// Base URL for TheMealDB API endpoints
const API_BASE_URL = 'https://www.themealdb.com/api/json/v1/1';

// Search for meals by name, returns array of meals matching the search term
async function searchMealsByName(name) {
    const response = await fetch(`${API_BASE_URL}/search.php?s=${name}`);
    const data = await response.json();
    // Return empty array if no meals found
    return data.meals || [];
}

// Search for meals by ingredient, returns array of meals containing the ingredient
async function searchMealsByIngredient(ingredient) {
    const response = await fetch(`${API_BASE_URL}/filter.php?i=${ingredient}`);
    const data = await response.json();
    // Return empty array if no meals found
    return data.meals || [];
}

// Get detailed information for a specific meal by its ID
async function getMealById(id) {
    const response = await fetch(`${API_BASE_URL}/lookup.php?i=${id}`);
    const data = await response.json();
    // Return first meal object or null if not found
    return data.meals ? data.meals[0] : null;
}

// Get list of all available meal categories
async function getMealCategories() {
    const response = await fetch(`${API_BASE_URL}/categories.php`);
    const data = await response.json();
    // Return empty array if no categories found
    return data.categories || [];
}

// Get a random meal from the database
async function fetchRandomMeal() {
    const response = await fetch(`${API_BASE_URL}/random.php`);
    const data = await response.json();
    // Return first meal object or null if error occurs
    return data.meals ? data.meals[0] : null;
}

// Get all meals in a specific category
async function getMealsByCategory(category) {
    const response = await fetch(`${API_BASE_URL}/filter.php?c=${category}`);
    const data = await response.json();
    // Return empty array if no meals found in category
    return data.meals || [];
}