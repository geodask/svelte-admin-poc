// The core's shared, browser-safe entry point. It must never import server-only code
// (`$app/server`, a Provider) or any UI package. `serveResource` lives in
// `@svelte-admin/core/server` and the bundled REST Provider in `@svelte-admin/core/rest`.
export { defineResource, type RecordOf, type Resource, type ResourceSchema } from './resource.ts';
export type { ListParams, ListResult, Provider, ProviderContext } from './provider.ts';
export { DEFAULT_PER_PAGE, MAX_PER_PAGE, listParamsSchema } from './list-params.ts';
export { defineAdmin, type AdminEntry, type ResourceNameOf } from './admin.ts';
export type { ResourceRemote } from './remote.ts';
export {
	defaultLabel,
	detectKind,
	field,
	fieldRegistry,
	type DetectedKind,
	type Field,
	type FieldMeta,
	type KindName
} from './fields.ts';
