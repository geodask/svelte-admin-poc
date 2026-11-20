import { z } from 'zod';
import type { Kinds } from './kinds.ts';
import type { IdOf, Resource } from './resource.ts';

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
 * `sortable`, `filterable`, `ref` and `kind`.
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
	/**
	 * The Resource whose records this Field points to, which makes it a Reference: it holds the id
	 * of a record of that Resource, and the Views show it by that record's Record title, linked to
	 * its detail View. Written as a function (`ref: () => users`), which only `defineAdmin` and the
	 * Views call, so two Resources may reference each other and a Resource itself. The Field's type
	 * (without `undefined` or `null`) must be the target's id type, the target must be in
	 * `admin.ts`, and only a top-level Field can be a Reference. A Reference can't be `sortable`,
	 * and `filterable` allows `eq` only. Write it inline, so the types see it.
	 */
	ref?: () => Resource;
	/**
	 * The named Kind the Views render the Field with, such as `'stars'`: its input on the create
	 * and edit Views, its cell in the list View and its display on the detail View, each from the
	 * app's Kind of that name in `admin.ts`, else the Theme's, else the Field's built-in rendering.
	 * It must be a name in `Kinds`, which the Theme and the app fill by module augmentation, so an
	 * unknown name is a type error. It changes how the Field looks, and its Kind may convert what
	 * its input sends (`fromInput`, `toInput`): sorting, filtering, validation and export keep
	 * following its schema. Write it inline, so the types see it.
	 */
	kind?: keyof Kinds;
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
	ref: (() => Resource) | undefined;
	kind: keyof Kinds | undefined;
};

/** One key of the metadata as a literal type, or `undefined` when it isn't set. */
type MetaValue<M, K extends keyof FieldBrand> = M extends { readonly [P in K]: infer V }
	? V
	: undefined;

/**
 * A Field's schema as `field()` returns it: the same Zod type, branded in its type with the
 * metadata the forms' and the list's types depend on (`readOnly`, `hidden`, `input`, `sortable`,
 * `filterable`, `ref` and `kind`), so `FormInput`, `CreateData` and `EditData` can leave out the
 * Fields no form sets, `FormInput` can type a Field that names a Kind, and `ListParams` can name
 * the sortable and filterable ones. The brand survives
 * `.optional()`, `.nullable()` and `.default()`, which keep the schema's type inside them.
 */
export type FieldSchema<T extends z.ZodType, M extends FieldMeta> = T & {
	readonly [fieldBrand]: {
		readOnly: MetaValue<M, 'readOnly'>;
		hidden: MetaValue<M, 'hidden'>;
		input: MetaValue<M, 'input'>;
		sortable: MetaValue<M, 'sortable'>;
		filterable: MetaValue<M, 'filterable'>;
		ref: MetaValue<M, 'ref'>;
		kind: MetaValue<M, 'kind'>;
	};
};

/** What a Reference's metadata is asked for when its type isn't its target's id type: never met. */
type RefTypeMatches = {
	"A Reference's type, without undefined or null, must be its target's id type": true;
};

/**
 * What `field()` asks of a Reference's metadata, besides `FieldMeta`: no `sortable`, and a type
 * that is its target's id type. A target whose id type TypeScript can't see takes any id type.
 */
type RefRules<T extends z.ZodType, M> = M extends { readonly ref: () => infer R extends Resource }
	? { sortable?: never } & (string | number extends IdOf<R>
			? unknown
			: [NonNullable<z.output<T>>] extends [IdOf<R>]
				? [IdOf<R>] extends [NonNullable<z.output<T>>]
					? unknown
					: RefTypeMatches
				: RefTypeMatches)
	: unknown;

/**
 * Attach metadata to a Field's schema and return the same schema, so it can sit inline in
 * `z.object({...})`. It may go inside or outside `.optional()`, `.nullable()` and `.default()`:
 * `field(z.number(), { label: 'Calories' }).optional()` keeps its label. Its type is branded with
 * `readOnly`, `hidden`, `input`, `sortable`, `filterable`, `ref` and `kind`, so write the metadata
 * inline (or `as const`) for the types to see it: a read-only Field is then left out of a replaced
 * form View's typed `fields` and of the Provider's write data, a sortable one is in `ListParams`'
 * sort, a filterable one in its filters, and one that names a Kind is typed in `fields` by what
 * that Kind's input sends. A Reference (`ref`) whose type isn't its target's id type,
 * or that is `sortable`, is a type error.
 */
