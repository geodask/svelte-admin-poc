import { test as base, type Page } from '@playwright/test';
import { BACKEND_URL } from '../backend/config.ts';

/**
 * Every e2e test imports `test` from here, not from `@playwright/test`. It resets the demo
 * backend to its seed data before each test, so tests never see each other's changes.
 */
export const test = base.extend<{ resetBackend: void }>({
	resetBackend: [
		async ({ request }, use) => {
			const response = await request.post(`${BACKEND_URL}/reset`);
			if (!response.ok())
				throw new Error(`Resetting the demo backend failed: ${response.status()}`);
			await use();
		},
		{ auto: true }
	]
});

export { expect } from '@playwright/test';

/**
 * Wait until the page is hydrated (the demo's root layout marks it), so a test that types with
 * JavaScript on doesn't type into server-rendered markup that hydration then replaces.
 */
export async function hydrated(page: Page) {
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
}
