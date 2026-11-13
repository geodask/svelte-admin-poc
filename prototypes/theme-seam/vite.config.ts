import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// PROTOTYPE (PER-18). SvelteKit 3 takes its config through the Vite plugin.
export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			experimental: { remoteFunctions: true },
			compilerOptions: { experimental: { async: true } }
		})
	]
});
