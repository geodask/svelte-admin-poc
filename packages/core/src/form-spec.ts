// The form layer: which input each Field gets, and the schema a remote `form()` validates with.
// It is pure and browser-safe (the browser runs `formSchema` as the form's `preflight`), so it
// lives on the shared entry and must never import `$app/server`.
import { z } from 'zod';
import type { StandardSchemaV1 } from './standard-schema.ts';
import { describeField, unwrap, type Field } from './fields.ts';
import { idFromParam } from './ids.ts';
import type { IdOf, RecordOf, Resource } from './resource.ts';

/** Which form a spec or a schema is for: the create View's or the edit View's. */
export type FormMode = 'create' | 'edit';

/** What every spec of a form has: the Field it is for, and how it is labelled. */
type FormFieldBase = {
	key: string;
	label: string;
	/** The Field's description, shown as help text under its input. */
	description?: string;
	/**
	 * False when the Field may be left empty (`optional`, `nullable` or `default`). A list or
	 * rows can always be left with no items unless the schema sets a minimum length, so they
	 * are required only then.
	 */
	required: boolean;
};

/**
 * One input of a create or edit form: the Field it edits, how it is labelled, and the kind of
 * input it gets, chosen from the Field's Zod type. A list, rows and a group hold the specs of
 * their own inputs, so a Theme renders them recursively.
 */
export type FormInputSpec = FormFieldBase & {
	/** The example value the input shows while it is empty. */
	placeholder?: string;
} & (
		| { kind: 'text'; format: 'text' | 'email' | 'url' }
		/** Long text, with `input: 'textarea'`. */
		| { kind: 'textarea' }
		| { kind: 'number'; integer: boolean }
		| { kind: 'checkbox' }
		| { kind: 'select'; options: readonly (string | number)[] }
		| { kind: 'date' }
		/** An ISO datetime, edited in a `datetime-local` input and read and written in UTC. */
		| { kind: 'datetime' }
		/**
		 * An array of scalars: one input per item (`rows`), always with one blank row at the end
		 * to add an item, or one textarea with one item per line (`lines`). `item` is the spec of
		 * one item's input; it has the list's key, label and placeholder.
		 */
		| { kind: 'list'; mode: 'rows' | 'lines'; item: FormInputSpec }
		/** An array of objects: one fieldset per item, with the same blank row at the end. */
		| { kind: 'rows'; fields: FormInputSpec[] }
		/** A nested object: a fieldset, whose inputs are named with dots (`nutrition.carbsGrams`). */
		| { kind: 'group'; fields: FormInputSpec[] }
	);

/**
 * A Field the edit form shows as text, not as an input: one the backend owns (`readOnly: true`,
 * or `'afterCreate'` on edit). The form never submits it. `field` is the Field as the detail
 * View shows it, so a Theme can show the record's value the same way.
 */
export type FormReadOnlySpec = FormFieldBase & { kind: 'readOnly'; field: Field };

/** One Field of a create or edit form: an input, or on edit a read-only Field shown as text. */
export type FormFieldSpec = FormInputSpec | FormReadOnlySpec;

/** Whether a spec is an input, which the form submits, rather than read-only text. */
export const isInputSpec = (spec: FormFieldSpec): spec is FormInputSpec => spec.kind !== 'readOnly';

/** The input-specific part of a spec: what `inputFor` adds to the Field's own details. */
type InputOf = FormInputSpec extends infer S
	? S extends unknown
		? Omit<S, keyof FormFieldBase | 'placeholder'>
		: never
	: never;

/** The smallest length an array schema allows, from its `.min()` or `.nonempty()`. */
function minimumLength(array: z.ZodArray): number {
	let minimum = 0;
	for (const check of array._zod.def.checks ?? []) {
		const def = check._zod.def as { check: string; minimum?: number };
		if (def.check === 'min_length' && def.minimum !== undefined) {
			minimum = Math.max(minimum, def.minimum);
		}
	}
	return minimum;
}

