import { z } from 'zod';

/**
 * The operators a list filter can use, in their canonical order: the order a Field's
 * `filterOperators` and a list's filters on one Field are kept in.
 */
export const FILTER_OPERATORS = ['eq', 'in', 'contains', 'lt', 'lte', 'gt', 'gte'] as const;

/**
 * One way a list filter compares a Field's value: equal to one value (`eq`), equal to any of
 * several (`in`), containing some text (`contains`), or below or above a bound (`lt`, `lte`,
 * `gt`, `gte`).
 */
export type FilterOperator = (typeof FILTER_OPERATORS)[number];

/**
 * The metadata a Field can carry, attached with `field()`: `label`, `description`, `hidden` (in
 * no View), `list: false` (left off the list View only), `readOnly`, `placeholder`, `input`,
 * `sortable` and `filterable`.
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
	/**
	 * Whether the backend can sort the list by this Field, so the list View offers it as the sort
	 * (its header becomes a link) and `getList` accepts it. Fields are not sortable unless they
	 * say so. Only a scalar Kind (text, number, date, enum, boolean) can be: `defineResource`
	 * throws for any other. Write it inline (or `as const`), so `ListParams` sees it.
	 */
	sortable?: true;
	/**
	 * Whether the backend can filter the list by this Field, so the list View offers a filter
	 * control for it and `getList` accepts filters on it. `true` allows every operator of the
	 * Field's Kind (text `eq`, `in`, `contains`; number and date `eq`, `lt`, `lte`, `gt`, `gte`;
	 * enum `eq`, `in`; boolean `eq`). A non-empty list allows only those, such as `['eq', 'in']`
	 * for a backend that can't match part of a text. Fields are not filterable unless they say
	 * so. Only a scalar Kind can be, its key can't be one the list URL uses (`page`, `perPage`,
	 * `sort`, `order`, `q`) or hold a `.`, and a list may name only its Kind's operators:
	 * `defineResource` throws otherwise. Write it inline (or `as const`), so `ListParams` sees it.
	 */
	filterable?: true | readonly FilterOperator[];
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
	sortable: true | undefined;
	filterable: true | readonly FilterOperator[] | undefined;
};

/** One key of the metadata as a literal type, or `undefined` when it isn't set. */
type MetaValue<M, K extends keyof FieldBrand> = M extends { readonly [P in K]: infer V }
	? V
	: undefined;

/**
 * A Field's schema as `field()` returns it: the same Zod type, branded in its type with the
 * metadata the forms' and the list's types depend on (`readOnly`, `hidden`, `input`, `sortable`
 * and `filterable`), so `FormInput`, `CreateData` and `EditData` can leave out the Fields no form
 * sets, and `ListParams` can name the sortable and filterable ones. The brand survives
 * `.optional()`, `.nullable()` and `.default()`, which keep the schema's type inside them.
 */
export type FieldSchema<T extends z.ZodType, M extends FieldMeta> = T & {
	readonly [fieldBrand]: {
		readOnly: MetaValue<M, 'readOnly'>;
		hidden: MetaValue<M, 'hidden'>;
		input: MetaValue<M, 'input'>;
		sortable: MetaValue<M, 'sortable'>;
		filterable: MetaValue<M, 'filterable'>;
	};
};

/**
 * Attach metadata to a Field's schema and return the same schema, so it can sit inline in
 * `z.object({...})`. It may go inside or outside `.optional()`, `.nullable()` and `.default()`:
 * `field(z.number(), { label: 'Calories' }).optional()` keeps its label. Its type is branded with
 * `readOnly`, `hidden`, `input`, `sortable` and `filterable`, so write the metadata inline (or
 * `as const`) for the types to see it: a read-only Field is then left out of a replaced form
 * View's typed `fields` and of the Provider's write data, a sortable one is in `ListParams`' sort,
 * and a filterable one in its filters.
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

/**
 * The operators a filter on a Field of each scalar Kind can use, in the canonical order. Its keys
 * are the scalar Kinds: the ones a Field can be sorted and filtered by.
 */
export const KIND_OPERATORS = {
	text: ['eq', 'in', 'contains'],
	number: ['eq', 'lt', 'lte', 'gt', 'gte'],
	date: ['eq', 'lt', 'lte', 'gt', 'gte'],
	enum: ['eq', 'in'],
	boolean: ['eq']
} as const satisfies Partial<Record<KindName, readonly FilterOperator[]>>;

/** The Kinds a Field can be sorted and filtered by: text, number, date, enum and boolean. */
export type ScalarKindName = keyof typeof KIND_OPERATORS;

const SCALAR_KINDS: ReadonlySet<KindName> = new Set(Object.keys(KIND_OPERATORS) as KindName[]);

