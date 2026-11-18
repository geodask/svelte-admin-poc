import { dirname } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { BACKEND_PORT } from './backend/config.ts';
import { SERVER_LOG } from './e2e/server-log.ts';

const port = 4173;

/** Tests that make the demo backend slow or fail. Its faults are global, so they run alone. */
const faultTests = /faults\.test\.ts$/;

/**
 * Tests that write to the demo backend. A write is seen by every test that reads the same list
 * (a new user is on the users list), and each test's reset undoes it, so they run one at a time,
 * after the read-only tests and before the fault tests. Nothing runs beside them, so they may
 * inject backend faults too.
 */
const writeTests = /\/writes\//;

/**
 * Tests that count every request the demo backend gets for a page (such as the one `getMany` a
 * page of References makes). Other tests' requests would be counted too, so they run one at a
 * time with the write tests, though they write nothing.
 */
const requestCountTests = /\/request-count\//;

/** The tests the `writes-*` projects run one at a time, after the read-only tests. */
const writeAndRequestCountTests = [writeTests, requestCountTests];

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
			testIgnore: [faultTests, ...writeAndRequestCountTests],
			use: { ...devices['Desktop Chrome'] }
		},
		{
			// The admin promises to work without JavaScript, so every test also runs with it off.
			// Tests that need JavaScript are tagged `@js` and skipped here.
			name: 'no-js',
			testIgnore: [faultTests, ...writeAndRequestCountTests],
			grepInvert: /@js/,
			use: { ...devices['Desktop Chrome'], javaScriptEnabled: false }
		},
		{
			// Writes and request counts, with JavaScript on and then off, one test at a time.
			name: 'writes-js',
			testMatch: writeAndRequestCountTests,
			dependencies: ['js', 'no-js'],
			workers: 1,
			use: { ...devices['Desktop Chrome'] }
		},
		{
			name: 'writes-no-js',
			testMatch: writeAndRequestCountTests,
			dependencies: ['writes-js'],
			workers: 1,
			grepInvert: /@js/,
			use: { ...devices['Desktop Chrome'], javaScriptEnabled: false }
		},
		{
			// A fault injected into the demo backend is used by whichever request comes next, and
			// any test's reset clears it, so these tests run one at a time, after all the others.
			// They need JavaScript.
			name: 'backend-faults',
			testMatch: faultTests,
			dependencies: ['writes-no-js'],
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
			// adapter-node checks a form post's origin against ORIGIN (Kit's CSRF protection).
			env: { PORT: String(port), ORIGIN: `http://localhost:${port}` },
			reuseExistingServer: !process.env.CI
		}
	]
});
