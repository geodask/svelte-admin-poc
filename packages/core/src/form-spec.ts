// The form layer: which input each Field gets, and the schema a remote `form()` validates with.
// It is pure and browser-safe (the browser runs `formSchema` as the form's `preflight`), so it
// lives on the shared entry and must never import `$app/server`.
import { z } from 'zod';
import type { StandardSchemaV1 } from './standard-schema.ts';
import {
	describeField,
	unwrap,
	type DateType,
	type Field,
	type FieldBrandOf,
	type IsWrapped,
	type UnwrappedSchema
} from './fields.ts';
import {
	readDateInput,
	readNumberInput,
	readReferenceInput,
	writeDateInput
} from './input-codec.ts';
import { idFromParam } from './ids.ts';
import { ownKind, type KindInputOf, type KindRegistry } from './kinds.ts';
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
	/**
	 * The named Kind the Field names (`FieldMeta.kind`), if any, so a Theme renders that Kind's
	 * input in place of the built-in one `kind` describes.
	 */
	namedKind?: string;
} & (
		| { kind: 'text'; format: 'text' | 'email' | 'url' }
		/** Long text, with `input: 'textarea'`. */
		| { kind: 'textarea' }
		| { kind: 'number'; integer: boolean }
		| { kind: 'checkbox' }
		| { kind: 'select'; options: readonly (string | number)[] }
		/**
		 * A Reference: a picker of the target's records, by their Record title. It sends the chosen
		 * record's id as text, which the form reads by the target's id schema. `target` is the target
		 * Resource's name, under which `admin.ts` lists it.
		 */
		| { kind: 'reference'; target: string; id: 'string' | 'number' }
		/** A day, edited in a `date` input: an ISO date string, or a `Date` at midnight UTC. */
		| { kind: 'date'; dateType: Exclude<DateType, 'datetime'> }
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
		/**
		 * A top-level Field whose type has no built-in input (a union, a record), which its named
		 * Kind's input renders: `defineAdmin` checks the app's Kind has one. What it sends goes
		 * through the Kind's `fromInput`, if any, as it is.
		 */
		| { kind: 'custom' }
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
		? Omit<S, keyof FormFieldBase | 'placeholder' | 'namedKind'>
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
 * The input for a Field, from its Kind and the input details the Field records (an integer, a
 * date or a datetime), refined by its unwrapped type for a text format and by its `input`
 * metadata.
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
			return { kind: 'number', integer: field.integer };
		case 'reference':
			// Only once every Resource module has loaded: `assertFormInputs` never gets here.
			return { kind: 'reference', target: field.ref().name, id: field.id };
		case 'boolean':
			return { kind: 'checkbox' };
		case 'enum':
			return { kind: 'select', options: field.options };
		case 'date':
			return field.dateType === 'datetime'
				? { kind: 'datetime' }
				: { kind: 'date', dateType: field.dateType };
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
		...(field.namedKind === undefined ? {} : { namedKind: field.namedKind }),
		required: field.required && (!(type instanceof z.ZodArray) || minimumLength(type) > 0),
		...input
	} as FormInputSpec;
}

/**
 * The spec of a top-level Field's input: its built-in input, or for a Field whose type has none
 * but that names a Kind, a custom input, which that Kind's input renders. `undefined` when the
 * form has no input for it.
 */
