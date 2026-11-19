// Helpers for the tests that fill and save a form: opening a View with a form, its inputs by
// their accessible names, filling the recipes create View, and the record the backend holds.
import type { APIRequestContext, Page } from '@playwright/test';
import { BACKEND_URL } from '../backend/config.ts';
import { hydrated, test } from './fixtures.ts';

/** The record the demo backend holds, read past the admin. */
export async function stored(request: APIRequestContext, resource: string, id: number) {
	return (await (await request.get(`${BACKEND_URL}/${resource}/${id}`)).json()) as Record<
		string,
		unknown
	>;
}

export const usesJavaScript = () => test.info().project.use.javaScriptEnabled !== false;

/** Open a View with a form, ready to type into: with JavaScript, once it is hydrated. */
export async function open(page: Page, path: string) {
	await page.goto(path);
	if (usesJavaScript()) await hydrated(page);
}

export const form = (page: Page) => page.locator('main form');
export const save = (page: Page) => page.getByRole('button', { name: 'Save' }).click();
export const textbox = (page: Page, name: string) =>
	form(page).getByRole('textbox', { name, exact: true }).first();
export const spinbutton = (page: Page, name: string) =>
	form(page).getByRole('spinbutton', { name, exact: true }).first();
export const group = (page: Page, name: string) =>
	form(page).getByRole('group', { name, exact: true });

/** Fill every input of the recipes create View. */
export async function fillRecipe(page: Page) {
	await textbox(page, 'Name').fill('Lemon Risotto');
	await textbox(page, 'Cuisine').fill('Italian');
	await form(page).getByRole('combobox', { name: 'Difficulty' }).selectOption('Medium');
	await spinbutton(page, 'Prep time (min)').fill('35');
	await spinbutton(page, 'Servings').fill('4');
	await textbox(page, 'Tags').fill('Rice\nVegetarian');
	await group(page, 'Ingredients 1').getByRole('textbox', { name: 'Name' }).fill('Arborio rice');
	await textbox(page, 'Published at (UTC)').fill('2024-05-01T12:00');
	await group(page, 'Nutrition').getByRole('spinbutton', { name: 'Protein grams' }).fill('8');
	await group(page, 'Nutrition').getByRole('spinbutton', { name: 'Carbs grams' }).fill('60');
	await textbox(page, 'Instructions').fill('Stir it slowly.');
}
