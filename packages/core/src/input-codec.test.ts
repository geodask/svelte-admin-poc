import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
	readDateInput,
	readNumberInput,
	readReferenceInput,
	writeDateInput
} from './input-codec.ts';

describe('a datetime input', () => {
	it('reads in UTC into an ISO datetime string, to the minute or finer', () => {
		expect(readDateInput('datetime', '2024-03-01T23:30')).toBe('2024-03-01T23:30:00.000Z');
		expect(readDateInput('datetime', '2024-03-01T23:30:15')).toBe('2024-03-01T23:30:15.000Z');
		expect(readDateInput('datetime', '2024-03-01T23:30:15.250')).toBe('2024-03-01T23:30:15.250Z');
	});
});

describe('a date input', () => {
	it('reads into the ISO date string as sent, for an ISO date Field', () => {
		expect(readDateInput('date', '2024-02-29')).toBe('2024-02-29');
	});

	it('reads into a Date at midnight UTC, for a Date Field', () => {
		expect(readDateInput('Date', '2024-02-29')).toEqual(new Date('2024-02-29T00:00:00Z'));
	});
});

describe('a date that does not exist', () => {
	it.each([
		['30 February', '2024-02-30T10:00'],
		['29 February in a common year', '2023-02-29T10:00'],
		['month 13', '2024-13-01T10:00'],
		['24 o’clock', '2024-03-01T24:00'],
		['25 o’clock', '2024-03-01T25:00'],
		['minute 60', '2024-03-01T10:60'],
		['second 60', '2024-03-01T10:30:60']
	])('is no datetime: %s', (_, text) => {
		expect(readDateInput('datetime', text)).toBeUndefined();
	});

	it.each([
		['30 February', '2024-02-30'],
		['29 February in a common year', '2023-02-29'],
		['month 13', '2024-13-01'],
		['day 0', '2024-03-00']
	])('is no date of either type: %s', (_, text) => {
		expect(readDateInput('date', text)).toBeUndefined();
		expect(readDateInput('Date', text)).toBeUndefined();
	});
});

describe('text a date input never sends', () => {
	it.each(['date', 'datetime', 'Date'] as const)('is no value when empty, for %s', (dateType) => {
		expect(readDateInput(dateType, '')).toBeUndefined();
	});

	it.each([
		['with a zone', '2024-03-01T10:00Z'],
		['without a time', '2024-03-01'],
		['with a space for the T', '2024-03-01 10:00'],
		['as words', 'tomorrow']
	])('is no datetime: %s', (_, text) => {
		expect(readDateInput('datetime', text)).toBeUndefined();
	});

	it.each([
		['with a time', '2024-03-01T00:00'],
		['without leading zeros', '2024-3-1'],
		['with spaces around it', ' 2024-03-01 '],
		['as words', 'yesterday']
	])('is no date: %s', (_, text) => {
		expect(readDateInput('date', text)).toBeUndefined();
		expect(readDateInput('Date', text)).toBeUndefined();
	});
});

describe('a value written into its date input', () => {
	it('is a datetime in UTC, to the minute, with seconds and milliseconds only when they are not zero', () => {
		expect(writeDateInput('datetime', '2024-03-01T23:30:00.000Z')).toBe('2024-03-01T23:30');
		expect(writeDateInput('datetime', '2024-03-01T23:30:15Z')).toBe('2024-03-01T23:30:15');
		expect(writeDateInput('datetime', '2024-03-01T23:30:15.250Z')).toBe('2024-03-01T23:30:15.250');
		expect(writeDateInput('datetime', '2024-03-02T01:30:00+02:00')).toBe('2024-03-01T23:30');
	});

	it('is the day as written, for an ISO date', () => {
		expect(writeDateInput('date', '2024-02-29')).toBe('2024-02-29');
	});

	it('is its day in UTC, for a Date', () => {
		expect(writeDateInput('Date', new Date('2024-02-29T00:00:00Z'))).toBe('2024-02-29');
		expect(writeDateInput('Date', new Date('2024-02-29T23:30:00Z'))).toBe('2024-02-29');
	});

	it('is a datetime that does not exist as it is, never the date it would roll over to', () => {
		expect(writeDateInput('datetime', '2024-02-30T10:00:00Z')).toBe('2024-02-30T10:00:00Z');
		expect(writeDateInput('datetime', '2024-03-01T24:00:00Z')).toBe('2024-03-01T24:00:00Z');
	});

	it('is text that is no date as it is, so an input never throws', () => {
		expect(writeDateInput('datetime', 'soon')).toBe('soon');
		expect(writeDateInput('date', 'soon')).toBe('soon');
		expect(writeDateInput('Date', new Date(Number.NaN))).toBe('');
	});
});

