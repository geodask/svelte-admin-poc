// PROTOTYPE (PER-18) — core. Turns a Resource schema into list columns. Pure, no markup.
// This is the "which kind is this Field" half of the Field mapping. Both seams share it;
// they differ in who turns a kind into markup.
import { z } from 'zod';
import { fieldRegistry, type Resource } from './resource';

export type FieldKind = 'text' | 'number' | 'boolean' | 'date' | 'enum' | 'list' | 'unknown';

export type Column = {
	key: string;
	label: string;
	kind: FieldKind;
	/** enum options, for filters and badges */
	options?: readonly string[];
	sortable: boolean;
	filterable: boolean;
};

function unwrap(s: z.ZodType): z.ZodType {
	let cur = s;
	while (cur instanceof z.ZodOptional || cur instanceof z.ZodNullable || cur instanceof z.ZodDefault) {
		cur = (cur as z.ZodOptional<z.ZodType>).unwrap() as z.ZodType;
	}
	return cur;
}

function kindOf(s: z.ZodType): FieldKind {
	const t = unwrap(s);
	if (t instanceof z.ZodString) return 'text';
	if (t instanceof z.ZodNumber) return 'number';
	if (t instanceof z.ZodBoolean) return 'boolean';
	if (t instanceof z.ZodDate) return 'date';
	if (t instanceof z.ZodEnum) return 'enum';
	if (t instanceof z.ZodArray) return 'list';
	return 'unknown';
}

const humanize = (k: string) =>
	k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

export function columnsOf(resource: Resource): Column[] {
	return Object.entries(resource.schema.shape).flatMap(([key, s]) => {
		const schema = s as z.ZodType;
		const meta = fieldRegistry.get(schema) ?? {};
		if (meta.hidden) return [];
		const t = unwrap(schema);
		return [
			{
				key,
				label: meta.label ?? humanize(key),
				kind: kindOf(schema),
				options: t instanceof z.ZodEnum ? (t.options as string[]) : undefined,
				sortable: !!meta.sortable,
				filterable: !!meta.filterable
			}
		];
	});
}

/** Plain-text display of a value. A seam may use it or draw its own. */
export function formatValue(col: Column, v: unknown): string {
	if (v === undefined || v === null) return '';
	switch (col.kind) {
		case 'boolean':
			return v ? 'Yes' : 'No';
		case 'date':
			return (v as Date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
		case 'list':
			return (v as unknown[]).join(', ');
		default:
			return String(v);
	}
}
