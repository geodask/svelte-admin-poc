// PROTOTYPE (PER-18) — Primitive-level seam, Theme B1: Tailwind on shadcn tokens.
// A Theme is one object that fills the core's component contract. In the real thing these
// could be shadcn-svelte's own components, wrapped to the contract's props.
import type { Primitives } from '#lib/core/primitive-level/primitives.ts';
import Button from './Button.svelte';
import LinkButton from './LinkButton.svelte';
import Link from './Link.svelte';
import Input from './Input.svelte';
import Select from './Select.svelte';
import Checkbox from './Checkbox.svelte';
import Table from './Table.svelte';
import Th from './Th.svelte';
import Td from './Td.svelte';
import Badge from './Badge.svelte';
import Dialog from './Dialog.svelte';
import Heading from './Heading.svelte';
import Muted from './Muted.svelte';

export const tailwindTheme: Primitives = { Button, LinkButton, Link, Input, Select, Checkbox, Table, Th, Td, Badge, Dialog, Heading, Muted };
