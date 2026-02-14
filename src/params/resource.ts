import { useResources, type ResourceName } from '../resources';

export const match = (param: string): param is ResourceName => {
	const resources = useResources();
	return param in resources;
};
