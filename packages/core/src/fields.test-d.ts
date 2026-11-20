// Type-level tests, checked by `tsc` (`bun run check`), never run. Each `@ts-expect-error`
// fails the check if the line below it stops being a type error.
import { expectTypeOf } from 'vitest';
import type { DateType, Field, FormInputSpec } from '@svelte-admin/core';

// A Field records its input details beside its Kind: which date a date Field holds, whether a
// number Field is an integer, and a Reference's id type.
declare const described: Field;
if (described.kind === 'date') {
	expectTypeOf(described.dateType).toEqualTypeOf<'date' | 'datetime' | 'Date'>();
	expectTypeOf(described.dateType).toEqualTypeOf<DateType>();
}
if (described.kind === 'number') expectTypeOf(described.integer).toEqualTypeOf<boolean>();
if (described.kind === 'reference') expectTypeOf(described.id).toEqualTypeOf<'string' | 'number'>();
if (described.kind === 'text') {
	// @ts-expect-error only a date Field says which date it holds
	void described.dateType;
	// @ts-expect-error only a number Field says whether it is an integer
	void described.integer;
	// @ts-expect-error only a Reference has an id type
	void described.id;
}

// A form input spec carries the same details: a date input says whether it holds an ISO date or
// a `Date` (an ISO datetime has its own `datetime` input), a number input whether it is an
// integer, and a Reference's picker its target's id type.
declare const spec: FormInputSpec;
if (spec.kind === 'date') expectTypeOf(spec.dateType).toEqualTypeOf<'date' | 'Date'>();
if (spec.kind === 'number') expectTypeOf(spec.integer).toEqualTypeOf<boolean>();
if (spec.kind === 'reference') expectTypeOf(spec.id).toEqualTypeOf<'string' | 'number'>();
if (spec.kind === 'datetime') {
	// @ts-expect-error a datetime input holds an ISO datetime only
	void spec.dateType;
}
