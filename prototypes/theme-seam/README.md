# PROTOTYPE: where the headless core ends and a Theme begins (PER-18)

Throwaway. Answers [Where is the seam between the headless core and a Theme?](https://linear.app/geodask/issue/PER-18/where-is-the-seam-between-the-headless-core-and-a-theme), part of the [Svelte Admin direction review](https://linear.app/geodask/issue/PER-6/svelte-admin-direction-review). Lives on a throwaway branch only and never goes to `master`.

A small SvelteKit **3.2** app (Svelte 5.57, remote `query`/`command`, in-memory Provider, Tailwind v4) with one Resource, Recipes. The list View is built **both ways**, each with two Themes, plus an app route that replaces the list View under each seam.

```sh
cd prototypes/theme-seam
bun install
bun run dev        # http://localhost:5173/recipes  and  /recipes/gallery
```

- The floating bar (or ← / →) cycles `?variant=`:
  - **A1** View-level seam, Tailwind table Theme
  - **A2** View-level seam, plain-CSS cards Theme (same core, no table at all)
  - **B1** Primitive-level seam, Tailwind primitives
  - **B2** Primitive-level seam, plain-CSS primitives (A2's look, forced into the core's table)
- **Stock list View** is what the framework renders. **Replaced View** is an app's own route at that path (a recipe gallery).
- The **seam panel** under the page lists, for the current variant, what the Theme author writes, what the core ships and what the app writes to replace the View, with line counts. Expand a file to read it.
- Search, filters, sort and pagination are links and a GET form, so they all work without JS. Select rows and delete them (JS) to see the dialog primitive.
- Restarting the dev server resets the data.

## Layout (each top folder would be a package)

| Folder | Seam | What it is |
|---|---|---|
| `src/lib/core/` | both | **Headless logic, 272 lines.** `columns.ts` (Field → kind, label, sortable, filterable), `list-view.svelte.ts` (`createListView`: URL state, hrefs, selection, delete), `serve-resource.ts`, Provider and Resource types. |
| `src/lib/core/primitive-level/` | B | **View markup + component contract, 185 lines.** `ListView`, `Toolbar`, `Pagination`, `Cell`, `DeleteDialog`, and `primitives.ts` (13 entries). |
| `src/lib/themes/view-level-tailwind/` | A1 | The list View and its exported parts. 141 lines. |
| `src/lib/themes/view-level-cards/` | A2 | One `ListView.svelte`, no exported parts. 119 lines. |
| `src/lib/themes/primitive-tailwind/` | B1 | 13 primitives. 104 lines. |
| `src/lib/themes/primitive-plain/` | B2 | 13 primitives. 130 lines. |
| `src/routes/recipes/gallery/` | both | The replaced View, one version per seam. |

## What it shows

1. **The headless logic is the same under both seams.** `createListView` is the core's real API either way. The Primitive-level seam *adds* a markup layer on top; it doesn't replace anything.
2. **View-level gives a Theme total freedom.** A2 turned the list into a filter rail with cards and a sort menu, and its delete confirm is inline. The same core drove it with no change but one: **A2 needed `filterHref`, which A1 didn't.** Under this seam, the headless API grows with every Theme's needs.
3. **Primitive-level fixes the layout.** B2 matches A2's colours and type, but it's still the core's table. A Theme can restyle, not restructure. B2 did swap the modal for an inline confirm bar, because the contract only fixes props.
4. **Under Primitive-level, the core picks the meaning of each primitive, and Themes collide with it.** B2 styles a muted `Badge` as a `#hashtag`, which is right for tags. But the core also uses a muted `Badge` for a `false` boolean, so the Vegetarian column reads `#No`. Fixing it means more primitives or per-kind cell overrides in the contract.
5. **Who maps a Field kind to markup.** Both seams share the kind detection (`columns.ts`). Under View-level, the Theme owns kind → cell, and later kind → input (`Cell.svelte` in A1, inline in A2). Under Primitive-level, the core owns it (`primitive-level/Cell.svelte`) and the Theme only styles `Badge`.
6. **Theme size.** For the list View alone: a View-level Theme is 119–141 lines in 1–6 files; a primitive Theme is 104–130 lines in 13 tiny files. With detail, create/edit and the shell, the View-level Theme grows by three Views and the form inputs; the primitive contract grows by about 12 entries (text, number, date, textarea, list rows, fieldset, sidebar, nav item, header, user menu…). The real cost difference is not lines: it's that **the primitive contract is a public API every Theme implements**, so each new core feature that needs a new control is a breaking change for Themes.
7. **Replacing one View.**
   - A1 exports its parts (`Toolbar`, `Pagination`, `DeleteDialog`), so the gallery is 23 lines and matches. Those parts become the Theme's public API.
   - A2 exports only whole Views, so the gallery has to write its own search, filters and pager (38 lines) and copy the look by hand.
   - Under Primitive-level, the gallery (25 lines) reuses the core's parts and matches whichever Theme is active without knowing which. But the gallery's own card container stays grey under B2: markup outside the primitives doesn't pick up the Theme (no `Card`/surface primitive, no shared tokens).
8. **Tailwind.** B1 and A1 are Tailwind v4 classes on shadcn-style tokens (`app.css`). A published Tailwind Theme needs the app to run Tailwind v4 and add an `@source` for the Theme package; otherwise the Theme must ship precompiled CSS like A2/B2.

## Found along the way

- **Kit 3.2:** `page.url` is a readonly URL type, so build a new one with `new URL(page.url.href)`. `goto` options are now `replace` and `reset` (`replaceState`, `noScroll` and `keepFocus` are gone or deprecated).
- **Delete refresh** works as PER-12 decided: the client calls `deleteMany(ids).updates(getList)` and the server calls `requested(getList, 5).refreshAll()`, so the list comes back in the same response.
- **A GET filter form puts empty params in the URL** (`?q=&difficulty=`). Harmless, but the real list View should drop empty fields (a small `onsubmit` with JS, or ignore them on read).
