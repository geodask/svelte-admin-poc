import {
	kindComponent,
	type Field,
	type FormInputSpec,
	type KindComponents,
	type KindRegistry,
	type KindSlot
} from '@svelte-admin/core';
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
 * The Theme's own Kinds, by name. A Field that names one of them is rendered with its components,
 * slot by slot, unless the app's Kind of the same name gives that slot. The Theme imports them up
 * front: only an app's Kinds must be lazy, since `admin.ts` loads in plain Node, and with these
 * lazy too, a list URL cleaned in place right after hydration failed in Kit's router. Each slot
 * reads its component when it renders, never while the modules load, so the import cycle through
 * FieldInput (which the inputs render, and which reads this registry) is safe.
 */
export const themeKinds: KindRegistry = {
	textarea: {
		input: async () => ({ default: TextareaInput }),
		cell: async () => ({ default: TextareaCell }),
		display: async () => ({ default: TextareaDisplay })
	},
	// No input: a list's own input, the app's for the built-in list Kind, or the Theme's.
	badges: {
		cell: async () => ({ default: BadgesCell }),
		display: async () => ({ default: BadgesDisplay })
	},
	image: {
		input: async () => ({ default: ImageInput }),
		cell: async () => ({ default: ImageCell }),
		display: async () => ({ default: ImageDisplay })
	}
};

/** Whether a value is a list of text, numbers or enum values, which `badges` shows. */
export function isBadgeList(value: unknown): value is (string | number)[] {
	return (
		Array.isArray(value) &&
		value.every((item) => typeof item === 'string' || typeof item === 'number')
	);
}

/** What each Theme Kind can render: which values (a cell, a display) and which inputs. */
const FITS: Readonly<
	Record<string, { value: (value: unknown) => boolean; input: (spec: FormInputSpec) => boolean }>
> = {
	textarea: { value: (value) => typeof value === 'string', input: (spec) => spec.kind === 'text' },
	badges: { value: isBadgeList, input: () => true },
	image: { value: (value) => typeof value === 'string', input: (spec) => spec.kind === 'text' }
};

/**
 * The component that renders a Field (or an input spec) in one slot, as the core's
 * `kindComponent` finds it from the app's Kinds and the Theme's, or `undefined` for the Theme's
 * built-in rendering. When that component is a Theme Kind's and the value (for a cell or a
 * display) or the input spec doesn't fit it, such as badges on a number, the Field renders as
 * its built-in Kind instead, the app's replacement of that Kind included.
 */
export function themeKindComponent<S extends KindSlot>(
	slot: S,
	of: Field | FormInputSpec,
	value: unknown,
	app: KindRegistry | undefined
): KindComponents[S] | undefined {
	const component = kindComponent(slot, of, app, themeKinds);
	const name = of.namedKind;
	if (name === undefined || component === undefined) return component;
	if (component !== themeKinds[name]?.[slot]) return component;
	const fits = slot === 'input' ? FITS[name].input(of as FormInputSpec) : FITS[name].value(value);
	return fits ? component : kindComponent(slot, { ...of, namedKind: undefined }, app, themeKinds);
}
