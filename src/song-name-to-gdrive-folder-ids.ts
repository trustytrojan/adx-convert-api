import { drive as gdrive } from '@googleapis/drive';
import process from 'node:process';
import fs from 'node:fs';
(await import('dotenv')).config();

const drive = gdrive({ version: 'v3', auth: process.env.GOOGLE_API_KEY });

// the root "maisquared" folder. this contains subfolders named "(version number). (version name)"
// so before we start the api, query and store all the subfolder ids from google drive
const rootFolderId = '1NiZ9rL19qKLqt0uNcP5tIqc0fUrksAPs';

const { data: { files: maimaiVersionFolders } } = await drive.files.list({
	q: `'${rootFolderId}' in parents and trashed = false`,
	fields: 'files(id, name)',
});

if (!maimaiVersionFolders)
	throw new TypeError('files is undefined');

console.log(`Fetched ${maimaiVersionFolders.length} maimai version folders`);

const songNameToGdriveFolderIdMap: Record<string, string> = {};

for (const maimaiVersionFolder of maimaiVersionFolders) {
	if (!maimaiVersionFolder.id || !maimaiVersionFolder.name)
		throw new TypeError('maimaiVersionFolder id/name is undefined');

	console.log(`Listing maimai version folder '${maimaiVersionFolder.name}'`);

	const { data: { files: maimaiVersionSongFolders } } = await drive.files.list({
		q: `'${maimaiVersionFolder.id}' in parents and trashed = false`,
		fields: 'files(id, name)',
	});

	if (!maimaiVersionSongFolders)
		throw new TypeError('maimaiVersionSongFolders is undefined');

	console.log(
		`Fetched maimai version folder list '${maimaiVersionFolder.name}', contains ${maimaiVersionSongFolders.length} song folders`,
	);

	for (const { name, id } of maimaiVersionSongFolders) {
		if (!name || !id)
			throw new TypeError('file name/id is undefined');

		songNameToGdriveFolderIdMap[name] = id;
	}
}

fs.writeFileSync('song-name-to-gdrive-folder-id.json', JSON.stringify(songNameToGdriveFolderIdMap, null, '\t'));
