// The shadcn Theme's entry point and its public API. It renders the admin on top of the
// headless core: the shell and the Views a route passes a Resource to. It also exports the
// parts its list and detail Views are built from, so an app that replaces one View with a
// route of its own can reuse them and still match the rest of the admin. Each part takes what
// it needs as props (the core's list View helper, a Field, a value), never from context.
// Nothing else in the package is public: import only from here.

// The shell and the Views.
export { default as AdminShell } from './AdminShell.svelte';
export { default as DetailView } from './DetailView.svelte';
export { default as ErrorPage } from './ErrorPage.svelte';
export { default as ListView } from './ListView.svelte';

// Parts for a replaced list View, driven by the core's `createListView`.
export { default as Toolbar, type ToolbarProps } from './Toolbar.svelte';
export { default as Pager, type PagerProps } from './Pager.svelte';
export {
	default as SelectionCheckbox,
	type SelectionCheckboxProps
} from './SelectionCheckbox.svelte';

// The Field display: a Field's value by its Kind, in a list View cell or on the detail View.
export { default as FieldCell, type FieldCellProps } from './FieldCell.svelte';
export { default as FieldValue, type FieldValueProps } from './FieldValue.svelte';
