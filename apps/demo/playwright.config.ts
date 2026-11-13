import { defineConfig, devices } from '@playwright/test';

const port = 4173;

export default defineConfig({
	testDir: 'e2e',
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
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
	webServer: {
		// A production build served by adapter-node, not the dev server.
		command: 'bun run build && node build',
		port,
		env: { PORT: String(port) },
		reuseExistingServer: !process.env.CI
	}
});
