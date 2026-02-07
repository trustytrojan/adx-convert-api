import { Hono } from 'hono';
import { ExportJob, fetchFolderName } from './gdrive-folder-download.ts';
import songMapping from '../song-name-to-gdrive-folder-id.json' with { type: 'json' };
import process from 'node:process';
import fs from 'node:fs';

const app = new Hono();

// In-memory cache for storage URLs
let storageCache: NodeJS.Dict<string> = Object.create(null);

// Parse search query to handle quoted terms and whitespace-separated terms
const parseSearchQuery = (query: string) => {
	const terms: string[] = [];
	let remaining = query;

	// Extract quoted terms first
	const quotedPattern = /"([^"]+)"/g;
	let match: RegExpExecArray | null;

	while ((match = quotedPattern.exec(query)) !== null) {
		terms.push(match[1]);
		remaining = remaining.replace(match[0], ' ');
	}

	// Extract remaining whitespace-separated terms
	const plainTerms = remaining.trim().split(/\s+/).filter((t) => t.length > 0);
	terms.push(...plainTerms);

	return terms;
};

// Search through song names
app.get('/search', (c) => {
	const query = c.req.query('q') || c.req.query('query');

	if (!query)
		return c.json({ error: 'Missing query parameter (q or query)' }, 400);

	const terms = parseSearchQuery(query);

	if (terms.length === 0)
		return c.json({});

	const results: Record<string, string> = {};

	for (const songName in songMapping) {
		const lowerSongName = songName.toLowerCase();
		const inLowerSongName = lowerSongName.includes.bind(lowerSongName);

		// Check if all terms match
		const allMatch = terms.every(inLowerSongName);

		if (allMatch)
			results[songName] = (songMapping as Record<string, string>)[songName];
	}

	return c.json(results);
});

// Download endpoint with caching
app.get('/download/:folderId', async (c) => {
	const folderId = c.req.param('folderId');
	const force = c.req.query('force') !== undefined;

	// Check cache unless force is specified
	if (!force && folderId in storageCache)
		return c.redirect(storageCache[folderId]!);

	try {
		// Fetch folder name
		const folderName = await fetchFolderName(folderId);

		// Create export job
		const job = await ExportJob.create(folderId, folderName);

		// Wait for success with timeout
		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(() => reject(new Error('Export job timed out after 60 seconds')), 60_000);
		});

		await Promise.race([
			job.waitForSuccess((status, percentDone) => {
				console.log(`[${folderId}] ${status} ${percentDone ? `(${percentDone}%)` : ''}`);
			}),
			timeoutPromise,
		]);

		// Get the storage path
		if (!job.archives || job.archives.length === 0)
			return c.json({ error: 'No archives generated' }, 500);

		const storageUrl = job.archives[0].storagePath;

		// Cache the result
		storageCache[folderId] = storageUrl;

		return c.redirect(storageUrl);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return c.json({ error: message }, 500);
	}
});

// Health check endpoint
app.get('/', (c) => {
	return c.json({
		status: 'ok',
		endpoints: {
			search: '/search?q=<query>',
			download: '/download/<folderId>?force=1',
		},
	});
});

const storageCacheFile = 'storage-url-cache.json';

// deno-lint-ignore no-explicit-any
const saveCacheAndExit = (o: any) => {
	fs.writeFileSync(storageCacheFile, JSON.stringify(storageCache, null, '\t'));
	if (o instanceof Error) {
		console.error(o);
		process.exit(1);
	}
	process.exit();
};

process.on('uncaughtException', saveCacheAndExit);
process.on('SIGINT', saveCacheAndExit);
process.on('SIGTERM', saveCacheAndExit);

if (fs.existsSync(storageCacheFile))
	storageCache = JSON.parse(fs.readFileSync(storageCacheFile).toString());

const port = 3000;

if ('Deno' in globalThis)
	Deno.serve({ port }, app.fetch);
else {
	const { serve } = await import('@hono/node-server');
	serve({ fetch: app.fetch, port });
}

console.log(`Server is running on http://localhost:${port}`);
