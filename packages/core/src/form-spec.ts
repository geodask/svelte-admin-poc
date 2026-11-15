// The form layer: which input each Field gets, and the schema a remote `form()` validates with.
// It is pure and browser-safe (the browser runs `formSchema` as the form's `preflight`), so it
// lives on the shared entry and must never import `$app/server`.
import { z } from 'zod';
import type { StandardSchemaV1 } from './standard-schema.ts';
import { unwrap, type Field } from './fields.ts';
import type { RecordOf, Resource } from './resource.ts';

/** Which form a spec or a schema is for. The edit View comes later. */
export type FormMode = 'create';

/**
 * One input of a create or edit form: the Field it edits, how it is labelled, and the kind of
 * input it gets, chosen from the Field's Zod type.
 */
export type FormFieldSpec = {
	key: string;
	label: string;
	description?: string;
	/** False when the Field may be left empty (`optional`, `nullable` or `default`). */
	required: boolean;
} & (
	| { kind: 'text'; format: 'text' | 'email' | 'url' }
	| { kind: 'number'; integer: boolean }
	| { kind: 'checkbox' }
	| { kind: 'select'; options: readonly (string | number)[] }
	| { kind: 'date' }
	/** An ISO datetime, edited in a `datetime-local` input and read and written in UTC. */
	| { kind: 'datetime' }
);

/** The input-specific part of a spec: what `inputFor` adds to the Field's own details. */
type InputOf = FormFieldSpec extends infer S
	? S extends unknown
		? Omit<S, keyof Field>
		: never
	: never;

/**
 * The input for a Field, from its Kind, refined by its unwrapped type where the Kind leaves a
 * choice (a text format, an integer, a date or a datetime). `undefined` for a Kind with no input
 * yet (a list, an object, unknown).
 */
function inputFor(field: Field, schema: z.ZodType): InputOf | undefined {
	const type = unwrap(schema);
	switch (field.kind) {
		case 'text': {
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
		default:
			return undefined;
	}
}

/**
 * The inputs of a Resource's create form: one per Field it can map, in schema order. The id is
 * never in a form, since the backend assigns it. Kinds with no input yet (lists, objects,
 * unknown) are left out for now.
 */
export function toFormSpec(resource: Resource, mode: FormMode): FormFieldSpec[] {
	void mode;
	const specs: FormFieldSpec[] = [];
	for (const field of resource.fields) {
		if (field.key === 'id') continue;
		const input = inputFor(field, resource.schema.shape[field.key] as z.ZodType);
		if (input === undefined) continue;
		specs.push({
			key: field.key,
			label: field.label,
			...(field.description === undefined ? {} : { description: field.description }),
			required: field.required,
			...input
		} as FormFieldSpec);
	}
	return specs;
}

/**
 * What a remote form receives from the browser, as Kit types it: each input's name maps to its
 * value. Only scalar inputs so far. (Kit checks a form schema's input type for booleans that
 * aren't optional; a recursive or `File` type here would defeat that check and fail it.)
 */
export type FormInput = {
	[key: string]: FormInputValue | FormInputValue[] | undefined;
};
type FormInputValue = string | number | boolean;

/** A Resource's record as its create form gives it: everything but the id. */
export type CreateData<R extends Resource> = Omit<RecordOf<R>, 'id'>;

/** A `datetime-local` input's value: a date and a time, to the minute or finer, with no zone. */
const LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/;

/** What an empty input means for a Field: `undefined`, or `null` for a Field only `nullable`. */
function noValue(schema: z.ZodType): undefined | null {
	if (schema.safeParse(undefined).success) return undefined;
	return schema.safeParse(null).success ? null : undefined;
}

/** One input's value as the browser sent it, turned into the value the Resource schema checks. */
function normalize(spec: FormFieldSpec, schema: z.ZodType, raw: unknown): unknown {
	// An unchecked checkbox sends nothing, so anything but a checked one is false.
	if (spec.kind === 'checkbox') return raw === true || raw === 'on' || raw === 'true';
	if (raw === undefined || raw === null || raw === '') return noValue(schema);

	switch (spec.kind) {
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
 * The schema a Resource's remote create form validates with, and the browser runs as its
 * `preflight`. It normalises what the browser sent, then validates with the Resource's own
 * schema minus the id, which it never rewrites:
 *
 * - An empty input means no value, so a required Field reports "Required" (unless its schema
 *   sets its own message) and an optional one is left out. A Field that is only `nullable`
 *   gets `null`.
 * - An unchecked checkbox means `false`, so the Resource can say `z.boolean()`.
 * - A date becomes the schema's type (a `Date` for `z.date()`, the text for `z.iso.date()`),
 *   and a datetime is read in UTC and becomes an ISO string.
 * - Only the inputs the form has are read; any other key is dropped.
 */
export function formSchema<R extends Resource>(
	resource: R,
	mode: FormMode
): StandardSchemaV1<FormInput, CreateData<R>> {
	const specs = toFormSpec(resource, mode);
	const target = resource.schema.omit({ id: true });
	const shape = resource.schema.shape as Record<string, z.ZodType>;

	return {
		'~standard': {
			version: 1,
			vendor: 'svelte-admin',
			validate(value) {
				const raw = (typeof value === 'object' && value !== null ? value : {}) as FormInput;
				const input: Record<string, unknown> = {};
				for (const spec of specs) {
					const normalized = normalize(spec, shape[spec.key], raw[spec.key]);
					if (normalized !== undefined) input[spec.key] = normalized;
				}

				const result = target.safeParse(input, {
					// A schema's own message wins; this is only the fallback for "nothing entered".
					error: (issue) => (issue.input === undefined ? 'Required' : undefined)
				});
				if (result.success) return { value: result.data as CreateData<R> };
				return {
					issues: result.error.issues.map((issue) => ({
						message: issue.message,
						path: issue.path
					}))
				};
			}
		}
	};
}
