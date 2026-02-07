const ROOT_ID = 'live2d-extension-root';
const INIT_SCRIPT_ID = 'live2d-extension-init-script';
const CSS_PATH = 'styles.css';
const SCRIPTS = ['lib/live2d.min.js', 'dist/live2d-helper.min.js', 'patch-live2d-helper.js', 'init-live2d.js'];

(function () {
    if (window.live2dExtensionInjected) {
        return;
    }
    window.live2dExtensionInjected = true;

    const head = document.head || document.documentElement;
    if (!head) {
        return;
    }

    injectCss();
    loadScript(0);
})();

function injectCss() {
    const href = chrome.runtime.getURL(CSS_PATH);
    if (document.querySelector(`link[href="${href}"]`)) {
        return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.live2dExtension = 'true';
    (document.head || document.documentElement).appendChild(link);
}

function loadScript(index) {
    if (index >= SCRIPTS.length) {
        return;
    }

    const path = SCRIPTS[index];
    const src = chrome.runtime.getURL(path);

    if (document.querySelector(`script[src="${src}"]`)) {
        loadScript(index + 1);
        return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.dataset.live2dExtension = 'true';

    if (path === 'init-live2d.js') {
        script.id = INIT_SCRIPT_ID;
        script.dataset.extensionBase = chrome.runtime.getURL('');
    }

    script.onload = () => loadScript(index + 1);
    (document.head || document.documentElement).appendChild(script);
}

// --- Message Bridge ---
// 1. From Popup (Background/Runtime) -> Page (Window)
// --- WebSocket Client (Content Script Context) ---
let ws = null;
let currentWsUrl = '';
let reconnectTimer = null;

function connectWebSocket(url) {
    if (!url) return;
    if (ws) {
        ws.close();
    }

    currentWsUrl = url;
    console.log('[Live2D Extension] Connecting to WebSocket:', url);

    try {
        ws = new WebSocket(url);

        ws.onopen = () => {
            console.log('[Live2D Extension] WebSocket Connected');
            // Optional: send hello
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('[Live2D Extension] WS Message:', data);
                // Forward directly to page
                window.postMessage({
                    type: 'LIVE2D_COMMAND_FROM_EXTENSION',
                    payload: { cmd: 'WS_PAYLOAD', data: data }
                }, '*');
            } catch (e) {
                console.error('[Live2D Extension] Invalid JSON from WS:', e);
            }
        };

        ws.onclose = () => {
            console.log('[Live2D Extension] WebSocket Closed. Reconnecting in 5s...');
            scheduleReconnect();
        };

        ws.onerror = (err) => {
            console.error('[Live2D Extension] WebSocket Error:', err);
            ws.close(); // Ensure cleanup
        };

    } catch (e) {
        console.error('[Live2D Extension] WebSocket Connection Failed:', e);
        scheduleReconnect();
    }
}

function scheduleReconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
        if (currentWsUrl) connectWebSocket(currentWsUrl);
    }, 5000);
}

// Initialize WS from storage
chrome.storage.local.get(['wsUrl'], (result) => {
    if (result.wsUrl) {
        connectWebSocket(result.wsUrl);
    }
});

// Update Listener (from Popup -> Background -> Content, relying on existing message bridge)
// The popup sends "UPDATE_WS_CONFIG" via "LIVE2D_COMMAND" channel.
// We intercept it here in the content script listener before (or in parallel) forwarding?
// Actually, let's hook into the existing listener to catch this specific command.

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'LIVE2D_COMMAND') {
        if (request.cmd === 'UPDATE_WS_CONFIG') {
            connectWebSocket(request.data.url);
            sendResponse({ status: 'updated' });
            return;
        }

        // Forward others to window as usual
        window.postMessage({ type: 'LIVE2D_COMMAND_FROM_EXTENSION', payload: request }, '*');
        sendResponse({ status: 'forwarded' });
    }
});

// 2. From Page (Window) -> Popup (Runtime)
window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data.type === 'LIVE2D_STATE_UPDATE_FROM_PAGE') {
        chrome.runtime.sendMessage({
            type: 'LIVE2D_STATE_UPDATE',
            data: event.data.payload
        }).catch(() => {
            // Popup might be closed, ignore error
        });
    }
});

