import type { Field, FormInputSpec, KindRegistry } from '@svelte-admin/core';
import type { Component } from 'svelte';
import TextareaInput from './kinds/TextareaInput.svelte';
import TextareaCell from './kinds/TextareaCell.svelte';
import TextareaDisplay from './kinds/TextareaDisplay.svelte';
import BadgesCell from './kinds/BadgesCell.svelte';
import BadgesDisplay from './kinds/BadgesDisplay.svelte';
import ImageInput from './kinds/ImageInput.svelte';
import ImageCell from './kinds/ImageCell.svelte';
import ImageDisplay from './kinds/ImageDisplay.svelte';

// The Theme's own Kinds, declared to the core so a Field may name them with `kind` once the Theme
// is in the app's types (any import of the Theme). None says what its input sends: each sends
// what the Field's built-in input would, text for `textarea` and `image`, and a list for `badges`.
declare module '@svelte-admin/core' {
	interface Kinds {
		/** Long text: a textarea, shown with its line breaks, and on one line in the list View. */
		textarea: object;
		/** A list of text or enum values, shown as badges. Its input is the list's own. */
		badges: object;
		/**
		 * An image's URL, shown as a thumbnail in the list View and as an image on the detail
		 * View, when the core's `imageSrc` rule allows it, and as text otherwise. Edited as a URL.
		 */
		image: object;
	}
}

/**
 * A component the Theme imports itself, as the lazy import a Kind's slot takes. An app's Kinds
 * are lazy because `admin.ts` loads in plain Node; the Theme's never do, and loading them up front
 * keeps a page from waiting on more chunks while it hydrates (with them lazy, a list URL cleaned
 * in place right after hydration failed in Kit's router).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Svelte's own constraint on props
const loaded = <P extends Record<string, any>>(component: Component<P>) => {
	const module = { default: component };
	return async () => module;
};

/**
 * The Theme's own Kinds, by name. A Field that names one of them is rendered with its components,
 * slot by slot, unless the app's Kind of the same name gives that slot. A value that doesn't fit
 * the Kind (badges on a number) falls back to the Theme's built-in rendering.
 */
export const themeKinds: KindRegistry = {
	textarea: {
		input: loaded(TextareaInput),
		cell: loaded(TextareaCell),
		display: loaded(TextareaDisplay)
	},
	// No input: a list's own input, the app's for the built-in list Kind, or the Theme's.
	badges: {
		cell: loaded(BadgesCell),
		display: loaded(BadgesDisplay)
	},
	image: {
		input: loaded(ImageInput),
		cell: loaded(ImageCell),
		display: loaded(ImageDisplay)
	}
};

/**
 * The Field (or input spec) without its named Kind, which a Theme Kind's component renders with
 * the Theme's parts when the value doesn't fit it, so they render the built-in Kind, not this one.
 * The parts get no admin, so the app's Kinds don't render it either.
 */
export function withoutNamedKind<T extends Field | FormInputSpec>(of: T): T {
	return { ...of, namedKind: undefined };
}

/** Whether a value is a list of text, numbers or enum values, which `badges` shows. */
export function isBadgeList(value: unknown): value is (string | number)[] {
	return (
		Array.isArray(value) &&
		value.every((item) => typeof item === 'string' || typeof item === 'number')
	);
}
