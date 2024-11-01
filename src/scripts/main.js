const { ipcRenderer } = require('electron');

// Main search function that handles different types of meal searches
async function searchMeals() {
    const searchInput = document.getElementById('searchInput').value;
    const searchType = document.getElementById('searchType').value;
    const resultsContainer = document.getElementById('results');
    
    // Show loading state
    resultsContainer.innerHTML = '<p>Searching...</p>';
    
    try {
        // Handle different search types using switch case
        let meals = [];
        switch(searchType) {
            case 'name':
                meals = await searchMealsByName(searchInput);
                break;
            case 'ingredient':
                meals = await searchMealsByIngredient(searchInput);
                break;
            case 'category':
                meals = await getMealsByCategory(searchInput);
                break;
        }
        displayMeals(meals);
    } catch (error) {
        resultsContainer.innerHTML = '<p>Error searching meals. Please try again.</p>';
        console.error(error);
    }
}

// Display search results in a grid layout
function displayMeals(meals) {
    const resultsContainer = document.getElementById('results');
    
    // Handle no results found
    if (!meals || meals.length === 0) {
        resultsContainer.innerHTML = '<p>No meals found.</p>';
        return;
    }
    
    // Create meal cards with image and basic information
    resultsContainer.innerHTML = meals.map(meal => `
        <div class="meal-card" onclick="showMealDetails('${meal.idMeal}')">
            <img src="${meal.strMealThumb}" alt="${meal.strMeal}">
            <div class="meal-card-content">
                <h3>${meal.strMeal}</h3>
                ${meal.strCategory ? `<p><i class="fas fa-tag"></i> ${meal.strCategory}</p>` : ''}
                ${meal.strArea ? `<p><i class="fas fa-globe"></i> ${meal.strArea}</p>` : ''}
            </div>
        </div>
    `).join('');
}

