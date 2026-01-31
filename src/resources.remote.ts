import { resource as berryFirmnessResource } from './resources/berry-firmness.resource';
import { resource as berryFlavorResource } from './resources/berry-flavor.resource';
import { resource as berryResource } from './resources/berry.resource';
import { resource as userResource } from './resources/user.resource';

export const { getList: getBerryFirmnesss } = berryFirmnessResource;
export const { getList: getBerryFlavors } = berryFlavorResource;
export const { getList: getBerrys } = berryResource;
export const { getList: getUsers } = userResource;
