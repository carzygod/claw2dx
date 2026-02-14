const INIT_SCRIPT_ID = 'live2d-extension-init-script';
const CSS_PATH = 'styles.css';
const SCRIPTS = ['lib/live2d.min.js', 'dist/live2d-helper.min.js', 'patch-live2d-helper.js', 'init-live2d.js'];

let ws = null;
let currentWsUrl = '';
let reconnectTimer = null;
let shouldReconnect = true;
let wsStatus = 'disconnected';
let wsStatusDetail = 'Not connected';
let isRegistered = false;
let keyPair = null;
let whitelist = [];
let usedNonceQueue = [];
let usedNonceSet = new Set();
let noncePersistTimer = null;

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
    initializeSecureRuntime();
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

async function initializeSecureRuntime() {
    try {
        keyPair = await window.Live2DSecurity.ensureKeyPair();
        whitelist = await window.Live2DSecurity.getWhitelist();
        usedNonceQueue = await window.Live2DSecurity.getUsedNonceEntries();
        usedNonceSet = new Set(usedNonceQueue);

        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== 'local') {
                return;
            }
            if (changes[window.Live2DSecurity.STORAGE_WHITELIST_KEY]) {
                const updated = changes[window.Live2DSecurity.STORAGE_WHITELIST_KEY].newValue;
                whitelist = Array.isArray(updated) ? updated : [];
            }
        });

        chrome.storage.local.get(['wsUrl'], (result) => {
            if (result.wsUrl) {
                currentWsUrl = result.wsUrl;
                connectWebSocket(currentWsUrl);
            } else {
                publishWsStatus();
            }
        });
    } catch (error) {
        console.error('[Live2D Extension] Security init failed:', error);
        wsStatus = 'error';
        wsStatusDetail = 'Security initialization failed';
        publishWsStatus();
    }
}

function publishWsStatus() {
    const payload = {
        status: wsStatus,
        detail: wsStatusDetail,
        url: currentWsUrl,
        registered: isRegistered,
        publicKey: keyPair ? keyPair.publicKey : ''
    };

    chrome.runtime.sendMessage({ type: 'WS_CONNECTION_STATUS', data: payload }).catch(() => {
        // Popup may be closed.
    });
}

function persistUsedNoncesSoon() {
    if (noncePersistTimer) {
        clearTimeout(noncePersistTimer);
    }
    noncePersistTimer = setTimeout(() => {
        window.Live2DSecurity.saveUsedNonceEntries(usedNonceQueue).catch((error) => {
            console.error('[Live2D Extension] Failed to persist nonce cache:', error);
        });
    }, 300);
}

function addUsedNonce(senderPublicKey, nonce) {
    const nonceKey = `${senderPublicKey}:${nonce}`;
    if (usedNonceSet.has(nonceKey)) {
        return false;
    }

    usedNonceSet.add(nonceKey);
    usedNonceQueue.push(nonceKey);
    while (usedNonceQueue.length > 5000) {
        const removed = usedNonceQueue.shift();
        usedNonceSet.delete(removed);
    }
    persistUsedNoncesSoon();
    return true;
}

function isNonceUsed(senderPublicKey, nonce) {
    return usedNonceSet.has(`${senderPublicKey}:${nonce}`);
}

function scheduleReconnect() {
    if (!shouldReconnect || !currentWsUrl) {
        return;
    }
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
    }
    reconnectTimer = setTimeout(() => connectWebSocket(currentWsUrl), 5000);
}

function connectWebSocket(url) {
    const nextUrl = (url || '').trim();
    if (!nextUrl) {
        wsStatus = 'disconnected';
        wsStatusDetail = 'WebSocket URL is empty';
        publishWsStatus();
        return;
    }

    currentWsUrl = nextUrl;
    shouldReconnect = true;
    isRegistered = false;

    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }

    if (ws) {
        try {
            ws.close();
        } catch (error) {
            // Ignore close errors
        }
    }

    wsStatus = 'connecting';
    wsStatusDetail = 'Connecting...';
    publishWsStatus();

    let socket;
    try {
        socket = new WebSocket(nextUrl);
    } catch (error) {
        wsStatus = 'error';
        wsStatusDetail = `Connection failed: ${error.message}`;
        publishWsStatus();
        scheduleReconnect();
        return;
    }

    ws = socket;

    socket.onopen = () => {
        if (ws !== socket) {
            return;
        }
        wsStatus = 'connected';
        wsStatusDetail = 'Connected, registering plugin...';
        publishWsStatus();
        sendRegistration();
    };

    socket.onmessage = (event) => {
        if (ws !== socket) {
            return;
        }
        handleIncomingMessage(event.data);
    };

    socket.onclose = () => {
        if (ws !== socket) {
            return;
        }
        ws = null;
        isRegistered = false;
        wsStatus = 'disconnected';
        wsStatusDetail = shouldReconnect ? 'Disconnected, waiting to reconnect...' : 'Disconnected';
        publishWsStatus();
        scheduleReconnect();
    };

    socket.onerror = () => {
        if (ws !== socket) {
            return;
        }
        wsStatus = 'error';
        wsStatusDetail = 'WebSocket error';
        publishWsStatus();
    };
}

