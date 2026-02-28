// Listens for geolocation requests from the background service worker
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'GET_GEOLOCATION') {
        getLocation().then(sendResponse).catch(err => {
            sendResponse({ error: err.message });
        });
        return true; // Keep message channel open for async response
    }
});

function getLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            return reject(new Error('Geolocation not supported'));
        }

        // High accuracy is preferred for campus walking tracking
        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    timestamp: position.timestamp
                });
            },
            (error) => {
                reject(error);
            },
            options
        );
    });
}
