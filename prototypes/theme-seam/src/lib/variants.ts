// PROTOTYPE (PER-18): the four variants the floating bar cycles through (?variant=).
export const variants = [
	{ key: 'A1', seam: 'view', name: 'View-level seam · Tailwind table Theme', theme: 'view-level-tailwind' },
	{ key: 'A2', seam: 'view', name: 'View-level seam · plain-CSS cards Theme', theme: 'view-level-cards' },
	{ key: 'B1', seam: 'primitive', name: 'Primitive-level seam · Tailwind primitives', theme: 'primitive-tailwind' },
	{ key: 'B2', seam: 'primitive', name: 'Primitive-level seam · plain-CSS primitives', theme: 'primitive-plain' }
] as const;

export type Variant = (typeof variants)[number];
export const variantOf = (url: { searchParams: { get(k: string): string | null } }): Variant =>
	variants.find((v) => v.key === url.searchParams.get('variant')) ?? variants[0];
