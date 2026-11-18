// The core's lookup entry point: the building block of `serveResource`'s `lookup`, a pure module
// with no browser or Kit import, so it is tested on its own. Only `serveResource` uses it, on the
// server.
export { resolveIds, type IdSource } from './resolve-ids.ts';