export function field<T extends z.ZodType, const M extends FieldMeta>(
	schema: T,
	meta: M & NoInfer<RefRules<T, M>>
): FieldSchema<T, M> {
	// Zod's registry rewrites the metadata type in depth, which a Resource in `ref` (its schema
	// included) doesn't survive; `M` is a `FieldMeta`, so the registry holds what it expects.
	(schema as z.ZodType).register(fieldRegistry, meta as z.core.$replace<FieldMeta, z.ZodType>);
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

/**
 * The built-in Kinds: the ones the core finds from a Field's Zod type, and `reference`, found from
 * its `ref`. A Field may also name a Kind (`kind`), which changes how it is rendered and may
 * convert its input's value: see `Kinds`.
 */
export type KindName =
	'text' | 'number' | 'boolean' | 'date' | 'enum' | 'list' | 'object' | 'unknown' | 'reference';

/** The Kind `detectKind` finds from a Field's Zod type, with an enum's options. */
export type DetectedKind =
	| { kind: Exclude<KindName, 'enum' | 'reference'> }
	| { kind: 'enum'; options: readonly (string | number)[] };

/**
 * A Reference's Kind: its target, as the function `ref` names it (call it only once every
 * Resource module has loaded, as `defineAdmin` and the Views do), and its id type.
 */
export type ReferenceKind = { kind: 'reference'; ref: () => Resource; id: 'string' | 'number' };

/**
 * Which date a date Field holds: an ISO date string (`z.iso.date()`), an ISO datetime string
 * (`z.iso.datetime()`), or a `Date` (`z.date()`).
 */
export type DateType = 'date' | 'datetime' | 'Date';

/**
 * A Field's Kind with the details its inputs need, as `describeField` records them: an enum's
 * options, which date a date Field holds (`dateType`), whether a number Field is an integer
 * (`integer`), and a Reference's target and id type. Every module that reads or writes an input
 * for a Field finds these details on the Field, never in the Resource's schema.
 */
export type FieldKind =
	| { kind: Exclude<KindName, 'enum' | 'reference' | 'number' | 'date'> }
	| { kind: 'enum'; options: readonly (string | number)[] }
	| { kind: 'number'; integer: boolean }
	| { kind: 'date'; dateType: DateType }
	| ReferenceKind;

/**
 * The operators a filter on a Field of each Kind can use, in the canonical order. Its keys are the
 * Kinds a Field can be filtered by: the scalar Kinds, and a Reference, by equality.
 */
export const KIND_OPERATORS = {
	text: ['eq', 'in', 'contains'],
	number: ['eq', 'lt', 'lte', 'gt', 'gte'],
	date: ['eq', 'lt', 'lte', 'gt', 'gte'],
	enum: ['eq', 'in'],
	boolean: ['eq'],
	reference: ['eq']
} as const satisfies Partial<Record<KindName, readonly FilterOperator[]>>;

/** The Kinds a Field can be filtered by: text, number, date, enum, boolean and reference. */
export type FilterableKindName = keyof typeof KIND_OPERATORS;

const FILTERABLE_KINDS: ReadonlySet<KindName> = new Set(Object.keys(KIND_OPERATORS) as KindName[]);

/** The scalar Kinds: the ones a Field can be sorted by, and a list can hold. */
const SCALAR_KINDS: ReadonlySet<KindName> = new Set(['text', 'number', 'date', 'enum', 'boolean']);

/** The list URL's own params, which no filterable Field's key may be. */
export const RESERVED_LIST_KEYS = ['page', 'perPage', 'sort', 'order', 'q'] as const;

function isFilterableKind(kind: KindName): kind is FilterableKindName {
	return FILTERABLE_KINDS.has(kind);
}

/** The operators `filterable` allows on a Field of `kind`, in the canonical order. */
function filterOperatorsOf(
	kind: KindName,
	filterable: FieldMeta['filterable']
): readonly FilterOperator[] {
	if (filterable === undefined || !isFilterableKind(kind)) return [];
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

/**
 * One Field of a Resource, as the Views need it. `kind` is its built-in Kind, which sorting,
 * filtering, the forms' validation and export follow; its Kind's details (an enum's options,
 * which date a date Field holds, whether a number is an integer, a Reference's target and id
 * type) sit beside it: see `FieldKind`. `namedKind` is the Kind it names, if any, which the Views
 * render it with.
 */
export type Field = FieldKind & {
	key: string;
	/** The named Kind the Views render it with (`FieldMeta.kind`), if it names one. */
	namedKind?: string;
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

/** Which date a date Field's unwrapped type holds. */
function dateTypeOf(type: z.ZodType): DateType {
	if (type instanceof z.ZodISODateTime) return 'datetime';
	return type instanceof z.ZodDate ? 'Date' : 'date';
}

/**
 * A detected Kind with the details its inputs need, read from the Field's unwrapped type: which
 * date a date Field holds, and whether a number Field is an integer (`z.int()` or `.int()`).
 */
function withInputDetails(detected: DetectedKind, type: z.ZodType): FieldKind {
	switch (detected.kind) {
		case 'date':
			return { kind: 'date', dateType: dateTypeOf(type) };
		case 'number':
			return { kind: 'number', integer: (type as z.ZodNumber).isInt };
		default:
			return detected as FieldKind;
	}
}

/**
 * Describe one Field from its key and schema. Metadata is looked up on the schema and every
 * wrapper inside it, so it is found whether `field()` went inside or outside `.optional()`;
 * where both set a key, the outer one wins.
 */
export function describeField(key: string, schema: z.ZodType): Field {
	const chain = wrapperChain(schema);
	const meta = fieldMeta(schema);
	const kind: FieldKind =
		meta.ref === undefined
			? withInputDetails(detectKind(schema), unwrap(schema))
			: { kind: 'reference', ref: meta.ref, id: referenceIdType(schema) ?? 'string' };
	const hidden = meta.hidden ?? false;
	const object = kind.kind === 'object' ? nestedObject(schema) : undefined;

	return {
		...kind,
		key,
		...(meta.kind === undefined ? {} : { namedKind: meta.kind }),
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
 * is sortable: no backend sort of a list, an object, a Reference or an unknown value could be
 * offered.
 */
export function assertSortable(name: string, fields: readonly Field[]): void {
	for (const field of fields) {
		if (!field.sortable || SCALAR_KINDS.has(field.kind)) continue;
		const kind = field.kind === 'reference' ? 'it is a Reference' : `its Kind is ${field.kind}`;
		throw new Error(
			`Resource "${name}": the Field "${field.key}" is \`sortable\`, but ${kind}. ` +
				'Only a text, number, date, enum or boolean Field can be sortable.'
		);
	}
}

/** The id type a Reference's schema holds, or `undefined` when it is neither a string nor a number. */
function referenceIdType(schema: z.ZodType): ReferenceKind['id'] | undefined {
	const { type } = unwrap(schema)._zod.def;
	return type === 'string' || type === 'number' ? type : undefined;
}

/**
 * The Kind of a Field's schema as `describeField` finds it: a Reference for one with a `ref`, else
 * the Kind of its Zod type.
 */
function kindOf(schema: z.ZodType): KindName {
	return fieldMeta(schema).ref === undefined ? detectKind(schema).kind : 'reference';
}

/**
 * The path, below a Field, of the first `ref` set inside it (in a nested object or as an array's
 * element), or `undefined` when there is none.
 */
function nestedRef(schema: z.ZodType, path: string): string | undefined {
	const type = unwrap(schema);
	const inner: [z.ZodType, string][] =
		type instanceof z.ZodObject
			? Object.entries(type.shape).map(([key, child]) => [child as z.ZodType, `${path}.${key}`])
			: type instanceof z.ZodArray
				? [[type.element as z.ZodType, `${path}[]`]]
				: [];
	for (const [child, at] of inner) {
		if (fieldMeta(child).ref !== undefined) return at;
		const deeper = nestedRef(child, at);
		if (deeper !== undefined) return deeper;
	}
	return undefined;
}

/**
 * Fails at startup when a Reference can't work in this version: one whose type is neither a
 * string nor a number (an id is one), and a `ref` inside a nested object or an array, since only a
 * top-level Field can be a Reference. It never calls a `ref`, so the target may still be loading.
 */
export function assertReferences(name: string, schema: z.ZodObject): void {
	for (const [key, fieldSchema] of Object.entries(schema.shape)) {
		const nested = nestedRef(fieldSchema as z.ZodType, key);
		if (nested !== undefined) {
			throw new Error(
				`Resource "${name}": the Field "${key}" holds a Reference at "${nested}". ` +
					'Only a top-level Field can be a Reference in this version.'
			);
		}
		if (kindOf(fieldSchema as z.ZodType) !== 'reference') continue;
		if (referenceIdType(fieldSchema as z.ZodType) === undefined) {
			throw new Error(
				`Resource "${name}": the Field "${key}" is a Reference, so its type must be a string or ` +
					"a number: its target's id type."
			);
		}
	}
}

/**
 * Fails at startup when a Field's `filterable` can't work: on a Field that isn't of a scalar Kind
 * or a Reference, as an empty list, with an operator its Kind doesn't have, or on a key the list
 * URL can't hold as a filter (one of its own params, or one with a `.`, which starts an operator
 * suffix).
 */
export function assertFilterable(name: string, schema: z.ZodObject): void {
	for (const [key, fieldSchema] of Object.entries(schema.shape)) {
		const { filterable } = fieldMeta(fieldSchema as z.ZodType);
		if (filterable === undefined) continue;
		const fail = (problem: string): never => {
			throw new Error(`Resource "${name}": the Field "${key}" is \`filterable\`, but ${problem}`);
		};
		const kind = kindOf(fieldSchema as z.ZodType);
		if (!isFilterableKind(kind)) {
			fail(
				`its Kind is ${kind}. Only a text, number, date, enum, boolean or Reference Field can be ` +
					'filterable.'
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
