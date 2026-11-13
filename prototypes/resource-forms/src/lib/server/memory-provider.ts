// PROTOTYPE (PER-17): in-memory Provider. Restarting the dev server wipes it.
import type { Recipe } from '../recipes';
import { FieldError, type Provider } from '../framework/provider';

const rows: Recipe[] = [
	{
		id: 1,
		name: 'Margherita pizza',
		summary: 'The classic.',
		cuisine: 'Italian',
		difficulty: 'Medium',
		servings: 2,
		caloriesPerServing: 800,
		vegetarian: true,
		publishedOn: new Date('2026-03-01T00:00:00Z'),
		image: 'https://example.com/pizza.jpg',
		tags: ['pizza', 'oven'],
		ingredients: [
			{ name: 'Pizza dough', quantity: '250 g' },
			{ name: 'Tomato sauce', quantity: '80 ml' },
			{ name: 'Mozzarella', quantity: '125 g' },
			{ name: 'Basil' }
		],
		nutrition: { protein: 32, carbs: 98 },
		rating: 4.6,
		createdAt: new Date('2026-02-20T10:00:00Z')
	},
	{
		id: 2,
		name: 'Miso soup',
		cuisine: 'Japanese',
		servings: 4,
		vegetarian: false,
		tags: [],
		ingredients: [{ name: 'Dashi', quantity: '1 l' }, { name: 'Miso paste', quantity: '3 tbsp' }],
		rating: 4.1,
		createdAt: new Date('2026-05-02T08:30:00Z')
	}
];

/** What the last write handed the Provider, so the prototype can show it. */
export const lastWrite: { op?: string; payload?: unknown } = {};

function checkUniqueName(name: string | undefined, id?: number) {
	if (name && rows.some((r) => r.name.toLowerCase() === name.toLowerCase() && r.id !== id)) {
		throw new FieldError(['name'], 'A recipe with this name already exists');
	}
}

export const memoryProvider: Provider<Recipe, number> = {
	async getList() {
		return { data: rows, total: rows.length };
	},
	async getOne(_ctx, id) {
		return rows.find((r) => r.id === id);
	},
	async create(_ctx, data) {
		lastWrite.op = 'create';
		lastWrite.payload = data;
		checkUniqueName(data.name);
		const row = {
			...data,
			id: Math.max(0, ...rows.map((r) => r.id)) + 1,
			rating: 0,
			createdAt: new Date()
		} as Recipe;
		rows.push(row);
		return row;
	},
	async update(_ctx, { id, data }) {
		lastWrite.op = `update ${id}`;
		lastWrite.payload = data;
		checkUniqueName(data.name, id);
		const i = rows.findIndex((r) => r.id === id);
		const { rating, createdAt } = rows[i];
		// replace every editable Field; keep the read-only ones
		rows[i] = { ...(data as Recipe), id, rating, createdAt };
		return rows[i];
	}
};
