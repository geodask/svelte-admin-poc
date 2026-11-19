import { describe, expect, it } from 'vitest';
import { imageSrc } from '@svelte-admin/core';

describe('imageSrc, the image URL rule', () => {
	it.each([
		['an https URL', 'https://images.example.com/pizza.jpg?w=80#top'],
		['an http URL', 'http://images.example.com/pizza.jpg'],
		['an upper-case scheme', 'HTTPS://images.example.com/pizza.jpg'],
		['a path on the same site', '/images/recipes/pizza.svg'],
		['a path with a query', '/images/pizza.svg?v=2']
	])('uses %s as the src', (_, url) => {
		expect(imageSrc(url)).toBeTypeOf('string');
	});

	it('gives the src as the browser would load it', () => {
		expect(imageSrc('https://images.example.com/a b.jpg')).toBe(
			'https://images.example.com/a%20b.jpg'
		);
		expect(imageSrc('/images/a b.svg')).toBe('/images/a%20b.svg');
		expect(imageSrc('/images/../pizza.svg')).toBe('/pizza.svg');
	});

	it.each([
		['a javascript: URL', 'javascript:alert(1)'],
		['a javascript: URL in capitals', 'JavaScript:alert(1)'],
		['a javascript: URL behind a space', ' javascript:alert(1)'],
		['a data: URL', 'data:image/svg+xml,<svg onload="alert(1)"/>'],
		['a blob: URL', 'blob:https://example.com/1'],
		['a file: URL', 'file:///etc/passwd'],
		['a protocol-relative URL', '//evil.example.com/a.png'],
		['a protocol-relative URL with a backslash', '/\\evil.example.com/a.png'],
		['a protocol-relative URL split by a tab', '/\t/evil.example.com/a.png'],
		['a protocol-relative URL split by a line break', '/\n/evil.example.com/a.png'],
		['an http URL without its slashes', 'http:evil.example.com/a.png'],
		['an https URL with one slash', 'https:/evil.example.com/a.png'],
		['an https URL with no host', 'https://'],
		['a relative path', 'images/pizza.svg'],
		['a dot path', './pizza.svg'],
		['a path behind a space', ' /images/pizza.svg'],
		['a bare host', 'evil.example.com'],
		['empty text', '']
	])('rejects %s', (_, url) => {
		expect(imageSrc(url)).toBeUndefined();
	});

	it('rejects a value that is no text', () => {
		expect(imageSrc(42)).toBeUndefined();
		expect(imageSrc(null)).toBeUndefined();
		expect(imageSrc(['/a.png'])).toBeUndefined();
	});
});
