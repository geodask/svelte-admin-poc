// PROTOTYPE (PER-17): serveResource builds a Resource's remote functions from its Provider.
// Imported only by a *.remote.ts file, so it stays on the server.
import { form, query, getRequestEvent } from '$app/server';
import { error, invalid, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import type { Resource } from './resource';
import { formSchema } from './form-spec';
import { FieldError, type Provider, type ProviderContext } from './provider';

function ctx(): ProviderContext {
	const { fetch, locals } = getRequestEvent();
	return { fetch, locals };
}

export function serveResource<S extends z.ZodObject>(
	resource: Resource<S>,
	provider: Provider<z.infer<S>, any>
) {
	type T = z.infer<S>;
	// The id is a number for this Resource. Callers must pass the same type: getOne("1") and
	// getOne(1) are different cache entries, so a .set() after a write would miss the page.
	const Id = z.number();

	const getList = query(async () => provider.getList(ctx()));

	const getOne = query(Id, async (id) => {
		const record = await provider.getOne(ctx(), id);
		if (!record) error(404, `${resource.label}: no record ${id}`);
		return record;
	});

	/** Provider FieldErrors become per-Field issues, exactly like schema issues. */
	function toIssue(e: unknown, issue: any): never {
		if (e instanceof FieldError) {
			let target = issue;
			for (const p of e.path) target = target[p];
			invalid(target(e.message));
		}
		throw e;
	}

	const create = form(formSchema(resource, 'create'), async (data, issue) => {
		let record: T;
		try {
			record = await provider.create(ctx(), data as Partial<T>);
		} catch (e) {
			toIssue(e, issue);
		}
		redirect(303, `/${resource.name}/${(record as any)[resource.idKey]}?saved=created`);
	});

	const update = form(formSchema(resource, 'edit'), async (data, issue) => {
		const { [resource.idKey]: id, ...rest } = data as Record<string, unknown>;
		let record: T;
		try {
			record = await provider.update(ctx(), { id, data: rest as Partial<T> });
		} catch (e) {
			toIssue(e, issue);
		}
		getOne(id as number).set(record!);
		redirect(303, `/${resource.name}/${id}?saved=updated`);
	});

	return { getList, getOne, create, update };
}
