import type { Page } from '@playwright/test';
import { expect, hydrated, test } from './fixtures.ts';
import { dataRows, selectedCount } from './list-helpers.ts';

// Posts set `recordTitle: 'title'`, the key form of the setting.

const breadcrumb = (page: Page) => page.getByRole('navigation', { name: 'breadcrumb' });
const firstPost = 'A beginner guide to weeknight dinners (part 1)';

test.describe("a post's Record title, from its `recordTitle` key", () => {
	test("is the detail View's heading and the breadcrumb's last crumb", async ({ page }) => {
		await page.goto('/admin/posts/1');

		await expect(page.getByRole('heading', { level: 1 })).toHaveText(firstPost);
		await expect(breadcrumb(page).getByRole('listitem')).toHaveText(['Posts', firstPost]);
	});

	test("is the list View's link to each post: the title cell, and no other", async ({ page }) => {
		await page.goto('/admin/posts');

		const row = dataRows(page).first();
		await expect(row.getByRole('link')).toHaveCount(1);
		await expect(row.getByRole('link')).toHaveText(firstPost);
		await expect(row.getByRole('link')).toHaveAttribute('href', '/admin/posts/1');

		await row.getByRole('link').click();

		await expect(page).toHaveURL('/admin/posts/1');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(firstPost);
	});

	test('labels the row checkboxes, "Select {title}" @js', async ({ page }) => {
		await page.goto('/admin/posts');
		await hydrated(page);

		await page.getByRole('checkbox', { name: `Select ${firstPost}` }).check();

		await expect(selectedCount(page)).toHaveText('1 selected');
		await expect(
			dataRows(page)
				.first()
				.getByRole('checkbox', { name: `Select ${firstPost}` })
		).toBeChecked();
	});
});
