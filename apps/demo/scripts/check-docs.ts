// Fails when a file the docs quote differs from the demo's own file, so the setup guide can't
// drift from the files that actually run. Each whole-file quote sits under a marker that names
// the demo file, on its own line, such as `<!-- demo: src/params.ts -->`. The fenced block after
// it must equal that file, apart from the final newline. It reads only sources: no build needed.
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const demoDir = new URL('..', import.meta.url).pathname;
const repoDir = new URL('../../..', import.meta.url).pathname;

const marker = /^<!-- demo: (\S+) -->$/;
// Anything that looks like a marker but isn't one exactly, so a typo never skips a quote.
const markerLike = /<!--\s*demo\s*:/;
// A fence may be indented, as in a list item; a quote under a marker may not.
const fenceOpen = /^\s*(`{3,}|~{3,})/;

const docs = [
	join(repoDir, 'README.md'),
	...(await readdir(join(repoDir, 'docs'), { recursive: true, withFileTypes: true }))
		.filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
		.map((entry) => join(entry.parentPath, entry.name))
];

const failures: string[] = [];
let checked = 0;

for (const doc of docs) {
	const lines = (await readFile(doc, 'utf8')).split('\n');
	const where = (index: number) => `${relative(repoDir, doc)}:${index + 1}`;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]!;

		// A fenced block not under a marker is skipped whole, so a marker shown inside one is text.
		const fence = fenceOpen.exec(line);
		if (fence) {
			i = closingFence(lines, i, fence[1]!) ?? lines.length;
			continue;
		}

		const match = marker.exec(line);
		if (!match) {
			if (markerLike.test(line)) {
				failures.push(`${where(i)}: a malformed marker; write it as <!-- demo: src/path.ts -->`);
			}
			continue;
		}

		const name = match[1]!;
		const file = join(demoDir, name);
		const label = `${where(i)} (demo: ${name})`;

		let start = i + 1;
		while (start < lines.length && lines[start]!.trim() === '') start++;
		const open = start < lines.length ? fenceOpen.exec(lines[start]!) : null;
		if (!open) {
			failures.push(`${label}: the marker has no fenced code block after it`);
			continue;
		}
		if (/^\s/.test(lines[start]!)) {
			failures.push(
				`${label}: the fenced code block after the marker is indented; quote it at the start of the line`
			);
			i = closingFence(lines, start, open[1]!) ?? lines.length;
			continue;
		}
		const end = closingFence(lines, start, open[1]!);
		if (end === undefined) {
			failures.push(`${label}: the fenced code block after the marker never closes`);
			i = lines.length;
			continue;
		}
		i = end;

		if (!existsSync(file)) {
			failures.push(`${label}: the marker names a file the demo doesn't have (apps/demo/${name})`);
			continue;
		}

		checked++;
		const quote = lines.slice(start + 1, end);
		const content = await readFile(file, 'utf8');
		const actual = (content.endsWith('\n') ? content.slice(0, -1) : content).split('\n');
		if (quote.join('\n') !== actual.join('\n')) {
			failures.push(
				`${label}: the quote differs from apps/demo/${name}\n` +
					`    - in the docs, + in the demo's file:\n` +
					formatDiff(diffLines(quote, actual))
			);
		}
	}
}

if (checked === 0 && failures.length === 0) {
	console.error(
		'No `<!-- demo: … -->` markers found in README.md or docs/, so nothing was checked.'
	);
	process.exit(1);
}

if (failures.length > 0) {
	console.error(
		`The docs don't match the demo's files:\n\n${failures.map((f) => `  - ${f}`).join('\n\n')}`
	);
	process.exit(1);
}

console.log(`The docs match the demo: ${checked} quoted files, all equal.`);

/** The index of the line that closes the fence opened at `openAt`, if there is one. */
function closingFence(lines: string[], openAt: number, opener: string): number | undefined {
	const close = new RegExp(`^\\s*${opener[0] === '`' ? '`' : '~'}{${opener.length},}\\s*$`);
	for (let i = openAt + 1; i < lines.length; i++) if (close.test(lines[i]!)) return i;
	return undefined;
}

/** A diff line: unchanged, only in the docs, or only in the demo's file. */
type Op = { change: ' ' | '-' | '+'; text: string };

/** A line diff from `a` to `b`, by their longest common subsequence. Quotes are short. */
function diffLines(a: string[], b: string[]): Op[] {
	const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
	for (let i = a.length - 1; i >= 0; i--) {
		for (let j = b.length - 1; j >= 0; j--) {
			lcs[i]![j] =
				a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
		}
	}
	const ops: Op[] = [];
	let i = 0;
	let j = 0;
	while (i < a.length && j < b.length) {
		if (a[i] === b[j]) {
			ops.push({ change: ' ', text: a[i++]! });
			j++;
		} else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) ops.push({ change: '-', text: a[i++]! });
		else ops.push({ change: '+', text: b[j++]! });
	}
	while (i < a.length) ops.push({ change: '-', text: a[i++]! });
	while (j < b.length) ops.push({ change: '+', text: b[j++]! });
	return ops;
}

/** The changed lines with two lines of context, and `…` where unchanged lines are left out. */
function formatDiff(ops: Op[]): string {
	const shown = ops.map((_, k) =>
		ops.slice(Math.max(0, k - 2), k + 3).some((op) => op.change !== ' ')
	);
	const out: string[] = [];
	ops.forEach((op, k) => {
		if (shown[k]) out.push(`      ${op.change} ${op.text}`);
		else if (out.at(-1) !== '      …') out.push('      …');
	});
	return out.join('\n');
}
