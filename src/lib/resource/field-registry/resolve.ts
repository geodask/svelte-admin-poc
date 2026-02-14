import { z } from 'zod';
import { fieldRegistry } from './registry';
import type { ResolvedField, ViewName } from './types';

/**
 * Convert camelCase/snake-like key names into a user-friendly label.
 *
 * @param key - Field key to humanize.
 * @returns Human-readable label text.
 */
export function humanize(key: string): string {
	return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (char) => char.toUpperCase());
}

/**
 * Resolve metadata for a single zod field.
 * Applies defaults and computes `required` from zod wrappers.
 *
 * @param key - Field key in the schema shape.
 * @param schema - Zod field schema.
 * @returns Fully resolved field metadata.
 */
export function resolveField(key: string, schema: z.ZodType): ResolvedField {
	const meta = fieldRegistry.has(schema) ? fieldRegistry.get(schema) : undefined;
	const isOptional =
		schema instanceof z.ZodOptional ||
		schema instanceof z.ZodNullable ||
		schema instanceof z.ZodDefault;

	return {
		...meta,
		key,
		label: meta?.label ?? humanize(key),
		hidden: meta?.hidden ?? false,
		readOnly: meta?.readOnly ?? false,
		required: !isOptional,
		order: meta?.order ?? Infinity
	};
}

/**
 * Resolve all fields from a zod object schema.
 * Sorted by `order` ascending.
 *
 * @param schema - Zod object schema containing fields.
 * @returns Resolved fields sorted by order.
 */
export function resolveFields(schema: z.ZodObject): ResolvedField[] {
	const shape = (schema as unknown as { shape: Record<string, z.ZodType> }).shape;
	return Object.entries(shape)
		.map(([key, fieldSchema]) => resolveField(key, fieldSchema))
		.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
}

/**
 * Resolve fields for a specific view (`list`, `create`, `edit`, `detail`).
 *
 * Rules:
 * - Global `hidden` removes field from all views.
 * - `views[view].hidden` removes field from that view.
 * - View-level properties override global defaults.
 *
 * @param schema - Zod object schema containing fields.
 * @param view - Target view name.
 * @returns Resolved and filtered fields for the target view.
 */
export function fieldsForView(schema: z.ZodObject, view: ViewName): ResolvedField[] {
	return resolveFields(schema)
		.flatMap((field) => {
			if (field.hidden) return [];

			const viewConfig = field.views?.[view];
			if (viewConfig?.hidden) return [];

			const merged: ResolvedField = {
				...field,
				...(viewConfig ?? {}),
				render: viewConfig?.render
			};

			return [merged];
		})
		.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
}
