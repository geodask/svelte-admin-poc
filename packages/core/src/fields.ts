import { z } from 'zod';

/**
 * The metadata a Field can carry, attached with `field()`: `label`, `description`, `hidden` (in
 * no View), `list: false` (left off the list View only), `readOnly`, `placeholder` and `input`.
 */
export type FieldMeta = {
	label?: string;
	/** Shown under the Field's label on the detail View, and as help text under its input. */
	description?: string;
	/**
	 * Shown in no View. The forms treat a hidden Field as read-only, so a save never clears a
	 * value no View shows: the backend must keep it.
	 */
	hidden?: boolean;
	list?: false;
	/**
	 * Whether the backend owns the Field, so no form can set it. `true`: it is left out of the
	 * create form, shown as text on the edit form, and left out of both form schemas, so a
	 * crafted request can't set it either. `'afterCreate'`: it is editable on create, then
	 * treated as `true` on edit (for example an email or a slug). Only a top-level Field's
	 * setting counts.
	 */
	readOnly?: FieldReadOnly;
	/** An example value, shown in the Field's input while it is empty. */
	placeholder?: string;
	/**
	 * Which input the create and edit forms give the Field, where its type leaves a choice:
	 * `textarea` for a long text Field, and for an array of text `rows` (one input per item, the
	 * default) or `lines` (one textarea with one item per line). Ignored for any other type.
	 */
	input?: FieldInputChoice;
};

/** Who may set a Field the backend owns: never (`true`), or only on create. See `FieldMeta.readOnly`. */
export type FieldReadOnly = true | 'afterCreate';

/** The choices of input a Field's metadata can make. See `FieldMeta.input`. */
export type FieldInputChoice = 'textarea' | 'rows' | 'lines';

/** The Zod registry that holds each Field's metadata. */
export const fieldRegistry = z.registry<FieldMeta>();

/**
 * Attach metadata to a Field's schema and return the same schema, so it can sit inline in
 * `z.object({...})`. It may go inside or outside `.optional()`, `.nullable()` and `.default()`:
 * `field(z.number(), { label: 'Calories' }).optional()` keeps its label.
 */
export function field<T extends z.ZodType>(schema: T, meta: FieldMeta): T {
	(schema as z.ZodType).register(fieldRegistry, meta);
	return schema;
}

/** The built-in Kinds a Field's Zod type maps to. Named Kinds and Kind registration come later. */
export type KindName =
	'text' | 'number' | 'boolean' | 'date' | 'enum' | 'list' | 'object' | 'unknown';

export type DetectedKind =
	{ kind: Exclude<KindName, 'enum'> } | { kind: 'enum'; options: readonly (string | number)[] };

const SCALAR_KINDS: ReadonlySet<KindName> = new Set(['text', 'number', 'boolean', 'date', 'enum']);

/** The wrappers a Field's type can sit in without changing its Kind. */
type Wrapper = z.ZodOptional | z.ZodNullable | z.ZodDefault;

function isWrapper(schema: z.ZodType): schema is Wrapper {
	return (
		schema instanceof z.ZodOptional ||
		schema instanceof z.ZodNullable ||
		schema instanceof z.ZodDefault
	);
}

/** The schema and every wrapper inside it, outermost first, ending at the unwrapped type. */
function wrapperChain(schema: z.ZodType): z.ZodType[] {
	const chain = [schema];
	for (let inner = schema; isWrapper(inner);) {
		inner = inner.unwrap() as z.ZodType;
		chain.push(inner);
	}
	return chain;
}

/** The schema inside any `optional`, `nullable` and `default` wrappers. */
export function unwrap(schema: z.ZodType): z.ZodType {
	return wrapperChain(schema).at(-1)!;
}

/**
 * The built-in Kind of a Field's Zod type, seen through `optional`, `nullable` and `default`.
 * Pure: it reads only the schema. ISO date and datetime strings are dates, since JSON carries
 * dates as strings.
 */
