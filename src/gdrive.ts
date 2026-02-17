import * as cheerio from 'cheerio';

interface FolderItem {
	id: string;
	name: string;
	type: 'file' | 'folder';
	lastModified: string;
}

const THIRTY_MINUTES_MS = 1.8e6;
const folderItemCache: Record<string, FolderItem[]> = Object.create(null);

export const getFileUrl = (id: string) => `https://drive.usercontent.google.com/download?id=${id}`;

export const fetchFolderItems = async (id: string) => {
	if (id in folderItemCache)
		return folderItemCache[id];

	const folderItems = await fetchEmbeddedFolderView(id).then(parseEmbeddedFolderView);

	setTimeout(() => delete folderItemCache[id], THIRTY_MINUTES_MS);
	return folderItemCache[id] = folderItems;
}

export const fetchEmbeddedFolderView = async (id: string) => {
	const url = `https://drive.google.com/embeddedfolderview?id=${id}`;
	const resp = await fetch(url);
	if (!resp.ok)
		throw new Error(`${url} -> ${resp.status} ${resp.statusText}`);
	return await resp.text();
};

export const parseEmbeddedFolderView = (html: string) => {
	const $ = cheerio.load(html);
	const items: FolderItem[] = [];

	// Each folder item is contained within a "flip-entry" div
	$('.flip-entry').each((_, element) => {
		let { id } = element.attribs;

		if (!id.startsWith('entry-'))
			throw new Error(`malformed .flip-entry id: ${id}`);

		// get rid of 'entry-' at beginning
		id = id.slice(6);

		const linkElement = $(element).find('a').first();
		const titleElement = $(element).find('.flip-entry-title').first();

		const href = linkElement.attr('href');
		const name = titleElement.text().trim();

		if (!href)
			throw new Error(`href is undefined`);

		let type: 'file' | 'folder';
		const { pathname } = new URL(href);

		if (pathname.startsWith('/drive/folders'))
			type = 'folder';
		else if (pathname.startsWith('/file/d'))
			type = 'file';
		else
			throw new Error(`unrecognized pathname: ${pathname}`);

		// Extract last modified date
		const lastModifiedElement = $(element).find('.flip-entry-last-modified > div').first();
		const dateText = lastModifiedElement.text().trim();
		const lastModified = parseDateToISO(dateText);

		items.push({ id, name, type, lastModified });
	});

	return items;
};

const parseDateToISO = (dateText: string): string => {
	const currentYear = new Date().getFullYear();
	
	// Check if format is MM/DD/YY
	if (dateText.includes('/')) {
		const [month, day, year] = dateText.split('/');
		const fullYear = parseInt(year) + 2000; // Convert YY to YYYY
		const date = new Date(fullYear, parseInt(month) - 1, parseInt(day));
		return date.toISOString();
	}
	
	// Otherwise format is "MMM DD" (e.g., "Jan 27")
	const [monthStr, day] = dateText.split(' ');
	const monthMap: Record<string, number> = {
		'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
		'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
	};
	
	const month = monthMap[monthStr];
	if (month === undefined)
		throw new Error(`unrecognized month: ${monthStr}`);
	
	const date = new Date(currentYear, month, parseInt(day));
	return date.toISOString();
};
