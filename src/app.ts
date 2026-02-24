import { Hono } from 'hono';
import { stream } from 'hono/streaming';
// import { logger } from 'hono/logger';
import converts from './converts.ts';
import { Song } from './types.ts';
import * as gdrive from './gdrive.ts';

/**
 * Number of songs returned by `/list` per page
 */
const PAGE_SIZE = 30;

const app = new Hono();

// app.use(logger());

app.get('/adx/converts/list', (c) => {
	const sendSongs = (songs: Song[]) => {
		const page = c.req.query('page');
		if (!page)
			return c.json(songs);
		const pageNum = Number(page);
		if (isNaN(pageNum))
			return c.json({ message: 'page is not a number' }, 400);
		if (pageNum < 0)
			return c.json({ message: 'page is negative' }, 400);
		return c.json(songs.slice(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE));
	};

	const search = c.req.query('search')?.toLowerCase();

	if (!search)
		return sendSongs(converts);

	const filtered = converts.filter((song: Song) => {
		const haystack = [
			song.title,
			song.artist,
			song.designer,
			song.romanizedTitle,
			song.romanizedArtist,
			song.romanizedDesigner,
			song.communityNames,
			song.levels,
		]
			.filter(Boolean)
			.join()
			.toLowerCase();

		return haystack.includes(search);
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

		const gdriveUrl = gdrive.getFileUrl(item.id);

		if (c.req.query('proxy')) {
			console.log(`Proxying ${fileType}`);
			return stream(c, (stream) => fetch(gdriveUrl).then(r => stream.pipe(r.body!)));
		}

		return c.redirect(gdriveUrl);
	});

for (const fileType in fileType2Name)
	individualFileEndpoint(fileType as keyof typeof fileType2Name);

export default app;
