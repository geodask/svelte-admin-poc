import { z } from 'zod';
import type { FieldMeta } from './types';

/**
 * Shared zod metadata registry for resource field configuration.
 * Metadata is attached to individual zod fields via `defineField`.
 */
export const fieldRegistry = z.registry<FieldMeta>();

/**
 * Attach field metadata to a zod schema node and return the same schema.
 *
 * @param schema - zod field schema
 * @param meta - metadata to register for that schema
 * @returns The same schema instance (for chaining/inlining in z.object shape).
 */
export function defineField<T extends z.ZodType>(schema: T, meta: FieldMeta): T {
	(schema as z.ZodType).register(fieldRegistry, meta);
	return schema;
}
