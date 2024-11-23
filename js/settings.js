document.addEventListener('DOMContentLoaded', () => {
    // Load saved settings
    loadSettings();
    
    // Add event listeners for theme buttons
    document.querySelectorAll('.theme-button').forEach(button => {
        button.addEventListener('click', () => {
            const newTheme = button.dataset.theme;
            const currentTheme = document.body.getAttribute('data-theme');
            
            // Only update if theme is actually changing
            if (newTheme !== currentTheme) {
                updateTheme(newTheme);
                showNotification(`Theme changed to ${newTheme} mode`);
                saveSettings();
            }
        });
    });

    // Add event listeners for other settings
    document.getElementById('showSeconds').addEventListener('change', saveSettings);
    document.getElementById('minDuration').addEventListener('change', saveSettings);
    
    // Update data management button listeners
    document.getElementById('exportJsonBtn').addEventListener('click', () => exportData());
    document.getElementById('clearBtn').addEventListener('click', clearData);

    // Add validation for minDuration input
    const minDurationInput = document.getElementById('minDuration');
    minDurationInput.addEventListener('input', () => {
        validateMinDuration(minDurationInput);
    });

    minDurationInput.addEventListener('blur', () => {
        validateMinDuration(minDurationInput);
        saveSettings();
    });

    // Add event listener for trackInactive toggle
    document.getElementById('trackInactive').addEventListener('change', saveSettings);
});

async function loadSettings() {
    const settings = await chrome.storage.local.get({
        theme: 'light',
        showSeconds: false,
        minDuration: 1,
        trackInactive: false
    });

    // Apply theme
    updateTheme(settings.theme);
    
    // Set other settings
    document.getElementById('showSeconds').checked = settings.showSeconds;
    document.getElementById('minDuration').value = settings.minDuration;
    document.getElementById('trackInactive').checked = settings.trackInactive;

    // Check if we have data and update button states
    const data = await chrome.storage.local.get('visits');
    const hasData = Object.keys(data.visits || {}).length > 0;
    updateDataButtonStates(hasData);
}

function updateDataButtonStates(hasData) {
    const exportJsonBtn = document.getElementById('exportJsonBtn');
    const clearBtn = document.getElementById('clearBtn');
    
    if (!hasData) {
        exportJsonBtn?.setAttribute('disabled', 'true');
        clearBtn?.setAttribute('disabled', 'true');
        exportJsonBtn?.classList.add('disabled');
        clearBtn?.classList.add('disabled');
    } else {
        exportJsonBtn?.removeAttribute('disabled');
        clearBtn?.removeAttribute('disabled');
        exportJsonBtn?.classList.remove('disabled');
        clearBtn?.classList.remove('disabled');
    }
}

function updateTheme(theme) {
    // Update theme buttons
    document.querySelectorAll('.theme-button').forEach(button => {
        button.classList.toggle('active', button.dataset.theme === theme);
    });

    // Apply theme to body
    document.body.setAttribute('data-theme', theme);
}

async function saveSettings() {
    try {
        const newSettings = {
            theme: document.querySelector('.theme-button.active')?.dataset.theme || 'light',
            showSeconds: document.getElementById('showSeconds').checked,
            minDuration: validateMinDuration(document.getElementById('minDuration')),
            trackInactive: document.getElementById('trackInactive').checked
        };

        await chrome.storage.local.set(newSettings);
        
        // Only show notifications for non-theme changes
        const activeElement = document.activeElement;
        if (activeElement?.id === 'showSeconds') {
            showNotification(`Time display ${newSettings.showSeconds ? 'will now' : 'will no longer'} show seconds`);
        } else if (activeElement?.id === 'minDuration') {
            showNotification(`Minimum tracking duration set to ${newSettings.minDuration} seconds`);
        } else if (activeElement?.id === 'trackInactive') {
            showNotification(`Inactive tab tracking ${newSettings.trackInactive ? 'enabled' : 'disabled'}`);
        }
    } catch (error) {
        showNotification('Failed to save settings', true);
    }
}

async function exportData() {
    try {
        const data = await chrome.storage.local.get('visits');
        const blob = new Blob([JSON.stringify(data.visits || {}, null, 2)], { 
            type: 'application/json' 
        });
        downloadFile(blob, `trackmyweb-export-${new Date().toISOString().split('T')[0]}.json`);
        showNotification('Data exported successfully');
    } catch (error) {
        showNotification('Failed to export data', true);
    }
}

function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function clearData() {
    if (confirm('Are you sure you want to clear all tracking data? This cannot be undone.')) {
        try {
            await chrome.storage.local.remove('visits');
            showNotification('All tracking data cleared');
        } catch (error) {
            showNotification('Failed to clear data', true);
        }
    }
}

function showNotification(message, isError = false) {
    const existingNotification = document.querySelector('.save-confirmation');
    if (existingNotification) {
        existingNotification.classList.add('hide');
        setTimeout(() => existingNotification.remove(), 300);
    }

    const notification = document.createElement('div');
    notification.className = `save-confirmation${isError ? ' error' : ''}`;
    
    const icon = isError ? 
        '<i class="fas fa-exclamation-circle"></i>' : 
        '<i class="fas fa-check-circle"></i>';
    
    notification.innerHTML = `${icon}${message}`;
    document.body.appendChild(notification);

    requestAnimationFrame(() => {
        notification.classList.add('show');
    });

    setTimeout(() => {
        notification.classList.add('hide');
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// Apply theme to popup when it changes
chrome.storage.onChanged.addListener((changes) => {
    if (changes.theme) {
        updateTheme(changes.theme.newValue);
    }
});

// Add this function to validate the minimum duration input
function validateMinDuration(input) {
    let value = parseInt(input.value);
    if (value < 1) value = 1;
    if (value > 60) value = 60;
    input.value = value;
    return value;
}
  