/** The specs of an object's Fields, or `undefined` when any of them has no input. */
function specsOf(fields: readonly Field[], object: z.ZodObject): FormInputSpec[] | undefined {
	const specs: FormInputSpec[] = [];
	for (const field of fields) {
		const spec = specFor(field, object.shape[field.key] as z.ZodType);
		// A row or group with a Field the form can't edit can't be saved whole: leave it out.
		if (spec === undefined) return undefined;
		specs.push(spec);
	}
	return specs;
}

/**
 * The input for a Field, from its Kind, refined by its unwrapped type where the Kind leaves a
 * choice (a text format, an integer, a date or a datetime) and by its `input` metadata.
 * `undefined` for a type with no input (a union, a record, a list of booleans) and for a list,
 * rows or group holding one.
 */
function inputFor(field: Field, schema: z.ZodType): InputOf | undefined {
	const type = unwrap(schema);
	switch (field.kind) {
		case 'text': {
			if (field.input === 'textarea') return { kind: 'textarea' };
			// `format` covers both `z.email()` and `z.string().email()`.
			const { format } = type as z.ZodString;
			return { kind: 'text', format: format === 'email' || format === 'url' ? format : 'text' };
		}
		case 'number':
			return { kind: 'number', integer: (type as z.ZodNumber).isInt };
		case 'boolean':
			return { kind: 'checkbox' };
		case 'enum':
			return { kind: 'select', options: field.options };
		case 'date':
			return type instanceof z.ZodISODateTime ? { kind: 'datetime' } : { kind: 'date' };
		case 'list': {
			const element = (type as z.ZodArray).element as z.ZodType;
			const own = describeField(field.key, element);
			const placeholder = field.placeholder ?? own.placeholder;
			const item = specFor(
				{ ...own, label: field.label, ...(placeholder === undefined ? {} : { placeholder }) },
				element
			);
			// A list of checkboxes has no blank row to tell an item from none.
			if (item === undefined || item.kind === 'checkbox') return undefined;
			const lines = field.input === 'lines' && item.kind === 'text';
			return { kind: 'list', mode: lines ? 'lines' : 'rows', item };
		}
		case 'object': {
			if (field.fields === undefined) return undefined;
			if (type instanceof z.ZodArray) {
				const fields = specsOf(field.fields, unwrap(type.element as z.ZodType) as z.ZodObject);
				return fields === undefined ? undefined : { kind: 'rows', fields };
			}
			const fields = specsOf(field.fields, type as z.ZodObject);
			return fields === undefined ? undefined : { kind: 'group', fields };
		}
		default:
			return undefined;
	}
}

/** What every spec of a Field has, from the Field itself. */
const baseOf = (field: Field): FormFieldBase => ({
	key: field.key,
	label: field.label,
	...(field.description === undefined ? {} : { description: field.description }),
	required: field.required
});

/** The spec of one Field's input, or `undefined` when the form has no input for it. */
function specFor(field: Field, schema: z.ZodType): FormInputSpec | undefined {
	const input = inputFor(field, schema);
	if (input === undefined) return undefined;
	const type = unwrap(schema);
	return {
		...baseOf(field),
		...(field.placeholder === undefined ? {} : { placeholder: field.placeholder }),
		required: field.required && (!(type instanceof z.ZodArray) || minimumLength(type) > 0),
		...input
	} as FormInputSpec;
}

/**
 * How a form treats a top-level Field: as an input, as read-only text, or not at all. A
 * hidden Field is in no form, so a save never clears a value no View shows.
 */
function roleIn(field: Field, mode: FormMode): 'input' | 'readOnly' | 'none' {
	if (field.key === 'id' || !field.detail) return 'none';
	if (field.readOnly === true || (field.readOnly === 'afterCreate' && mode === 'edit')) {
		return mode === 'edit' ? 'readOnly' : 'none';
	}
	return 'input';
}

/**
 * Check that the forms can edit every Field they would give an input: one whose type has no
 * input (a union, a record), or a list, rows or group holding one, must be `readOnly: true` or
 * `hidden`. `defineResource` runs it, so a Resource whose form could never be saved fails at
 * startup, naming the Field.
 */
