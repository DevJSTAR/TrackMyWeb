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

chrome.storage.local.get({
    showSeconds: false,
    minDuration: 1,
    trackInactive: false
}, (loadedSettings) => {
    settings = loadedSettings;
});

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

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const previousActiveTab = currentActiveTab;
    currentActiveTab = activeInfo.tabId;
    const tab = await chrome.tabs.get(activeInfo.tabId);
    
    if (previousActiveTab && activeTabData[previousActiveTab]) {
        const data = activeTabData[previousActiveTab];
        if (!settings.trackInactive) {
            const timeSpent = Math.floor((Date.now() - data.lastTrackTime) / 1000);
            if (timeSpent > 0) {
                await updateSiteData(data.domain, 'time', timeSpent);
                data.lastTrackTime = Date.now();
            }
        }
        data.isTracking = settings.trackInactive;
    }

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

function startTimeTracking() {
    updateInterval = setInterval(async () => {
        if (pendingUpdates) return;
        pendingUpdates = true;

        for (const [tabId, data] of Object.entries(activeTabData)) {
            if (data.isTracking) {
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
        
        if (url.startsWith('chrome://') || 
            url.startsWith('chrome-extension://') ||
            url.startsWith('edge://') ||
            url.startsWith('about:') ||
            url.startsWith('firefox:') ||
            url.startsWith('opera:') ||
            urlObj.protocol === 'file:' ||
            urlObj.protocol === 'c:' ||
            urlObj.protocol === 'd:' ||
            urlObj.protocol === 'e:' ||
            urlObj.protocol === 'f:' ||
            /^[a-zA-Z]:/i.test(url)) {
            return false;
        }
        return true;
    } catch (error) {
        return false;
    }
}

startTimeTracking();
async function updateSiteData(domain, type, timeSpent = 0) {
    try {
        const data = await chrome.storage.local.get('visits');
        const visits = data.visits || {};

        if (!visits[domain]) {
            visits[domain] = {
                count: 0,
                totalTimeSpent: 0,
                lastVisited: new Date().toLocaleString()
            };
        }

        if (type === 'count') {
            visits[domain].count += 1;
        } else if (type === 'time' && timeSpent > 0) {
            const validTimeSpent = Math.min(timeSpent, 2);
            visits[domain].totalTimeSpent += validTimeSpent;
        }

        visits[domain].lastVisited = new Date().toLocaleString();
        await chrome.storage.local.set({ visits });
    } catch (error) {
        console.error('Error updating site data:', error);
    }
} 