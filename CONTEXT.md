# Svelte Admin

An admin framework for SvelteKit: you describe the kinds of records an app manages, and it provides the screens to list, view, create, edit and delete them.

## Language

**Admin framework**:
What this project is: the toolkit that turns Resource definitions into a working admin panel.
_Avoid_: Dashboard generator, dashboard, CMS

**Resource**:
A named kind of record the admin manages (e.g. Berries, Recipes), defined by its schema, its data operations and how it is presented.
_Avoid_: Entity, model, collection

**Field**:
A single attribute of a Resource (e.g. a Recipe's name), together with how it is labelled and shown.
_Avoid_: Column, property, attribute

**Kind**:
What a Field is for display and input purposes (text, number, date, an enum, a list, a Reference), either detected from its schema or named by the Field. A Theme renders each Kind, and an app can add Kinds or replace a Theme's.
_Avoid_: Type (clashes with schema and TypeScript types), widget, field type

**Reference**:
A Field that holds the id of a record of another Resource, shown as that record's Record title.
_Avoid_: Relation, foreign key, association

**Record title**:
The text that names one record of a Resource (e.g. a User's full name), used wherever a record is shown by name rather than by id.
_Avoid_: Display name, label (a label names a Field or a Resource)

**Provider**:
The adapter that carries out a Resource's data operations against a particular backend.
_Avoid_: Data source, adapter, backend, API client

**View**:
One of a Resource's four standard screens: list, detail, create or edit. The admin provides each one, and an app can replace a single View for a single Resource.
_Avoid_: Screen, page (a SvelteKit page is a route file)

**Theme**:
The package that renders the admin's UI on top of the headless core: the four Views, the admin shell, the Field inputs and the parts they are built from, which it also exports so an app replacing one View can reuse them.
_Avoid_: UI kit, skin; "theme" for colours (those are tokens)

**Token**:
A design variable such as a colour or radius (shadcn's CSS variables). An app's tokens restyle a Theme; they are not a Theme.
_Avoid_: Theme (for colours), palette

**Dashboard**:
A summary page of charts and key figures. A possible later feature of the admin, not its core.
_Avoid_: Using it to mean the admin panel as a whole
