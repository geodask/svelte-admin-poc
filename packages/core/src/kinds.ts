// Kinds: the names a Field can give itself with `kind`, the components an app registers for a
// Kind in `admin.ts`, and which component renders a Field in each slot. Shared and browser-safe:
// it holds types and pure functions only, and imports no component.
import type { Component } from 'svelte';
import type { Admin } from './admin.ts';
import type { Field, KindName } from './fields.ts';
import type { FormInputSpec } from './form-spec.ts';
import type { RemoteFormFieldLike } from './remote.ts';

/**
 * The named Kinds, by name: the Kinds a Field may name with `kind` in `field()`. Empty in the
 * core: a Theme and an app add theirs by module augmentation, so a Kind no one declared is a type
 * error. Each entry may say what its input sends, as an `input` type, which types that Field in a
 * replaced form View's `fields` (`FormInput`). Without one, the input sends what the Field's
 * built-in input would.
 *
 * @example
 * declare module '@svelte-admin/core' {
 * 	interface Kinds {
 * 		// A radio group, which sends its choice as text.
 * 		stars: { input: string };
 * 	}
 * }
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- filled by module augmentation
export interface Kinds {}

/**
 * What a Kind's input may send, as an `input` type in `Kinds`: text, a number, a boolean, or a
 * list of them, as a remote form's inputs send.
 */
export type KindInputValue = string | number | boolean | (string | number | boolean)[];

/**
 * What the input of the named Kind `K` sends, when its entry in `Kinds` says so with an `input`
 * type that is a `KindInputValue`; else `never`.
 */
export type KindInputOf<K> = K extends keyof Kinds
	? Kinds[K] extends { input: infer I extends KindInputValue }
		? I
		: never
	: never;

/**
 * What the input of the named Kind `K` sends, as its conversions see it: its `input` type in
 * `Kinds`, or any `KindInputValue` when its entry doesn't say.
 */
export type KindRawInput<K> = [KindInputOf<K>] extends [never] ? KindInputValue : KindInputOf<K>;

/**
 * A named Kind's conversions between what its input sends (`I`) and the Field's value. Both are
 * optional, and only a named Kind may have them: the core reads a built-in Kind's values itself.
 *
 * - `fromInput(raw)` turns what the input sent into the value the Resource's schema then
 *   validates, on the server and in the browser. It is never called for an empty input (no value,
 *   empty text, or a list of only those), which means no value, as for any Field. A throw becomes
 *   an issue under the Field's input, with the thrown error's message.
 * - `toInput(value)` turns the record's value into what the input shows, for the edit form's
 *   prefill. It is never called for a missing value.
 *
 * They are written as methods, so a Kind's own input type (`fromInput(raw: string)`) fits the
 * untyped `KindRegistry`.
 */
export type KindConversions<I = KindInputValue> = {
	fromInput?(raw: I): unknown;
	toInput?(value: unknown): I;
};

/** What a built-in Kind's entry in `kinds` can't have: conversions. */
type NoConversions = { fromInput?: never; toInput?: never };

/**
 * The props of a Kind's input, on the create and edit Views: the Field's input spec (from the
 * core's `createFormView(...).spec`) and its input on the remote form. The component renders the
 * label, the help text (`spec.description`) and the issues (`field.issues()`) itself, or reuses
 * the Theme's parts for them, and submits its value under the Field's name.
 */
export type KindInputProps = {
	spec: FormInputSpec;
	field: RemoteFormFieldLike;
};

/** The props of a Kind's cell, in the list View: the Field, the record's value for it, and the record. */
export type KindCellProps = {
	field: Field;
	/** The record's value for the Field. Never empty: the Theme shows an empty value itself. */
	value: unknown;
	record: Record<string, unknown>;
};

/**
 * The props of a Kind's display, on the detail View: the same as a cell's, the Field, the record's
 * value for it, and the record.
 */
export type KindDisplayProps = KindCellProps;

/**
 * One component of a Kind, as a lazy import: `() => import('./StarsCell.svelte')`. It is lazy, as
 * a Resource's icon is, because SvelteKit loads `src/params.ts`, which reads `admin.ts`, in plain
 * Node, where a `.svelte` file can't load.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Svelte's own constraint on props
export type KindComponent<P extends Record<string, any>> = () => Promise<{ default: Component<P> }>;

/**
 * A Kind: up to three components, one per slot. `input` renders the Field on the create and edit
 * Views, `cell` in the list View and `display` on the detail View. A slot left out falls back to
 * the Theme's Kind of that name, then to the Theme's built-in rendering.
 */
export type KindComponents = {
	input?: KindComponent<KindInputProps>;
	cell?: KindComponent<KindCellProps>;
	display?: KindComponent<KindDisplayProps>;
};

/** Where a Kind's component renders: `input`, `cell` or `display`. */
export type KindSlot = keyof KindComponents;

/**
 * The built-in Kinds an app Kind may replace the components of: every one but `object` and
 * `reference`, whose rendering depends on the core's nesting and Reference resolution.
 */
export type ReplaceableKindName = Exclude<KindName, 'object' | 'reference'>;

/**
 * The app's Kinds, in `admin.ts`, by name: a named Kind from `Kinds`, with its components and
 * its conversions, or a built-in Kind whose components it replaces for every Field of that Kind
 * (`date`, `boolean`...), with no conversions. Either replaces a Theme's Kind of the same name
 * slot by slot.
 */
