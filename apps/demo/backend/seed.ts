// The demo backend's seed data. Each reset restores exactly these records, so tests are
// deterministic. Recipes and posts each fill several default pages (25 records each).
//
// Recipes carry a Field of every Kind, so the e2e tests can check how each one is shown.
// The values of the later Fields are derived from the row's position.
export type Recipe = {
	id: number;
	name: string;
	cuisine: string;
	difficulty: 'Easy' | 'Medium' | 'Hard';
	prepTimeMinutes: number;
	servings: number;
	caloriesPerServing?: number;
	vegetarian: boolean;
	tags: string[];
	reviewCount: number;
	publishedAt: string;
	sourceId: string | number;
	nutrition: { proteinGrams: number; carbsGrams: number };
	instructions: string;
	internalNotes: string;
};

const rows: [string, string, Recipe['difficulty'], number, number, string[]][] = [
	['Classic Margherita Pizza', 'Italian', 'Easy', 20, 4, ['Pizza', 'Vegetarian']],
	[
		'Vegetarian Stir-Fry',
		'Asian',
		'Medium',
		15,
		3,
		['Vegetarian', 'Quick', 'Vegan', 'Healthy', 'Weeknight']
	],
	['Chocolate Chip Cookies', 'American', 'Easy', 15, 24, ['Dessert', 'Baking']],
	['Chicken Alfredo Pasta', 'Italian', 'Medium', 15, 4, ['Pasta', 'Chicken']],
	['Mango Salsa Chicken', 'Mexican', 'Easy', 15, 3, ['Chicken', 'Salsa']],
	['Quinoa Salad with Avocado', 'Mediterranean', 'Easy', 20, 4, ['Salad', 'Vegetarian']],
	['Tomato Basil Bruschetta', 'Italian', 'Easy', 15, 6, ['Appetizer', 'Vegetarian']],
	['Beef and Broccoli Stir-Fry', 'Asian', 'Medium', 20, 4, ['Beef', 'Quick']],
	['Caprese Salad', 'Italian', 'Easy', 10, 2, ['Salad', 'Vegetarian']],
	['Shrimp Scampi Pasta', 'Italian', 'Medium', 15, 3, ['Pasta', 'Seafood']],
	['Chicken Biryani', 'Pakistani', 'Hard', 30, 6, ['Rice', 'Chicken']],
	['Chicken Karahi', 'Pakistani', 'Medium', 20, 4, ['Curry', 'Chicken']],
	['Aloo Keema', 'Pakistani', 'Medium', 15, 4, ['Curry', 'Beef']],
	['Chapli Kebabs', 'Pakistani', 'Medium', 25, 4, ['Kebab', 'Beef']],
	['Saag (Spinach) with Makki di Roti', 'Pakistani', 'Hard', 40, 4, ['Vegetarian', 'Bread']],
	['Japanese Ramen Soup', 'Japanese', 'Hard', 20, 2, ['Soup', 'Noodles']],
	['Moroccan Chickpea Tagine', 'Moroccan', 'Medium', 15, 4, ['Stew', 'Vegetarian']],
	['Korean Bibimbap', 'Korean', 'Medium', 30, 2, ['Rice', 'Beef']],
	['Greek Moussaka', 'Greek', 'Hard', 30, 6, ['Casserole', 'Lamb']],
	['Butter Chicken (Murgh Makhani)', 'Indian', 'Medium', 30, 4, ['Curry', 'Chicken']],
	['Thai Green Curry', 'Thai', 'Medium', 20, 4, ['Curry', 'Chicken']],
	['Mexican Street Corn (Elote)', 'Mexican', 'Easy', 10, 4, ['Snack', 'Vegetarian']],
	['Russian Borscht', 'Russian', 'Medium', 30, 6, ['Soup', 'Beef']],
	['South Indian Masala Dosa', 'Indian', 'Hard', 40, 4, ['Breakfast', 'Vegetarian']],
	['Lebanese Falafel Wrap', 'Lebanese', 'Medium', 30, 4, ['Wrap', 'Vegetarian']],
	['Brazilian Feijoada', 'Brazilian', 'Hard', 20, 6, ['Stew', 'Pork']],
	['Spanish Paella', 'Spanish', 'Hard', 30, 6, ['Rice', 'Seafood']],
	['Turkish Kebabs', 'Turkish', 'Medium', 20, 4, ['Kebab', 'Lamb']],
	['Hawaiian Poke Bowl', 'Hawaiian', 'Easy', 15, 2, ['Bowl', 'Seafood']],
	['Vietnamese Pho', 'Vietnamese', 'Hard', 30, 4, ['Soup', 'Noodles']],
	['French Onion Soup', 'French', 'Medium', 25, 4, ['Soup', 'Vegetarian']],
	['Coq au Vin', 'French', 'Hard', 30, 6, ['Stew', 'Chicken']],
	['Ratatouille', 'French', 'Medium', 25, 4, ['Stew', 'Vegetarian']],
	['Fish and Chips', 'British', 'Medium', 20, 4, ['Fried', 'Seafood']],
	["Shepherd's Pie", 'British', 'Medium', 30, 6, ['Casserole', 'Lamb']],
	['Pierogi', 'Polish', 'Hard', 45, 6, ['Dumplings', 'Vegetarian']],
	['Hungarian Goulash', 'Hungarian', 'Medium', 25, 6, ['Stew', 'Beef']],
	['Swedish Meatballs', 'Swedish', 'Medium', 25, 4, ['Meatballs', 'Beef']],
	['German Schnitzel', 'German', 'Medium', 20, 4, ['Fried', 'Pork']],
	['Portuguese Custard Tarts', 'Portuguese', 'Hard', 40, 12, ['Dessert', 'Baking']],
	['Greek Salad', 'Greek', 'Easy', 10, 4, ['Salad', 'Vegetarian']],
	['Shakshuka', 'Israeli', 'Easy', 15, 4, ['Breakfast', 'Vegetarian']],
	['Hummus', 'Lebanese', 'Easy', 10, 6, ['Dip', 'Vegan']],
	['Ethiopian Doro Wat', 'Ethiopian', 'Hard', 40, 6, ['Stew', 'Chicken']],
	['Jollof Rice', 'Nigerian', 'Medium', 20, 6, ['Rice', 'Vegetarian']],
	['Bobotie', 'South African', 'Medium', 25, 6, ['Casserole', 'Beef']],
	['Peruvian Ceviche', 'Peruvian', 'Easy', 20, 4, ['Seafood', 'Raw']],
	['Argentinian Empanadas', 'Argentinian', 'Medium', 40, 12, ['Pastry', 'Beef']],
	['Chicken Tacos', 'Mexican', 'Easy', 15, 4, ['Tacos', 'Chicken']],
	['Guacamole', 'Mexican', 'Easy', 10, 4, ['Dip', 'Vegan']],
	['Clam Chowder', 'American', 'Medium', 20, 6, ['Soup', 'Seafood']],
	['Pancakes', 'American', 'Easy', 10, 4, ['Breakfast', 'Vegetarian']],
	['Pad Thai', 'Thai', 'Medium', 20, 2, ['Noodles', 'Shrimp']],
	['Kung Pao Chicken', 'Chinese', 'Medium', 15, 4, ['Stir-fry', 'Chicken']],
	['Mapo Tofu', 'Chinese', 'Medium', 15, 4, ['Tofu', 'Spicy']]
];

