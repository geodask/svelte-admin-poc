import { z } from 'zod';

// Base schemas for reusable components
export const PaginationSchema = z.object({
	pageIndex: z.number().optional(),
	pageSize: z.number().optional(),
	mode: z.enum(['client', 'server', 'off']).optional()
});

export const SorterSchema = z.object({
	field: z.string(),
	order: z.enum(['asc', 'desc'])
});

export const FilterOperators = [
	'eq',
	'ne',
	'lt',
	'gt',
	'lte',
	'gte',
	'contains',
	'in',
	'nin'
] as const;

export const FilterSchema = z.object({
	field: z.string(),
	operator: z.enum(FilterOperators),
	value: z.unknown()
});

export const MetaSchema = z.record(z.string(), z.unknown());

// Input schemas for operations (generic versions used at runtime)
export const GetManyInputSchema = z
	.object({
		pagination: PaginationSchema.optional(),
		search: z.string().optional(),
		sorters: z.array(SorterSchema).optional(),
		filters: z.array(FilterSchema).optional(),
		meta: MetaSchema.optional()
	})
	.default({});

export const GetOneInputSchema = z.string().or(z.number());

export const DeleteOneInputSchema = z.string().or(z.number());

// Infer TypeScript types from Zod schemas
export type Pagination = z.infer<typeof PaginationSchema>;
export type FilterOperator = (typeof FilterOperators)[number];
export type Meta = z.infer<typeof MetaSchema>;

// Type-safe Sorter and Filter (generic on field keys)
export type Sorter<TFields extends string = string> = {
	field: TFields;
	order: 'asc' | 'desc';
};

export type Filter<TFields extends string = string> = {
	field: TFields;
	operator: FilterOperator;
	value: unknown;
};

// Type-safe GetManyParams (generic on field keys)
export type GetManyParams<TFields extends string = string> = {
	pagination?: Pagination;
	sorters?: Sorter<TFields>[];
	filters?: Filter<TFields>[];
	search?: string;
	meta?: Meta;
};

export type GetOneParams = z.infer<typeof GetOneInputSchema>;
export type DeleteOneParams = z.infer<typeof DeleteOneInputSchema>;

// Generic params that depend on the resource schema
export type CreateParams<T> = Partial<T>;

export type UpdateParams<T> = {
	id: string | number;
	payload: Partial<T>;
};

// Response types
export type GetManyResponse<T> = {
	data: T[];
	total?: number;
	pageCount?: number;
};

export type GetOneResponse<T> = {
	data: T | null;
};

export type CreateResponse<T> = {
	data: T | null;
};

export type UpdateResponse<T> = {
	data: T | null;
};

export type DeleteOneResponse = {
	data?: unknown;
};

// Provider type (generic on data type and field keys)
export type Provider<T, TFields extends string = string> = {
	getMany: (params: GetManyParams<TFields>) => Promise<GetManyResponse<T>>;
	getOne: (params: GetOneParams) => Promise<GetOneResponse<T>>;
	create: (params: CreateParams<T>) => Promise<CreateResponse<T>>;
	update: (params: UpdateParams<T>) => Promise<UpdateResponse<T>>;
	deleteOne: (params: DeleteOneParams) => Promise<DeleteOneResponse>;
};
