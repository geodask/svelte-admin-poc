import { defineParams } from '@sveltejs/kit/params';
import { admin } from '#lib/admin.ts';

export const params = defineParams({ resource: admin.matchResource });