export function assertFormInputs(name: string, fields: readonly Field[], schema: z.ZodObject) {
	for (const field of fields) {
		if (roleIn(field, 'create') !== 'input' && roleIn(field, 'edit') !== 'input') continue;
		if (specFor(field, schema.shape[field.key] as z.ZodType) === undefined) {
			throw noInputError(name, field);
		}
	}
}

/** The startup error for a Field the forms would edit but have no input for. */
function noInputError(name: string, field: Field): Error {
	const afterCreate =
		field.readOnly === 'afterCreate' ? " `readOnly: 'afterCreate'` still needs one on create." : '';
	return new Error(
		`Resource "${name}": the Field "${field.key}" has no form input for its type.` +
			afterCreate +
			' Mark it `readOnly: true` or `hidden: true` with `field()`, so the forms leave it out.'
	);
}

/**
 * The Fields of a Resource's create or edit form, in schema order: an input for each Field the
 * form may set, and on edit read-only text for each Field the backend owns (`readOnly: true`,
 * and `'afterCreate'` ones). Read-only Fields are left out of create, and hidden Fields out of
 * both. The id is never one of them: the backend assigns it on create, and the edit form
 * carries it as a hidden input.
 */
export function toFormSpec(resource: Resource, mode: FormMode): FormFieldSpec[] {
	const specs: FormFieldSpec[] = [];
	for (const field of resource.fields) {
		const role = roleIn(field, mode);
		if (role === 'readOnly') specs.push({ ...baseOf(field), kind: 'readOnly', field });
		if (role !== 'input') continue;
		const spec = specFor(field, resource.schema.shape[field.key] as z.ZodType);
		// `defineResource` has checked every Field has one; a Resource built by hand may not.
		if (spec === undefined) throw noInputError(resource.name, field);
		specs.push(spec);
	}
	return specs;
}

/** What one input sends: text, a number, or a checkbox's state. */
type FormInputScalar = string | number | boolean;
/** What a list sends: one value per item, or the text of its lines. */
type FormInputList = FormInputScalar | FormInputScalar[];
/** What a group or one row sends, two levels deep at most... */
type FormInputInner = { [key: string]: FormInputList | undefined };
/** ...and one level up, so a group or rows can hold a group or rows. */
type FormInputOuter = {
	[key: string]: FormInputList | FormInputInner | FormInputInner[] | undefined;
};

/**
 * What a remote form receives from the browser, as Kit types it: each input's name maps to its
 * value, a list to an array of values, and a group or rows to nested values. The type nests
 * three levels deep; the runtime goes deeper. It is not recursive on purpose: Kit checks a form
 * schema's input type for booleans that aren't optional, and a recursive or `File` type would
 * defeat that check and fail it.
 */
export type FormInput = {
	[key: string]: FormInputList | FormInputOuter | FormInputOuter[] | undefined;
};

/** A Resource's record as its create form gives it: everything but the id. */
export type CreateData<R extends Resource> = Omit<RecordOf<R>, 'id'>;

/** A Resource's editable Fields as its edit form gives them, for `update`: everything but the id. */
export type EditData<R extends Resource> = Omit<RecordOf<R>, 'id'>;

/**
 * What a Resource's form schema gives for a mode: the record without its id on create, and on
 * edit the editable Fields with the typed id of the record they replace.
 */
export type FormOutput<R extends Resource, M extends FormMode> = M extends 'edit'
	? EditData<R> & { id: IdOf<R> }
	: CreateData<R>;

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The values a form's inputs show for a record, for the edit form's prefill: each input's
 * name and its value as the input writes it. A datetime is written in UTC, to the minute
 * unless it has seconds, a `Date` as its UTC day, and a number option as text, as a select
 * sends it. A list in rows and rows are written as their items then one blank row, which is
 * where an item is added, and a list in lines as one item per line. A Field with no value is
 * left out, and so is the id, which the edit form carries as a hidden input.
 */
export function toFormValues(spec: readonly FormFieldSpec[], record: object): FormInput {
	return valuesOf(spec, record) as FormInput;
}

