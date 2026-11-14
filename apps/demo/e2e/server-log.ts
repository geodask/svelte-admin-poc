import { readFile } from 'node:fs/promises';

/**
 * Where the demo app's server output goes during an e2e run (relative to `apps/demo`), so a
 * test can check what the server logged. Playwright starts the server with its output copied
 * here; a server started by hand and reused has no log here.
 */
export const SERVER_LOG = 'test-logs/server.log';

/** Everything the demo app's server has written so far. */
export async function serverLog(): Promise<string> {
	try {
		return await readFile(SERVER_LOG, 'utf8');
	} catch {
		throw new Error(
			`No server log at apps/demo/${SERVER_LOG}: let Playwright start the demo app instead of reusing one`
		);
	}
}
