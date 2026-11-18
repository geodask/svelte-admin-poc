import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineResource, field } from '@svelte-admin/core';
import { toCsv } from '@svelte-admin/core/export';

const BOM = '\uFEFF';

/** The CSV's lines without the byte order mark and the final CRLF. */
const lines = (csv: string) => csv.slice(BOM.length).replace(/\r\n$/, '').split('\r\n');

const notes = defineResource({
	name: 'notes',
	label: 'Notes',
	schema: z.object({ id: z.number(), text: z.string() })
});

describe('the CSV writer', () => {
	it('starts with a UTF-8 byte order mark and ends every row with CRLF', () => {
		const csv = toCsv(notes, [
			{ id: 1, text: 'Crème brûlée' },
			{ id: 2, text: 'Ramen' }
		]);

		expect(csv.startsWith(BOM)).toBe(true);
		expect(csv.slice(BOM.length)).toBe('"ID","Text"\r\n"1","Crème brûlée"\r\n"2","Ramen"\r\n');
	});

	it('writes only the header row for no records', () => {
		expect(toCsv(notes, [])).toBe(`${BOM}"ID","Text"\r\n`);
	});

	it('quotes every cell and doubles the quotes inside one, keeping commas and line breaks', () => {
		const csv = toCsv(notes, [{ id: 1, text: 'Say "cheese",\nthen smile' }]);

		expect(csv).toBe(`${BOM}"ID","Text"\r\n"1","Say ""cheese"",\nthen smile"\r\n`);
	});

	it('has one column per Field that isn’t hidden, in schema order, headed by its label', () => {
		const recipes = defineResource({
			name: 'recipes',
			label: 'Recipes',
			schema: z.object({
				id: z.number(),
				name: z.string(),
				internalNotes: field(z.string(), { hidden: true }),
				prepTimeMinutes: field(z.number(), { label: 'Prep time (min)' }),
				// Not in the list View, but on the detail View, so in the export.
				instructions: field(z.string(), { list: false })
			})
		});

		const csv = toCsv(recipes, [
			{ id: 1, name: 'Pizza', internalNotes: 'secret', prepTimeMinutes: 20, instructions: 'Bake' }
		]);

		expect(lines(csv)).toEqual([
			'"ID","Name","Prep time (min)","Instructions"',
			'"1","Pizza","20","Bake"'
		]);
	});

	it('writes each kind of value', () => {
		const everything = defineResource({
			name: 'everything',
			label: 'Everything',
			schema: z.object({
				id: z.number(),
				text: z.string(),
				number: z.number(),
				decimal: z.number(),
				yes: z.boolean(),
				no: z.boolean(),
				isoDate: z.iso.date(),
				isoDatetime: z.iso.datetime(),
				date: z.date(),
				tags: z.array(z.string()),
				scores: z.array(z.number()),
				nutrition: z.object({ proteinGrams: z.number() }),
				ingredients: z.array(z.object({ name: z.string(), quantity: z.string().optional() })),
				level: z.enum(['Easy', 'Hard']),
				missing: z.string().optional(),
				nothing: z.string().nullable()
			})
		});

		const csv = toCsv(everything, [
			{
				id: 7,
				text: 'Pad Thai',
				number: 1250,
				decimal: 45.5,
				yes: true,
				no: false,
				isoDate: '2024-03-01',
				isoDatetime: '2024-03-01T23:30:00.000Z',
				date: new Date(Date.UTC(2024, 2, 1, 12)),
				tags: ['Thai', 'Noodles'],
				scores: [3, 4.5],
				nutrition: { proteinGrams: 12 },
				ingredients: [{ name: 'Rice noodles', quantity: '200 g' }, { name: 'Lime' }],
				level: 'Easy',
				nothing: null
			}
		]);

		expect(lines(csv)[1]).toBe(
			[
				'"7"',
				'"Pad Thai"',
				'"1250"',
				'"45.5"',
				'"true"',
				'"false"',
				'"2024-03-01"',
				'"2024-03-01T23:30:00.000Z"',
				'"2024-03-01T12:00:00.000Z"',
				'"Thai, Noodles"',
				'"3, 4.5"',
				'"{""proteinGrams"":12}"',
				'"[{""name"":""Rice noodles"",""quantity"":""200 g""},{""name"":""Lime""}]"',
				'"Easy"',
				'""',
				'""'
			].join(',')
		);
	});

	describe('the formula guard', () => {
		it.each(['=SUM(A1:A2)', '+1', '-1+2', '@cmd', '\tTabbed', '\rReturned'])(
			'prefixes a text cell starting %j with an apostrophe',
			(text) => {
				const csv = toCsv(notes, [{ id: 1, text }]);

				expect(lines(csv)[1]).toBe(`"1","'${text}"`);
			}
		);

		it('leaves other text alone, including those characters further in', () => {
			const csv = toCsv(notes, [{ id: 1, text: 'a=b, c+d, e-f, me@example.com' }]);

			expect(lines(csv)[1]).toBe('"1","a=b, c+d, e-f, me@example.com"');
		});

		it('never prefixes a number, so a negative one stays a number', () => {
			const ledger = defineResource({
				name: 'ledger',
				label: 'Ledger',
				schema: z.object({ id: z.number(), amount: z.number() })
			});

			const csv = toCsv(ledger, [{ id: -1, amount: -5 }]);

			expect(lines(csv)[1]).toBe('"-1","-5"');
		});

		it('guards a list of values joined as text', () => {
			const tagged = defineResource({
				name: 'tagged',
				label: 'Tagged',
				schema: z.object({ id: z.number(), tags: z.array(z.string()) })
			});

			const csv = toCsv(tagged, [{ id: 1, tags: ['=HYPERLINK("x")', 'safe'] }]);

			expect(lines(csv)[1]).toBe('"1","\'=HYPERLINK(""x""), safe"');
		});

		it('guards the headers too', () => {
			const sheet = defineResource({
				name: 'sheet',
				label: 'Sheet',
				schema: z.object({ id: z.number(), total: field(z.number(), { label: '=1+1' }) })
			});

			expect(lines(toCsv(sheet, []))[0]).toBe('"ID","\'=1+1"');
		});
	});
});
