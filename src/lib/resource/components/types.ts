import type { ColumnDef } from '@tanstack/table-core';
import type {
	CreateResponse,
	DeleteOneResponse,
	GetManyResponse,
	GetOneResponse,
	UpdateResponse
} from '../schemas';

export type { ColumnDef };

// Full type for the resource object from useResource()
// Using minimal typing to support SvelteKit's remote function wrappers (query/command)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ResourceLike<TData = any> = {
	metadata: {
		name: string;
		label: string;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		columns?: readonly ColumnDef<any, any>[];
		schema: unknown;
	};
	remotes: {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		getMany: (...args: any[]) => PromiseLike<GetManyResponse<TData>>;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		getOne?: (...args: any[]) => PromiseLike<GetOneResponse<TData>>;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		create?: (...args: any[]) => PromiseLike<CreateResponse<TData>>;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		update?: (...args: any[]) => PromiseLike<UpdateResponse<TData>>;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		deleteOne?: (...args: any[]) => PromiseLike<DeleteOneResponse>;
	};
};
