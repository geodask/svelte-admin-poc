import type { FormValues } from './form-spec.ts';
import type { ListResult } from './provider.ts';
import type { StandardSchemaV1 } from './standard-schema.ts';

/**
 * What a remote query returns: a promise of its result that can also load it again. In the
 * browser `refresh` fetches it anew, e.g. for a Retry after a failure.
 */
export type RemoteRead<T> = Promise<T> & { refresh(): Promise<void> };

/** An issue a remote form reports: its message, and the path of the input it belongs to. */
export type RemoteFormIssue = { message: string; path: (string | number)[] };

/**
 * One input of a remote form, or a set of them (a list, a row or a group), untyped, as a Theme
 * renders any Field: `as(type)` gives the attributes to spread onto an input (its name, type,
 * value and `aria-invalid`), and `issues()` the issues that belong to it itself. A list's items
 * and a row's or group's Fields are read by index or key: `fields.tags[0]`,
 * `fields.ingredients[2].name`. (Kit's own type is stricter; this is the part the core relies
 * on.)
 */
export type RemoteFormField = {
	/** What the input, or set of inputs, will submit: an array for a list or rows. */
	value(): unknown;
	/** Replace what it will submit, e.g. a list without the item a × button removed. */
	set(value: unknown): unknown;
	issues(): RemoteFormIssue[] | undefined;
	// Methods, so Kit's stricter, generic `as` fits them.
	as(type: RemoteFormInputType): Record<string, unknown>;
	/** A hidden input, which needs its value given, e.g. the edit form's record id. */
	as(type: 'hidden', value: string | number): Record<string, unknown>;
} & { readonly [key: string | number]: RemoteFormField };

/**
 * Any one input of a remote form, or set of them, typed or not: what a Theme part that renders
 * one Field takes. Kit's typed fields (`form.fields.title`, `form.fields.ingredients`) fit it,
 * and so does an untyped `RemoteFormField`. Every one of them is a `RemoteFormField` at runtime,
 * so such a part reads it as one. (It leaves out `as`: Kit types it per input, so a text
 * input's `as` refuses `'number'`, and no one signature fits them all.)
 */
export type RemoteFormFieldLike = {
	value(): unknown;
	// A method, so Kit's typed `set` fits it.
	set(value: unknown): unknown;
	issues(): RemoteFormIssue[] | undefined;
};

/** The input types a Theme renders a form's Fields with. */
export type RemoteFormInputType =
	'text' | 'email' | 'url' | 'number' | 'checkbox' | 'select' | 'date' | 'datetime-local';

/**
 * A remote form's `fields` as the core relies on them for any Resource: what belongs to the form
 * as a whole. Its inputs are read by key, typed from the Resource on the form `serveResource`
 * returns (`form.fields.name`), or untyped as `RemoteFormFields`.
 */
export type RemoteFormFieldsLike = {
	/**
	 * The issues of the form as a whole, which belong to no input: e.g. a conflict the backend
	 * reported for a save.
	 */
	issues(): RemoteFormIssue[] | undefined;
	allIssues(): RemoteFormIssue[] | undefined;
	/**
	 * Set every input's value, e.g. the edit form's prefill. Kit leaves a submitted form's input
	 * alone, so a failed save keeps what the user typed. (A method, so Kit's typed `set` fits.)
	 */
	set(values: FormValues): unknown;
};

/** A remote form's `fields`, untyped: what belongs to the whole form, and each input by its key. */
export type RemoteFormFields = RemoteFormFieldsLike & { readonly [key: string]: RemoteFormField };

/**
 * A remote form, as the core's helpers and a Theme use it: spread it onto a `<form>`, read its
 * inputs from `fields`, and watch `pending` while a submit is in flight. The forms
 * `serveResource` returns fit it, whatever their Resource.
 */
export type RemoteFormLike = {
	readonly method: 'POST';
	readonly action: string;
	readonly pending: number;
	/** Whether the form has been submitted at least once. */
	readonly submitted: boolean;
	readonly fields: RemoteFormFieldsLike;
	/** Check the input in the browser with `schema` before it is sent. */
	preflight(schema: StandardSchemaV1<FormValues, unknown>): RemoteFormLike;
	/** Check the input again now, e.g. as the user edits after a failed submit. */
	validate(options?: { preflightOnly?: boolean }): Promise<void>;
};

