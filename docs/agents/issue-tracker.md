# Issue tracker: Linear

Issues and specs for this repo live in Linear, in team **Personal** (key `PER`) under project
**Svelte Admin** (`P-PER-2`, https://linear.app/geodask/project/svelte-admin-b97cbb74395d).
Use the Linear MCP tools (`save_issue`, `get_issue`, `list_issues`, `list_comments`, `save_comment`).

## Conventions

- **Create an issue**: `save_issue` with `team: "PER"`, `project: "Svelte Admin"`. Every issue for this repo goes in that project.
- **Read an issue**: `get_issue` with the identifier (e.g. `PER-12`), then `list_comments`, since `get_issue` omits the discussion.
- **List issues**: `list_issues` with `project: "Svelte Admin"`, filtered by `state` / `label` as needed. Follow the cursor while `hasNextPage` is true.
- **Comment**: `save_comment` on the issue.
- **Apply / remove labels**: `save_issue` with `addLabels` / `removeLabels` (never `labels`, which replaces the whole set).
- **Statuses**: Backlog → Todo → In Progress → Done (also Canceled, Duplicate).
- **Close**: comment with the reason, then set status to Done, or Canceled for won't-do.

## Specs and tickets

- A **spec** is a parent issue holding the spec in its description.
- **Tickets** from `/to-tickets` are sub-issues of the spec (`parentId`).
- **Blocking**: Linear's native "blocked by" relations between issues. A ticket is unblocked when every blocker is Done.

## When a skill says "publish to the issue tracker"

Create a Linear issue in team `PER`, project "Svelte Admin".

## When a skill says "fetch the relevant ticket"

`get_issue` with the identifier, plus `list_comments`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a parent issue and its **children** are sub-issues.

- **Map**: an issue labelled `wayfinder:map` holding the Notes / Decisions-so-far / Fog body.
- **Child ticket**: a sub-issue of the map, labelled `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Create these labels in `PER` the first time they're needed.
- **Blocking**: native "blocked by" relations.
- **Frontier**: the map's open sub-issues with no open blocker and no assignee; first in map order wins.
- **Claim**: assign to `me` and set status In Progress, the session's first write.
- **Resolve**: comment with the answer, set status Done, then append a context pointer (gist + link) to the map's Decisions-so-far.
