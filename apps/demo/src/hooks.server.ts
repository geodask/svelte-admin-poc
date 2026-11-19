// Unexpected errors and remote function validation failures are logged, and the user sees only
// a safe message. The admin's Kinds reach the server's forms here, so a Kind's `fromInput` (such
// as recipes' source id) converts on the server too, even for a form posted right after a restart.
import { adminHooks } from '@svelte-admin/core/hooks';
import { admin } from '#lib/admin.ts';

export const { handleError } = adminHooks(admin);
