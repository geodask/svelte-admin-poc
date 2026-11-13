// PROTOTYPE (PER-18) — Primitive-level seam: the component contract. The core's Views render
// every control through these; a Theme is one object that fills them in.
//
// This is the list View's share only. Detail, create/edit (FieldInput: text, number, select,
// checkbox, date, textarea, list rows, fieldset) and the admin shell (sidebar, nav item,
// header, user menu) would add roughly another 12 entries.
import { getContext, setContext, type Component, type Snippet } from 'svelte';

type Tone = 'default' | 'outline' | 'ghost' | 'destructive';

export type Primitives = {
	Button: Component<{ variant?: Tone; type?: 'button' | 'submit'; disabled?: boolean; onclick?: () => void; children: Snippet }>;
	/** an <a> that looks like a Button (pagination, sort, "New") */
	LinkButton: Component<{ href: string; variant?: Tone; active?: boolean; disabled?: boolean; label?: string; children: Snippet }>;
	/** an inline text link */
	Link: Component<{ href: string; children: Snippet }>;
	Input: Component<{ name: string; value?: string; placeholder?: string }>;
	Select: Component<{ name: string; value?: string; label: string; options: { value: string; label: string }[] }>;
	Checkbox: Component<{ checked: boolean; label: string; onchange: (checked: boolean) => void }>;
	/** wraps <thead>/<tbody> the core writes */
	Table: Component<{ children: Snippet }>;
	Th: Component<{ align?: 'left' | 'right'; children?: Snippet }>;
	Td: Component<{ align?: 'left' | 'right'; children?: Snippet }>;
	Badge: Component<{ tone?: 'default' | 'muted' | 'positive'; children: Snippet }>;
	Dialog: Component<{ open: boolean; title: string; description?: string; onclose: () => void; actions: Snippet }>;
	Heading: Component<{ children: Snippet }>;
	Muted: Component<{ children: Snippet }>;
};

const KEY = Symbol('primitives');
export const setPrimitives = (p: Primitives) => setContext(KEY, p);
export const primitives = () => getContext<Primitives>(KEY);

/** For Theme authors: `let { … }: PropsOf<'Button'> = $props()` */
export type PropsOf<K extends keyof Primitives> = import('svelte').ComponentProps<Primitives[K]>;
