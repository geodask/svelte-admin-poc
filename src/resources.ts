// Auto-generated file - do not edit manually
import { resource as berriesResource } from './resources/berries.resource';
import { resource as berryFirmnessResource } from './resources/berry-firmness.resource';
import { resource as berryFlavorsResource } from './resources/berry-flavors.resource';
import {
	berriesGetMany,
	berriesGetOne,
	berriesCreate,
	berriesUpdate,
	berriesDeleteOne,
	berryFirmnessGetMany,
	berryFirmnessGetOne,
	berryFirmnessCreate,
	berryFirmnessUpdate,
	berryFirmnessDeleteOne,
	berryFlavorsGetMany,
	berryFlavorsGetOne,
	berryFlavorsCreate,
	berryFlavorsUpdate,
	berryFlavorsDeleteOne
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
	'berry-firmness': {
		metadata: berryFirmnessResource.metadata,
		remotes: {
			getMany: berryFirmnessGetMany,
			getOne: berryFirmnessGetOne,
			create: berryFirmnessCreate,
			update: berryFirmnessUpdate,
			deleteOne: berryFirmnessDeleteOne
		}
	},
	'berry-flavors': {
		metadata: berryFlavorsResource.metadata,
		remotes: {
			getMany: berryFlavorsGetMany,
			getOne: berryFlavorsGetOne,
			create: berryFlavorsCreate,
			update: berryFlavorsUpdate,
			deleteOne: berryFlavorsDeleteOne
		}
	}
} as const;

export type ResourceMap = typeof resources;
export type ResourceName = keyof ResourceMap;

export function useResource<K extends ResourceName>(name: K): ResourceMap[K] {
	return resources[name];
}