/**
 * A Resource's remote functions, as its `.remote.ts` module exports them. `serveResource`
 * builds them on the server; in the browser the same imports are `fetch` wrappers. A remote
 * query is a promise of its result with a `refresh`, and a remote form an object to spread onto
 * a `<form>`, which is all the shared entry relies on, so it needs nothing from `$app/server`,
 * not even types.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any record, id and list params fit by default
export type ResourceRemote<T = any, Id = any, List = any> = {
	/** One page of records. `List` is the Resource's `ListParams`, as `serveResource` types it. */
	getList: (params: List) => RemoteRead<ListResult<T>>;
	getOne: (id: Id) => RemoteRead<T>;
	/**
	 * One record by its id, or `null` when there is none, for a Reference that points to this
	 * Resource. A batched query: every `lookup` a page makes in the same tick is one request.
	 */
	lookup: (id: Id) => RemoteRead<T | null>;
	/** The create form: it saves a new record and redirects to its detail View. */
	create: RemoteFormLike;
	/**
	 * The edit form, one instance per record: `update.for(id)`. It saves the record's editable
	 * Fields and redirects to its detail View.
	 */
	update: RemoteFormLike & { for(id: Id): RemoteFormLike };
	/**
	 * Delete one record. A remote command, so it runs only with JavaScript: call
	 * `deleteOne(id).updates(getList)`, so the server refreshes the list queries the client has.
	 * It rejects with `{ status, body: { message } }` when the delete fails.
	 */
	deleteOne: (id: Id) => RemoteCommandCall;
	/**
	 * Delete many records: one to 1,000 ids, duplicates ignored. A remote command, so it runs only
	 * with JavaScript: call `deleteMany(ids).updates(getList)`. It reports how many were deleted,
	 * and why it stopped if it failed partway, rather than rejecting, so the list queries are
	 * refreshed either way. The deleted ids are always the first ones sent. It rejects only for
	 * invalid input (an empty array, more than 1,000 ids, or an id of the wrong type) or when the
	 * server can't be reached.
	 */
	deleteMany: (ids: Id[]) => RemoteCommandCall<DeleteManyReport>;
	/**
	 * Export every record that matches a search, a sort and filters (the list params without the
	 * page and the page size) as CSV, up to the Resource's cap. A remote command, so it runs only
	 * with JavaScript. It rejects with `{ status, body: { message } }` when the export fails, with
	 * no partial file.
	 */
	exportList: (params: Omit<List, 'page' | 'perPage'>) => RemoteCommandCall<ExportReport>;
};

/**
 * What an export holds: how many records, whether it stopped at the cap with more records left,
 * and the total the Provider counted, when it counts.
 */
export type ExportSummary = { rows: number; capped: boolean; total?: number };

/** What an export returns: the CSV file's text, and what it holds (see `ExportSummary`). */
export type ExportReport = ExportSummary & { csv: string };

/**
 * Why a remote command (a delete, an export) failed: a message safe to show, and the HTTP status
 * when the server answered.
 */
export type RemoteFailure = { status?: number; message: string };

/** Why a delete failed: see `RemoteFailure`. */
export type DeleteFailure = RemoteFailure;

/**
 * What a bulk delete reports: how many records it deleted (the first that many ids sent, in
 * order), and, when it stopped before the end, why.
 */
export type DeleteManyReport = { deleted: number } | { deleted: number; failure: ServedFailure };

/** A failure the server reports with its status: a Provider error's, or 500 for any other. */
export type ServedFailure = RemoteFailure & { status: number };

/**
 * One call of a remote command: a promise of its result, and `updates` to name the queries the
 * server refreshes along with it (e.g. a Resource's `getList`, for all its instances).
 */
export type RemoteCommandCall<T = void> = Promise<T> & {
	// A method, so Kit's stricter parameter type fits it.
	updates(...queries: unknown[]): Promise<T>;
};
