// Type-level tests of Kinds, checked by `tsc` (`bun run check`), never run. Each `@ts-expect-error`
// fails the check if the line below it stops being a type error.
import type { Component } from 'svelte';
import { expectTypeOf } from 'vitest';
import { z } from 'zod';
import {
	defineAdmin,
	type CreateData,
	defineResource,
	field,
	type Field,
	type FormInput,
	type FormInputSpec,
	type KindCellProps,
	type KindDisplayProps,
	type KindInputProps,
	type KindInputValue,
	type RemoteFormFieldLike,
	type ResourceRemote,
	type SortableKey
} from '@svelte-admin/core';

// The core's tests name these Kinds, as an app or a Theme would declare its own. (This augments
// the whole core project, so the runtime tests in `kinds.test.ts` may name them too.)
declare module '@svelte-admin/core' {
	interface Kinds {
		/** A radio group of 1 to 5, which sends its choice as text. */
		stars: { input: string };
		/** A Kind whose entry doesn't say what its input sends. */
		mood: object;
		/** A text input whose `fromInput` reads digits as a number and anything else as text. */
		numberOrSlug: { input: string };
	}
}

// A declared Kind name is accepted, and an unknown one rejected.
field(z.number(), { kind: 'stars' });
field(z.string(), { kind: 'mood', label: 'Mood' });
// @ts-expect-error no one declared the Kind "stras"
field(z.number(), { kind: 'stras' });
// @ts-expect-error a built-in Kind isn't a name a Field gives itself
field(z.number(), { kind: 'number' });

const recipes = defineResource({
	name: 'recipes',
	label: 'Recipes',
	schema: z.object({
		id: z.number(),
		rating: field(z.number(), { kind: 'stars', sortable: true }).optional(),
		// Inside the wrapper this time: the Kind still counts.
		score: field(z.number().optional(), { kind: 'stars' }),
		strength: field(z.number(), { kind: 'stars' }),
		mood: field(z.string(), { kind: 'mood' }),
		calories: z.number()
	})
});

// A named Kind with an `input` type maps the Field to it, on create and on edit, wrapped or not...
expectTypeOf<FormInput<typeof recipes, 'create'>['rating']>().toEqualTypeOf<string | undefined>();
expectTypeOf<FormInput<typeof recipes, 'edit'>['score']>().toEqualTypeOf<string | undefined>();
expectTypeOf<FormInput<typeof recipes, 'create'>['strength']>().toEqualTypeOf<string>();
// ...and a named Kind without one keeps what the built-in input sends, as a Field without a Kind.
expectTypeOf<FormInput<typeof recipes, 'create'>['mood']>().toEqualTypeOf<string>();
expectTypeOf<FormInput<typeof recipes, 'create'>['calories']>().toEqualTypeOf<number>();

// Sorting still reads the schema: a rating shown as stars is sortable, as a number.
expectTypeOf<SortableKey<typeof recipes>>().toEqualTypeOf<'rating'>();

// The remote functions only run inside a SvelteKit app; these checks never call them.
const remote = async () => ({}) as unknown as ResourceRemote;

// Components with the core's prop types, as an app's `.svelte` files declare them.
declare const StarsInput: Component<KindInputProps>;
declare const StarsCell: Component<KindCellProps>;
declare const StarsDisplay: Component<KindDisplayProps>;
/** A component whose props are wider than a Kind's: it ignores the record. */
declare const ValueOnly: Component<{ field: Field; value: unknown }>;
/** A component that asks for a prop no Kind slot gives. */
declare const NeedsColour: Component<{ field: Field; value: unknown; colour: string }>;
/** A component whose value must be a number, which no slot promises. */
declare const NumberCell: Component<{ field: Field; value: number; record: object }>;

// The keys of `kinds` are declared Kind names or built-in Kinds, each with lazy components.
defineAdmin({
	basePath: '/admin',
	resources: { recipes: { resource: recipes, remote } },
	kinds: {
		stars: {
			input: async () => ({ default: StarsInput }),
			cell: async () => ({ default: StarsCell }),
			display: async () => ({ default: StarsDisplay })
		},
		boolean: { cell: async () => ({ default: ValueOnly }) },
		date: { display: async () => ({ default: ValueOnly }) }
	}
});

defineAdmin({
	basePath: '/admin',
	resources: {},
	kinds: {
		// @ts-expect-error no one declared the Kind "stras"
		stras: { cell: async () => ({ default: StarsCell }) }
	}
});

