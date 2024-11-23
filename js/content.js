// Content script for TrackMyWeb
// This script runs in the context of web pages

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'getPageInfo') {
        // Get page title and other metadata if needed
        const pageInfo = {
            title: document.title,
            url: window.location.href,
            timestamp: Date.now()
        };
        sendResponse(pageInfo);
    }
    return true;
});

// You can add more page-specific tracking functionality here
// For example, tracking scroll depth, time spent on specific sections, etc. 