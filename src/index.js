const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Create data directory for storing meal plans if it doesn't exist
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// ====== IPC (Inter-Process Communication) Handlers for Meal Plans ======

// Handler to save meal details to a text file
ipcMain.handle('saveMealToFile', async (event, meal) => {
    try {
        // Create filename format: day_mealType_mealName.txt
        const filename = `${meal.day}_${meal.type}_${meal.name.replace(/\s+/g, '_')}.txt`;
        const filePath = path.join(dataDir, filename);

        // Format meal details in a readable structure
        const mealDetails = `Name: ${meal.name}
Day: ${meal.day}
Meal Type: ${meal.type}
Category: ${meal.category}
Area: ${meal.area}

Instructions:
${meal.instructions}

Ingredients:
${meal.ingredients.map(ing => `- ${ing.measure} ${ing.ingredient}`).join('\n')}

YouTube: ${meal.youtube || 'Not available'}`;

        // Write formatted details to file
        fs.writeFileSync(filePath, mealDetails);
        return true;
    } catch (error) {
        console.error('Error saving meal:', error);
        return false;
    }
});

// Handler to delete meal file
ipcMain.handle('deleteMealFromFile', async (event, meal) => {
    try {
        const filename = `${meal.day}_${meal.type}_${meal.name.replace(/\s+/g, '_')}.txt`;
        const filePath = path.join(dataDir, filename);
        
        // Check if file exists before attempting deletion
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        return true;
    } catch (error) {
        console.error('Error deleting meal file:', error);
        return false;
    }
});

// Handler to generate shopping list from all saved meals
ipcMain.handle('generateShoppingList', async (event) => {
    try {
        // Read all meal files from data directory
        const files = fs.readdirSync(dataDir);
        // Use Map to store and combine similar ingredients
        const shoppingList = new Map(); 

        // Process each meal file
        for (const file of files) {
            if (file.endsWith('.txt')) {
                const content = fs.readFileSync(path.join(dataDir, file), 'utf8');
                
                // Extract ingredients section using regex
                const ingredientsMatch = content.match(/Ingredients:\n([\s\S]*?)(?:\n\n|$)/);
                if (ingredientsMatch) {
                    // Process and clean up ingredient lines
                    const ingredients = ingredientsMatch[1].split('\n')
                        .map(line => line.trim())
                        .filter(line => line.startsWith('-'))
                        .map(line => line.substring(2)); // Remove "- " prefix

                    // Combine similar ingredients
                    ingredients.forEach(ing => {
                        const [measure, ...nameParts] = ing.split(' ');
                        const name = nameParts.join(' ').toLowerCase();
                        
                        // If ingredient exists, combine measurements
                        if (shoppingList.has(name)) {
                            const existing = shoppingList.get(name);
                            shoppingList.set(name, `${existing}\n${measure} ${name}`);
                        } else {
                            shoppingList.set(name, `${measure} ${name}`);
                        }
                    });
                }
            }
        }

        return Array.from(shoppingList.values());
    } catch (error) {
        console.error('Error generating shopping list:', error);
        return [];
    }
});

// Check if running as Windows installer
if (require('electron-squirrel-startup')) {
    app.quit();
}

// Create the main application window
const createWindow = () => {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true, // Enable Node.js integration
            contextIsolation: false // Disable context isolation for IPC
        }
    });

    // Remove default application menu
    mainWindow.setMenu(null);

    // Load the main HTML file
    mainWindow.loadFile(path.join(__dirname, 'pages/index.html'));
};

// Initialize app when ready
app.whenReady().then(() => {
    createWindow();

    // macOS specific: recreate window when dock icon is clicked
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Quit the app when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

