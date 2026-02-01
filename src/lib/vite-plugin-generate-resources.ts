import { readdir, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import type { Plugin, ViteDevServer } from 'vite';

async function formatWithPrettier(content: string, filePath: string): Promise<string> {
	try {
		const prettier = await import('prettier');
		const config = await prettier.resolveConfig(filePath);
		return prettier.format(content, {
			...config,
			filepath: filePath
		});
	} catch {
		// If prettier fails, return unformatted content
		return content;
	}
}

export function generateResourcesPlugin(): Plugin {
	let resourcesDir: string;

	return {
		name: 'vite-plugin-generate-resources',

		configResolved(config) {
			resourcesDir = join(config.root, 'src/resources');
		},

		async buildStart() {
			await generateResourcesFile();
		},

		configureServer(server: ViteDevServer) {
			// Watch the resources directory with absolute path
			server.watcher.add(resourcesDir);

			const handleFile = async (file: string) => {
				if (!file.endsWith('.resource.ts')) return;
				// Small delay to ensure file is fully written
				await new Promise((resolve) => setTimeout(resolve, 10));
				await syncResourceName(file);
				await generateResourcesFile();
			};

			server.watcher.on('add', handleFile);
			server.watcher.on('change', handleFile);
			server.watcher.on('unlink', async (file) => {
				if (file.endsWith('.resource.ts')) {
					await generateResourcesFile();
				}
			});
		}
	};
}

async function syncResourceName(filePath: string): Promise<void> {
	try {
		const content = await readFile(filePath, 'utf-8');
		const fileName = filePath.split('/').pop() || '';
		const resourceName = fileName.replace('.resource.ts', '');

		// If file is empty, scaffold it
		if (content.trim().length === 0) {
			const template = `import { defineResource } from './resource';
import { z } from 'zod';

const ${resourceName}Schema = z.object({
	// Define your schema here
});

export const resource = defineResource('${resourceName}')({
	schema: ${resourceName}Schema,
});
`;
			await writeFile(filePath, template, 'utf-8');
			console.log(`✓ Scaffolded ${fileName}`);
			return;
		}

		// Sync defineResource name with filename
		const defineResourceRegex = /defineResource\s*\(\s*['"]([^'"]+)['"]\s*\)/;
		const match = content.match(defineResourceRegex);

		if (match && match[1] !== resourceName) {
			const updatedContent = content.replace(
				defineResourceRegex,
				`defineResource('${resourceName}')`
			);
			await writeFile(filePath, updatedContent, 'utf-8');
			console.log(`✓ Synced resource name in ${fileName}: '${match[1]}' → '${resourceName}'`);
		}
	} catch {
		// Ignore errors
	}
}

async function generateResourcesFile(): Promise<void> {
	const resourcesDir = join(process.cwd(), 'src/resources');
	const remoteOutputFile = join(process.cwd(), 'src/resources.remote.ts');
	const helperOutputFile = join(process.cwd(), 'src/resources.ts');

	const methods = ['getMany', 'getOne', 'create', 'update', 'delete'] as const;
	const methodExportName = (camelName: string, method: string) =>
		`${camelName}${method.charAt(0).toUpperCase()}${method.slice(1)}`;

	try {
		const files = await readdir(resourcesDir);
		const resourceFiles = files.filter(
			(file) => file.endsWith('.resource.ts') && !file.startsWith('.')
		);

		// Generate resources.remote.ts - ONLY export remote functions
		const remoteContent =
			'// Auto-generated file - do not edit manually\n' +
			resourceFiles
				.map((file) => {
					const name = file.replace('.resource.ts', '');
					const camelName = toCamelCase(name);
					const importLine = `import { resource as ${camelName}Resource } from './resources/${file.replace('.ts', '')}';`;
					const methodExports = methods
						.map((method) => `${method}: ${methodExportName(camelName, method)}`)
						.join(', ');
					const destructureLine = `export const { ${methodExports} } = ${camelName}Resource;`;
					return `${importLine}\n${destructureLine}`;
				})
				.join('\n\n') +
			'\n';

		const formattedRemoteContent = await formatWithPrettier(remoteContent, remoteOutputFile);
		await writeFile(remoteOutputFile, formattedRemoteContent, 'utf-8');
		console.log(`✓ Generated resources.remote.ts`);

		// Generate resources.ts - import resources for metadata, remote functions for methods
		const resourceImports = resourceFiles
			.map((file) => {
				const name = file.replace('.resource.ts', '');
				const camelName = toCamelCase(name);
				return `import { resource as ${camelName}Resource } from './resources/${file.replace('.ts', '')}';`;
			})
			.join('\n');

		const remoteImports = resourceFiles
			.flatMap((file) => {
				const name = file.replace('.resource.ts', '');
				const camelName = toCamelCase(name);
				return methods.map((method) => methodExportName(camelName, method));
			})
			.join(',\n\t');

		const resourcesMapEntries = resourceFiles
			.map((file) => {
				const name = file.replace('.resource.ts', '');
				const camelName = toCamelCase(name);
				const methodEntries = methods
					.map((method) => `\t\t${method}: ${methodExportName(camelName, method)}`)
					.join(',\n');
				return `\t'${name}': {\n\t\tmetadata: ${camelName}Resource.metadata,\n\t\tremotes: {\n${methodEntries}\n\t\t}\n\t}`;
			})
			.join(',\n');

		const helperContent = resourceFiles.length
			? `// Auto-generated file - do not edit manually
${resourceImports}
import {
	${remoteImports}
} from './resources.remote';

const resources = {
${resourcesMapEntries}
} as const;

export type ResourceMap = typeof resources;
export type ResourceName = keyof ResourceMap;

export function useResource<K extends ResourceName>(name: K): ResourceMap[K] {
	return resources[name];
}
`
			: `// Auto-generated file - do not edit manually
const resources = {} as const;

export type ResourceMap = typeof resources;
export type ResourceName = keyof ResourceMap;

export function useResource<K extends ResourceName>(name: K): ResourceMap[K] {
	return resources[name];
}
`;

		const formattedHelperContent = await formatWithPrettier(helperContent, helperOutputFile);
		await writeFile(helperOutputFile, formattedHelperContent, 'utf-8');
		console.log(`✓ Generated resources.ts`);
	} catch (error) {
		console.error('Error generating resources file:', error);
	}
}

function toCamelCase(str: string): string {
	return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}