/** The input values of an object's Fields: a record's, a row's or a group's. */
function valuesOf(specs: readonly FormFieldSpec[], object: object): Record<string, unknown> {
	const values: Record<string, unknown> = {};
	const fields = object as Record<string, unknown>;
	for (const spec of specs.filter(isInputSpec)) {
		const value = fields[spec.key];
		if (value === undefined || value === null) continue;
		const shown = inputValue(spec, value);
		if (shown !== undefined) values[spec.key] = shown;
	}
	return values;
}

/** One value as its input writes it, or `undefined` for a value the input can't show. */
function inputValue(spec: FormInputSpec, value: unknown): unknown {
	switch (spec.kind) {
		case 'select':
			return String(value);
		case 'date':
			return value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
		case 'datetime': {
			const date = new Date(String(value));
			if (Number.isNaN(date.getTime())) return String(value);
			// `2024-03-01T23:30:15.250Z` is written `2024-03-01T23:30:15.250`, and without the
			// seconds and milliseconds when they are zero.
			return date
				.toISOString()
				.replace(/Z$/, '')
				.replace(/\.000$/, '')
				.replace(/:00$/, '');
		}
		case 'list': {
			if (!Array.isArray(value)) return undefined;
			const items = value.map((item) =>
				item === undefined || item === null ? '' : (inputValue(spec.item, item) ?? '')
			);
			return spec.mode === 'lines' ? items.join('\n') : [...items, ''];
		}
		case 'rows':
			if (!Array.isArray(value)) return undefined;
			return [...value.map((row) => (isObject(row) ? valuesOf(spec.fields, row) : {})), {}];
		case 'group':
			return isObject(value) ? valuesOf(spec.fields, value) : undefined;
		default:
			return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
				? value
				: undefined;
	}
}

/**
 * How many rows a list in rows, or rows, shows for what it holds: one per item up to the last
 * with a value, then one blank row, where typing adds an item. Blank rows after the last item
 * (the prefill's blank row, or rows cleared since) count as that one blank row.
 */
export function rowCount(value: unknown): number {
	const items = Array.isArray(value) ? value : [];
	let filled = items.length;
	while (filled > 0 && isBlank(items[filled - 1])) filled--;
	return filled + 1;
}

/** What a list in rows, or rows, holds without the row at `index`: what its × button sets. */
export function withoutRow(value: unknown, index: number): unknown[] {
	return (Array.isArray(value) ? value : []).filter((_, row) => row !== index);
}

/** A `datetime-local` input's value: a date and a time, to the minute or finer, with no zone. */
const LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/;

/** What an empty input means for a Field: `undefined`, or `null` for a Field only `nullable`. */
function noValue(schema: z.ZodType): undefined | null {
	if (schema.safeParse(undefined).success) return undefined;
	return schema.safeParse(null).success ? null : undefined;
}

/**
 * Whether the browser sent nothing for an input or a set of them: no value, empty text, an
 * unchecked checkbox, or only such values in a row, a group or a list.
 */
function isBlank(raw: unknown): boolean {
	if (raw === undefined || raw === null || raw === '' || raw === false) return true;
	if (typeof raw === 'number') return Number.isNaN(raw);
	if (Array.isArray(raw)) return raw.every(isBlank);
	if (isObject(raw)) return Object.values(raw).every(isBlank);
	return false;
}

/** The items a list or rows sent: an array, or one value if the browser sent only that. */
const itemsOf = (raw: unknown): unknown[] =>
	Array.isArray(raw) ? raw : raw === undefined || raw === null ? [] : [raw];

/**
 * How a normalised path maps back to the inputs: for each list or rows (by its normalised
 * path, as JSON), the index of the row each item came from, since blank rows are dropped; or
 * `whole` for a list in lines, whose items all come from its one textarea.
 */
type Origins = Map<string, number[] | 'whole'>;

/** The key of a normalised path in `Origins`. */
const pathKey = (path: readonly PropertyKey[]) => JSON.stringify(path);