defineAdmin({
	basePath: '/admin',
	resources: {},
	// @ts-expect-error a Reference's components can't be replaced
	kinds: { reference: { cell: async () => ({ default: StarsCell }) } }
});

defineAdmin({
	basePath: '/admin',
	resources: {},
	// @ts-expect-error an object's components can't be replaced
	kinds: { object: { display: async () => ({ default: StarsDisplay }) } }
});

// Each slot's component takes that slot's props.
defineAdmin({
	basePath: '/admin',
	resources: {},
	kinds: {
		stars: {
			// @ts-expect-error an input takes the spec and the form field, not a cell's props
			input: async () => ({ default: StarsCell }),
			// @ts-expect-error a cell gets no `colour`
			cell: async () => ({ default: NeedsColour }),
			// @ts-expect-error a display's value may be anything, not only a number
			display: async () => ({ default: NumberCell })
		}
	}
});

// @ts-expect-error a Kind's component is a lazy import, not the component itself
defineAdmin({ basePath: '/admin', resources: {}, kinds: { stars: { cell: StarsCell } } });

// The prop types say what each slot gets.
expectTypeOf<KindInputProps>().toEqualTypeOf<{
	spec: FormInputSpec;
	field: RemoteFormFieldLike;
}>();
expectTypeOf<KindCellProps>().toEqualTypeOf<{
	field: Field;
	value: unknown;
	record: Record<string, unknown>;
}>();
expectTypeOf<KindDisplayProps>().toEqualTypeOf<KindCellProps>();

// The admin keeps its Kinds.
const admin = defineAdmin({
	basePath: '/admin',
	resources: {},
	kinds: { stars: { cell: async () => ({ default: StarsCell }) } }
});
expectTypeOf(admin.kinds.stars?.cell).toEqualTypeOf<
	(() => Promise<{ default: Component<KindCellProps> }>) | undefined
>();

// A named Kind may convert its Field's value: `fromInput` gets what its input sends, as `Kinds`
// declares it, and `toInput` gives that back.
defineAdmin({
	basePath: '/admin',
	resources: {},
	kinds: {
		numberOrSlug: {
			input: async () => ({ default: StarsInput }),
			fromInput: (raw) => {
				expectTypeOf(raw).toEqualTypeOf<string>();
				return /^\d+$/.test(raw) ? Number(raw) : raw;
			},
			toInput: (value) => String(value)
		},
		// Without an `input` type in `Kinds`, any value a form input sends.
		mood: { fromInput: (raw) => expectTypeOf(raw).toEqualTypeOf<KindInputValue>() }
	}
});

defineAdmin({
	basePath: '/admin',
	resources: {},
	kinds: {
		// @ts-expect-error `numberOrSlug`'s input sends text, so `toInput` must give text
		numberOrSlug: { toInput: (value: unknown) => Number(value) }
	}
});

// Conversions are refused on a built-in Kind, whose values the core reads itself.
defineAdmin({
	basePath: '/admin',
	resources: {},
	// @ts-expect-error a built-in Kind can't convert
	kinds: { date: { fromInput: (raw: string) => new Date(raw) } }
});
defineAdmin({
	basePath: '/admin',
	resources: {},
	// @ts-expect-error nor write its value for the input
	kinds: { number: { cell: async () => ({ default: StarsCell }), toInput: String } }
});

// A union has no built-in input, so naming a converting Kind is what makes it editable, typed by
// what the Kind's input sends, on create and on edit.
export const sources = defineResource({
	name: 'sources',
	label: 'Sources',
	schema: z.object({
		id: z.number(),
		sourceId: field(z.union([z.string(), z.number()]), { kind: 'numberOrSlug' }),
		altId: field(z.union([z.string(), z.number()]), { kind: 'numberOrSlug' }).optional()
	})
});
expectTypeOf<FormInput<typeof sources, 'create'>['sourceId']>().toEqualTypeOf<string>();
expectTypeOf<FormInput<typeof sources, 'edit'>['altId']>().toEqualTypeOf<string | undefined>();
// The Provider still gets the schema's value.
expectTypeOf<CreateData<typeof sources>['sourceId']>().toEqualTypeOf<string | number>();
// The form spec of such a Field is a custom input.
expectTypeOf<Extract<FormInputSpec, { kind: 'custom' }>>().toExtend<{ namedKind?: string }>();
