import fs from 'node:fs';
import { ConvertSong } from './types.ts';

const convertsJsonFile = 'converts.json';

if (!fs.existsSync(convertsJsonFile)) {
	const url = 'https://github.com/trustytrojan/adx-convert-db/raw/refs/heads/main/songs.json';
	const resp = await fetch(url);
	if (!resp.ok)
		throw new Error(`${url} -> ${resp.status} ${resp.statusText}`);
	fs.writeFileSync(convertsJsonFile, await resp.text());
}

export default JSON.parse(fs.readFileSync(convertsJsonFile).toString()) as ConvertSong[];
