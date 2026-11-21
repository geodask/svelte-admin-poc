// The core's headless View helpers. They read the page's URL and navigate, so they import
// `$app/state` and `$app/navigation`: a component may use them, but `admin.ts` and
// `src/params.ts`, which SvelteKit loads in plain Node, must not. That is why they are not on
// the shared entry. They import no UI package.
export { createDetailView, type DeleteResult, type DetailViewState } from './detail-view.svelte.ts';
export { createFormView, type FormView, type FormViewState } from './form-view.svelte.ts';
export {
	createListView,
	type BulkDeleteResult,
	type ExportResult,
	type KeptForm,
	type ListSelection,
	type ListViewState
} from './list-view.svelte.ts';
export type {
	FilterChip,
	FilterChipValue,
	FilterControl,
	FilterInput,
	FilterInputType,
	FilterOption,
	HiddenInput
} from './filter-state.ts';
export {
	createReferencePicker,
	type ReferenceOption,
	type ReferencePicker
} from './reference-picker.ts';
export type { DeleteFailure, RemoteFailure } from './remote.ts';
export {
	createShell,
	type ShellAdmin,
	type ShellItem,
	type ShellLocation,
	type ShellState
} from './shell.svelte.ts';
