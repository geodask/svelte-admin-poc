import { describe, expect, it } from 'vitest';
import { readDateInput, writeDateInput } from './input-codec.ts';

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
