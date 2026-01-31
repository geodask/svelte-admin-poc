import { readdir, writeFile } from 'fs/promises';
import { join } from 'path';
import type { Plugin } from 'vite';

export function generateResourcesPlugin(): Plugin {
	return {
		name: 'vite-plugin-generate-resources',

		async buildStart() {
			await generateResourcesFile();
		},

		async handleHotUpdate({ file }) {
			// Watch for changes in resource files
			if (file.includes('/resources/') && file.endsWith('.resource.ts')) {
				await generateResourcesFile();
			}
		}
	};
}

async function generateResourcesFile(): Promise<void> {
	const resourcesDir = join(process.cwd(), 'src/resources');
	const outputFile = join(process.cwd(), 'src/resources.remote.ts');

	try {
		const files = await readdir(resourcesDir);
		const resourceFiles = files.filter(
			(file) => file.endsWith('.resource.ts') && !file.startsWith('.')
		);

		// Generate imports
		const imports = resourceFiles
			.map((file) => {
				const name = file.replace('.resource.ts', '');
				const camelName = toCamelCase(name);
				return `import { resource as ${camelName}Resource } from './resources/${file.replace('.ts', '')}';`;
			})
			.join('\n');

		// Generate exports
		const exports = resourceFiles
			.map((file) => {
				const name = file.replace('.resource.ts', '');
				const camelName = toCamelCase(name);
				const pascalName = toPascalCase(name);
				return `export const { getList: get${pascalName}s } = ${camelName}Resource;`;
			})
			.join('\n');

		const content = `${imports}\n\n${exports}\n`;

		await writeFile(outputFile, content, 'utf-8');
		console.log(`✓ Generated resources.remote.ts with ${resourceFiles.length} resources`);
	} catch (error) {
		console.error('Error generating resources file:', error);
	}
}

function toCamelCase(str: string): string {
	return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}

function toPascalCase(str: string): string {
	const camel = toCamelCase(str);
	return camel.charAt(0).toUpperCase() + camel.slice(1);
}
