import type { ListParams, ListResult } from './provider.ts';

/**
 * A Resource's remote functions, as its `.remote.ts` module exports them. `serveResource`
 * builds them on the server; in the browser the same imports are `fetch` wrappers. A remote
 * query is a promise of its result, which is all the shared entry relies on, so it needs
 * nothing from `$app/server`, not even types.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any record type fits by default
export type ResourceRemote<T = any> = {
	getList: (params: ListParams) => Promise<ListResult<T>>;
};
