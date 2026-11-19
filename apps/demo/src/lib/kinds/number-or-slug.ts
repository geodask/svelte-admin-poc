// The `numberOrSlug` Kind's conversions, between the text its input sends and the Field's value, a
// number or a slug. Plain functions, so admin.ts still loads in plain Node.

/** A slug: letters, digits and underscores, in words joined by single dashes, such as `abc-1`. */
const SLUG = /^[\p{L}\p{N}_]+(-[\p{L}\p{N}_]+)*$/u;

/**
 * What was typed, as the Field's value: digits are a number (`42`), and a slug is text (`abc-1`).
 * Anything else is refused, and the message shows under the input.
 */
export function numberOrSlugFromInput(raw: string): number | string {
	const text = raw.trim();
	if (/^\d+$/.test(text) && Number.isSafeInteger(Number(text))) return Number(text);
	if (SLUG.test(text)) return text;
	throw new Error('Enter a number or a slug, such as 42 or abc-1');
}

/** The Field's value as the input shows it: as text. */
export function numberOrSlugToInput(value: unknown): string {
	return String(value);
}
