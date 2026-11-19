import { defineAdmin, type ResourceNameOf } from '@svelte-admin/core';
import { numberOrSlugFromInput, numberOrSlugToInput } from '#lib/kinds/number-or-slug.ts';
import { posts } from '#lib/resources/posts.ts';
import { recipes } from '#lib/resources/recipes.ts';
import { users } from '#lib/resources/users.ts';

export const admin = defineAdmin({
	basePath: '/admin',
	resources: {
		recipes: { resource: recipes, remote: () => import('#lib/resources/recipes.remote.ts') },
		posts: { resource: posts, remote: () => import('#lib/resources/posts.remote.ts') },
		users: { resource: users, remote: () => import('#lib/resources/users.remote.ts') }
	},
	// Each component is a lazy import, as a Resource's icon is: this module loads in plain Node.
	kinds: {
		// The app's own Kind, which recipes' rating names (declared in `kinds/kinds.d.ts`).
		stars: {
			input: () => import('#lib/kinds/StarsInput.svelte'),
			cell: () => import('#lib/kinds/Stars.svelte'),
			display: () => import('#lib/kinds/Stars.svelte')
		},
		// The app's Kind for recipes' source id, a number or a slug: a text input, and the
		// conversions between what it sends and the Field's value.
		numberOrSlug: {
			input: () => import('#lib/kinds/NumberOrSlugInput.svelte'),
			fromInput: numberOrSlugFromInput,
			toInput: numberOrSlugToInput
		},
		// The built-in boolean Kind's cell, replaced for every boolean Field: ✓ and ✗ in the list
		// View. Its display and input stay the Theme's.
		boolean: { cell: () => import('#lib/kinds/BooleanCell.svelte') }
	}
});

export type ResourceName = ResourceNameOf<typeof admin>;
