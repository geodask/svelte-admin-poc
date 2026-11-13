# PROTOTYPE: schema-driven create and edit forms (PER-17)

Throwaway. Answers [How are create and edit forms generated from the schema?](https://linear.app/geodask/issue/PER-17/how-are-create-and-edit-forms-generated-from-the-schema), part of the [Svelte Admin direction review](https://linear.app/geodask/issue/PER-6/svelte-admin-direction-review). Lives on a throwaway branch only and never goes to `master`.

A small SvelteKit **3.2** app (Svelte 5.57, real remote `form()`, in-memory Provider) with one Resource, Recipes. Its Fields cover every case the ticket asks about: text, long text, url, enum, optional enum, int, optional number, boolean, date, array of text, array of objects, optional nested object, and read-only Fields.

```sh
cd prototypes/resource-forms
bun install
bun run dev        # http://localhost:5173/recipes/new  and  /recipes/1/edit
```

- The right-hand panel shows the live form values, what the Resource schema validates after normalising, and the issues.
- The detail page shows what the Provider received on the last write.
- The floating bar (or ← / →) switches how arrays of text are edited: **A** one input per item, or **B** one item per line in a textarea (`?arrays=rows|lines`).
- To see the no-JS path, turn JavaScript off: create, edit and the issues all still work.
- Restarting the dev server resets the data.

## Where the logic is

| File | What it does |
|---|---|
| `src/lib/framework/form-spec.ts` | **The answer.** It holds three pure functions: `toFormSpec` (which input each Field gets), `toFormValues` (prefill) and `formSchema` (the Standard Schema handed to `form()`). |
| `src/lib/framework/serve-resource.ts` | `serveResource(resource, provider)` builds `getList`, `getOne`, `create` and `update`. It maps a Provider `FieldError` onto a Field issue, and redirects after a save. |
| `src/lib/framework/ResourceForm.svelte`, `FieldInput.svelte` | The generic create and edit View body. It takes the Resource as a prop and renders the spec. |
| `src/lib/recipes.ts` | The shared Resource module: schema and Field metadata. |
| `src/lib/recipes.remote.ts` | The one wiring line: `export const { getList, getOne, create, update } = serveResource(recipes, memoryProvider)`. |

## What it proposes

1. **The input comes from the Zod type, at runtime.**

   | Zod type | Input |
   |---|---|
   | string | text |
   | `z.email()` / `z.url()` | email / url |
   | `z.iso.date()` / `z.date()` | date |
   | number | number (`step=1` for int) |
   | boolean | checkbox |
   | enum | select |
   | array of text | list |
   | array of objects | rows |
   | object | fieldset |

   Field metadata `input` only settles real ambiguity: `textarea`, or `rows`/`lines`. A type with no mapping, such as a union or a record, renders a notice, and the app supplies the input. That ties into the Field-registry fog.
2. **The Resource schema stays the single source of truth.** The form layer never rewrites it. It normalises what the browser sends, then validates with the Resource's own schema, minus the id and the read-only Fields. The same wrapper runs as client `preflight`. The rules:
   - An empty input means no value: `''` becomes `undefined`, so `.optional()` just works. A required Field reports "Required".
   - An unchecked checkbox means `false`. The Resource writes `z.boolean()`; Kit's "booleans must be optional" rule is handled inside the framework.
   - A blank row isn't an item, and an all-blank optional group means no value.
   - A date string becomes a `Date`, and lines text becomes an array.
3. **Arrays:** there is always one blank row at the end. Type into it to add an item: without JS that adds one item per save. Clearing a row removes it, and × also removes it when JS is on. Arrays of objects work the same way, with one fieldset row per item.
4. **Nested objects** become a fieldset with dotted names. A child marked required in an optional group means "required once the group is filled".
5. **Read-only Fields** never appear in create. Edit shows them as text, and they are left out of the form schema, so a crafted request can't set them. The id is a hidden input, and each record gets its own instance through `update.for(id)`.
6. **Per-Field issues** come from `fields.x.issues()`. A list, rows or group shows its own issues (for example "Add at least one ingredient"). A Provider throws `FieldError(path, message)`, and `serveResource` turns it into `invalid(issue.<path>(message))`, which shows in the same place.
7. **Prefill:** `form.fields.set(toFormValues(record))` during render. It runs during SSR, so it works without JS, and Kit skips it after a failed submit, so the user's input survives.
8. **Edit replaces every editable Field.** An optional Field that is absent means the user cleared it, so `Provider.update({ id, data })` gets the whole editable record, not a patch. Without JS the browser sends every Field anyway.
9. **After a save** the handler sets `getOne(id)` and redirects with 303 to the detail View.

## Found along the way

- **A `<svelte:boundary>` with a `pending` snippet blanks SSR.** During SSR, Svelte renders only the pending snippet. With one in the layout, the page arrived as "Loading…" and the no-JS form was gone. This affects the PER-12 decision to give list and detail a pending skeleton: those Views would render no content on the server.
- **Query arguments must have one canonical type.** `getOne('1')` and `getOne(1)` are separate cache entries. A `.set()` after a write missed the detail page and showed stale data until the route passed `Number(params.id)`. So the id schema must not coerce, and turning a route param into an id is the framework's job.
- **Kit 3 upgrade facts:** `$lib` became `#lib` (a package.json `imports` entry plus explicit `.ts` extensions); `$app/environment` became `$app/env`; tsconfig extends `$app/tsconfig`; config goes through `sveltekit({...})` in `vite.config.ts`.
- **Fields are untyped in an app-written View.** The wrapper's input type is loose, so `create.fields.name` has no type in a hand-written route. A mapped input type can fix this later.
- **Zod's default messages read like developer text,** for example "Too small: expected string to have >=2 characters". Friendlier messages would come from the schema.
- A test-harness note: a Playwright full-page screenshot taken right before a click swallowed the submit. Use a tall viewport instead.
