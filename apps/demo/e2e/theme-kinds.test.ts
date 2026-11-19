// The Theme's own Kinds, which recipes name without registering anything: `textarea` for the
// instructions, `badges` for the tags and `image` for the image. Read-only, with JavaScript on
// and off.
import { expect, test } from './fixtures.ts';
import { columnCells, valueOf } from './list-helpers.ts';

test.describe("recipes' instructions, the Theme's textarea Kind", () => {
	test('show their line breaks on the detail View', async ({ page }) => {
		await page.goto('/admin/recipes/2');

		const instructions = valueOf(page, 'Instructions');
		await expect(instructions).toHaveText(
			'Prepare the ingredients for Vegetarian Stir-Fry.\nCook, then serve.'
		);
		// Rendered on two lines, not run together on one.
		expect(await instructions.innerText()).toBe(
			'Prepare the ingredients for Vegetarian Stir-Fry.\nCook, then serve.'
		);
	});

	test('show on one line in the list View, cut, with the full text in its title', async ({
		page
	}) => {
		await page.goto('/admin/recipes');

		const text = (await columnCells(page, 'Instructions')).nth(1).locator('[title]');
		await expect(text).toHaveAttribute(
			'title',
			'Prepare the ingredients for Vegetarian Stir-Fry.\nCook, then serve.'
		);
		expect(await text.innerText()).not.toContain('\n');
		await expect(text).toHaveCSS('white-space', 'nowrap');
		await expect(text).toHaveCSS('text-overflow', 'ellipsis');
	});
});

test.describe("recipes' tags, the Theme's badges Kind", () => {
	test('show as badges in the list View, cut to three and "+N"', async ({ page }) => {
		await page.goto('/admin/recipes');
		const tags = await columnCells(page, 'Tags');

		await expect(tags.nth(0).getByRole('listitem')).toHaveText(['Pizza', 'Vegetarian']);
		await expect(tags.nth(0)).not.toContainText('+');
		// The second recipe has five tags: three badges, then "+2".
		await expect(tags.nth(1).getByRole('listitem')).toHaveText(['Vegetarian', 'Quick', 'Vegan']);
		await expect(tags.nth(1)).toContainText('+2');
		await expect(tags.nth(1).locator('[title]')).toHaveAttribute(
			'title',
			'Vegetarian, Quick, Vegan, Healthy, Weeknight'
		);
	});

	test('show every badge on the detail View', async ({ page }) => {
		await page.goto('/admin/recipes/2');

		await expect(valueOf(page, 'Tags').getByRole('listitem')).toHaveText([
			'Vegetarian',
			'Quick',
			'Vegan',
			'Healthy',
			'Weeknight'
		]);
		await expect(valueOf(page, 'Tags')).not.toContainText('+');
	});
});

test.describe("recipes' image, the Theme's image Kind", () => {
	test('shows as a small thumbnail in the list View', async ({ page }) => {
		const response = await page.goto('/admin/recipes');

		// Rendered on the server.
		expect(await response?.text()).toContain('/images/recipes/pizza.svg');
		const images = await columnCells(page, 'Image');
		const thumbnail = images.nth(0).getByRole('img', { name: 'Image' });
		// Loaded lazily, so only once it is near the viewport.
		await thumbnail.scrollIntoViewIfNeeded();
		await expect(thumbnail).toHaveAttribute('src', '/images/recipes/pizza.svg');
		await expect(thumbnail).toHaveAttribute('loading', 'lazy');
		await expect(thumbnail).toHaveJSProperty('naturalWidth', 120);
		const box = await thumbnail.boundingBox();
		expect([box?.width, box?.height]).toEqual([40, 40]);
		// A recipe with no image has an empty cell.
		await expect(images.nth(3)).toHaveText('');
		await expect(images.nth(3).getByRole('img')).toHaveCount(0);
	});

	test('shows larger on the detail View', async ({ page }) => {
		await page.goto('/admin/recipes/2');

		const image = valueOf(page, 'Image').getByRole('img', { name: 'Image' });
		await image.scrollIntoViewIfNeeded();
		await expect(image).toHaveAttribute('src', '/images/recipes/stir-fry.svg');
		await expect(image).toHaveAttribute('loading', 'lazy');
		await expect(image).toHaveJSProperty('naturalWidth', 120);
		expect((await image.boundingBox())?.width).toBeGreaterThan(40);

		await page.goto('/admin/recipes/4');
		await expect(valueOf(page, 'Image')).toHaveText('—');
	});
});
