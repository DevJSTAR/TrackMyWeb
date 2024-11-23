let activeTabData = {};
let updateInterval;
let pendingUpdates = false;
let currentActiveTab = null;
let lastVisitedDomains = {};
let settings = {
    showSeconds: false,
    minDuration: 1,
    trackInactive: false
};

// Load settings when background script starts
chrome.storage.local.get({
    showSeconds: false,
    minDuration: 1,
    trackInactive: false
}, (loadedSettings) => {
    settings = loadedSettings;
});

// Listen for settings changes
chrome.storage.onChanged.addListener((changes) => {
    if (changes.showSeconds) {
        settings.showSeconds = changes.showSeconds.newValue;
    }
    if (changes.minDuration) {
        settings.minDuration = changes.minDuration.newValue;
    }
    if (changes.trackInactive) {
        settings.trackInactive = changes.trackInactive.newValue;
    }
});

// Track active tab changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    currentActiveTab = activeInfo.tabId;
    const tab = await chrome.tabs.get(activeInfo.tabId);
    
    // Update previous active tab's tracking state
    Object.entries(activeTabData).forEach(([tabId, data]) => {
        if (tabId !== currentActiveTab.toString()) {
            // Only stop tracking if trackInactive is false
            data.isTracking = settings.trackInactive;
            if (!settings.trackInactive) {
                const timeSpent = Math.floor((Date.now() - data.lastTrackTime) / 1000);
                if (timeSpent > 0) {
                    updateSiteData(data.domain, 'time', timeSpent);
                }
            }
        }
    });

    // Start tracking new active tab
    if (tab.url && shouldTrackUrl(tab.url)) {
        try {
            const domain = new URL(tab.url).hostname;
            activeTabData[activeInfo.tabId] = {
                domain,
                startTime: Date.now(),
                lastTrackTime: Date.now(),
                isTracking: true
            };
        } catch (error) {
            console.error('Error processing URL:', error);
        }
    }
});

// Track when tabs are updated (actual navigation)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && shouldTrackUrl(tab.url)) {
        try {
            const domain = new URL(tab.url).hostname;
            const isActiveTab = tabId === currentActiveTab;
            const lastDomain = lastVisitedDomains[tabId];

            const isNewVisit = lastDomain !== domain;
            
            activeTabData[tabId] = {
                domain,
                startTime: Date.now(),
                lastTrackTime: Date.now(),
                isTracking: isActiveTab || settings.trackInactive
            };

            if (isNewVisit) {
                updateSiteData(domain, 'count');
                lastVisitedDomains[tabId] = domain;
            }
        } catch (error) {
            console.error('Error processing URL:', error);
        }
    }
});

// Update active tab times every second
function startTimeTracking() {
    updateInterval = setInterval(async () => {
        if (pendingUpdates) return;
        pendingUpdates = true;

        // Update time for all tracking tabs
        for (const [tabId, data] of Object.entries(activeTabData)) {
            if (data.isTracking) {
                // Track active tab always, inactive tabs only if setting is enabled
                const isActiveTab = tabId === currentActiveTab?.toString();
                if (isActiveTab || settings.trackInactive) {
                    try {
                        await updateSiteData(data.domain, 'time', 1);
                        data.lastTrackTime = Date.now();
                    } catch (error) {
                        console.error('Error updating time:', error);
                    }
                }
            }
        }

        pendingUpdates = false;
    }, 1000);
}

function shouldTrackUrl(url) {
    if (!url) return false;
    
    try {
        const urlObj = new URL(url);
        
        // Don't track browser URLs, extension pages, and file system URLs
        if (url.startsWith('chrome://') || 
            url.startsWith('chrome-extension://') ||
            url.startsWith('edge://') ||
            url.startsWith('about:') ||
            url.startsWith('firefox:') ||
            url.startsWith('opera:') ||
            urlObj.protocol === 'file:' ||  // Don't track file:// URLs
            urlObj.protocol === 'c:' ||     // Don't track C:/ paths
            urlObj.protocol === 'd:' ||     // Don't track D:/ paths
            urlObj.protocol === 'e:' ||     // Don't track E:/ paths
            urlObj.protocol === 'f:' ||     // Don't track F:/ paths
            /^[a-zA-Z]:/i.test(url)) {     // Don't track any drive letter paths
            return false;
        }
        return true;
    } catch (error) {
        return false;  // If URL is invalid, don't track it
    }
}

// Start tracking when extension loads
startTimeTracking();

// Add this function to your background.js
async function updateSiteData(domain, type, timeSpent = 0) {
    try {
        const data = await chrome.storage.local.get('visits');
        const visits = data.visits || {};

        if (!visits[domain]) {
            visits[domain] = {
                count: 1,
                totalTimeSpent: 0,
                lastVisited: new Date().toLocaleString()
            };
        } else if (visits[domain].count === 0) {
            visits[domain].count = 1;
        }

        if (type === 'count') {
            visits[domain].count++;
        } else if (type === 'time' && timeSpent > 0) {
            visits[domain].totalTimeSpent += timeSpent;
        }

        visits[domain].lastVisited = new Date().toLocaleString();
        await chrome.storage.local.set({ visits });
    } catch (error) {
        console.error('Error updating site data:', error);
    }
} 