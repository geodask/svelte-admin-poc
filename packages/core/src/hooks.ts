// The core's hooks for an app's `hooks.server.ts`, and the admin's Kinds they hand to
// `serveResource`'s forms. Nothing here imports `$app/server`, so this entry is plain functions an
// app (or a test) can call.
import type { HandleServerError } from '@sveltejs/kit/hooks';
import type { Admin } from './admin.ts';
import {
	formSchema,
	isInputSpec,
	toFormSpec,
	type FormInput,
	type FormMode,
	type FormOutput
} from './form-spec.ts';
import type { KindRegistry } from './kinds.ts';
import type { Resource } from './resource.ts';
import type { StandardSchemaV1 } from './standard-schema.ts';
import { describeUnexpected, UNEXPECTED_MESSAGE } from './unexpected.ts';

/**
 * The server `handleError` hook. It logs unexpected errors (with their causes) and remote
 * function validation failures, and returns a message that is safe to show: an unexpected error
 * becomes a generic 500, whatever it said. An expected error (one thrown with `error()`, which
 * is how `serveResource` serves a Provider error) or
 * one of Kit's own keeps its status and message and isn't logged.
 *
 * An app whose Fields name no Kind can re-export it as it is. Once a Field names a Kind, use
 * `adminHooks(admin)`, which returns this same hook.
 *
 * @example
 * // src/hooks.server.ts
 * export { handleError } from '@svelte-admin/core/hooks';
 */
export const handleError: HandleServerError = ({ kind, error, issues, remote }) => {
	if (kind === 'unknown') {
		console.error(describeUnexpected(error));
		return { status: 500, message: UNEXPECTED_MESSAGE };
	}
	if (kind === 'validation') {
		const remoteName = [remote?.name, remote?.file && `(${remote.file})`].filter(Boolean).join(' ');
		const lines = issues.map((issue) => {
			const path = issue.path?.map((key) => (typeof key === 'object' ? key.key : key)).join('.');
			return `  ${path ? `${path}: ` : ''}${issue.message}`;
		});
		console.error(
			`Remote function ${remoteName ? `${remoteName} ` : ''}schema validation failed:\n${lines.join('\n')}`
		);
	}
	return { status: error.status, message: error.message };
};

/** The app's Kinds as `adminHooks` was given them, for `serveResource`'s forms. */
let servedKinds: KindRegistry | undefined;

/**
 * The hooks of an app whose Fields name Kinds: the same `handleError`, and the admin's Kinds
 * handed to `serveResource`'s forms, so a Kind's `fromInput` converts a Field's value on the
 * server too, before the Resource's schema validates it.
 *
 * Why the hooks file: Kit 3.2 loads it once, when the server starts, before any request. It
 * loads `src/params.ts` (and so `admin.ts`) only lazily, when a request first resolves a route
 * (`manifest.matchers()`), and a remote query call resolves none. `admin.ts` itself registers
 * nothing with the server either, so without the hooks a remote form call right after a restart
 * could reach a Kind's Field before anything gave the server its Kinds.
 *
 * @example
 * // src/hooks.server.ts
 * import { adminHooks } from '@svelte-admin/core/hooks';
 * import { admin } from '#lib/admin.ts';
 *
 * export const { handleError } = adminHooks(admin);
 */
export function adminHooks(admin: Pick<Admin, 'kinds'>): { handleError: HandleServerError } {
	servedKinds = admin.kinds;
	return { handleError };
}

/**
 * The schema `serveResource`'s create or edit form validates with: `formSchema(resource, mode,
 * kinds)` with the Kinds `adminHooks` was given, read when the form validates, so a schema built
 * before the hooks ran still converts. A form with a Field that names a Kind fails as an
 * unexpected error, naming the fix, when no admin was given, since its Kind's conversions would
 * be skipped. A form whose Fields name no Kind needs none.
 */
export function servedFormSchema<R extends Resource, M extends FormMode>(
	resource: R,
	mode: M
): StandardSchemaV1<FormInput<R, M>, FormOutput<R, M>> {
	const named = toFormSpec(resource, mode)
		.filter(isInputSpec)
		.find((spec) => spec.namedKind !== undefined);
	const withoutKinds = formSchema(resource, mode);
	let built: { kinds: KindRegistry; schema: typeof withoutKinds } | undefined;

	return {
		'~standard': {
			version: 1,
			vendor: 'svelte-admin',
			validate(value) {
				const kinds = servedKinds;
				if (kinds === undefined) {
					if (named === undefined) return withoutKinds['~standard'].validate(value);
					throw new Error(
						`The ${resource.name} form validates the Field "${named.key}", which names the Kind ` +
							`"${named.namedKind}", but no admin was given to the server. In ` +
							'src/hooks.server.ts, write `export const { handleError } = adminHooks(admin);`.'
					);
				}
				if (built?.kinds !== kinds) built = { kinds, schema: formSchema(resource, mode, kinds) };
				return built.schema['~standard'].validate(value);
			}
		}
	};
}
