// PROTOTYPE (PER-18) — core. The list half of the Provider contract from PER-16.
export type ProviderContext = { fetch: typeof fetch; locals: App.Locals };

export type Filter = { field: string; value: string };
export type ListParams = {
	page: number;
	perPage: number;
	sort?: { field: string; dir: 'asc' | 'desc' };
	search?: string;
	/** flat AND list */
	filters: Filter[];
};

export type Provider<T, Id = string | number> = {
	getList(ctx: ProviderContext, params: ListParams): Promise<{ data: T[]; total: number }>;
	deleteMany?(ctx: ProviderContext, ids: Id[]): Promise<void>;
};
