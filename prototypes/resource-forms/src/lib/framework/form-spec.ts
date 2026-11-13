// PROTOTYPE (PER-17): the logic this prototype is really about.
//
// Three pure functions turn a Resource's Zod schema + Field metadata into a remote `form()`:
//
//   toFormSpec(resource, view)   -> which input each Field gets (drives the generic create/edit View)
//   toFormValues(spec, record)   -> prefill: record -> the values the inputs show
//   formSchema(resource, view)   -> the Standard Schema handed to `form()`: normalises what the
//                                   browser sends, then validates with the Resource's OWN schema
//
// The Resource schema is never rewritten. The form layer only normalises input before validating:
//   1. an empty input means "no value"      ('' -> undefined, so `.optional()` just works)
//   2. an unchecked checkbox means false    (so the Resource can say `z.boolean()`, not optional)
//   3. a blank row is not an item           (trailing empty row / cleared row is dropped)
//   4. an all-blank group is no value       (optional nested object -> undefined)
//   5. text that stands for another type is converted (date input -> Date, lines textarea -> string[])
import { z } from 'zod';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import { fieldRegistry, type FieldMeta, type Resource } from './resource';

export type View = 'create' | 'edit';

type Common = {
	key: string;
	label: string;
	description?: string;
	placeholder?: string;
	required: boolean;
	/** Edit only: shown as text, not submitted. */
	readOnly: boolean;
};

export type FormFieldSpec = Common &
	(
		| { kind: 'text'; format: 'text' | 'email' | 'url' }
		| { kind: 'textarea' }
		| { kind: 'number'; integer: boolean }
		| { kind: 'checkbox' }
		| { kind: 'select'; options: string[] }
		| { kind: 'date' }
		/** array of text / numbers: one input per item, or one textarea with one item per line */
		| { kind: 'list'; mode: 'rows' | 'lines'; item: FormFieldSpec }
		/** array of objects: one row (fieldset) per item */
		| { kind: 'rows'; fields: FormFieldSpec[] }
		/** nested object: a fieldset */
		| { kind: 'group'; fields: FormFieldSpec[] }
		/** a type the generator can't map. The View shows a notice; an app supplies a custom input. */
		| { kind: 'unsupported'; zodType: string }
	);

export type SpecOptions = {
	/** Default editor for arrays of text when the Field doesn't say. Toggled by the prototype's switcher. */
	listMode?: 'rows' | 'lines';
};

type AnyZod = z.ZodType & { _zod: { def: any } };

function humanize(key: string) {
	return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}

/** Peel optional / nullable / default wrappers, collecting Field metadata from every layer. */
function unwrap(schema: AnyZod) {
	let node = schema;
	let required = true;
	let meta: FieldMeta = {};
	for (;;) {
		meta = { ...(fieldRegistry.get(node) ?? {}), ...meta };
		const t = node._zod.def.type;
		if (t === 'optional' || t === 'nullable' || t === 'default') {
			required = false;
			node = node._zod.def.innerType;
		} else break;
	}
	return { node, required, meta };
}

function specFor(key: string, schema: AnyZod, opts: SpecOptions): FormFieldSpec | null {
	const { node, required, meta } = unwrap(schema);
	if (meta.hidden) return null;
	const def = node._zod.def;
	const common: Common = {
		key,
		label: meta.label ?? humanize(key),
		description: meta.description,
		placeholder: meta.placeholder,
		required,
		readOnly: meta.readOnly ?? false
	};

	switch (def.type) {
		case 'string':
			if (meta.input === 'textarea') return { ...common, kind: 'textarea' };
			if (def.format === 'date') return { ...common, kind: 'date' };
			if (def.format === 'email' || def.format === 'url')
				return { ...common, kind: 'text', format: def.format };
			return { ...common, kind: 'text', format: 'text' };
		case 'number':
			return {
				...common,
				kind: 'number',
				integer: (node as any).isInt ?? false
			};
		case 'boolean':
			return { ...common, kind: 'checkbox' };
		case 'enum':
			return { ...common, kind: 'select', options: (node as any).options };
		case 'date':
			return { ...common, kind: 'date' };
		case 'array': {
			const element = def.element as AnyZod;
			const elType = unwrap(element).node._zod.def.type;
			if (elType === 'object') {
				const inner = specFor(key, element, opts);
				if (inner?.kind !== 'group') break;
				return { ...common, kind: 'rows', fields: inner.fields };
			}
			const item = specFor('item', element, opts);
			if (!item || item.kind === 'unsupported') break;
			const mode = meta.input === 'rows' || meta.input === 'lines' ? meta.input : (opts.listMode ?? 'rows');
			return { ...common, kind: 'list', mode, item };
		}
		case 'object': {
			const fields = Object.entries((node as z.ZodObject).shape)
				.map(([k, s]) => specFor(k, s as AnyZod, opts))
				.filter((f): f is FormFieldSpec => f !== null);
			return { ...common, kind: 'group', fields };
		}
	}
	return { ...common, kind: 'unsupported', zodType: def.type };
}

/** Which Fields the create / edit View shows, and with what input. */
export function toFormSpec(resource: Resource, view: View, opts: SpecOptions = {}): FormFieldSpec[] {
	return Object.entries(resource.schema.shape)
		.filter(([key]) => key !== resource.idKey)
		.map(([key, s]) => specFor(key, s as AnyZod, opts))
		.filter((f): f is FormFieldSpec => f !== null)
		.filter((f) => view === 'edit' || !f.readOnly);
}

