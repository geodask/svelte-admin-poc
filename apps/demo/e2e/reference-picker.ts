// Driving the Theme's Reference picker the way a person does: a plain select without JavaScript, a
// searchable combobox with it. Both are a combobox to assistive technology, named by the Field's
// label.
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';

/** Whether the test runs with JavaScript on. */
export const usesJavaScript = () => test.info().project.use.javaScriptEnabled !== false;

/** A Reference's picker, by its Field's label: the select, or once hydrated the combobox. */
export const picker = (scope: Page | Locator, label: string) =>
	scope.getByRole('combobox', { name: label, exact: true });

/** The records a combobox's open listbox offers, by its Field's label. */
export const matches = (page: Page, label: string) =>
	page.getByRole('listbox', { name: label, exact: true }).getByRole('option');

/** One record of a combobox's open listbox, by its Field's label and the record's title. */
const match = (page: Page, label: string, title: string) =>
	page
		.getByRole('listbox', { name: label, exact: true })
		.getByRole('option', { name: title, exact: true });

/**
 * Choose the record titled `title` in a Reference's picker. Without JavaScript, pick its option in
 * the select. With it, type `typed` (part of the title), wait for the record among the matches,
 * move to it with the arrow keys and press Enter.
 */
export async function choose(page: Page, label: string, title: string, typed = title) {
	const box = picker(page, label);
	if (!usesJavaScript()) {
		await box.selectOption({ label: title });
		return;
	}
	await box.fill(typed);
	const option = match(page, label, title);
	await expect(option).toBeVisible();
	// The arrow keys move through the matches; at most as many presses as there are matches.
	const count = await matches(page, label).count();
	for (let press = 0; press < count; press++) {
		if ((await option.getAttribute('aria-selected')) === 'true') break;
		await box.press('ArrowDown');
	}
	await expect(option).toHaveAttribute('aria-selected', 'true');
	await box.press('Enter');
	await expect(box).toHaveValue(title);
}

/** Clear a Reference's picker: the select's empty choice, or the combobox's text. */
export async function clear(page: Page, label: string) {
	const box = picker(page, label);
	if (usesJavaScript()) await box.fill('');
	else await box.selectOption('');
}
