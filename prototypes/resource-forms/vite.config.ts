import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// PROTOTYPE (PER-17). SvelteKit 3 takes its config through the Vite plugin.
export default defineConfig({
	plugins: [
		sveltekit({
			experimental: { remoteFunctions: true },
			compilerOptions: { experimental: { async: true } }
		})
	]
});
