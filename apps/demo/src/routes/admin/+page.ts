import { error, redirect } from '@sveltejs/kit';
import { admin } from '#lib/admin.ts';

// The admin's index opens the first Resource's list.
export function load() {
	if (admin.homeHref === undefined) error(404, 'Not found');
	redirect(307, admin.homeHref);
}