/** One input's value, or a set of them, as the browser sent it, turned into what the schema checks. */
function normalize(
	spec: FormInputSpec,
	schema: z.ZodType,
	raw: unknown,
	path: (string | number)[],
	origins: Origins
): unknown {
	switch (spec.kind) {
		case 'checkbox':
			// An unchecked checkbox sends nothing, so anything but a checked one is false.
			return raw === true || raw === 'on' || raw === 'true';
		case 'list': {
			if (spec.mode === 'lines') {
				origins.set(pathKey(path), 'whole');
				const text = itemsOf(raw)
					.filter((item) => typeof item === 'string')
					.join('\n');
				return text
					.split(/\r\n?|\n/)
					.map((line) => line.trim())
					.filter((line) => line !== '');
			}
			const element = (unwrap(schema) as z.ZodArray).element as z.ZodType;
			return normalizeItems(raw, path, origins, (item, at) =>
				normalize(spec.item, element, item, at, origins)
			);
		}
		case 'rows': {
			const row = unwrap((unwrap(schema) as z.ZodArray).element as z.ZodType) as z.ZodObject;
			return normalizeItems(raw, path, origins, (item, at) =>
				normalizeObject(spec.fields, row, item, at, origins)
			);
		}
		case 'group':
			// An all-blank group that may be left empty means no value; a required one is checked
			// Field by Field, so each required Field reports itself.
			if (!spec.required && isBlank(raw)) return noValue(schema);
			return normalizeObject(spec.fields, unwrap(schema) as z.ZodObject, raw, path, origins);
		default:
			return normalizeScalar(spec, schema, raw);
	}
}

/** The items of a list or rows, without the blank rows, remembering which row each came from. */
function normalizeItems(
	raw: unknown,
	path: (string | number)[],
	origins: Origins,
	normalizeItem: (item: unknown, path: (string | number)[]) => unknown
): unknown[] {
	const items: unknown[] = [];
	const rows: number[] = [];
	itemsOf(raw).forEach((item, row) => {
		if (isBlank(item)) return;
		items.push(normalizeItem(item, [...path, items.length]));
		rows.push(row);
	});
	origins.set(pathKey(path), rows);
	return items;
}

/** The values of an object's Fields (a record's, a row's or a group's), left out when empty. */
function normalizeObject(
	specs: readonly FormInputSpec[],
	object: z.ZodObject,
	raw: unknown,
	path: (string | number)[],
	origins: Origins
): Record<string, unknown> {
	const values = isObject(raw) ? raw : {};
	const normalized: Record<string, unknown> = {};
	for (const spec of specs) {
		const shape = object.shape as Record<string, z.ZodType>;
		const value = normalize(spec, shape[spec.key], values[spec.key], [...path, spec.key], origins);
		if (value !== undefined) normalized[spec.key] = value;
	}
	return normalized;
}

/** One scalar input's value as the browser sent it, turned into the value the schema checks. */
function normalizeScalar(spec: FormInputSpec, schema: z.ZodType, raw: unknown): unknown {
	if (raw === undefined || raw === null || raw === '') return noValue(schema);

	switch (spec.kind) {
		case 'textarea':
			// A form posted without JavaScript sends line breaks as CRLF; with it, as typed.
			return typeof raw === 'string' ? raw.replace(/\r\n?/g, '\n') : raw;
		case 'select':
			// A select sends text, so a number option is matched by how it is written.
			return spec.options.find((option) => String(option) === String(raw)) ?? raw;
		case 'date': {
			if (!(unwrap(schema) instanceof z.ZodDate) || typeof raw !== 'string') return raw;
			const date = new Date(`${raw}T00:00:00Z`);
			return Number.isNaN(date.getTime()) ? raw : date;
		}
		case 'datetime': {
			// The input has no time zone: it is read as UTC, as the Views show dates. Text that is
			// no real date (month 13) is left as it is, for the schema to report.
			if (typeof raw !== 'string' || !LOCAL_DATETIME.test(raw)) return raw;
			const date = new Date(`${raw}Z`);
			return Number.isNaN(date.getTime()) ? raw : date.toISOString();
		}
		default:
			return raw;
	}
}

/**
 * An issue's path as the form names its inputs: an item's index becomes the index of the row
 * it came from, and an issue about one line of a list in lines belongs to its textarea.
 */
