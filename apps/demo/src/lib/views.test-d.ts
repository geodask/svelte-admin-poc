// Type-level checks of the Theme's Views as the demo's routes use them, checked by svelte-check
// (`bun run check`), never run or imported. Each `@ts-expect-error` fails the check if its line
// stops being an error.
import type { ComponentProps } from 'svelte';
import { CreateView, DetailView, EditView, ListView } from '@svelte-admin/theme-shadcn';
import type { admin } from './admin.ts';
import type { users } from './resources/users.ts';

type ListProps = ComponentProps<typeof ListView>;
type DetailProps = ComponentProps<typeof DetailView>;
type CreateProps = ComponentProps<typeof CreateView>;
type EditProps = ComponentProps<typeof EditView>;

// Each View takes the admin from admin.ts...
export const listAdmin: ListProps['admin'] = {} as typeof admin;
export const detailAdmin: DetailProps['admin'] = {} as typeof admin;
export const createAdmin: CreateProps['admin'] = {} as typeof admin;
export const editAdmin: EditProps['admin'] = {} as typeof admin;

// ...and nothing that isn't an admin, such as a Resource or a part of an admin.
// @ts-expect-error a Resource is not an admin
export const listResource: ListProps['admin'] = {} as typeof users;
// @ts-expect-error the base path and sidebar alone are not an admin
export const detailPart: DetailProps['admin'] = {} as Pick<typeof admin, 'basePath' | 'sidebar'>;
// @ts-expect-error nor is one of its Resource entries
export const createEntry: CreateProps['admin'] = {} as (typeof admin)['resources']['users'];
// @ts-expect-error the admin is required
export const editWithout: EditProps = {} as Omit<EditProps, 'admin'>;
