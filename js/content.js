chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'getPageInfo') {
        const pageInfo = {
            title: document.title,
            url: window.location.href,
            timestamp: Date.now()
        };
        sendResponse(pageInfo);
    }
    return true;
});