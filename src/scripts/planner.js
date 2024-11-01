const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

// Initialize meal plans from localStorage or empty array if none exists
let mealPlans = JSON.parse(localStorage.getItem('mealPlans') || '[]');

// Main function to render the weekly meal planner interface
function initializePlanner() {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const mealTypes = ['Breakfast', 'Lunch', 'Dinner'];
    const weeklyPlanner = document.getElementById('weeklyPlanner');
    
    // Generate HTML for each day and meal slot
    weeklyPlanner.innerHTML = days.map(day => `
        <div class="day-card">
            <h3>${day}</h3>
            ${mealTypes.map(type => {
                const meal = mealPlans.find(m => m.day === day && m.type === type);
                return `
                    <div class="meal-slot" id="${day}-${type}">
                        <h4>${type}</h4>
                        ${meal ? `
                            <div class="planned-meal">
                                <img src="${meal.thumbnail}" alt="${meal.name}">
                                <div class="meal-info">
                                    <h5>${meal.name}</h5>
                                    <div class="meal-actions">
                                        <button onclick="editMeal('${meal.id}', '${day}', '${type}')" class="edit-btn">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button onclick="deleteMeal('${day}', '${type}')" class="delete-btn">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ` : '<p class="empty-slot">No meal planned</p>'}
                    </div>
                `;
            }).join('')}
        </div>
    `).join('');
}

// Function to handle editing of existing meal plans
async function editMeal(mealId, currentDay, currentType) {
    // Create modal for editing meal details
    const editModal = document.createElement('div');
    editModal.className = 'modal';
    
    const meal = mealPlans.find(m => m.day === currentDay && m.type === currentType);
    
    editModal.innerHTML = `
        <div class="modal-content">
            <span class="close">&times;</span>
            <h3>Edit Meal Plan</h3>
            <form id="editMealForm" class="planner-form">
                <div class="form-group">
                    <label><i class="fas fa-calendar-day"></i> Select Day:</label>
                    <select id="editDay" required>
                        ${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
                            .map(day => `<option value="${day}" ${day === currentDay ? 'selected' : ''}>${day}</option>`)
                            .join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label><i class="fas fa-clock"></i> Select Meal Type:</label>
                    <select id="editType" required>
                        ${['Breakfast', 'Lunch', 'Dinner']
                            .map(type => `<option value="${type}" ${type === currentType ? 'selected' : ''}>${type}</option>`)
                            .join('')}
                    </select>
                </div>
                <button type="submit" class="btn save-btn">
                    <i class="fas fa-save"></i> Update Meal
                </button>
            </form>
        </div>
    `;

    document.body.appendChild(editModal);
    editModal.style.display = 'block';

    // Handle form submission for meal updates
    const form = editModal.querySelector('#editMealForm');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const newDay = document.getElementById('editDay').value;
        const newType = document.getElementById('editType').value;

        // Delete old text file
        await ipcRenderer.invoke('deleteMealFromFile', meal);

        // Update meal details
        meal.day = newDay;
        meal.type = newType;

        // Update localStorage
        mealPlans = mealPlans.filter(m => !(m.day === currentDay && m.type === currentType));
        mealPlans.push(meal);
        localStorage.setItem('mealPlans', JSON.stringify(mealPlans));

        // Save updated meal to new text file
        await ipcRenderer.invoke('saveMealToFile', meal);

        // Close modal and refresh display
        editModal.remove();
        initializePlanner();
    };

    // Handle close button
    const closeBtn = editModal.querySelector('.close');
    closeBtn.onclick = () => editModal.remove();

    // Close when clicking outside
    window.onclick = (event) => {
        if (event.target === editModal) {
            editModal.remove();
        }
    };
}

// Function to remove meals from planner
async function deleteMeal(day, type) {
    const mealToDelete = mealPlans.find(m => m.day === day && m.type === type);
    if (mealToDelete) {
        // Delete from text file
        await ipcRenderer.invoke('deleteMealFromFile', mealToDelete);
        
        // Remove from localStorage
        mealPlans = mealPlans.filter(m => !(m.day === day && m.type === type));
        localStorage.setItem('mealPlans', JSON.stringify(mealPlans));
        initializePlanner();
    }
}

// Function to add new meals to the planner
async function addMealToPlan(mealId, mealName, mealThumb, day, type) {
    // Remove existing meal in slot if any
    mealPlans = mealPlans.filter(m => !(m.day === day && m.type === type));
    
    // Add new meal
    const newMeal = {
        id: mealId,
        name: mealName,
        thumbnail: mealThumb,
        day,
        type
    };
    
    mealPlans.push(newMeal);
    localStorage.setItem('mealPlans', JSON.stringify(mealPlans));
    
    // Save to text file
    await ipcRenderer.invoke('saveMealPlan', newMeal);
    
    initializePlanner();
}

