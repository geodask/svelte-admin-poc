// PROTOTYPE (PER-18) — Primitive-level seam, Theme B2: plain CSS, the same warm look as Theme A2.
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

export const plainTheme: Primitives = { Button, LinkButton, Link, Input, Select, Checkbox, Table, Th, Td, Badge, Dialog, Heading, Muted };