describe('a real date', () => {
	it.each([
		['datetime', '2024-02-29T23:30'],
		['datetime', '2024-12-31T00:00:15'],
		['datetime', '2024-01-01T09:05:15.250'],
		['date', '2024-02-29'],
		['Date', '2024-02-29']
	] as const)('reads and writes back unchanged: %s %s', (dateType, text) => {
		const value = readDateInput(dateType, text);
		expect(value).toBeDefined();
		expect(writeDateInput(dateType, value!)).toBe(text);
	});
});

describe('a number input', () => {
	it.each([
		['15', 15],
		['3', 3],
		['-2.5', -2.5],
		['45.5', 45.5],
		['0.5', 0.5],
		['.5', 0.5],
		['1e3', 1000],
		['1E3', 1000],
		['2.5e-1', 0.25],
		['-5', -5],
		['010.50', 10.5]
	])('reads %j as a number, as a number input sends it', (text, number) => {
		expect(readNumberInput(text)).toBe(number);
	});

	it.each([
		['empty', ''],
		['blank', '  '],
		['with spaces around it', ' 3 '],
		['with a space before it', ' 3'],
		['with a space after it', '3 '],
		['followed by letters', '3a'],
		['with a trailing dot', '3.'],
		['with a plus sign', '+5'],
		['in hex', '0x10'],
		['a lone minus sign', '-'],
		['as words', 'abc'],
		['not finite', 'Infinity'],
		['too large to be finite', '1e999'],
		['not a number', 'NaN']
	])('reads no number from text %s', (_, text) => {
		expect(readNumberInput(text)).toBeUndefined();
	});

	it('reads a fraction for an integer Field too, which its schema then rejects', () => {
		expect(readNumberInput('2.5')).toBe(2.5);
		expect(z.int().safeParse(readNumberInput('2.5')).success).toBe(false);
		expect(z.int().safeParse(readNumberInput('2')).success).toBe(true);
	});
});

describe('a Reference id', () => {
	const numberTarget = { schema: z.object({ id: z.number() }) };
	const intTarget = { schema: z.object({ id: z.int().positive() }) };
	const stringTarget = { schema: z.object({ id: z.string() }) };
	const uuidTarget = { schema: z.object({ id: z.uuid() }) };

	it('reads a number id as it prints', () => {
		expect(readReferenceInput(numberTarget, '3')).toBe(3);
		expect(readReferenceInput(numberTarget, '-2.5')).toBe(-2.5);
	});

	it.each(['03', '3a', '3.0', '1e0', ' 3', '3 ', '+3', 'Infinity', ''])(
		'reads no number id from %j, as a route param would name none',
		(text) => {
			expect(readReferenceInput(numberTarget, text)).toBeUndefined();
		}
	);

	it("reads by the target's id schema, with its refinements", () => {
		expect(readReferenceInput(intTarget, '3')).toBe(3);
		expect(readReferenceInput(intTarget, '2.5')).toBeUndefined();
		expect(readReferenceInput(intTarget, '-3')).toBeUndefined();
		expect(readReferenceInput(uuidTarget, '3')).toBeUndefined();
		const uuid = '7f9c24e8-3b12-4fef-91e0-3a7f1c5b2d4a';
		expect(readReferenceInput(uuidTarget, uuid)).toBe(uuid);
	});

	it('reads a string id as written, digits and spaces too', () => {
		expect(readReferenceInput(stringTarget, 'bread/rye')).toBe('bread/rye');
		expect(readReferenceInput(stringTarget, '03')).toBe('03');
		expect(readReferenceInput(stringTarget, ' rye ')).toBe(' rye ');
	});

	it('reads no id from empty text, for any id type', () => {
		expect(readReferenceInput(stringTarget, '')).toBeUndefined();
		expect(readReferenceInput(numberTarget, '')).toBeUndefined();
	});
});
