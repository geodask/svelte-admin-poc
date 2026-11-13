// The demo backend, through the bundled REST Provider. Server-only: nothing here may reach the
// browser (CI checks the client build for the backend URL).
import { restProvider } from '@svelte-admin/core/rest';
import { BACKEND_URL } from '../../../backend/config.ts';

export const api = restProvider(BACKEND_URL);