/** The list URL's own params, which no filterable Field's key may be. */
export const RESERVED_LIST_KEYS = ['page', 'perPage', 'sort', 'order', 'q'] as const;

function isScalarKind(kind: KindName): kind is ScalarKindName {
	return SCALAR_KINDS.has(kind);
}

/** The operators `filterable` allows on a Field of `kind`, in the canonical order. */
function filterOperatorsOf(
	kind: KindName,
	filterable: FieldMeta['filterable']
): readonly FilterOperator[] {
	if (filterable === undefined || !isScalarKind(kind)) return [];
	if (filterable === true) return KIND_OPERATORS[kind];
	return FILTER_OPERATORS.filter((operator) => filterable.includes(operator));
}

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
	/** Whether the list can be sorted by it: see `FieldMeta.sortable`. */
	sortable: boolean;
	/**
	 * The operators the list can be filtered by it with, in the canonical order: see
	 * `FieldMeta.filterable`. Empty when it isn't filterable.
	 */
	filterOperators: readonly FilterOperator[];
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
 * A Field's metadata, looked up on its schema and every wrapper inside it; where both set a key,
 * the outer one wins.
 */
function fieldMeta(schema: z.ZodType): FieldMeta {
	return Object.assign(
		{},
		...wrapperChain(schema)
			.map((s) => fieldRegistry.get(s))
			.reverse()
	);
}

/**
 * Describe one Field from its key and schema. Metadata is looked up on the schema and every
 * wrapper inside it, so it is found whether `field()` went inside or outside `.optional()`;
 * where both set a key, the outer one wins.
 */
export function describeField(key: string, schema: z.ZodType): Field {
	const chain = wrapperChain(schema);
	const meta = fieldMeta(schema);
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
		sortable: meta.sortable === true,
		filterOperators: filterOperatorsOf(kind.kind, meta.filterable),
		list: !hidden && meta.list !== false && kind.kind !== 'object',
		detail: !hidden,
		...(object === undefined ? {} : { fields: describeFields(object) })
	};
}

/**
 * Fails at startup when a Field that isn't of a scalar Kind (text, number, date, enum, boolean)
 * is sortable: no backend sort of a list, an object or an unknown value could be offered.
 */
export function assertSortable(name: string, fields: readonly Field[]): void {
	for (const field of fields) {
		if (!field.sortable || SCALAR_KINDS.has(field.kind)) continue;
		throw new Error(
			`Resource "${name}": the Field "${field.key}" is \`sortable\`, but its Kind is ${field.kind}. ` +
				'Only a text, number, date, enum or boolean Field can be sortable.'
		);
	}
}

/**
 * Fails at startup when a Field's `filterable` can't work: on a Field that isn't of a scalar Kind,
 * as an empty list, with an operator its Kind doesn't have, or on a key the list URL can't hold
 * as a filter (one of its own params, or one with a `.`, which starts an operator suffix).
 */
export function assertFilterable(name: string, schema: z.ZodObject): void {
	for (const [key, fieldSchema] of Object.entries(schema.shape)) {
		const { filterable } = fieldMeta(fieldSchema as z.ZodType);
		if (filterable === undefined) continue;
		const fail = (problem: string): never => {
			throw new Error(`Resource "${name}": the Field "${key}" is \`filterable\`, but ${problem}`);
		};
		const { kind } = detectKind(fieldSchema as z.ZodType);
		if (!isScalarKind(kind)) {
			fail(
				`its Kind is ${kind}. Only a text, number, date, enum or boolean Field can be filterable.`
			);
		} else if (filterable !== true) {
			if (filterable.length === 0) fail('its list of operators is empty. Name at least one.');
			const allowed: readonly FilterOperator[] = KIND_OPERATORS[kind];
			const foreign = filterable.find((operator) => !allowed.includes(operator));
			if (foreign !== undefined) {
				fail(
					`it names the operator "${foreign}", which a ${kind} Field doesn't have. ` +
						`It may name ${allowed.map((operator) => `"${operator}"`).join(', ')}.`
				);
			}
		}
		if ((RESERVED_LIST_KEYS as readonly string[]).includes(key)) {
			fail(
				`its key is reserved by the list URL (${RESERVED_LIST_KEYS.join(', ')}). Rename the Field.`
			);
		}
		if (key.includes('.')) {
			fail('its key holds a ".", which the list URL uses for operators. Rename the Field.');
		}
	}
}

/** Describe every Field of an object schema, in its key order, which is the display order. */
export function describeFields(schema: z.ZodObject): Field[] {
	return Object.entries(schema.shape).map(([key, fieldSchema]) =>
		describeField(key, fieldSchema as z.ZodType)
	);
}
