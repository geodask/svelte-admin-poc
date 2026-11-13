import { describe, expect, it } from 'vitest';

describe('@svelte-admin/core', () => {
	it('resolves its public entry point by package name', async () => {
		const core = await import('@svelte-admin/core');

		expect(core).toBeTypeOf('object');
	});
});
