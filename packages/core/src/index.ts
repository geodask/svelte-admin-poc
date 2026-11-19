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
export { resolveReference, type ReferenceLink } from './reference-link.ts';
export {
	createReferencePicker,
	PICKER_SIZE,
	type ReferenceOption,
	type ReferencePicker
} from './reference-picker.ts';
export type {
	ExportParams,
	FilterableKey,
	FilterValue,
	ListFilter,
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
export { activeFilters, type ActiveFilter } from './active-filters.ts';
export {
	encodeListParams,
	listHref,
	listUrlRewrite,
	readListParams,
	type FilterFieldsResource,
	type ListHrefResource,
	type ListParamDefaults
} from './list-url.ts';
export {
	defineAdmin,
	type Admin,
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
	ExportReport,
	ExportSummary,
	RemoteCommandCall,
	RemoteFormField,
	RemoteFormFieldLike,
	RemoteFormFields,
	RemoteFormFieldsLike,
	RemoteFormInputType,
	RemoteFormIssue,
	RemoteFailure,
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
	type FilterOperator,
	type FieldInputChoice,
	type FieldMeta,
	type FieldReadOnly,
	type FieldSchema,
	type KindName,
	type ReferenceKind
} from './fields.ts';
export {
	assertNamedKinds,
	builtInKindOf,
	kindComponent,
	type AdminKinds,
	type KindCellProps,
	type KindComponent,
	type KindComponents,
	type KindDisplayProps,
	type KindInputOf,
	type KindInputProps,
	type KindInputValue,
	type KindRegistry,
	type Kinds,
	type KindSlot,
	type ReplaceableKindName
} from './kinds.ts';
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
