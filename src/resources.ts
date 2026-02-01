// Auto-generated file - do not edit manually
import { resource as aResource } from './resources/a.resource';
import { resource as bResource } from './resources/b.resource';
import { resource as berriesResource } from './resources/berries.resource';
import { resource as berryFirmnessResource } from './resources/berry-firmness.resource';
import { resource as berryFlavorsResource } from './resources/berry-flavors.resource';
import { resource as cResource } from './resources/c.resource';
import {
	aGetMany,
	aGetOne,
	aCreate,
	aUpdate,
	aDelete,
	bGetMany,
	bGetOne,
	bCreate,
	bUpdate,
	bDelete,
	berriesGetMany,
	berriesGetOne,
	berriesCreate,
	berriesUpdate,
	berriesDelete,
	berryFirmnessGetMany,
	berryFirmnessGetOne,
	berryFirmnessCreate,
	berryFirmnessUpdate,
	berryFirmnessDelete,
	berryFlavorsGetMany,
	berryFlavorsGetOne,
	berryFlavorsCreate,
	berryFlavorsUpdate,
	berryFlavorsDelete,
	cGetMany,
	cGetOne,
	cCreate,
	cUpdate,
	cDelete
} from './resources.remote';

const resources = {
	a: {
		metadata: aResource.metadata,
		remotes: {
			getMany: aGetMany,
			getOne: aGetOne,
			create: aCreate,
			update: aUpdate,
			delete: aDelete
		}
	},
	b: {
		metadata: bResource.metadata,
		remotes: {
			getMany: bGetMany,
			getOne: bGetOne,
			create: bCreate,
			update: bUpdate,
			delete: bDelete
		}
	},
	berries: {
		metadata: berriesResource.metadata,
		remotes: {
			getMany: berriesGetMany,
			getOne: berriesGetOne,
			create: berriesCreate,
			update: berriesUpdate,
			delete: berriesDelete
		}
	},
	'berry-firmness': {
		metadata: berryFirmnessResource.metadata,
		remotes: {
			getMany: berryFirmnessGetMany,
			getOne: berryFirmnessGetOne,
			create: berryFirmnessCreate,
			update: berryFirmnessUpdate,
			delete: berryFirmnessDelete
		}
	},
	'berry-flavors': {
		metadata: berryFlavorsResource.metadata,
		remotes: {
			getMany: berryFlavorsGetMany,
			getOne: berryFlavorsGetOne,
			create: berryFlavorsCreate,
			update: berryFlavorsUpdate,
			delete: berryFlavorsDelete
		}
	},
	c: {
		metadata: cResource.metadata,
		remotes: {
			getMany: cGetMany,
			getOne: cGetOne,
			create: cCreate,
			update: cUpdate,
			delete: cDelete
		}
	}
} as const;

export type ResourceMap = typeof resources;
export type ResourceName = keyof ResourceMap;

export function useResource<K extends ResourceName>(name: K): ResourceMap[K] {
	return resources[name];
}
