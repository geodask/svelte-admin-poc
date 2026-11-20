---
status: accepted
---

# The demo passes the success test

PER-11 set a success test for the Admin framework: one real app runs its admin on it with 3+ Resources, each wired in about 4 lines plus its schema, with replaced Views as the exception. It also set a rethink trigger: most Resources in that app need replaced Views, or per-Field metadata grows until it is no shorter than hand-written Fields. After M5 we measured the demo, which stands in for that app (ADR 0001), under the counting rule below. Each of its three Resources is wired in 7 lines. None of them needs a replaced View. Per-Field metadata averages 1.0 line, against 7.3 and 14.6 lines per Field in the demo's two hand-written Views. Neither half of the trigger fired, so the design stays as it is, and the docs say 7 lines instead of "about 4".

## Counting rule

Written down so that the next run is comparable.

- Lines are counted as Prettier formats them (the repo's `.prettierrc`, print width 100), leaving out blank lines and whole-line comments.
- **Wiring** is every line an app writes per Resource beyond its shared module: the remote module, imports included, plus the Resource's import and its entry in `admin.ts`. An own Provider module counts separately, as **Provider code**. Files an app writes once for all its Resources (the route files, `backend.ts`, the app's own Kinds) are not per Resource and aren't counted.
- **Per-Field metadata** is the lines a Field's `field()` call and its settings add beyond the same Field written as its bare Zod type. A Field whose settings still fit on its one line counts as 1, so no setting is free. Zod's own checks and modifiers (`.min(1)`, `.optional()`) are schema, not metadata. A Resource's settings outside its schema (`label`, `icon`, `defaultSort` and the rest) aren't per-Field metadata either.
- **Hand-written cost per Field** is a replaced View's lines divided by the Fields it lays out.

## Wiring

| Resource | Remote module | `admin.ts` | Wiring | Provider code                | Shared module |
| -------- | ------------- | ---------- | ------ | ---------------------------- | ------------- |
| recipes  | 5             | 2          | 7      | none (bundled REST Provider) | 42            |
| users    | 5             | 2          | 7      | none (bundled REST Provider) | 19            |
| posts    | 5             | 2          | 7      | 17 (`posts-provider.ts`)     | 22            |

The remote module is three imports and one statement that Prettier breaks over two lines. In `admin.ts` the Resource takes its import and its one-line entry. So 4 of the 7 lines are imports. The bundled REST Provider costs the app 3 lines once (`backend.ts`), shared by every Resource that uses it.

7 is more than PER-11's "about 4". The success test's number isn't part of the rethink trigger, so this doesn't fire it. The README and ADR 0001 now say 7.

## Replaced Views

| Resource | Replaced Views             | Why                          | Needed in a real app? |
| -------- | -------------------------- | ---------------------------- | --------------------- |
| recipes  | none                       |                              |                       |
| users    | list (a card grid)         | to demonstrate replacing one | No                    |
| posts    | create (a two-column form) | to demonstrate replacing one | No                    |

- **Users' list View.** Six short Fields fit the stock table well, and the stock table has the sort that the card grid leaves out. A real app would keep the stock View.
- **Posts' create View.** The stock create View renders the same Fields with the same inputs: the body's textarea, the tags' list and the author's Reference picker. Only the layout differs. A real app would keep the stock View unless its authors wanted that layout.

By presence, 2 of the 3 Resources replace a View, which reads as "most". By need, which is what the trigger asks, none of them do. The first half of the trigger has not fired.

## Per-Field metadata

| Resource  | Fields | With metadata | Metadata lines | Settings | Lines per Field |
| --------- | ------ | ------------- | -------------- | -------- | --------------- |
| recipes   | 18     | 14            | 22             | 26       | 1.2             |
| users     | 7      | 5             | 5              | 7        | 0.7             |
| posts     | 8      | 7             | 7              | 14       | 0.9             |
| **Total** | **33** | **26**        | **34**         | **47**   | **1.0**         |

Per Field:

- **recipes:** `name` 4, `prepTimeMinutes` 4, `sourceId` 3. `cuisine`, `difficulty`, `caloriesPerServing`, `vegetarian`, `tags`, `reviewCount`, `publishedAt`, `rating`, `instructions`, `imageUrl` and `internalNotes` 1 each. `id`, `servings`, `ingredients` and `nutrition` 0.
- **users:** `name`, `email`, `role`, `active` and `joinedAt` 1 each. `id` and `phone` 0.
- **posts:** `id`, `title`, `userId`, `replyToId`, `status`, `body` and `viewCount` 1 each. `tags` 0.

The longest Fields are recipes' `name` and `prepTimeMinutes`, at 4 lines each: three settings each, which Prettier wraps onto their own lines. Next is recipes' `sourceId`, at 3 lines: a Kind and a placeholder. The Field with the most settings is posts' `viewCount`, with four (`label`, `readOnly`, `list`, `sortable`), still on one line. Outside these figures, posts' two References cost its shared module one more line, the import of their target `users`.

The baseline is the demo's two replaced Views, which are hand-written:

| Replaced View                    | Lines   | Fields laid out | Lines per Field |
| -------------------------------- | ------- | --------------- | --------------- |
| users' list View (card grid)     | 44      | 6               | 7.3             |
| posts' create View (two columns) | 73      | 5               | 14.6            |
| **Both**                         | **117** | **11**          | **10.6**        |

This is a lower bound. Both Views reuse the core's helpers (`createListView`, `createFormView`) and the Theme's parts, and a View written without the framework would be longer. Within posts' create View, the one Field written fully by hand, the title, takes 17 lines (3 in the script and 14 in the markup). Each of its other four Fields takes 1 line, through the Theme's `FieldInput` or `ReferencePicker`, but only because that Field's metadata tells the part what to render. The card grid likewise loops over the Resource's Fields.

At 1.0 line per Field, and 4 at most, per-Field metadata is about a tenth of the baseline's 10.6, and about a seventeenth of the 17 lines of the one Field written by hand. It is clearly shorter. The second half of the trigger has not fired.

## Limits

- The demo stands in for PER-11's "one real app" (ADR 0001). Its Resources were written to show the features, so recipes, which holds a Field of every built-in Kind, may carry more metadata than a typical Resource, and both replaced Views exist only as examples. The check runs again, under the counting rule above, when a real app adopts the framework, and that run is the one that counts.
- The baseline comes from two Views, and it is a lower bound.
- The app's own Kinds (`stars`, `numberOrSlug`, and the boolean cell) aren't counted. They are registered once in `admin.ts`, with their components, and any Field of any Resource may name them. In the demo, only recipes does.
- The measurement was taken once by hand on the code as of M5.4, not by a test.
