import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import inspect from 'vite-plugin-inspect';
import { generateResourcesPlugin } from './src/lib/vite-plugin-generate-resources';

export default defineConfig({
	plugins: [generateResourcesPlugin(), sveltekit(), inspect()]
});
