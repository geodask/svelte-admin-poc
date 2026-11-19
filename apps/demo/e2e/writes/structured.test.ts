// Lists, rows and groups on the edit View: posts' tags (one input per tag), and recipes' tags
// (one per line), ingredients (one fieldset per ingredient) and nutrition (a group). These tests
// write to the demo backend, so they run one at a time, after the read-only tests (see
// playwright.config.ts), and with JavaScript on and off.
import type { APIRequestContext, Page } from '@playwright/test';
import { BACKEND_URL } from '../../backend/config.ts';
import { expect, hydrated, test } from '../fixtures.ts';
import { valueOf } from '../list-helpers.ts';

/** The record the demo backend holds, read past the admin. */
async function stored(request: APIRequestContext, resource: string, id: number) {
	return (await (await request.get(`${BACKEND_URL}/${resource}/${id}`)).json()) as Record<
		string,
		unknown
	>;
}

/** The `PUT` requests for a Resource the demo backend has received so far. */
async function updates(request: APIRequestContext, resource: string) {
	const log = (await (await request.get(`${BACKEND_URL}/requests`)).json()) as string[];
	return log.filter((line) => line.startsWith(`PUT /${resource}/`));
}

const usesJavaScript = () => test.info().project.use.javaScriptEnabled !== false;

/** Open a record's edit View, ready to type into: with JavaScript, once it is hydrated. */
async function openEditView(page: Page, resource: string, id: number) {
	await page.goto(`/admin/${resource}/${id}/edit`);
	if (usesJavaScript()) await hydrated(page);
}

const save = (page: Page) => page.getByRole('button', { name: 'Save' }).click();

/** A list's or a group's fieldset, by its label. */
const group = (page: Page, name: string) => page.getByRole('group', { name, exact: true });
/** The input of one item of a list, e.g. "Tags 3", the blank row of a list of two. */
const item = (page: Page, name: string) => page.getByRole('textbox', { name, exact: true });

test.describe("a post's tags, one input per tag", () => {
	test('show one input per tag, then one blank row', async ({ page }) => {
		await openEditView(page, 'posts', 1);

		const inputs = group(page, 'Tags').getByRole('textbox');
		await expect(inputs).toHaveCount(3);
		await expect(item(page, 'Tags 1')).toHaveValue('Weeknight dinners');
		await expect(item(page, 'Tags 2')).toHaveValue('Guide');
		await expect(item(page, 'Tags 3')).toHaveValue('');
	});

	test('typing into the blank row and saving adds a tag', async ({ page, request }) => {
		await openEditView(page, 'posts', 1);

		await item(page, 'Tags 3').fill('Quick');
		await save(page);

		await expect(page).toHaveURL('/admin/posts/1');
		await expect(valueOf(page, 'Tags')).toHaveText('Weeknight dinners, Guide, Quick');
		expect(await stored(request, 'posts', 1)).toMatchObject({
			tags: ['Weeknight dinners', 'Guide', 'Quick']
		});
	});

	test("clearing a tag's input and saving removes it", async ({ page, request }) => {
		await openEditView(page, 'posts', 1);

		await item(page, 'Tags 1').fill('');
		await save(page);

		await expect(page).toHaveURL('/admin/posts/1');
		await expect(valueOf(page, 'Tags')).toHaveText('Guide');
		expect(await stored(request, 'posts', 1)).toMatchObject({ tags: ['Guide'] });
	});

	test('× removes a tag in place, and saving keeps it removed @js', async ({ page, request }) => {
		await openEditView(page, 'posts', 1);

		await page.getByRole('button', { name: 'Remove Tags 1' }).click();

		await expect(page).toHaveURL('/admin/posts/1/edit');
		await expect(group(page, 'Tags').getByRole('textbox')).toHaveCount(2);
		await expect(item(page, 'Tags 1')).toHaveValue('Guide');
		await expect(item(page, 'Tags 2')).toHaveValue('');
		// The blank row has nothing to remove.
		await expect(page.getByRole('button', { name: /^Remove Tags/ })).toHaveCount(1);

		await save(page);

		await expect(page).toHaveURL('/admin/posts/1');
		expect(await stored(request, 'posts', 1)).toMatchObject({ tags: ['Guide'] });
	});

	test('show no × without JavaScript, where it could not work', async ({ page }) => {
		test.skip(usesJavaScript(), 'Only without JavaScript');
		await openEditView(page, 'posts', 1);

		await expect(item(page, 'Tags 1')).toHaveValue('Weeknight dinners');
		await expect(page.getByRole('button', { name: /^Remove/ })).toHaveCount(0);
	});
});

