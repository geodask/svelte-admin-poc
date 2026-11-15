import { defineResource, field } from '@svelte-admin/core';
import { z } from 'zod';

export const posts = defineResource({
	name: 'posts',
	label: 'Posts',
	icon: () => import('@lucide/svelte/icons/newspaper'),
	group: 'Content',
	// The demo backend can't count posts, so their list View pages with previous and next only.
	// Posts aren't searchable, so their list View shows no search box.
	schema: z.object({
		id: z.number(),
		title: z.string(),
		// A plain number for now; it becomes a Reference to users in M4.
		userId: field(z.number(), { label: 'Author ID' }),
		status: z.enum(['draft', 'published']),
		tags: z.array(z.string()),
		body: field(z.string(), { list: false })
	})
});
