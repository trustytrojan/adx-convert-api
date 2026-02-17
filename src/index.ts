import process from 'node:process';
import app from './app.ts';

// deno-lint-ignore no-explicit-any
const exitHandler = (o: any) => {
	console.log(`[${exitHandler.name}] called with:`, o);
	if (o instanceof Error)
		process.exitCode = 1;
	process.exit();
};

process.on('uncaughtException', exitHandler);
process.on('SIGINT', exitHandler);
process.on('SIGTERM', exitHandler);

if (!process.argv[2])
	throw new Error('port required');

const port = Number.parseInt(process.argv[2]);

if ('Deno' in globalThis)
	Deno.serve({ port }, app.fetch);
else {
	const { serve } = await import('@hono/node-server');
	serve({ fetch: app.fetch, port });
}

console.log(`Server is running on http://localhost:${port}`);
