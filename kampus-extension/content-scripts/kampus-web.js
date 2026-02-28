// ---------------------------------------------------------------------------
// Kampus Web Bridge — runs on the Kampus web app (localhost)
// Listens for token messages from the website and saves to extension storage
// Also forwards commands from the website to the extension background script
// ---------------------------------------------------------------------------

(function () {
  const TOKEN_KEY = 'kampusToken';
  const USER_KEY = 'kampusUser';

  // Listen for messages from the page (posted by auth-context.tsx)
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    // Token bridge — saves auth token to extension storage
    if (event.data && event.data.type === 'KAMPUS_TOKEN_BRIDGE') {
      const { token, user } = event.data;
      if (token) {
        chrome.storage.local.set({
          [TOKEN_KEY]: token,
          [USER_KEY]: user || '',
        });
        try {
          chrome.runtime.sendMessage({ type: 'SET_TOKEN', token });
        } catch (e) {
          // Background may not be ready
        }
        console.log('[Kampus Extension] Token synced from website.');
      }
    }

    // Command bridge — forwards commands from website to background
    if (event.data && event.data.type === 'KAMPUS_COMMAND') {
      const { command } = event.data;
      console.log('[Kampus Extension] Forwarding command:', command);
      try {
        chrome.runtime.sendMessage({ type: command }, (response) => {
          // Post the response back to the website
          window.postMessage({
            type: 'KAMPUS_COMMAND_RESPONSE',
            command,
            response,
          }, '*');
        });
      } catch (e) {
        console.warn('[Kampus Extension] Command forward failed:', e);
      }
    }
  });

  // When the extension registers from MyRed, push the token back to the website
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.kampusToken && changes.kampusToken.newValue) {
      const token = changes.kampusToken.newValue;
      const user = changes.kampusUser?.newValue || '';
      // Store in page's localStorage so the auth context can pick it up
      window.postMessage({
        type: 'KAMPUS_EXT_AUTHENTICATED',
        token,
        user,
      }, '*');
      console.log('[Kampus Extension] Pushed auth token to website.');
    }
  });
})();
