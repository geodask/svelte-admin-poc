// The image URL rule: which stored URLs a Theme may load as an image's `src`. Shared and
// browser-safe: a pure function of the value.

/** A base no real URL has, so a path can be told apart from a URL to another host. */
const SAME_SITE = 'http://same-site.invalid';

/**
 * The `src` to load an image from, or `undefined` when the value isn't safe to load, so a Theme
 * shows it as text instead. Only two shapes are used:
 *
 * - an absolute `http:` or `https:` URL (`https://images.example.com/pizza.jpg`);
 * - a path on the same site, starting with a single `/` (`/images/pizza.svg`).
 *
 * Anything else is rejected: other schemes (`javascript:`, `data:`, `blob:`), protocol-relative
 * URLs (`//host`, and `/\host` or a `/` split by a tab, which a browser reads the same way),
 * relative paths, and any value that isn't text. The src is given as the browser would load it,
 * parsed and written again, so what is checked is what is loaded.
 */
export function imageSrc(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	if (/^https?:\/\//i.test(value)) {
		const url = parse(value);
		// The scheme is http(s), as tested above; a URL with no host doesn't parse.
		return url?.host ? url.href : undefined;
	}
	if (value.startsWith('/')) {
		const url = parse(value, SAME_SITE);
		return url?.origin === SAME_SITE ? url.pathname + url.search + url.hash : undefined;
	}
	return undefined;
}

/** The URL, or `undefined` when it doesn't parse (`URL.parse`, which older browsers lack). */
function parse(url: string, base?: string): URL | undefined {
	try {
		return new URL(url, base);
	} catch {
		return undefined;
	}
}
