import { defineConfig, devices } from '@playwright/test';
import { BACKEND_PORT } from './backend/config.ts';

const port = 4173;

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
			use: { ...devices['Desktop Chrome'] }
		},
		{
			// The admin promises to work without JavaScript, so every test also runs with it off.
			// Tests that need JavaScript are tagged `@js` and skipped here.
			name: 'no-js',
			grepInvert: /@js/,
			use: { ...devices['Desktop Chrome'], javaScriptEnabled: false }
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
			command: process.env.SKIP_BUILD ? 'bun run start' : 'bun run build && bun run start',
			port,
			env: { PORT: String(port) },
			reuseExistingServer: !process.env.CI
		}
	]
});
