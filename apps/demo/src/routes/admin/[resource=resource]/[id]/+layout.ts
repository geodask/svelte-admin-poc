import { error } from '@sveltejs/kit';
import { idFromParam } from '@svelte-admin/core';
import { admin } from '#lib/admin.ts';
import type { LayoutLoad } from './$types';

// The id param becomes the Resource's typed id, for the detail View and the edit View under it.
// A param that names none (`abc` for a number id) is a 404 here, so it never reaches the Provider.
export const load: LayoutLoad = ({ params }) => {
	const id = idFromParam(admin.resources[params.resource].resource, params.id);
	if (id === undefined) error(404, 'Not found');
	return { id };
};
