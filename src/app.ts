import { Hono } from 'hono';
import converts from './converts.ts';
import { ConvertSong } from './types.ts';
import * as gdrive from './gdrive.ts';

const app = new Hono();

app.get('/adx/converts/list', (c) => {
	const sendSongs = (songs: ConvertSong[]) => {
		const page = c.req.query('page');
		if (!page)
			return c.json(songs);
		const pageNum = Number(page);
		if (isNaN(pageNum))
			return c.json({ message: 'page is not a number' }, 400);
		if (pageNum < 0)
			return c.json({ message: 'page is negative' }, 400);
		return c.json(songs.slice(pageNum * 25, (pageNum + 1) * 25));
	};

	const trimmed = c.req.query('search')?.trim().toLowerCase();

	if (!trimmed)
		return sendSongs(converts);

	const terms = trimmed.split(/\s+/).filter(Boolean);

	const filtered = converts.filter((song) => {
		const haystack = [
			song.title,
			song.artist,
			song.romanizedTitle,
			song.romanizedArtist,
			song.zetarakuId,
			song.communityNames,
		]
			.filter(Boolean)
			.join(' ')
			.toLowerCase();

		return terms.every((term) => haystack.includes(term));
	});

	return sendSongs(filtered);
});

const fileType2Name = {
	track: 'track.mp3',
	chart: 'maidata.txt',
	image: 'bg.png/bg.jpg',
	video: 'pv.mp4',
};

const individualFileEndpoint = (fileType: keyof typeof fileType2Name) =>
	app.get(`/adx/converts/:id/${fileType}`, async (c) => {
		const id = c.req.param('id');

		// google drive file IDs are always 33 characters and start with '1'
		if (!id || id.length !== 33 || id[0] !== '1')
			return c.json({ message: 'id is missing or is malformed' }, 400);

		const gdriveFolderItems = await gdrive.fetchFolderItems(id);
		const desiredFileName = fileType2Name[fileType];
		const item = gdriveFolderItems.find(({ name }) => desiredFileName.includes(name));

		if (!item)
			return c.json({ message: `could not find a ${desiredFileName} file for this song` }, 404);

		return c.redirect(gdrive.getFileUrl(item.id));
	});

for (const fileType in fileType2Name)
	individualFileEndpoint(fileType as keyof typeof fileType2Name);

export default app;