export const recipes: Recipe[] = rows.map(
	([name, cuisine, difficulty, prepTimeMinutes, servings, tags], index) => ({
		id: index + 1,
		name,
		cuisine,
		difficulty,
		prepTimeMinutes,
		servings,
		// Every third recipe has no calorie count, so the optional Field is sometimes empty.
		...(index % 3 === 2 ? {} : { caloriesPerServing: 250 + index * 15 }),
		vegetarian: tags.includes('Vegetarian'),
		tags,
		reviewCount: 1250 + index * 37,
		// Late in the UTC day, so formatting it in any other time zone would show another date.
		publishedAt: new Date(Date.UTC(2024, 0, 1 + index * 7, 23, 30)).toISOString(),
		// Imported recipes keep their source's id, which is a number or a slug.
		sourceId: index % 2 === 0 ? `dj-${index + 1}` : 9000 + index,
		nutrition: { proteinGrams: 10 + index, carbsGrams: 40 + index * 2 },
		instructions: `Prepare the ingredients for ${name}, then cook and serve.`,
		internalNotes: `Imported batch ${Math.floor(index / 10) + 1}`
	})
);

// Posts: the backend can't count them, so it answers with `hasNextPage` instead of `total`.
export type Post = {
	id: number;
	title: string;
	userId: number;
	status: 'draft' | 'published';
	tags: string[];
	body: string;
};

const topics = [
	'Weeknight dinners',
	'Baking bread',
	'Knife skills',
	'Seasonal vegetables',
	'Spice blends',
	'Meal prep',
	'Fermentation',
	'Grilling'
];
const angles = [
	'A beginner guide to',
	'Ten tips for',
	'What I learned from',
	'The science of',
	'Myths about',
	'A week of'
];

export const posts: Post[] = Array.from({ length: 45 }, (_, index) => {
	const topic = topics[index % topics.length];
	const angle = angles[index % angles.length];
	return {
		id: index + 1,
		title: `${angle} ${topic.toLowerCase()} (part ${Math.floor(index / topics.length) + 1})`,
		userId: (index % 5) + 1,
		status: index % 4 === 3 ? 'draft' : 'published',
		tags: [topic, index % 2 === 0 ? 'Guide' : 'Story'],
		body: `Notes on ${topic.toLowerCase()}.`
	};
});
