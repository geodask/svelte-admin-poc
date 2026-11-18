// The core's export entry point: the building blocks of `serveResource`'s `exportList`, pure
// modules with no browser or Kit import, so they are tested on their own. Server-only by intent:
// a records-to-CSV writer and a pager have no place in the client build (the demo's client
// bundle check looks for the CSV writer).
export { toCsv } from './csv.ts';
export { collectPages, type CollectedPages } from './export-pages.ts';
