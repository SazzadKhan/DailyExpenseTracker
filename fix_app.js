const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

// 1. Remove settingsModal click listeners since it's no longer a modal
appJs = appJs.replace("settingsBtn.addEventListener('click', openSettingsModal);\n    settingsClose.addEventListener('click', closeSettingsModal);\n    settingsModal.addEventListener('click', (e) => {\n        if (e.target === settingsModal) closeSettingsModal();\n    });", "");

// 2. Add listeners for addModal
const addListeners = `
    const addModal = document.getElementById('add-modal');
    const addClose = document.getElementById('add-close');
    const dashboardAddBtn = document.getElementById('dashboard-add-btn');

    if (addClose) {
        addClose.addEventListener('click', () => {
            addModal.classList.remove('active');
        });
    }

    if (addModal) {
        addModal.addEventListener('click', (e) => {
            if (e.target === addModal) addModal.classList.remove('active');
        });
    }

    if (dashboardAddBtn) {
        dashboardAddBtn.addEventListener('click', () => {
            if (addModal) addModal.classList.add('active');
        });
    }
`;

// Inject right before handleNavigation
appJs = appJs.replace("// ===== Mobile Navigation =====", addListeners + "\n// ===== Mobile Navigation =====");

// 3. Update handleAddExpense to close the modal and show toast
const toastInjection = `    // Reset form
    expenseAmount.value = '';
    expenseDescription.value = '';
    expenseSubcategory.value = '';
    
    // Close modal and notify
    const addModal = document.getElementById('add-modal');
    if (addModal) addModal.classList.remove('active');
    
    // Optional: navigate to history or dashboard if we want, or just show toast
    showToast('Entry logged successfully!', 'success');
`;
appJs = appJs.replace("    // Reset form\n    expenseAmount.value = '';\n    expenseDescription.value = '';\n    expenseSubcategory.value = '';\n    expenseAmount.focus();", toastInjection);

fs.writeFileSync('app.js', appJs);
