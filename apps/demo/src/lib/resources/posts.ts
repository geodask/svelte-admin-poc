import { defineResource, field } from '@svelte-admin/core';
import { z } from 'zod';
import { users } from './users.ts';

export const posts = defineResource({
	name: 'posts',
	label: 'Posts',
	icon: () => import('@lucide/svelte/icons/newspaper'),
	group: 'Content',
	// The demo backend can't count posts, so their list View pages with previous and next only.
	// Posts aren't searchable, so their list View shows no search box.
	schema: z.object({
		id: field(z.number(), { sortable: true }),
		title: field(z.string(), { sortable: true }),
		// A Reference to users: the Views show the author's name, linked to the user. Filtered by
		// equality, the only operator a Reference has.
		userId: field(z.number(), { label: 'Author', ref: () => users, filterable: true }),
		status: field(z.enum(['draft', 'published']), { filterable: true }),
		tags: z.array(z.string()),
		body: field(z.string(), { list: false }),
		// Counted by the backend: it starts at 0, and no form can set it. Sortable, though the list
		// doesn't show it: a sort by views still works from the URL.
		viewCount: field(z.number(), { label: 'Views', readOnly: true, list: false, sortable: true })
	}),
	// Posts have no `name` Field, so the default rule would pick `title` anyway; written out, it
	// shows the key form of the setting.
	recordTitle: 'title',
	// Newest first: the list opens sorted by id, descending, with nothing in the URL.
	defaultSort: { field: 'id', order: 'desc' },
	// Not one of the stock page sizes, so the list View offers it beside them.
	perPage: 20
});
