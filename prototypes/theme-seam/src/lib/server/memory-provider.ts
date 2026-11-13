// PROTOTYPE (PER-18): in-memory Provider. Restarting the dev server resets it.
import type { Recipe } from '../recipes';
import type { Provider } from '../core/provider';

const names: [string, Recipe['cuisine'], boolean, string[]][] = [
	['Margherita pizza', 'Italian', true, ['pizza', 'oven']],
	['Miso soup', 'Japanese', false, ['soup']],
	['Moussaka', 'Greek', false, ['oven', 'comfort']],
	['Chana masala', 'Indian', true, ['curry', 'vegan']],
	['Tacos al pastor', 'Mexican', false, ['street food']],
	['Risotto ai funghi', 'Italian', true, ['rice']],
	['Spanakopita', 'Greek', true, ['pastry', 'oven']],
	['Ramen', 'Japanese', false, ['soup', 'noodles']],
	['Palak paneer', 'Indian', true, ['curry']],
	['Guacamole', 'Mexican', true, ['dip', 'vegan', 'quick']],
	['Lasagne', 'Italian', false, ['oven', 'comfort']],
	['Souvlaki', 'Greek', false, ['grill']],
	['Okonomiyaki', 'Japanese', false, ['pancake']],
	['Dal tadka', 'Indian', true, ['lentils', 'vegan']],
	['Chiles rellenos', 'Mexican', true, ['oven']],
	['Tiramisu', 'Italian', true, ['dessert']],
	['Gemista', 'Greek', true, ['oven', 'vegan']],
	['Katsu curry', 'Japanese', false, ['curry']],
	['Butter chicken', 'Indian', false, ['curry', 'comfort']],
	['Pozole', 'Mexican', false, ['soup']]
];
const levels = ['Easy', 'Medium', 'Hard', undefined] as const;

let rows: Recipe[] = names.map(([name, cuisine, vegetarian, tags], i) => ({
	id: i + 1,
	name,
	cuisine,
	difficulty: levels[i % 4],
	servings: (i % 5) + 2,
	vegetarian,
	publishedOn: i % 6 === 5 ? undefined : new Date(Date.UTC(2026, i % 12, (i * 7) % 27 + 1)),
	tags,
	rating: Math.round((3.2 + ((i * 37) % 18) / 10) * 10) / 10
}));

export const memoryProvider: Provider<Recipe, number> = {
	async getList(_ctx, { page, perPage, sort, search, filters }) {
		let out = rows.filter((r) => !search || r.name.toLowerCase().includes(search.toLowerCase()));
		for (const f of filters) out = out.filter((r) => String(r[f.field as keyof Recipe]) === f.value);
		if (sort) {
			const k = sort.field as keyof Recipe;
			const d = sort.dir === 'asc' ? 1 : -1;
			out = [...out].sort((a, b) => {
				const x = a[k] as any, y = b[k] as any;
				if (x === undefined) return 1;
				if (y === undefined) return -1;
				return (x > y ? 1 : x < y ? -1 : 0) * d;
			});
		}
		return { data: out.slice((page - 1) * perPage, page * perPage), total: out.length };
	},
	async deleteMany(_ctx, ids) {
		rows = rows.filter((r) => !ids.includes(r.id));
	}
};
