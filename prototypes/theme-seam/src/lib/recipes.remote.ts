// PROTOTYPE (PER-18): the one line of wiring per Resource.
import { serveResource } from './core/serve-resource';
import { recipes } from './recipes';
import { memoryProvider } from './server/memory-provider';

export const { getList, deleteMany } = serveResource(recipes, memoryProvider);
