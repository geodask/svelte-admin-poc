import type { ListParams, ListResult } from './provider.ts';

/**
 * What a remote query returns: a promise of its result that can also load it again. In the
 * browser `refresh` fetches it anew, e.g. for a Retry after a failure.
 */
export type RemoteRead<T> = Promise<T> & { refresh(): Promise<void> };

/**
 * A Resource's remote functions, as its `.remote.ts` module exports them. `serveResource`
 * builds them on the server; in the browser the same imports are `fetch` wrappers. A remote
 * query is a promise of its result with a `refresh`, which is all the shared entry relies on,
 * so it needs nothing from `$app/server`, not even types.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any record and id type fit by default
export type ResourceRemote<T = any, Id = any> = {
	getList: (params: ListParams) => RemoteRead<ListResult<T>>;
	getOne: (id: Id) => RemoteRead<T>;
};
