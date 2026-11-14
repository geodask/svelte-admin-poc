import { error } from '@sveltejs/kit';
import { idFromParam } from '@svelte-admin/core';
import { admin } from '#lib/admin.ts';
import type { PageLoad } from './$types';

// The id param becomes the Resource's typed id. A param that names none (`abc` for a number id)
// is a 404 here, so it never reaches the Provider.
export const load: PageLoad = ({ params }) => {
	const id = idFromParam(admin.resources[params.resource].resource, params.id);
	if (id === undefined) error(404, 'Not found');
	return { id };
};
