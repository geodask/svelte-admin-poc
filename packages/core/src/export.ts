// The core's export entry point: the building blocks of `serveResource`'s `exportList`, for an
// app that builds an export of its own (e.g. a GET route that works without JavaScript). Pure,
// with no browser or Kit import, but server-only by intent: a records-to-CSV writer and a pager
// have no place in the client build (the demo's client bundle check looks for the CSV writer).
export { toCsv } from './csv.ts';
export { collectPages, type CollectedPages } from './export-pages.ts';
