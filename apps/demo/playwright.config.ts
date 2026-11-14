import { dirname } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { BACKEND_PORT } from './backend/config.ts';
import { SERVER_LOG } from './e2e/server-log.ts';

const port = 4173;

/** Tests that make the demo backend slow or fail. Its faults are global, so they run alone. */
const faultTests = /faults\.test\.ts$/;

export default defineConfig({
	testDir: 'e2e',
	forbidOnly: !!process.env.CI,
	reporter: process.env.CI ? [['github'], ['list']] : 'list',
	use: {
		baseURL: `http://localhost:${port}`,
		trace: 'off'
	},
	projects: [
		{
			name: 'js',
			testIgnore: faultTests,
			use: { ...devices['Desktop Chrome'] }
		},
		{
			// The admin promises to work without JavaScript, so every test also runs with it off.
			// Tests that need JavaScript are tagged `@js` and skipped here.
			name: 'no-js',
			testIgnore: faultTests,
			grepInvert: /@js/,
			use: { ...devices['Desktop Chrome'], javaScriptEnabled: false }
		},
		{
			// A fault injected into the demo backend is used by whichever request comes next, and
			// any test's reset clears it, so these tests run one at a time, after all the others.
			// They need JavaScript.
			name: 'backend-faults',
			testMatch: faultTests,
			dependencies: ['js', 'no-js'],
			workers: 1,
			use: { ...devices['Desktop Chrome'] }
		}
	],
	webServer: [
		{
			// The demo backend the app's REST Provider talks to. Tests reset it before each test.
			command: 'bun backend/server.ts',
			port: BACKEND_PORT,
			reuseExistingServer: !process.env.CI
		},
		{
			// A production build served by adapter-node, not the dev server. CI builds in an
			// earlier step (to check the client bundle) and sets SKIP_BUILD, so it isn't built twice.
			// Its output is also copied to SERVER_LOG, so a test can check what the server logged.
			command: `${process.env.SKIP_BUILD ? '' : 'bun run build && '}mkdir -p ${dirname(SERVER_LOG)} && bun run start 2>&1 | tee ${SERVER_LOG}`,
			port,
			env: { PORT: String(port) },
			reuseExistingServer: !process.env.CI
		}
	]
});
