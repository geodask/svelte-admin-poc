// The headless Reference picker: what a Theme needs to let a person choose a Reference's record by
// its Record title, in a form and in a list View's filter. Shared and browser-safe: it reaches the
// target through the admin, so it imports no remote module itself.
import type { Admin } from './admin.ts';
import type { Field } from './fields.ts';
import type { FormInputSpec } from './form-spec.ts';
import { readReferenceInput } from './input-codec.ts';
import type { ListParams } from './provider.ts';
import { recordTitle } from './record-title.ts';
import type { ResourceRemote } from './remote.ts';
import type { Resource } from './resource.ts';

/** How many records a picker offers at most: the first page of the target it asks for. */
export const PICKER_SIZE = 50;

/**
 * One record a picker offers: its id and its Record title. `missing` marks the current choice when
 * it names no record, so its title is the id itself.
 */
export type ReferenceOption = { id: string | number; title: string; missing?: true };

/**
 * The headless Reference picker for one Reference and its current value. See
 * `createReferencePicker`.
 */
export type ReferencePicker = {
	/** The Resource the Reference points to. */
	readonly target: Resource;
	/**
	 * The current choice's Record title, through the target's `lookup`: `undefined` with no choice,
	 * when the record doesn't exist, and when the lookup fails.
	 */
	readonly title: Promise<string | undefined>;
	/**
	 * The options of a plain `<select>`, for a page without JavaScript: the target's first 50
	 * records in its default order, plus the current choice when it isn't among them (marked
	 * `missing` when it names no record). It rejects when the first page fails.
	 */
	readonly options: Promise<ReferenceOption[]>;
	/**
	 * The records whose Record title matches `text`, at most 50: a searchable target is asked to
	 * search for it; any other target's first 50 records, in its default order, are filtered by
	 * title, ignoring case. Blank text gives the first 50. It rejects when the target's `getList`
	 * fails.
	 */
	search(text: string): Promise<ReferenceOption[]>;
};

/**
 * The headless Reference picker: the target Resource, the current choice's Record title, the
 * options a page without JavaScript shows in a `<select>`, and `search` for a combobox once it has
 * hydrated. It reads the target through its remote `getList` and `lookup`, which the admin's entry
 * for the target names, so it works during SSR too. It asks for nothing until a property is read.
 *
 * `field` is a Reference Field (`view.fields` of a list or detail View) or a Reference input's
 * form spec (`view.spec` of a form View); anything else throws. `current` is the Reference's
 * value: the target's typed id, or the id as a form holds it, as text (a number id `3` as `'3'`),
 * read by the input codec with the target's id schema, as the forms and filters read it
 * (`readReferenceInput`). Empty (`undefined`, `null` or `''`) is no choice, and so is text that
 * names no id of the target (`3a` or `03` for a number id).
 *
 * @example
 * const picker = createReferencePicker(admin, spec, view.inputs.userId.value());
 * // {#each await picker.options as option (option.id)}
 */
export function createReferencePicker(
	admin: Admin,
	field: Field | FormInputSpec,
	current: unknown
): ReferencePicker {
	if (field.kind !== 'reference') {
		throw new Error(`The Field "${field.key}" is not a Reference, so it has no picker`);
	}
	// A Field names its target with `ref`; a form spec, which must stay plain data, by name.
	const name = 'ref' in field ? field.ref().name : field.target;
	// `defineAdmin` has checked that every Reference's target is mounted under its name.
	const entry = admin.resources[name];
	const target = entry.resource;
	// The input codec reads the id as a form holds it, as text, or a typed id as it prints.
	const currentId =
		typeof current === 'string' || typeof current === 'number'
			? readReferenceInput(target, String(current))
			: undefined;

	/** The target's remote functions, read loosely: the picker works for any target. */
	const remote = (): Promise<
		ResourceRemote<Record<string, unknown>, string | number, ListParams>
	> => entry.remote();

	const optionOf = (record: Record<string, unknown>): ReferenceOption => ({
		id: record.id as string | number,
		title: recordTitle(target, record)
	});

	/** The first page of the target, or of its search, as options. */
	async function firstPage(search?: string): Promise<ReferenceOption[]> {
		const params: ListParams = { page: 1, perPage: PICKER_SIZE };
		if (search !== undefined) params.search = search;
		const { data } = await (await remote()).getList(params);
		return data.map(optionOf);
	}

	/** The current record, or `null` when it doesn't exist; it rejects when the lookup fails. */
	async function lookup(id: string | number): Promise<Record<string, unknown> | null> {
		return (await remote()).lookup(id);
	}

	return {
		target,
		get title(): Promise<string | undefined> {
			if (currentId === undefined) return Promise.resolve(undefined);
			return lookup(currentId).then(
				(record) => (record === null ? undefined : recordTitle(target, record)),
				// A failed lookup leaves the picker without a title; the form still renders.
				() => undefined
			);
		},
		get options(): Promise<ReferenceOption[]> {
			return firstPage().then(async (options) => {
				if (currentId === undefined) return options;
				if (options.some((option) => String(option.id) === String(currentId))) return options;
				const record = await lookup(currentId).catch(() => null);
				const option: ReferenceOption =
					record === null
						? { id: currentId, title: String(currentId), missing: true }
						: optionOf(record);
				return [...options, option];
			});
		},
		async search(text: string): Promise<ReferenceOption[]> {
			const needle = text.trim();
			if (needle === '') return firstPage();
			if (target.searchable) return firstPage(needle);
			const lower = needle.toLowerCase();
			return (await firstPage()).filter((option) => option.title.toLowerCase().includes(lower));
		}
	};
}
