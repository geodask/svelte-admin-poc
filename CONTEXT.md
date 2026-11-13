# Svelte Admin

An admin framework for SvelteKit: you describe the kinds of records an app manages, and it provides the screens to list, view, create, edit and delete them.

## Language

**Admin framework**:
What this project is: the toolkit that turns Resource definitions into a working admin panel.
_Avoid_: Dashboard generator, dashboard, CMS

**Resource**:
A named kind of record the admin manages (e.g. Berries, Recipes), defined by its schema, its data operations and how it is presented.
_Avoid_: Entity, model, collection

**Dashboard**:
A summary page of charts and key figures. A possible later feature of the admin, not its core.
_Avoid_: Using it to mean the admin panel as a whole
