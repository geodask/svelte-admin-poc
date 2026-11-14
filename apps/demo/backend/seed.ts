// The demo backend's seed data. Each reset restores exactly these records, so tests are
// deterministic. There are more recipes than one default page (25) holds.
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
	['Vietnamese Pho', 'Vietnamese', 'Hard', 30, 4, ['Soup', 'Noodles']]
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