// ---------------------------------------------------------------------------------------------
// Prefill: record -> input values

function toInputValue(spec: FormFieldSpec, value: unknown): unknown {
	if (value === undefined || value === null) return undefined;
	switch (spec.kind) {
		case 'date':
			return value instanceof Date ? value.toISOString().slice(0, 10) : value;
		case 'list':
			return spec.mode === 'lines' && Array.isArray(value) ? value.join('\n') : value;
		case 'rows':
			return (value as Record<string, unknown>[]).map((row) => toInputValues(spec.fields, row));
		case 'group':
			return toInputValues(spec.fields, value as Record<string, unknown>);
		default:
			return value;
	}
}

function toInputValues(fields: FormFieldSpec[], record: Record<string, unknown>) {
	const out: Record<string, unknown> = {};
	for (const f of fields) {
		if (f.readOnly) continue;
		const v = toInputValue(f, record[f.key]);
		if (v !== undefined) out[f.key] = v;
	}
	return out;
}

/** The values the form starts with. Edit: from the record. Create: empty (the inputs' own defaults). */
export function toFormValues(
	resource: Resource,
	spec: FormFieldSpec[],
	record?: Record<string, unknown>
): Record<string, unknown> {
	if (!record) return {};
	return { ...toInputValues(spec, record), [resource.idKey]: record[resource.idKey] };
}

// ---------------------------------------------------------------------------------------------
// Normalise: what the browser sent -> what the Resource schema validates

const isBlank = (v: unknown): boolean =>
	v === undefined ||
	v === null ||
	v === '' ||
	v === false ||
	(Array.isArray(v) && v.every(isBlank)) ||
	(typeof v === 'object' && !Array.isArray(v) && Object.values(v as object).every(isBlank));

function normalizeValue(spec: FormFieldSpec, raw: unknown): unknown {
	switch (spec.kind) {
		case 'checkbox':
			return raw === true || raw === 'on' || raw === 'true';
		case 'text':
		case 'textarea':
			return raw === '' ? undefined : raw;
		case 'select':
			return raw === '' ? undefined : raw;
		case 'number':
			return raw === '' || (typeof raw === 'number' && Number.isNaN(raw)) ? undefined : raw;
		case 'date': {
			if (raw === '' || raw === undefined) return undefined;
			const d = new Date(`${raw}T00:00:00Z`);
			return Number.isNaN(d.getTime()) ? raw : d;
		}
		case 'list': {
			const items =
				typeof raw === 'string' ? raw.split('\n').map((s) => s.trim()) : Array.isArray(raw) ? raw : [];
			return items.map((item) => normalizeValue(spec.item, item)).filter((v) => !isBlank(v));
		}
		case 'rows': {
			const rows = Array.isArray(raw) ? raw : [];
			return rows
				.filter((row) => !isBlank(row))
				.map((row) => normalizeObject(spec.fields, row as Record<string, unknown>));
		}
		case 'group': {
			if (isBlank(raw)) return undefined;
			return normalizeObject(spec.fields, raw as Record<string, unknown>);
		}
		default:
			return raw;
	}
}

function normalizeObject(fields: FormFieldSpec[], raw: Record<string, unknown> = {}) {
	const out: Record<string, unknown> = {};
	for (const f of fields) {
		if (f.readOnly) continue;
		const v = normalizeValue(f, raw[f.key]);
		if (v !== undefined) out[f.key] = v;
	}
	return out;
}

export function normalizeFormInput(
	resource: Resource,
	view: View,
	raw: Record<string, unknown>
): Record<string, unknown> {
	// listMode doesn't matter here: a list accepts both an array (rows) and a string (lines).
	const spec = toFormSpec(resource, view);
	const out = normalizeObject(spec, raw);
	if (view === 'edit') out[resource.idKey] = raw[resource.idKey];
	return out;
}

// ---------------------------------------------------------------------------------------------
// The schema handed to form()

/**
 * Standard Schema for `form()`:
 * - create: the Resource schema minus the id and read-only Fields
 * - edit:   the same plus the id (a hidden input). Edit replaces every editable Field, so a cleared
 *           optional Field reaches the Provider as absent.
 */
export function formSchema<S extends z.ZodObject>(resource: Resource<S>, view: View) {
	const omit: Record<string, true> = {};
	for (const [key, s] of Object.entries(resource.schema.shape)) {
		const { meta } = unwrap(s as AnyZod);
		if (meta.readOnly || meta.hidden) omit[key] = true;
	}
	if (view === 'create') omit[resource.idKey] = true;
	else delete omit[resource.idKey];

	const target = resource.schema.omit(omit as never);

	const standard: StandardSchemaV1<Record<string, any>, z.infer<S>> = {
		'~standard': {
			version: 1,
			vendor: 'svelte-admin-prototype',
			validate(raw) {
				const input = normalizeFormInput(resource, view, (raw ?? {}) as Record<string, unknown>);
				const result = target.safeParse(input, {
					// one friendly message for "nothing entered"
					error: (iss) => (iss.input === undefined ? 'Required' : undefined)
				});
				if (result.success) return { value: result.data as z.infer<S> };
				return {
					issues: result.error.issues.map((i) => ({
						message: i.message,
						path: i.path as PropertyKey[]
					}))
				};
			}
		}
	};
	return standard;
}
