// PROTOTYPE (PER-17): just enough of the Provider contract for forms.
export type ProviderContext = { fetch: typeof fetch; locals: App.Locals };

/** A Provider throws this when the backend rejects one Field (e.g. a unique name). */
export class FieldError extends Error {
	constructor(
		public path: (string | number)[],
		message: string
	) {
		super(message);
	}
}

export type Provider<T, Id = string | number> = {
	getList(ctx: ProviderContext): Promise<{ data: T[]; total: number }>;
	getOne(ctx: ProviderContext, id: Id): Promise<T | undefined>;
	create(ctx: ProviderContext, data: Partial<T>): Promise<T>;
	/** `data` holds every editable Field. An absent optional key means the user cleared it. */
	update(ctx: ProviderContext, args: { id: Id; data: Partial<T> }): Promise<T>;
};