// Display detailed meal information in a modal
async function showMealDetails(id) {
    const modal = document.getElementById('mealModal');
    const mealDetails = document.getElementById('mealDetails');
    const meal = await getMealById(id);
    
    if (!meal) {
        mealDetails.innerHTML = '<p>Error loading meal details.</p>';
        return;
    }

    // Extract ingredients and measurements from API response
    const ingredients = [];
    for (let i = 1; i <= 20; i++) {
        if (meal[`strIngredient${i}`]) {
            ingredients.push({
                ingredient: meal[`strIngredient${i}`],
                measure: meal[`strMeasure${i}`] || ''
            });
        }
    }

    // Check if meal is already saved in planner
    const savedMeals = JSON.parse(localStorage.getItem('mealPlans') || '[]');
    const isSaved = savedMeals.some(m => m.id === meal.idMeal);

    // Helper function to convert YouTube URL to embed URL
    function getEmbedUrl(url) {
        const videoId = url.split('v=')[1];
        return `https://www.youtube.com/embed/${videoId}`;
    }

    mealDetails.innerHTML = `
        <div class="meal-header">
            <div class="meal-image">
                <img src="${meal.strMealThumb}" alt="${meal.strMeal}">
                <div class="meal-badges">
                    <span class="badge category"><i class="fas fa-tag"></i> ${meal.strCategory}</span>
                    <span class="badge area"><i class="fas fa-globe"></i> ${meal.strArea}</span>
                </div>
            </div>
            <div class="meal-info">
                <h2>${meal.strMeal}</h2>
                <div class="action-buttons">
                    <button onclick="toggleSaveMeal('${meal.idMeal}', '${meal.strMeal}', '${meal.strMealThumb}')" 
                            class="btn ${isSaved ? 'remove-btn' : 'save-btn'}">
                        <i class="fas ${isSaved ? 'fa-trash' : 'fa-bookmark'}"></i>
                        ${isSaved ? 'Remove from Planner' : 'Add to Planner'}
                    </button>
                </div>
            </div>
        </div>

        <div class="meal-content">
            <div class="ingredients-section">
                <div class="ingredients-header">
                    <h3><i class="fas fa-list"></i> Ingredients</h3>
                    <button onclick="addIngredient()" class="btn add-btn">
                        <i class="fas fa-plus"></i> Add Ingredient
                    </button>
                </div>
                <div class="ingredients-grid">
                    ${ingredients.map(ing => `
                        <div class="ingredient-item">
                            <span class="measure">${ing.measure}</span>
                            <span class="ingredient">${ing.ingredient}</span>
                            <div class="ingredient-actions">
                                <button onclick="editIngredient(this)" class="btn edit-btn">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button onclick="deleteIngredient(this)" class="btn remove-btn">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="instructions-section">
                <h3><i class="fas fa-book"></i> Instructions</h3>
                <ol class="instructions-list">
                    ${meal.strInstructions
                        .split('.')
                        .filter(step => step.trim())
                        .map(step => `<li>${step.trim()}.</li>`)
                        .join('')}
                </ol>
            </div>

            ${meal.strYoutube ? `
                <div class="video-section">
                    <h3><i class="fab fa-youtube"></i> Video Tutorial</h3>
                    <div class="video-container">
                        <iframe 
                            src="${getEmbedUrl(meal.strYoutube)}"
                            frameborder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowfullscreen>
                        </iframe>
                    </div>
                </div>
            ` : ''}
        </div>
    `;

    modal.style.display = "block";
}

// Handle saving and removing meals from planner
async function toggleSaveMeal(mealId, mealName, mealThumb) {
    const savedMeals = JSON.parse(localStorage.getItem('mealPlans') || '[]');
    const existingMeal = savedMeals.find(m => m.id === mealId);

    if (existingMeal) {
        // Remove meal from localStorage and delete file
        const updatedMeals = savedMeals.filter(m => m.id !== mealId);
        localStorage.setItem('mealPlans', JSON.stringify(updatedMeals));
        await ipcRenderer.invoke('deleteMealFromFile', existingMeal);
        
        // Update UI
        const button = document.querySelector('.action-buttons button');
        button.innerHTML = '<i class="fas fa-bookmark"></i> Add to Planner';
        button.classList.remove('remove-btn');
        button.classList.add('save-btn');
    } else {
        // Show modal to add meal to planner
        showAddToPlannerModal(mealId, mealName, mealThumb);
    }
}

// Show add to planner modal
function showAddToPlannerModal(mealId, mealName, mealThumb) {
    const plannerModal = document.createElement('div');
    plannerModal.className = 'modal planner-modal';
    plannerModal.innerHTML = `
        <div class="modal-content">
            <span class="close">&times;</span>
            <h3>Add to Meal Planner</h3>
            <form id="addToPlannerForm" class="planner-form">
                <div class="form-group">
                    <label><i class="fas fa-calendar-day"></i> Select Day:</label>
                    <select id="plannerDay" required>
                        <option value="Monday">Monday</option>
                        <option value="Tuesday">Tuesday</option>
                        <option value="Wednesday">Wednesday</option>
                        <option value="Thursday">Thursday</option>
                        <option value="Friday">Friday</option>
                        <option value="Saturday">Saturday</option>
                        <option value="Sunday">Sunday</option>
                    </select>
                </div>
                <div class="form-group">
                    <label><i class="fas fa-clock"></i> Select Meal Type:</label>
                    <select id="plannerMealType" required>
                        <option value="Breakfast">Breakfast</option>
                        <option value="Lunch">Lunch</option>
                        <option value="Dinner">Dinner</option>
                    </select>
                </div>
                <button type="submit" class="btn save-btn">
                    <i class="fas fa-plus"></i> Add to Plan
                </button>
            </form>
        </div>
    `;

    document.body.appendChild(plannerModal);
    plannerModal.style.display = 'block';

    // Handle form submission
    const form = plannerModal.querySelector('#addToPlannerForm');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const day = document.getElementById('plannerDay').value;
        const type = document.getElementById('plannerMealType').value;

        // Get full meal details
        const meal = await getMealById(mealId);
        
        // Format ingredients
        const ingredients = [];
        for (let i = 1; i <= 20; i++) {
            if (meal[`strIngredient${i}`]) {
                ingredients.push({
                    ingredient: meal[`strIngredient${i}`],
                    measure: meal[`strMeasure${i}`] || ''
                });
            }
        }

        // Create meal object with full details
        const mealDetails = {
            id: mealId,
            name: meal.strMeal,
            thumbnail: meal.strMealThumb,
            day,
            type,
            category: meal.strCategory,
            area: meal.strArea,
            instructions: meal.strInstructions,
            ingredients: ingredients,
            youtube: meal.strYoutube
        };

        // Save to localStorage
        const savedMeals = JSON.parse(localStorage.getItem('mealPlans') || '[]');
        const updatedMeals = savedMeals.filter(m => !(m.day === day && m.type === type));
        updatedMeals.push(mealDetails);
        localStorage.setItem('mealPlans', JSON.stringify(updatedMeals));

        // Save to text file
        await ipcRenderer.invoke('saveMealToFile', mealDetails);

        plannerModal.remove();
        showMealDetails(mealId);
    };

    // Handle close button
    const closeBtn = plannerModal.querySelector('.close');
    closeBtn.onclick = () => plannerModal.remove();

    // Close when clicking outside
    window.onclick = (event) => {
        if (event.target === plannerModal) {
            plannerModal.remove();
        }
    };
}

// Random meal generator function
async function getRandomMeal() {
    try {
        const meal = await fetchRandomMeal();
        if (meal) {
            displayMeals([meal]);
            showMealDetails(meal.idMeal);
        }
    } catch (error) {
        console.error('Error getting random meal:', error);
        const resultsContainer = document.getElementById('results');
        resultsContainer.innerHTML = '<p>Error loading random meal. Please try again.</p>';
    }
}

document.querySelector('.close').onclick = function() {
    document.getElementById('mealModal').style.display = "none";
}

window.onclick = function(event) {
    const modal = document.getElementById('mealModal');
    if (event.target == modal) {
        modal.style.display = "none";
    }
}

function addToMealPlanner(mealId) {
    // We'll implement this in the next part with the meal planner functionality
    alert('This feature will be implemented with the meal planner!');
}

// CRUD Operations for Ingredients
// Add new ingredient
function addIngredient() {
    // Create modal for adding new ingredient
    const overlayModal = document.createElement('div');
    overlayModal.className = 'overlay-modal';
    overlayModal.innerHTML = `
        <div class="overlay-content">
            <div class="modal-header">
                <h3><i class="fas fa-plus"></i> Add New Ingredient</h3>
                <span class="close" onclick="closeOverlayModal()">&times;</span>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="measureInput">Measure:</label>
                    <input type="text" id="measureInput" class="measure-input" placeholder="e.g., 2 cups">
                </div>
                <div class="form-group">
                    <label for="ingredientInput">Ingredient:</label>
                    <input type="text" id="ingredientInput" class="ingredient-input" placeholder="e.g., flour">
                </div>
                <div class="modal-actions">
                    <button onclick="saveNewIngredient()" class="btn save-btn">
                        <i class="fas fa-save"></i> Save
                    </button>
                    <button onclick="closeOverlayModal()" class="btn cancel-btn">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlayModal);
}

