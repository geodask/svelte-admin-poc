// The inputs of the Theme's own Kinds, and an image URL that isn't safe to load. These tests write
// to the demo backend, so they run one at a time, after the read-only tests (see
// playwright.config.ts), and with JavaScript on and off.
import { expect, test } from '../fixtures.ts';
import { columnCells, valueOf } from '../list-helpers.ts';
import { form, open, save, stored, textbox } from '../form-helpers.ts';

test.describe("recipes' instructions, the Theme's textarea Kind", () => {
	test('are edited in a textarea, with its help text', async ({ page }) => {
		await open(page, '/admin/recipes/1/edit');

		const instructions = textbox(page, 'Instructions');
		await expect(instructions).toHaveJSProperty('tagName', 'TEXTAREA');
		await expect(instructions).toHaveValue(
			'Prepare the ingredients for Classic Margherita Pizza.\nCook, then serve.'
		);
		await expect(instructions).toHaveAccessibleDescription('How to cook it');
	});
});

test.describe("posts' body, a textarea through the core's input metadata", () => {
	test('is a textarea on the create and edit Views', async ({ page }) => {
		await open(page, '/admin/posts/new');
		await expect(textbox(page, 'Body')).toHaveJSProperty('tagName', 'TEXTAREA');

		await open(page, '/admin/posts/1/edit');
		await expect(textbox(page, 'Body')).toHaveJSProperty('tagName', 'TEXTAREA');
		await expect(textbox(page, 'Body')).not.toHaveValue('');
	});
});

test.describe("recipes' image, the Theme's image Kind", () => {
	test('is edited in a URL input', async ({ page }) => {
		await open(page, '/admin/recipes/1/edit');

		await expect(textbox(page, 'Image')).toHaveAttribute('type', 'url');
		await expect(textbox(page, 'Image')).toHaveValue('/images/recipes/pizza.svg');
	});

	test('saves a URL that is not safe, and shows it as text, never as an image', async ({
		page,
		request
	}) => {
		await open(page, '/admin/recipes/1/edit');

		await textbox(page, 'Image').fill('javascript:alert(1)');
		await save(page);

		await expect(page).toHaveURL('/admin/recipes/1');
		expect(await stored(request, 'recipes', 1)).toMatchObject({ imageUrl: 'javascript:alert(1)' });
		await expect(valueOf(page, 'Image')).toHaveText('javascript:alert(1)');
		await expect(valueOf(page, 'Image').locator('img')).toHaveCount(0);

		await page.goto('/admin/recipes');
		const image = (await columnCells(page, 'Image')).nth(0);
		await expect(image).toHaveText('javascript:alert(1)');
		await expect(image.locator('img')).toHaveCount(0);
		await expect(page.locator('main img[src^="javascript:"]')).toHaveCount(0);
	});

	test('removes the image when its URL is cleared', async ({ page, request }) => {
		await open(page, '/admin/recipes/1/edit');

		await textbox(page, 'Image').fill('');
		await save(page);

		await expect(page).toHaveURL('/admin/recipes/1');
		expect(await stored(request, 'recipes', 1)).not.toHaveProperty('imageUrl');
		await expect(valueOf(page, 'Image')).toHaveText('—');
		await expect(form(page)).toHaveCount(0);
	});
});
