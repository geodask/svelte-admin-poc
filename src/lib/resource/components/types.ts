import type {
	CreateResponse,
	DeleteOneResponse,
	GetManyResponse,
	GetOneResponse,
	UpdateResponse,
	GetManyParams,
	GetOneParams,
	DeleteOneParams
} from '../schemas';
import type { RemoteCommand, RemoteQueryFunction } from '@sveltejs/kit';

// Full type for the resource object from useResource()
// Using SvelteKit's exact remote function types for proper .updates(), .refresh(), etc.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ResourceLike<TData = any> = {
	metadata: {
		name: string;
		label: string;
		searchable: boolean;
		exportable: boolean;
		selectable: boolean;
		schema: unknown;
	};
	remotes: {
		getMany: RemoteQueryFunction<GetManyParams, GetManyResponse<TData>>;
		getOne: RemoteQueryFunction<GetOneParams, GetOneResponse<TData>>;
		create: RemoteCommand<Partial<TData>, Promise<CreateResponse<TData>>>;
		update: RemoteCommand<
			{ id: string | number; payload: Partial<TData> },
			Promise<UpdateResponse<TData>>
		>;
		deleteOne: RemoteCommand<DeleteOneParams, Promise<DeleteOneResponse>>;
	};
};
