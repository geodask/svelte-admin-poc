import { defineResource } from '@svelte-admin/core';
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
		name: z.string(),
		email: z.email(),
		role: z.enum(['admin', 'editor', 'viewer']),
		active: z.boolean(),
		joinedAt: z.iso.datetime()
	})
});
