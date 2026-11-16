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

/** The key of a Field schema's type-level brand. It exists in types only, never at runtime. */
declare const fieldBrand: unique symbol;

/**
 * What `field()` records in the type of the schema it returns: the metadata the forms' types
 * depend on. A key the metadata doesn't set (or sets with a type wider than one value) is
 * `undefined`.
 */
export type FieldBrand = {
	readOnly: FieldReadOnly | undefined;
	hidden: boolean | undefined;
	input: FieldInputChoice | undefined;
};

/** One key of the metadata as a literal type, or `undefined` when it isn't set. */
type MetaValue<M, K extends keyof FieldBrand> = M extends { readonly [P in K]: infer V }
	? V
	: undefined;

/**
 * A Field's schema as `field()` returns it: the same Zod type, branded in its type with the
 * metadata the forms' types depend on (`readOnly`, `hidden` and `input`), so `FormInput`,
 * `CreateData` and `EditData` can leave out the Fields no form sets. The brand survives
 * `.optional()`, `.nullable()` and `.default()`, which keep the schema's type inside them.
 */
export type FieldSchema<T extends z.ZodType, M extends FieldMeta> = T & {
	readonly [fieldBrand]: {
		readOnly: MetaValue<M, 'readOnly'>;
		hidden: MetaValue<M, 'hidden'>;
		input: MetaValue<M, 'input'>;
	};
};

/**
 * Attach metadata to a Field's schema and return the same schema, so it can sit inline in
 * `z.object({...})`. It may go inside or outside `.optional()`, `.nullable()` and `.default()`:
 * `field(z.number(), { label: 'Calories' }).optional()` keeps its label. Its type is branded with
 * `readOnly`, `hidden` and `input`, so write the metadata inline (or `as const`) for the form
 * types to see it: a read-only Field is then left out of a replaced form View's typed `fields`
 * and of the Provider's write data.
 */
export function field<T extends z.ZodType, const M extends FieldMeta>(
	schema: T,
	meta: M
): FieldSchema<T, M> {
	(schema as z.ZodType).register(fieldRegistry, meta);
	return schema as FieldSchema<T, M>;
}

/** The schema inside an `optional`, `nullable` or `default` wrapper, in types; `never` for any other. */
type InnerSchema<S> =
	S extends z.ZodOptional<infer I>
		? I
		: S extends z.ZodNullable<infer I>
			? I
			: S extends z.ZodDefault<infer I>
				? I
				: never;

/** A Field schema's type inside any `optional`, `nullable` and `default` wrappers. */
export type UnwrappedSchema<S> = [InnerSchema<S>] extends [never]
	? S
	: UnwrappedSchema<InnerSchema<S>>;

/** Whether a Field schema's type sits in any `optional`, `nullable` or `default` wrapper. */
export type IsWrapped<S> = [InnerSchema<S>] extends [never] ? false : true;

/**
 * One key of a Field's branded metadata, looked up on the schema's type and every wrapper
 * inside it, as `describeField` does at runtime: where both set it, the outer one wins.
 */
export type FieldBrandOf<S, K extends keyof FieldBrand> = (
	S extends { readonly [fieldBrand]: infer B extends FieldBrand } ? B[K] : undefined
) extends infer Own
	? [Own] extends [undefined]
		? [InnerSchema<S>] extends [never]
			? undefined
			: FieldBrandOf<InnerSchema<S>, K>
		: Own
	: never;

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