test.describe("a recipe's ingredients, one fieldset per ingredient", () => {
	/** One ingredient's input, e.g. the name of "Ingredients 2". */
	const ingredient = (page: Page, row: number, name: 'Name' | 'Quantity') =>
		group(page, `Ingredients ${row}`).getByRole('textbox', { name, exact: true });

	test('show one fieldset per ingredient, then one blank row', async ({ page }) => {
		await openEditView(page, 'recipes', 2);

		await expect(group(page, 'Ingredients').getByRole('group')).toHaveCount(4);
		await expect(ingredient(page, 1, 'Name')).toHaveValue('Mixed vegetables');
		await expect(ingredient(page, 1, 'Quantity')).toHaveValue('400 g');
		await expect(ingredient(page, 3, 'Name')).toHaveValue('Garlic');
		await expect(ingredient(page, 3, 'Quantity')).toHaveValue('');
		await expect(ingredient(page, 4, 'Name')).toHaveValue('');
	});

	test('removing every ingredient and saving shows the rule on the ingredients', async ({
		page,
		request
	}) => {
		const before = (await updates(request, 'recipes')).length;
		await openEditView(page, 'recipes', 2);

		// Cleared from the last row up: with JavaScript, a last row once cleared is the blank row,
		// and the blank row after it goes.
		for (const row of [3, 2, 1]) {
			await ingredient(page, row, 'Name').fill('');
			await ingredient(page, row, 'Quantity').fill('');
		}
		await save(page);

		await expect(group(page, 'Ingredients')).toHaveAccessibleDescription(
			'Add at least one ingredient'
		);
		await expect(page).toHaveURL(/\/admin\/recipes\/2\/edit(\?|$)/);
		expect(await updates(request, 'recipes')).toHaveLength(before);
	});

	test('a row with a quantity but no name shows "Required" under that name', async ({
		page,
		request
	}) => {
		const before = (await updates(request, 'recipes')).length;
		await openEditView(page, 'recipes', 2);

		// The first row is cleared, so the issue must still find the second row, not the first.
		await ingredient(page, 1, 'Name').fill('');
		await ingredient(page, 1, 'Quantity').fill('');
		await ingredient(page, 2, 'Name').fill('');
		await save(page);

		await expect(ingredient(page, 2, 'Name')).toHaveAccessibleDescription('Required');
		await expect(ingredient(page, 2, 'Quantity')).toHaveValue('2 tbsp');
		await expect(ingredient(page, 1, 'Name')).not.toHaveAccessibleDescription('Required');
		await expect(group(page, 'Ingredients')).not.toHaveAccessibleDescription(/./);
		expect(await updates(request, 'recipes')).toHaveLength(before);
	});

	test('a changed and an added ingredient save', async ({ page, request }) => {
		await openEditView(page, 'recipes', 2);

		await ingredient(page, 3, 'Quantity').fill('3 cloves');
		await ingredient(page, 4, 'Name').fill('Ginger');
		await save(page);

		await expect(page).toHaveURL('/admin/recipes/2');
		expect(await stored(request, 'recipes', 2)).toMatchObject({
			ingredients: [
				{ name: 'Mixed vegetables', quantity: '400 g' },
				{ name: 'Soy sauce', quantity: '2 tbsp' },
				{ name: 'Garlic', quantity: '3 cloves' },
				{ name: 'Ginger' }
			]
		});
	});
});

test.describe("a recipe's tags, one per line", () => {
	const tags = (page: Page) => page.getByRole('textbox', { name: 'Tags', exact: true });

	test('show one tag per line', async ({ page }) => {
		await openEditView(page, 'recipes', 1);

		await expect(tags(page)).toHaveValue('Pizza\nVegetarian');
		await expect(tags(page)).toHaveAccessibleDescription('One per line.');
	});

	test('save as separate tags, without the blank lines', async ({ page, request }) => {
		await openEditView(page, 'recipes', 1);

		await tags(page).fill('Pizza\n\n  Quick  \nVegetarian\n\n');
		await save(page);

		await expect(page).toHaveURL('/admin/recipes/1');
		await expect(valueOf(page, 'Tags').getByRole('listitem')).toHaveText([
			'Pizza',
			'Quick',
			'Vegetarian'
		]);
		expect(await stored(request, 'recipes', 1)).toMatchObject({
			tags: ['Pizza', 'Quick', 'Vegetarian']
		});
	});
});

test.describe("a recipe's nutrition, a group", () => {
	const number = (page: Page, name: string) =>
		group(page, 'Nutrition').getByRole('spinbutton', { name, exact: true });

	test('is prefilled, and editing one of its numbers saves', async ({ page, request }) => {
		await openEditView(page, 'recipes', 1);
		await expect(number(page, 'Protein grams')).toHaveValue('10');
		await expect(number(page, 'Carbs grams')).toHaveValue('40');

		await number(page, 'Carbs grams').fill('55');
		await save(page);

		await expect(page).toHaveURL('/admin/recipes/1');
		await expect(valueOf(page, 'Carbs grams')).toHaveText('55');
		expect(await stored(request, 'recipes', 1)).toMatchObject({
			nutrition: { proteinGrams: 10, carbsGrams: 55 },
			// The Fields the form can't edit are kept as they were.
			sourceId: 'dj-1',
			reviewCount: 1250
		});
	});
});

test.describe("a recipe's instructions, a textarea", () => {
	test('keep their line breaks', async ({ page, request }) => {
		await openEditView(page, 'recipes', 1);
		const instructions = page.getByRole('textbox', { name: 'Instructions', exact: true });
		await expect(instructions).toHaveValue(
			'Prepare the ingredients for Classic Margherita Pizza.\nCook, then serve.'
		);

		await instructions.fill('Stretch the dough.\nBake it hot.');
		await save(page);

		await expect(page).toHaveURL('/admin/recipes/1');
		expect(await stored(request, 'recipes', 1)).toMatchObject({
			instructions: 'Stretch the dough.\nBake it hot.'
		});
	});
});