export function detectKind(schema: z.ZodType): DetectedKind {
	const type = unwrap(schema);

	if (type instanceof z.ZodISODate || type instanceof z.ZodISODateTime) return { kind: 'date' };
	if (type instanceof z.ZodEnum) return { kind: 'enum', options: type.options };
	if (type instanceof z.ZodArray) {
		const element = unwrap(type.element as z.ZodType);
		if (element instanceof z.ZodObject) return { kind: 'object' };
		return SCALAR_KINDS.has(detectKind(element).kind) ? { kind: 'list' } : { kind: 'unknown' };
	}

	// The def's type, not `instanceof`, so string and number formats (`z.email()`, `z.int()`)
	// count as their base type. `_zod.def` is Zod's API for libraries that read schemas.
	switch (type._zod.def.type) {
		case 'string':
			return { kind: 'text' };
		case 'number':
			return { kind: 'number' };
		case 'boolean':
			return { kind: 'boolean' };
		case 'date':
			return { kind: 'date' };
		case 'object':
			return { kind: 'object' };
		default:
			return { kind: 'unknown' };
	}
}

/**
 * A Field's label when it doesn't set one: its key as words in sentence case, so
 * `prepTimeMinutes` and `prep_time_minutes` both read "Prep time minutes". Acronyms keep
 * their capitals, and an `id` word reads "ID".
 */
export function defaultLabel(key: string): string {
	const words = (key.match(/\p{Lu}+(?!\p{Ll})|\p{Lu}?\p{Ll}+|\d+/gu) ?? [key]).map((word) => {
		if (word.toLowerCase() === 'id') return 'ID';
		return word.length > 1 && word === word.toUpperCase() ? word : word.toLowerCase();
	});
	const sentence = words.join(' ');
	return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/** One Field of a Resource, as the Views need it. Its Kind's details (enum options) sit beside it. */
export type Field = DetectedKind & {
	key: string;
	label: string;
	description?: string;
	/** False when any wrapper (`optional`, `nullable`, `default`) lets the value be left out. */
	required: boolean;
	/** Whether the list View shows it: not hidden, not `list: false`, and not an object. */
	list: boolean;
	/** Whether the detail View shows it: every Field that isn't hidden. */
	detail: boolean;
	/** The input its metadata chose for the forms, if any. */
	input?: FieldInputChoice;
	/** Whether the backend owns it: see `FieldMeta.readOnly`. Absent when the forms may set it. */
	readOnly?: FieldReadOnly;
	/** The example value its input shows while empty, if any. */
	placeholder?: string;
	/**
	 * For an object Field, the Fields of the object (or of each object in an array of objects),
	 * so the detail View can show it as nested label-value pairs.
	 */
	fields?: readonly Field[];
};

/** The object schema an object Field holds, directly or as the element of an array. */
function nestedObject(schema: z.ZodType): z.ZodObject | undefined {
	const type = unwrap(schema);
	const object = type instanceof z.ZodArray ? unwrap(type.element as z.ZodType) : type;
	return object instanceof z.ZodObject ? object : undefined;
}

/**
 * Describe one Field from its key and schema. Metadata is looked up on the schema and every
 * wrapper inside it, so it is found whether `field()` went inside or outside `.optional()`;
 * where both set a key, the outer one wins.
 */
export function describeField(key: string, schema: z.ZodType): Field {
	const chain = wrapperChain(schema);
	const meta: FieldMeta = Object.assign({}, ...chain.map((s) => fieldRegistry.get(s)).reverse());
	const kind = detectKind(schema);
	const hidden = meta.hidden ?? false;
	const object = kind.kind === 'object' ? nestedObject(schema) : undefined;

	return {
		...kind,
		key,
		label: meta.label ?? defaultLabel(key),
		...(meta.description === undefined ? {} : { description: meta.description }),
		...(meta.input === undefined ? {} : { input: meta.input }),
		...(meta.readOnly === undefined ? {} : { readOnly: meta.readOnly }),
		...(meta.placeholder === undefined ? {} : { placeholder: meta.placeholder }),
		required: !chain.some(isWrapper),
		list: !hidden && meta.list !== false && kind.kind !== 'object',
		detail: !hidden,
		...(object === undefined ? {} : { fields: describeFields(object) })
	};
}

/** Describe every Field of an object schema, in its key order, which is the display order. */
export function describeFields(schema: z.ZodObject): Field[] {
	return Object.entries(schema.shape).map(([key, fieldSchema]) =>
		describeField(key, fieldSchema as z.ZodType)
	);
}
