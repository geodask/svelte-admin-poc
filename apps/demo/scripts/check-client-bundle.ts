// Fails when server-only code reached the demo's client build. Run it after `bun run build`.
// SvelteKit's own client/server guard has a known gap (PER-9), so this grep is the real check.
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BACKEND_URL } from '../backend/config.ts';

const clientDir = new URL('../build/client', import.meta.url).pathname;

const markers = [
	{ what: 'the demo backend URL', text: new URL(BACKEND_URL).host },
	{ what: 'the bundled REST Provider', text: 'REST Provider' },
	// An error code from the `$app/server` remote-function runtime that survives minification.
	{ what: 'the $app/server runtime', text: 'remote_query_prerender' }
];

if (!existsSync(clientDir)) {
	console.error(`No client build at ${clientDir}. Run \`bun run build\` first.`);
	process.exit(1);
}

const files = (await readdir(clientDir, { recursive: true, withFileTypes: true }))
	.filter((entry) => entry.isFile())
	.map((entry) => join(entry.parentPath, entry.name));

const leaks: string[] = [];
for (const file of files) {
	const content = await readFile(file, 'utf8');
	for (const { what, text } of markers) {
		if (content.includes(text)) leaks.push(`${what} ("${text}") in ${file}`);
	}
}

if (leaks.length > 0) {
	console.error(
		`Server-only code reached the client build:\n${leaks.map((l) => `  - ${l}`).join('\n')}`
	);
	process.exit(1);
}

console.log(`Client build is clean: ${files.length} files, no server-only markers.`);
