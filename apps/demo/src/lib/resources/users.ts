import { defineResource, field } from '@svelte-admin/core';
import { z } from 'zod';

export const users = defineResource({
	name: 'users',
	label: 'Users',
	icon: () => import('@lucide/svelte/icons/users'),
	group: 'People',
	// The demo backend searches users by name and email.
	searchable: true,
	schema: z.object({
		id: z.number(),
		name: field(z.string(), { sortable: true }),
		// Set once on create, then shown as text on the edit View.
		email: field(z.email(), { readOnly: 'afterCreate', placeholder: 'name@example.com' }),
		// Optional, so clearing it on the edit View removes it.
		phone: z.string().optional(),
		role: field(z.enum(['admin', 'editor', 'viewer']), { filterable: true }),
		active: field(z.boolean(), { filterable: true }),
		joinedAt: field(z.iso.datetime(), { sortable: true, filterable: true })
	}),
	// The list opens in name order, with nothing in the URL.
	defaultSort: { field: 'name', order: 'asc' }
});
