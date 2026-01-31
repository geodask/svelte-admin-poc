// Auto-generated file - do not edit manually
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
	berryFlavorsDelete
} from './resources.remote';

const resources = {
	a: {
		getMany: aGetMany,
		getOne: aGetOne,
		create: aCreate,
		update: aUpdate,
		delete: aDelete
	},
	b: {
		getMany: bGetMany,
		getOne: bGetOne,
		create: bCreate,
		update: bUpdate,
		delete: bDelete
	},
	berries: {
		getMany: berriesGetMany,
		getOne: berriesGetOne,
		create: berriesCreate,
		update: berriesUpdate,
		delete: berriesDelete
	},
	'berry-firmness': {
		getMany: berryFirmnessGetMany,
		getOne: berryFirmnessGetOne,
		create: berryFirmnessCreate,
		update: berryFirmnessUpdate,
		delete: berryFirmnessDelete
	},
	'berry-flavors': {
		getMany: berryFlavorsGetMany,
		getOne: berryFlavorsGetOne,
		create: berryFlavorsCreate,
		update: berryFlavorsUpdate,
		delete: berryFlavorsDelete
	}
} as const;

export type ResourceMap = typeof resources;
export type ResourceName = keyof ResourceMap;

export function useResource<K extends ResourceName>(name: K): ResourceMap[K] {
	return resources[name];
}