export type AdminKinds = {
	readonly [K in keyof Kinds | ReplaceableKindName]?: K extends ReplaceableKindName
		? KindComponents & NoConversions
		: KindComponents & KindConversions<KindRawInput<K>>;
};

/** One Kind as a registry holds it, untyped: its components and its conversions. */
export type KindDefinition = KindComponents & KindConversions;

/** Kinds by name, as an app's or a Theme's registry holds them, untyped. */
export type KindRegistry = Readonly<Partial<Record<string, KindDefinition>>>;

/** A registry's Kind of a name, if it has one of its own (never an inherited key). */
export function ownKind(
	registry: KindRegistry | undefined,
	name: string | undefined
): KindDefinition | undefined {
	return registry !== undefined && name !== undefined && Object.hasOwn(registry, name)
		? registry[name]
		: undefined;
}

/** Every built-in Kind, which the core finds from a Field's schema. */
const BUILT_IN_KINDS: readonly KindName[] = [
	'text',
	'number',
	'boolean',
	'date',
	'enum',
	'list',
	'object',
	'unknown',
	'reference'
];

/** The built-in Kinds whose components can't be replaced: see `ReplaceableKindName`. */
const FIXED_KINDS: readonly KindName[] = ['object', 'reference'];

/**
 * Fails at startup when the app's Kinds replace one that can't be (`object` or `reference`), or
 * give a built-in Kind conversions, since the core reads a built-in Kind's values itself.
 * `defineAdmin` runs it.
 */
export function assertAdminKinds(kinds: KindRegistry): void {
	for (const name of FIXED_KINDS) {
		if (Object.hasOwn(kinds, name)) {
			throw new Error(
				`admin.ts replaces the Kind "${name}" in \`kinds\`, which can't be replaced in this ` +
					"version, since its rendering depends on the core's nesting and Reference resolution. " +
					'Remove it.'
			);
		}
	}
	for (const name of BUILT_IN_KINDS) {
		const kind = ownKind(kinds, name);
		for (const conversion of ['fromInput', 'toInput'] as const) {
			if (kind?.[conversion] === undefined) continue;
			throw new Error(
				`admin.ts gives the built-in Kind "${name}" \`${conversion}\` in \`kinds\`. The core ` +
					"reads a built-in Kind's values itself, so only a named Kind may convert them. Remove it."
			);
		}
	}
}

/** The form spec kinds that aren't a built-in Kind's own name. */
type InputKind = Exclude<FormInputSpec['kind'], KindName>;

/** The built-in Kind of each form spec kind that isn't a built-in Kind's own name: all of them. */
const SPEC_KINDS: Readonly<Record<InputKind, KindName>> = {
	textarea: 'text',
	checkbox: 'boolean',
	select: 'enum',
	datetime: 'date',
	rows: 'object',
	group: 'object',
	// A Field whose type has no built-in input, which only its named Kind's input renders.
	custom: 'unknown'
};

/**
 * The built-in Kind of a Field, or of the Field a form's input spec is for. A spec names its
 * input (`checkbox`, `select`...), which tells its Field's built-in Kind (`boolean`, `enum`...).
 */
export function builtInKindOf(of: Field | FormInputSpec): KindName {
	return Object.hasOwn(SPEC_KINDS, of.kind)
		? SPEC_KINDS[of.kind as InputKind]
		: (of.kind as KindName);
}

/**
 * The component that renders a Field (or a form input spec) in one slot, as a lazy import, or
 * `undefined` when the Theme's built-in rendering does. Replacement is per slot, most specific
 * first:
 *
 * 1. the app's Kind of the Field's named Kind,
 * 2. the Theme's Kind of that name,
 * 3. the app's Kind of the Field's built-in Kind, which replaces it for every Field of it,
 * 4. the Theme's Kind of that name.
 *
 * A slot a Kind leaves out falls through to the next. An object or a Reference is always the
 * Theme's built-in rendering.
 */
export function kindComponent<S extends KindSlot>(
	slot: S,
	of: Field | FormInputSpec,
	app: KindRegistry | undefined,
	theme: KindRegistry | undefined
): KindComponents[S] | undefined {
	const builtIn = builtInKindOf(of);
	if (FIXED_KINDS.includes(builtIn)) return undefined;
	for (const name of [of.namedKind, builtIn]) {
		if (name === undefined) continue;
		for (const registry of [app, theme]) {
			const component = registry?.[name]?.[slot];
			if (component !== undefined) return component;
		}
	}
	return undefined;
}

/**
 * Fails when a Field names a Kind that neither the Theme nor the app defines, naming the
 * Resource, the Field and the Kind. The core can't know a Theme's Kinds, so the Theme runs it
 * (the shadcn Theme's `AdminShell`, on first render). TypeScript catches the same mistake earlier,
 * through `Kinds`.
 */
export function assertNamedKinds(
	admin: Pick<Admin, 'resources' | 'kinds'>,
	theme: KindRegistry
): void {
	for (const { resource } of Object.values(admin.resources)) {
		for (const { key, namedKind } of resource.fields) {
			if (namedKind === undefined) continue;
			if (Object.hasOwn(admin.kinds, namedKind) || Object.hasOwn(theme, namedKind)) continue;
			throw new Error(
				`Resource "${resource.name}": the Field "${key}" names the Kind "${namedKind}", which ` +
					"neither the Theme nor admin.ts defines. Add it to the admin's `kinds`."
			);
		}
	}
}