function topLevelSpecFor(field: Field, schema: z.ZodType): FormInputSpec | undefined {
	const spec = specFor(field, schema);
	if (spec !== undefined || field.namedKind === undefined) return spec;
	return {
		...baseOf(field),
		...(field.placeholder === undefined ? {} : { placeholder: field.placeholder }),
		namedKind: field.namedKind,
		kind: 'custom'
	};
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

/** Whether a form of either mode gives a top-level Field an input. */
const getsAnInput = (field: Field) =>
	roleIn(field, 'create') === 'input' || roleIn(field, 'edit') === 'input';

/**
 * Check that the forms can edit every Field they would give an input: one whose type has no
 * input (a union, a record), or a list, rows or group holding one, must be `readOnly: true` or
 * `hidden`. `defineResource` runs it, so a Resource whose form could never be saved fails at
 * startup, naming the Field. A Field that names a Kind is skipped: its Kind's input may edit it,
 * which only `defineAdmin` can see, so `assertKindInputs` checks it there.
 */
export function assertFormInputs(name: string, fields: readonly Field[], schema: z.ZodObject) {
	for (const field of fields) {
		if (!getsAnInput(field) || field.namedKind !== undefined) continue;
		// A Reference always has its picker. Its target may not have loaded yet (it may be this
		// very Resource), so its spec, which names the target, can't be built here.
		if (field.kind === 'reference') continue;
		if (specFor(field, schema.shape[field.key] as z.ZodType) === undefined) {
			throw noInputError(name, field);
		}
	}
}

/**
 * Check that every Field the forms would edit, that names a Kind and whose type has no built-in
 * input (a union, a record), names one of the app's Kinds with an `input`, which then edits it.
 * Otherwise it must be `readOnly: true` or `hidden`, as without a Kind. `defineAdmin` runs it,
 * since only the admin knows the app's Kinds.
 */
export function assertKindInputs(resource: Resource, kinds: KindRegistry): void {
	for (const field of resource.fields) {
		if (!getsAnInput(field) || field.namedKind === undefined || field.kind === 'reference')
			continue;
		if (specFor(field, resource.schema.shape[field.key] as z.ZodType) !== undefined) continue;
		if (ownKind(kinds, field.namedKind)?.input !== undefined) continue;
		throw noInputError(resource.name, field, field.namedKind);
	}
}

/**
 * The startup error for a Field the forms would edit but have no input for, and when it names a
 * Kind (`kind`), that Kind has no input in admin.ts either.
 */
function noInputError(name: string, field: Field, kind?: string): Error {
	const afterCreate =
		field.readOnly === 'afterCreate' ? " `readOnly: 'afterCreate'` still needs one on create." : '';
	const where = `Resource "${name}": the Field "${field.key}" has no form input for its type`;
	const leaveOut = '`readOnly: true` or `hidden: true` with `field()`, so the forms leave it out.';
	if (kind === undefined) return new Error(`${where}.${afterCreate} Mark it ${leaveOut}`);
	return new Error(
		`${where}, and its Kind "${kind}" has no \`input\` in admin.ts.${afterCreate} Give the Kind ` +
			`one in the admin's \`kinds\`, or mark the Field ${leaveOut}`
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
		const spec = topLevelSpecFor(field, resource.schema.shape[field.key] as z.ZodType);
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
 * What any Resource's form sends, untyped: each input's name maps to its value, a list to an
 * array of values, and a group or rows to nested values. It is what the Theme's parts, which
 * render any Field, work with; a replaced View gets the precise `FormInput` instead. The type
 * nests three levels deep; the runtime goes deeper. It is not recursive on purpose: Kit checks
 * a form schema's input type for booleans that aren't optional, and a recursive or `File` type
 * would defeat that check and fail it.
 */
export type FormValues = {
	[key: string]: FormInputList | FormInputOuter | FormInputOuter[] | undefined;
};

/** A type with its intersections flattened into one object, so it reads (and compares) plainly. */
export type Simplify<T> = { [K in keyof T]: T[K] } & {};

/** A Resource's schema shape: each Field's key and its schema. */
type ShapeOf<R extends Resource> = R['schema']['shape'];

/**
 * Whether a form leaves out a top-level Field, by its schema's type, as `toFormSpec` does at
 * runtime: a hidden Field in both modes, a `readOnly: true` one in both, and an `'afterCreate'`
 * one on edit.
 */
type LeftOutOf<S, M extends FormMode> = [FieldBrandOf<S, 'hidden'>] extends [true]
	? true
	: [FieldBrandOf<S, 'readOnly'>] extends [true]
		? true
		: [FieldBrandOf<S, 'readOnly'>] extends ['afterCreate']
			? M extends 'edit'
				? true
				: false
			: false;

/** The keys of the Fields a Resource's form has inputs for in `mode`: never the id. */
type FormKeys<R extends Resource, M extends FormMode> = {
	[K in keyof ShapeOf<R>]: K extends 'id'
		? never
		: LeftOutOf<ShapeOf<R>[K], M> extends true
			? never
			: K;
}[keyof ShapeOf<R>] &
	string;

/**
 * Whether an input may be left out of what the form sends: a Field in a wrapper (`optional`,
 * `nullable` or `default`), and every input that sends a boolean, since an unchecked checkbox
 * sends nothing (Kit requires form schemas to say so).
 */
type InputOptional<S, Top extends boolean> =
	IsWrapped<S> extends true ? true : FieldInputOf<S, Top> extends boolean ? true : false;

/**
 * The inputs of an object's Fields, every one of them by its key: the form's own top-level Fields
 * (`Top`), or a row's or a group's.
 */
type ObjectInput<Shape, Top extends boolean = false> = Simplify<
	{
		[K in keyof Shape as InputOptional<Shape[K], Top> extends true ? never : K]: FieldInputOf<
			Shape[K],
			Top
		>;
	} & {
		[K in keyof Shape as InputOptional<Shape[K], Top> extends true ? K : never]?: FieldInputOf<
			Shape[K],
			Top
		>;
	}
>;

/**
 * What one Field's input sends, by its schema: see `FormInput`. A top-level Field (`Top`) that
 * names a Kind whose entry in `Kinds` has an `input` type sends that type. (Kinds render only
 * top-level Fields, so a nested Field's input is always its built-in one.)
 */
type FieldInputOf<S, Top extends boolean = false> = Top extends true
	? [KindInputOf<FieldBrandOf<S, 'kind'>>] extends [never]
		? BuiltInInputOf<S>
		: KindInputOf<FieldBrandOf<S, 'kind'>>
	: BuiltInInputOf<S>;

/** What one Field's built-in input sends, by its schema. */
type BuiltInInputOf<S> = InputOfType<UnwrappedSchema<S>, FieldBrandOf<S, 'input'>>;

/** What an input sends for an unwrapped Zod type, and the Field's `input` choice. */
type InputOfType<T, Choice> = T extends z.ZodEnum
	? string
	: T extends z.ZodArray<infer E>
		? ListInput<UnwrappedSchema<E>, Choice>
		: T extends z.ZodObject<infer Shape>
			? ObjectInput<Shape>
			: z.output<T> extends boolean
				? boolean
				: z.output<T> extends number
					? number
					: string;

/**
 * What an array sends, by its unwrapped element type: rows of objects for objects; for scalars
 * one value per item, or one text for a list of text in lines.
 */
type ListInput<E, Choice> =
	E extends z.ZodObject<infer Shape>
		? ObjectInput<Shape>[]
		: InputOfType<E, undefined> extends infer Item
			? [Choice, Item] extends ['lines', string]
				? string
				: Item[]
			: never;

/**
 * What a Resource's create or edit form sends from the browser, typed from its schema: the
 * Standard Schema input type of `formSchema(resource, mode)`, from which Kit types a remote
 * form's `fields`. So a View that replaces the create or edit View gets `fields.name` checked,
 * and no input for a Field the server would ignore.
 *
 * Each Field the form has an input for maps to what that input sends: a number for a number, a
 * boolean for a checkbox, text for any other scalar (a string, an enum's select, a date, a
 * datetime), the target's id type for a Reference, an array for a list in rows, text for a list
 * in lines, an array of objects for rows, and an object for a group. The Theme's number input and
 * a Reference's picker send their value as text, which the form reads by the same rules as the
 * filters; a replaced View's `as('number')` input is read by Kit's own rule (`parseFloat`)
 * before the form sees it. A Field that names a Kind whose entry in `Kinds`
 * says what its input sends (`stars: { input: string }`) maps to that type instead. The id and
 * the read-only and hidden Fields are left out, and `'afterCreate'` Fields appear on create only.
 * A Field in a wrapper may be left out, and so may every input that sends a boolean, since an
 * unchecked checkbox sends nothing. The edit form also carries the record's typed id, its hidden
 * input, which also types `update.for(id)`.
 *
 * It reads `readOnly`, `hidden`, `input` and `kind` from the type `field()` returns, so write
 * that metadata inline in `field()`.
 */
export type FormInput<R extends Resource, M extends FormMode> = Simplify<
	ObjectInput<Pick<ShapeOf<R>, FormKeys<R, M>>, true> &
		(M extends 'edit' ? { id: IdOf<R> } : unknown)
>;

/**
 * A Resource's record as its create form gives it, for the Provider's `create`: the record
 * without its id and its read-only and hidden Fields, already validated with the schema. It is
 * the output type of `formSchema(resource, 'create')`.
 */
export type CreateData<R extends Resource> = Simplify<Pick<RecordOf<R>, FormKeys<R, 'create'>>>;

/**
 * A Resource's editable Fields as its edit form gives them, for the `data` of the Provider's
 * `update`: like `CreateData`, but without the `'afterCreate'` Fields either. An optional Field
 * whose key is absent was cleared.
 */
export type EditData<R extends Resource> = Simplify<Pick<RecordOf<R>, FormKeys<R, 'edit'>>>;

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
 *
 * Given the app's Kinds (`admin.kinds`), a top-level Field that names a Kind with `toInput` is
 * written by it instead. It is never called for a missing value.
 */
export function toFormValues(
	spec: readonly FormFieldSpec[],
	record: object,
	kinds?: KindRegistry
): FormValues {
	return valuesOf(spec, record, kinds) as FormValues;
}

/**
 * The input values of an object's Fields: a record's, a row's or a group's. Only a record's
 * (top-level) Fields are given the Kinds, since Kinds render only top-level Fields.
 */
function valuesOf(
	specs: readonly FormFieldSpec[],
	object: object,
	kinds?: KindRegistry
): Record<string, unknown> {
	const values: Record<string, unknown> = {};
	const fields = object as Record<string, unknown>;
	for (const spec of specs.filter(isInputSpec)) {
		const value = fields[spec.key];
		if (value === undefined || value === null) continue;
		const toInput = ownKind(kinds, spec.namedKind)?.toInput;
		const shown = toInput === undefined ? inputValue(spec, value) : toInput(value);
		if (shown !== undefined) values[spec.key] = shown;
	}
	return values;
}

/** One value as its input writes it, or `undefined` for a value the input can't show. */
function inputValue(spec: FormInputSpec, value: unknown): unknown {
	switch (spec.kind) {
		case 'select':
		case 'reference':
			// As the select or the picker sends it: an id as text.
			return String(value);
		case 'date':
			return writeDateInput(spec.dateType, value as string | Date);
		case 'datetime':
			return writeDateInput('datetime', value as string | Date);
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

/**
 * Whether an input sent nothing a Kind's `fromInput` should see: no value, empty text, or a
 * list of only those.
 */
function isEmptyInput(raw: unknown): boolean {
	if (raw === undefined || raw === null || raw === '') return true;
	return Array.isArray(raw) && raw.every(isEmptyInput);
}

/** The message of what a Kind's `fromInput` threw, as the Field's issue. */
function conversionMessage(thrown: unknown): string {
	return thrown instanceof Error && thrown.message !== '' ? thrown.message : 'Invalid input';
}

/** Each Reference's target, by the Field's key. Only a top-level Field can be a Reference. */
type Targets = ReadonlyMap<string, Resource>;

/**
 * A record's (top-level) values, as `normalizeRecord` gives them, and the Fields whose Kind's
 * `fromInput` threw, by key, each with the message its issue shows.
 */
type NormalizedRecord = { values: Record<string, unknown>; failures: Map<string, string> };

/**
 * The values of a record's (top-level) Fields, as `normalizeObject` gives them, except that a
 * Field whose named Kind has `fromInput` gets what that returns for what its input sent, and an
 * empty input no value without calling it. A throw is a failure of that Field, left out of the
 * values, so the schema doesn't report the same Field again.
 */
function normalizeRecord(
	specs: readonly FormInputSpec[],
	object: z.ZodObject,
	raw: unknown,
	origins: Origins,
	targets: Targets,
	kinds: KindRegistry | undefined
): NormalizedRecord {
	const values = isObject(raw) ? raw : {};
	const shape = object.shape as Record<string, z.ZodType>;
	const normalized: Record<string, unknown> = {};
	const failures = new Map<string, string>();
	for (const spec of specs) {
		const sent = values[spec.key];
		const fromInput = ownKind(kinds, spec.namedKind)?.fromInput;
		let value: unknown;
		if (fromInput === undefined && spec.kind === 'reference') {
			value = referenceValue(targets.get(spec.key)!, shape[spec.key], sent);
		} else if (fromInput === undefined) {
			value = normalize(spec, shape[spec.key], sent, [spec.key], origins);
		} else if (isEmptyInput(sent)) {
			value = noValue(shape[spec.key]);
		} else {
			try {
				value = fromInput(sent as never);
			} catch (thrown) {
				failures.set(spec.key, conversionMessage(thrown));
				continue;
			}
		}
		if (value !== undefined) normalized[spec.key] = value;
	}
	return { values: normalized, failures };
}

/** Text with its line breaks written as LF, as a textarea shows them, whatever the browser sent. */
function lineBreaksAsLf(raw: unknown): unknown {
	return typeof raw === 'string' ? raw.replace(/\r\n?/g, '\n') : raw;
}

/** One scalar input's value as the browser sent it, turned into the value the schema checks. */
function normalizeScalar(spec: FormInputSpec, schema: z.ZodType, raw: unknown): unknown {
	if (raw === undefined || raw === null || raw === '') return noValue(schema);

	switch (spec.kind) {
		case 'number':
			// The Theme's number input and a Kind's (a radio group) send text, which is read by the
			// input codec; a replaced View's `as('number')` input sends a number. Text that is no
			// number is left as it is, for the schema to reject.
			return typeof raw === 'string' ? (readNumberInput(raw) ?? raw) : raw;
		case 'textarea':
			// A form posted without JavaScript sends line breaks as CRLF; with it, as typed.
			return lineBreaksAsLf(raw);
		case 'text':
			// The built-in text input is one line. A Kind's input (a textarea) may send line breaks.
			return spec.namedKind === undefined ? raw : lineBreaksAsLf(raw);
		case 'select':
			// A select sends text, so a number option is matched by how it is written.
			return spec.options.find((option) => String(option) === String(raw)) ?? raw;
		case 'date':
		case 'datetime': {
			// Read in UTC, as the Views show dates, into the schema's type. Text that is no real
			// date (30 February, month 13) is left as it is, for the schema to report, and is
			// never turned into the date it would roll over to.
			if (typeof raw !== 'string') return raw;
			return readDateInput(spec.kind === 'date' ? spec.dateType : 'datetime', raw) ?? raw;
		}
		default:
			return raw;
	}
}

/**
 * The id a Reference's picker sent, as an id of its target, read by the input codec with the
 * target's id schema (`readReferenceInput`): for a number id, only a number written as it prints
 * (`3`, not `03` or `3a`). An empty input means no value, and anything else is left as it is,
 * for the Field's schema to reject. A typed id (a replaced View's) is read as it prints.
 */
function referenceValue(target: Resource, schema: z.ZodType, raw: unknown): unknown {
	if (raw === undefined || raw === null || raw === '') return noValue(schema);
	if (typeof raw !== 'string' && typeof raw !== 'number') return raw;
	return readReferenceInput(target, String(raw)) ?? raw;
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
 * - A number Field's input sends its number as text (the Theme's number input, a Kind's radio
 *   group), which is read by the same rule as a number filter (`readNumberInput`): `3`, `-2.5`,
 *   `.5` and `1e3` are numbers, and text that isn't one (`3a`, ` 3 `, `3.`) is left for the
 *   schema to reject. A number sent as a number (a replaced View's `as('number')`) is kept.
 * - A Reference's picker sends the chosen id as text, which is read by the target's id schema,
 *   by the same rule as a Reference filter (`readReferenceInput`), so `3` is the number 3 and
 *   `3a` and `03` are invalid.
 * - A textarea's line breaks become `\n`, as typed, though a form posted without JavaScript
 *   sends them as CRLF.
 * - A date becomes the schema's type (a `Date` for `z.date()`, the text for `z.iso.date()`),
 *   and a datetime is read in UTC and becomes an ISO string, by the same rules as a date filter
 *   (`readDateInput`). A date that doesn't exist (30 February, 24:00) is left as typed, so the
 *   schema reports it, rather than becoming the date it would roll over to.
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
 *
 * Given the app's Kinds (`admin.kinds`), a top-level Field that names a Kind with `fromInput` is
 * converted by it before the schema validates, in place of the rules above: an empty input
 * still means no value, without calling it, and a throw becomes an issue on the Field with the
 * thrown error's message (or "Invalid input"). Without the Kinds, what such a Field's input sent
 * is validated as it is.
 */
export function formSchema<R extends Resource, M extends FormMode>(
	resource: R,
	mode: M,
	kinds?: KindRegistry
): StandardSchemaV1<FormInput<R, M>, FormOutput<R, M>> {
	// Only the inputs: a read-only Field is left out of the schema, not ignored after parsing.
	const specs = toFormSpec(resource, mode).filter(isInputSpec);
	const keys: Record<string, true> = Object.fromEntries(specs.map((spec) => [spec.key, true]));
	const target = resource.schema.pick(keys as z.util.Mask<string>);
	// Called here, as `toFormSpec` calls them, once every Resource module has loaded.
	const targets: Targets = new Map(
		resource.fields.flatMap((field) =>
			field.kind === 'reference' ? [[field.key, field.ref()] as const] : []
		)
	);

	return {
		'~standard': {
			version: 1,
			vendor: 'svelte-admin',
			validate(value) {
				const raw = (typeof value === 'object' && value !== null ? value : {}) as FormValues;
				const origins: Origins = new Map();
				const { values: input, failures } = normalizeRecord(
					specs,
					resource.schema,
					raw,
					origins,
					targets,
					kinds
				);
				const issues: StandardSchemaV1.Issue[] = [...failures].map(([key, message]) => ({
					message,
					path: [key]
				}));

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
						// A Field whose conversion failed already has its issue.
						if (failures.has(issue.path[0] as string)) continue;
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