function disconnectWebSocket() {
    shouldReconnect = false;
    isRegistered = false;

    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }

    if (ws) {
        ws.close();
        ws = null;
    }

    wsStatus = 'disconnected';
    wsStatusDetail = 'Disconnected by user';
    publishWsStatus();
}

function sendRegistration() {
    if (!ws || ws.readyState !== WebSocket.OPEN || !keyPair) {
        return;
    }

    const registerMessage = {
        type: 'PLUGIN_REGISTER',
        publicKey: keyPair.publicKey,
        nonce: window.Live2DSecurity.createNonce(),
        timestamp: Date.now()
    };

    registerMessage.signature = window.Live2DSecurity.signObject(keyPair.privateKey, {
        type: registerMessage.type,
        publicKey: registerMessage.publicKey,
        nonce: registerMessage.nonce,
        timestamp: registerMessage.timestamp
    });

    ws.send(JSON.stringify(registerMessage));
}

function handleIncomingMessage(rawMessage) {
    let data;
    try {
        data = JSON.parse(rawMessage);
    } catch (error) {
        console.warn('[Live2D Extension] Ignore non-JSON message');
        return;
    }

    if (!data || typeof data !== 'object') {
        return;
    }

    if (data.type === 'REGISTERED') {
        isRegistered = true;
        wsStatus = 'connected';
        wsStatusDetail = 'Registered';
        publishWsStatus();
        return;
    }

    if (data.type === 'ERROR') {
        wsStatus = 'error';
        wsStatusDetail = data.message || 'Relay reported error';
        publishWsStatus();
        return;
    }

    if (data.type !== 'SECURE_MESSAGE') {
        return;
    }

    if (!keyPair) {
        return;
    }

    const senderPublicKey = (data.senderPublicKey || '').trim();
    const recipientPublicKey = (data.recipientPublicKey || '').trim();
    const nonce = (data.nonce || '').trim();
    const signature = (data.signature || '').trim();
    const payload = data.payload;

    if (!senderPublicKey || !recipientPublicKey || !nonce || !signature || typeof payload !== 'object' || payload === null) {
        return;
    }

    if (recipientPublicKey !== keyPair.publicKey) {
        return;
    }

    if (!whitelist.includes(senderPublicKey)) {
        return;
    }

    if (isNonceUsed(senderPublicKey, nonce)) {
        return;
    }

    const verified = window.Live2DSecurity.verifyObject(senderPublicKey, {
        senderPublicKey,
        recipientPublicKey,
        nonce,
        payload
    }, signature);

    if (!verified) {
        return;
    }

    addUsedNonce(senderPublicKey, nonce);

    window.postMessage({
        type: 'LIVE2D_COMMAND_FROM_EXTENSION',
        payload: { cmd: 'WS_PAYLOAD', data: payload }
    }, '*');
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type !== 'LIVE2D_COMMAND') {
        return;
    }

    if (request.cmd === 'UPDATE_WS_CONFIG') {
        const nextUrl = (request.data && request.data.url ? request.data.url : '').trim();
        currentWsUrl = nextUrl;
        chrome.storage.local.set({ wsUrl: nextUrl }, () => {
            sendResponse({ status: 'saved', wsStatus, wsStatusDetail, registered: isRegistered });
        });
        return true;
    }

    if (request.cmd === 'CONNECT_WS') {
        const nextUrl = (request.data && request.data.url ? request.data.url : currentWsUrl).trim();
        if (nextUrl && nextUrl !== currentWsUrl) {
            chrome.storage.local.set({ wsUrl: nextUrl });
        }
        connectWebSocket(nextUrl);
        sendResponse({ status: 'connecting' });
        return;
    }

    if (request.cmd === 'DISCONNECT_WS') {
        disconnectWebSocket();
        sendResponse({ status: 'disconnected' });
        return;
    }

    if (request.cmd === 'GET_WS_STATUS') {
        sendResponse({
            status: wsStatus,
            detail: wsStatusDetail,
            url: currentWsUrl,
            registered: isRegistered,
            publicKey: keyPair ? keyPair.publicKey : ''
        });
        return;
    }

    window.postMessage({ type: 'LIVE2D_COMMAND_FROM_EXTENSION', payload: request }, '*');
    sendResponse({ status: 'forwarded' });
});

window.addEventListener('message', (event) => {
    if (event.source !== window) {
        return;
    }
    if (event.data.type === 'LIVE2D_STATE_UPDATE_FROM_PAGE') {
        chrome.runtime.sendMessage({
            type: 'LIVE2D_STATE_UPDATE',
            data: event.data.payload
        }).catch(() => {
            // Popup may be closed.
        });
    }
});
