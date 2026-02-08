// Auto-generated file - do not edit manually
import { resource as berriesResource } from './resources/berries.resource';
import { resource as recipesResource } from './resources/recipes.resource';
import {
	berriesGetMany,
	berriesGetOne,
	berriesCreate,
	berriesUpdate,
	berriesDeleteOne,
	recipesGetMany,
	recipesGetOne,
	recipesCreate,
	recipesUpdate,
	recipesDeleteOne
} from './resources.remote';

const resources = {
	berries: {
		metadata: berriesResource.metadata,
		remotes: {
			getMany: berriesGetMany,
			getOne: berriesGetOne,
			create: berriesCreate,
			update: berriesUpdate,
			deleteOne: berriesDeleteOne
		}
	},
	recipes: {
		metadata: recipesResource.metadata,
		remotes: {
			getMany: recipesGetMany,
			getOne: recipesGetOne,
			create: recipesCreate,
			update: recipesUpdate,
			deleteOne: recipesDeleteOne
		}
	}
} as const;

export type ResourceMap = typeof resources;
export type ResourceName = keyof ResourceMap;

export function useResources(): ResourceMap {
	return resources;
}

export function useResource<K extends ResourceName>(name: K): ResourceMap[K] {
	return resources[name];
}
