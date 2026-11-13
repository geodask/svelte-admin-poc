// Read by svelte-check only. The Theme's Views use `await` in components, which needs Svelte's
// experimental async mode, as in the app that renders them.
export default {
	compilerOptions: { experimental: { async: true } }
};
