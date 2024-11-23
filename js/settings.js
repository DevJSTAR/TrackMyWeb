document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    
    document.querySelectorAll('.theme-button').forEach(button => {
        button.addEventListener('click', () => {
            const newTheme = button.dataset.theme;
            const currentTheme = document.body.getAttribute('data-theme');
            
            if (newTheme !== currentTheme) {
                updateTheme(newTheme);
                showNotification(`Theme changed to ${newTheme} mode`);
                saveSettings();
            }
        });
    });

    document.getElementById('showSeconds').addEventListener('change', saveSettings);
    document.getElementById('minDuration').addEventListener('change', saveSettings);
    
    document.getElementById('exportJsonBtn').addEventListener('click', () => exportData());
    document.getElementById('clearBtn').addEventListener('click', clearData);

    const minDurationInput = document.getElementById('minDuration');
    minDurationInput.addEventListener('input', () => {
        validateMinDuration(minDurationInput);
    });

    minDurationInput.addEventListener('blur', () => {
        validateMinDuration(minDurationInput);
        saveSettings();
    });

    document.getElementById('trackInactive').addEventListener('change', saveSettings);
});

async function loadSettings() {
    const settings = await chrome.storage.local.get({
        theme: 'light',
        showSeconds: false,
        minDuration: 1,
        trackInactive: false
    });

    updateTheme(settings.theme);
    
    document.getElementById('showSeconds').checked = settings.showSeconds;
    document.getElementById('minDuration').value = settings.minDuration;
    document.getElementById('trackInactive').checked = settings.trackInactive;

    const data = await chrome.storage.local.get('visits');
    const hasData = Object.keys(data.visits || {}).length > 0;
    updateDataButtonStates(hasData);

    const importInput = document.getElementById('importInput');
    const importBtn = document.getElementById('importBtn');
    
    importBtn?.addEventListener('click', () => {
        importInput.click();
    });

    importInput?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        importBtn.disabled = true;
        importBtn.classList.add('loading');

        try {
            await importData(file);
        } finally {
            importBtn.disabled = false;
            importBtn.classList.remove('loading');
            importInput.value = ''; // Reset input
        }
    });
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
    document.querySelectorAll('.theme-button').forEach(button => {
        button.classList.toggle('active', button.dataset.theme === theme);
    });

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
    const exportBtn = document.getElementById('exportJsonBtn');
    exportBtn.disabled = true;
    exportBtn.classList.add('loading');

    try {
        const data = await chrome.storage.local.get('visits');
        const blob = new Blob([JSON.stringify(data.visits || {}, null, 2)], { 
            type: 'application/json' 
        });
        downloadFile(blob, `trackmyweb-export-${new Date().toISOString().split('T')[0]}.json`);
        showNotification('Data exported successfully');
    } catch (error) {
        showNotification('Failed to export data', true);
    } finally {
        exportBtn.disabled = false;
        exportBtn.classList.remove('loading');
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
    const clearBtn = document.getElementById('clearBtn');
    
    if (confirm('Are you sure you want to clear all tracking data? This cannot be undone.')) {
        clearBtn.disabled = true;
        clearBtn.classList.add('loading');
        
        try {
            await chrome.storage.local.remove('visits');
            showNotification('All tracking data cleared');
            updateDataButtonStates(false);
        } catch (error) {
            showNotification('Failed to clear data', true);
        } finally {
            clearBtn.disabled = false;
            clearBtn.classList.remove('loading');
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
    }, 5000);
}

chrome.storage.onChanged.addListener((changes) => {
    if (changes.theme) {
        updateTheme(changes.theme.newValue);
    }
});

function validateMinDuration(input) {
    let value = parseInt(input.value);
    if (value < 1) value = 1;
    if (value > 60) value = 60;
    input.value = value;
    return value;
}

function validateImportedData(data) {
    try {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid data format: must be an object');
        }

        for (const [domain, stats] of Object.entries(data)) {
            try {
                new URL(`https://${domain}`);
            } catch {
                throw new Error(`Invalid domain: ${domain}`);
            }

            if (typeof stats !== 'object') {
                throw new Error(`Invalid stats for domain ${domain}: must be an object`);
            }

            if (typeof stats.count !== 'number' || stats.count < 0) {
                throw new Error(`Invalid visit count for ${domain}: must be a positive number`);
            }

            if (typeof stats.totalTimeSpent !== 'number' || stats.totalTimeSpent < 0) {
                throw new Error(`Invalid time spent for ${domain}: must be a positive number`);
            }

            if (!stats.lastVisited || isNaN(new Date(stats.lastVisited).getTime())) {
                throw new Error(`Invalid last visited date for ${domain}`);
            }

            data[domain] = {
                count: Math.floor(Math.abs(stats.count)),
                totalTimeSpent: Math.floor(Math.abs(stats.totalTimeSpent)),
                lastVisited: new Date(stats.lastVisited).toLocaleString()
            };
        }

        return { isValid: true, data };
    } catch (error) {
        return { isValid: false, error: error.message };
    }
}

async function importData(file) {
    try {
        const text = await file.text();
        const importedData = JSON.parse(text);
        
        const { isValid, data, error } = validateImportedData(importedData);
        
        if (!isValid) {
            showNotification(`Import failed: ${error}`, true);
            return false;
        }

        const currentData = await chrome.storage.local.get('visits');
        const visits = currentData.visits || {};

        for (const [domain, stats] of Object.entries(data)) {
            if (!visits[domain] || visits[domain].totalTimeSpent < stats.totalTimeSpent) {
                visits[domain] = stats;
            }
        }

        await chrome.storage.local.set({ visits });
        showNotification('Data imported successfully');
        updateDataButtonStates(true);
        return true;
    } catch (error) {
        showNotification(`Import failed: ${error.message}`, true);
        return false;
    }
}
  