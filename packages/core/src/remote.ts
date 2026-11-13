// A type-only import: `verbatimModuleSyntax` erases it, so no `$app/server` code reaches the
// browser through the shared entry.
import type { RemoteQueryFunction } from '$app/server';
import type { ListParams, ListResult } from './provider.ts';

/**
 * A Resource's remote functions, as its `.remote.ts` module exports them. `serveResource`
 * builds them on the server; in the browser the same imports are `fetch` wrappers.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any record type fits by default
export type ResourceRemote<T = any> = {
	getList: RemoteQueryFunction<ListParams, ListResult<T>>;
};
