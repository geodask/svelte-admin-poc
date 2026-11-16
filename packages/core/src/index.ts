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
export { idFromParam, idPathSegment, recordPath } from './ids.ts';
export { recordTitle } from './record-title.ts';
export type {
	ListParams,
	ListParamsResource,
	ListResult,
	ListSort,
	Provider,
	ProviderContext,
	ResourceProvider,
	SortableKey,
	SortOrder
} from './provider.ts';
export {
	ConflictError,
	FieldError,
	InvalidInputError,
	NotFoundError,
	ProviderError,
	type FieldIssue
} from './errors.ts';
export { DEFAULT_PER_PAGE, MAX_PER_PAGE, listParamsSchema } from './list-params.ts';
export {
	encodeListParams,
	listHref,
	listUrlRewrite,
	readListParams,
	type ListParamDefaults
} from './list-url.ts';
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
	DeleteFailure,
	DeleteManyReport,
	RemoteCommandCall,
	RemoteFormField,
	RemoteFormFieldLike,
	RemoteFormFields,
	RemoteFormFieldsLike,
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
	type FieldInputChoice,
	type FieldMeta,
	type FieldReadOnly,
	type FieldSchema,
	type KindName
} from './fields.ts';
export {
	formSchema,
	isInputSpec,
	rowCount,
	toFormSpec,
	toFormValues,
	withoutRow,
	type CreateData,
	type EditData,
	type FormFieldSpec,
	type FormInput,
	type FormInputSpec,
	type FormMode,
	type FormOutput,
	type FormReadOnlySpec,
	type FormValues
} from './form-spec.ts';
export type { StandardSchemaV1 } from './standard-schema.ts';