// Function to export meal plan to a text file
function exportMealPlan() {
    const mealPlans = JSON.parse(localStorage.getItem('mealPlans') || '[]');
    
    // Sort meals by day and type
    const sortedMeals = mealPlans.sort((a, b) => {
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const types = ['Breakfast', 'Lunch', 'Dinner'];
        
        if (days.indexOf(a.day) === days.indexOf(b.day)) {
            return types.indexOf(a.type) - types.indexOf(b.type);
        }
        return days.indexOf(a.day) - days.indexOf(b.day);
    });

    // Create text content
    let content = "MealFinder - Weekly Meal Plan\n";
    content += "===========================\n\n";

    let currentDay = '';
    sortedMeals.forEach(meal => {
        if (currentDay !== meal.day) {
            currentDay = meal.day;
            content += `\n${meal.day}\n${'-'.repeat(meal.day.length)}\n`;
        }
        content += `${meal.type}: ${meal.name}\n`;
    });

    // Create and download file
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'meal-plan.txt';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

// Function to display all saved meals
async function readSavedMeals() {
    const dataDir = path.join(__dirname, '../../data');
    const savedContent = document.getElementById('savedMealsContent');
    const modal = document.getElementById('savedMealsModal');
    
    try {
        // Read all files in the data directory
        const files = fs.readdirSync(dataDir);
        
        if (files.length === 0) {
            savedContent.innerHTML = `
                <div class="no-saved-meals">
                    <i class="fas fa-folder-open"></i>
                    <p>No saved meals found</p>
                </div>
            `;
        } else {
            // Create HTML content for each saved meal
            const mealsHTML = files.map(file => {
                const filePath = path.join(dataDir, file);
                const content = fs.readFileSync(filePath, 'utf8');
                const fileName = file.replace('.txt', '').split('_');
                
                return `
                    <div class="saved-meal-card">
                        <div class="saved-meal-header">
                            <h3>${fileName[2].replace(/_/g, ' ')}</h3>
                            <span class="meal-time">${fileName[0]} - ${fileName[1]}</span>
                        </div>
                        <div class="saved-meal-content">
                            <pre>${content}</pre>
                        </div>
                    </div>
                `;
            }).join('');

            savedContent.innerHTML = mealsHTML;
        }

        // Show modal
        modal.style.display = 'block';
        
        // Add animation class after content is loaded
        savedContent.querySelectorAll('.saved-meal-card').forEach((card, index) => {
            setTimeout(() => {
                card.classList.add('fade-in');
            }, index * 100);
        });

        // Handle close button
        const closeBtn = modal.querySelector('.close');
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };

        // Close when clicking outside
        window.onclick = (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        };

    } catch (error) {
        console.error('Error reading saved meals:', error);
        savedContent.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <p>Error reading saved meals</p>
            </div>
        `;
        modal.style.display = 'block';
    }
}

// Function to generate shopping list from planned meals
async function generateShoppingList() {
    const modal = document.getElementById('shoppingListModal');
    const content = document.getElementById('shoppingListContent');
    
    try {
        // Get shopping list from main process
        const ingredients = await ipcRenderer.invoke('generateShoppingList');
        
        if (ingredients.length === 0) {
            content.innerHTML = `
                <div class="empty-list">
                    <i class="fas fa-shopping-basket"></i>
                    <p>No ingredients found. Add some meals to your planner first!</p>
                </div>
            `;
        } else {
            content.innerHTML = `
                <ul class="shopping-list">
                    ${ingredients.map(item => `
                        <li>
                            <span>${item}</span>
                            <input type="checkbox" aria-label="Mark as collected">
                        </li>
                    `).join('')}
                </ul>
            `;
        }
        
        modal.style.display = 'block';
        
    } catch (error) {
        console.error('Error generating shopping list:', error);
        content.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <p>Error generating shopping list. Please try again.</p>
            </div>
        `;
    }
}

// Event handlers for modal interactions
document.querySelectorAll('.modal .close').forEach(closeBtn => {
    // Close modal handlers
    closeBtn.onclick = function() {
        this.closest('.modal').style.display = 'none';
    };
});

// Initialize planner when page loads
document.addEventListener('DOMContentLoaded', initializePlanner);