// Edit existing ingredient
function editIngredient(btn) {
    const ingredientItem = btn.closest('.ingredient-item');
    const measure = ingredientItem.querySelector('.measure').textContent;
    const ingredient = ingredientItem.querySelector('.ingredient').textContent;
    
    // Create modal for editing ingredient
    const overlayModal = document.createElement('div');
    overlayModal.className = 'overlay-modal';
    overlayModal.innerHTML = `
        <div class="overlay-content">
            <div class="modal-header">
                <h3><i class="fas fa-edit"></i> Edit Ingredient</h3>
                <span class="close" onclick="closeOverlayModal()">&times;</span>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="editMeasureInput">Measure:</label>
                    <input type="text" id="editMeasureInput" class="measure-input" value="${measure}">
                </div>
                <div class="form-group">
                    <label for="editIngredientInput">Ingredient:</label>
                    <input type="text" id="editIngredientInput" class="ingredient-input" value="${ingredient}">
                </div>
                <div class="modal-actions">
                    <button onclick="saveEditIngredient('${measure}', '${ingredient}')" class="btn save-btn">
                        <i class="fas fa-save"></i> Save
                    </button>
                    <button onclick="closeOverlayModal()" class="btn cancel-btn">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlayModal);
}

// Save new ingredient to the list
function saveNewIngredient() {
    const measure = document.getElementById('measureInput').value.trim();
    const ingredient = document.getElementById('ingredientInput').value.trim();
    
    if (!measure || !ingredient) {
        alert('Please fill in both measure and ingredient fields');
        return;
    }

    const ingredientsGrid = document.querySelector('.ingredients-grid');
    const newIngredientDiv = document.createElement('div');
    newIngredientDiv.className = 'ingredient-item';
    newIngredientDiv.innerHTML = `
        <span class="measure">${measure}</span>
        <span class="ingredient">${ingredient}</span>
        <div class="ingredient-actions">
            <button onclick="editIngredient(this)" class="btn edit-btn">
                <i class="fas fa-edit"></i>
            </button>
            <button onclick="deleteIngredient(this)" class="btn remove-btn">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    ingredientsGrid.appendChild(newIngredientDiv);
    closeOverlayModal();
}

// Update existing ingredient
function saveEditIngredient(originalMeasure, originalIngredient) {
    const measure = document.getElementById('editMeasureInput').value.trim();
    const ingredient = document.getElementById('editIngredientInput').value.trim();
    
    if (!measure || !ingredient) {
        alert('Please fill in both measure and ingredient fields');
        return;
    }

    // Find the original ingredient item
    const ingredientsGrid = document.querySelector('.ingredients-grid');
    const ingredientItems = ingredientsGrid.querySelectorAll('.ingredient-item');
    let targetItem;

    ingredientItems.forEach(item => {
        const itemMeasure = item.querySelector('.measure').textContent;
        const itemIngredient = item.querySelector('.ingredient').textContent;
        if (itemMeasure === originalMeasure && itemIngredient === originalIngredient) {
            targetItem = item;
        }
    });

    if (targetItem) {
        targetItem.innerHTML = `
            <span class="measure">${measure}</span>
            <span class="ingredient">${ingredient}</span>
            <div class="ingredient-actions">
                <button onclick="editIngredient(this)" class="btn edit-btn">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteIngredient(this)" class="btn remove-btn">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    }

    closeOverlayModal();
}

// Delete ingredient from the list
function deleteIngredient(btn) {
    // Remove ingredient from DOM
    const ingredientItem = btn.closest('.ingredient-item');
    ingredientItem.remove();
}