function inputPath(path: readonly PropertyKey[], origins: Origins): (string | number)[] {
	const named: (string | number)[] = [];
	const normalized: PropertyKey[] = [];
	for (const segment of path) {
		const origin = origins.get(pathKey(normalized));
		if (origin === 'whole') break;
		named.push(
			typeof segment === 'number' && origin !== undefined
				? (origin[segment] ?? segment)
				: (segment as string | number)
		);
		normalized.push(segment);
	}
	return named;
}

/**
 * The schema a Resource's remote create or edit form validates with, and the browser runs as
 * its `preflight`. It normalises what the browser sent, then validates with the Resource's own
 * schema, cut down to the Fields the form has inputs for, which it never rewrites. The id and
 * the Fields read-only in that mode (`readOnly: true` and hidden ones, and `'afterCreate'` ones
 * on edit) are left out of that schema, so a crafted request can't set them:
 *
 * - An empty input means no value, so a required Field reports "Required" (unless its schema
 *   sets its own message) and an optional one is left out: on edit, that clears it. A Field
 *   that is only `nullable` gets `null`.
 * - An unchecked checkbox means `false`, so the Resource can say `z.boolean()`.
 * - A textarea's line breaks become `\n`, as typed, though a form posted without JavaScript
 *   sends them as CRLF.
 * - A date becomes the schema's type (a `Date` for `z.date()`, the text for `z.iso.date()`),
 *   and a datetime is read in UTC and becomes an ISO string.
 * - A blank row isn't an item, so a list or rows sends only the rows with a value, and a list
 *   in lines sends one item per line, trimmed, without the blank lines. An issue about one item
 *   names the row it came from, so it shows under that row's input; an issue about one line
 *   shows on the textarea.
 * - An all-blank optional group means no value. Once it has any value, its required Fields
 *   are required.
 * - Only the inputs the form has are read; any other key, a read-only Field's too, is dropped.
 * - On edit, the hidden `id` input becomes the typed id by the same rule as a route param
 *   (`idFromParam`), so it is the id the detail View reads the record by. An id that names
 *   none is invalid input.
 */
export function formSchema<R extends Resource, M extends FormMode>(
	resource: R,
	mode: M
): StandardSchemaV1<FormInput, FormOutput<R, M>> {
	// Only the inputs: a read-only Field is left out of the schema, not ignored after parsing.
	const specs = toFormSpec(resource, mode).filter(isInputSpec);
	const keys: Record<string, true> = Object.fromEntries(specs.map((spec) => [spec.key, true]));
	const target = resource.schema.pick(keys as z.util.Mask<string>);

	return {
		'~standard': {
			version: 1,
			vendor: 'svelte-admin',
			validate(value) {
				const raw = (typeof value === 'object' && value !== null ? value : {}) as FormInput;
				const origins: Origins = new Map();
				const input = normalizeObject(specs, resource.schema, raw, [], origins);

				const issues: StandardSchemaV1.Issue[] = [];
				let id: IdOf<R> | undefined;
				if (mode === 'edit') {
					id = idOfInput(resource, raw.id);
					if (id === undefined) issues.push({ message: 'Invalid input', path: ['id'] });
				}

				const result = target.safeParse(input, {
					// A schema's own message wins; this is only the fallback for "nothing entered".
					error: (issue) => (issue.input === undefined ? 'Required' : undefined)
				});
				if (!result.success) {
					for (const issue of result.error.issues) {
						issues.push({ message: issue.message, path: inputPath(issue.path, origins) });
					}
				}
				if (issues.length > 0 || !result.success) return { issues };
				const output = mode === 'edit' ? { id, ...result.data } : result.data;
				return { value: output as FormOutput<R, M> };
			}
		}
	};
}

/**
 * The typed id the edit form's hidden input names, or `undefined` when it names none. Kit
 * sends a number id as a number and a string id as text; both are read as a route param is.
 */
function idOfInput<R extends Resource>(resource: R, raw: unknown): IdOf<R> | undefined {
	if (typeof raw !== 'string' && typeof raw !== 'number') return undefined;
	return idFromParam(resource, String(raw));
}
