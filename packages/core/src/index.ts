// The core's shared, browser-safe entry point. It must never import server-only code
// (`$app/server`, a Provider) or any UI package. `serveResource` lives in
// `@svelte-admin/core/server` and the bundled REST Provider in `@svelte-admin/core/rest`.
export {
	defineResource,
	type IdOf,
	type RecordOf,
	type Resource,
	type ResourceIcon,
	type ResourceSchema
} from './resource.ts';
export { idFromParam, idPathSegment } from './ids.ts';
export { recordTitle } from './record-title.ts';
export type { ListParams, ListResult, Provider, ProviderContext } from './provider.ts';
export { ConflictError, InvalidInputError, NotFoundError, ProviderError } from './errors.ts';
export { DEFAULT_PER_PAGE, MAX_PER_PAGE, listParamsSchema } from './list-params.ts';
export { listHref, listUrlRewrite, readListParams } from './list-url.ts';
export {
	defineAdmin,
	type AdminEntry,
	type AdminLocation,
	type AdminView,
	type ResourceNameOf,
	type SidebarGroup,
	type SidebarItem
} from './admin.ts';
export type {
	RemoteFormField,
	RemoteFormInputType,
	RemoteFormIssue,
	RemoteFormLike,
	RemoteRead,
	ResourceRemote
} from './remote.ts';
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
export {
	formSchema,
	toFormSpec,
	type CreateData,
	type FormFieldSpec,
	type FormInput,
	type FormMode
} from './form-spec.ts';
export type { StandardSchemaV1 } from './standard-schema.ts';
