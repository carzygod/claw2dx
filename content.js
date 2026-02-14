const INIT_SCRIPT_ID = 'live2d-extension-init-script';
const CSS_PATH = 'styles.css';
const SCRIPTS = ['lib/live2d.min.js', 'dist/live2d-helper.min.js', 'patch-live2d-helper.js', 'init-live2d.js'];
const LOG_PREFIX = '[Live2D Content]';

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

function shortKey(input) {
    const key = typeof input === 'string' ? input : '';
    if (key.length < 16) {
        return key;
    }
    return `${key.slice(0, 8)}...${key.slice(-6)}`;
}

function log(...args) {
    console.log(LOG_PREFIX, ...args);
}

function warn(...args) {
    console.warn(LOG_PREFIX, ...args);
}

function errorLog(...args) {
    console.error(LOG_PREFIX, ...args);
}

(function () {
    if (window.live2dExtensionInjected) {
        log('Already injected. Skip.');
        return;
    }
    window.live2dExtensionInjected = true;

    const head = document.head || document.documentElement;
    if (!head) {
        warn('No head/documentElement available. Abort injection.');
        return;
    }

    log('Initializing content script and secure runtime');
    injectCss();
    loadScript(0);
    initializeSecureRuntime();
})();

function injectCss() {
    const href = chrome.runtime.getURL(CSS_PATH);
    if (document.querySelector(`link[href="${href}"]`)) {
        log('CSS already injected:', href);
        return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.live2dExtension = 'true';
    (document.head || document.documentElement).appendChild(link);
    log('CSS injected:', href);
}

function loadScript(index) {
    if (index >= SCRIPTS.length) {
        log('All page scripts injected');
        return;
    }

    const path = SCRIPTS[index];
    const src = chrome.runtime.getURL(path);

    if (document.querySelector(`script[src="${src}"]`)) {
        log('Script already injected:', path);
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

    script.onload = () => {
        log('Script loaded:', path);
        loadScript(index + 1);
    };
    script.onerror = () => {
        errorLog('Script failed to load:', path);
    };
    (document.head || document.documentElement).appendChild(script);
    log('Script injection started:', path);
}

async function initializeSecureRuntime() {
    try {
        log('Loading keypair and security state');
        keyPair = await window.Live2DSecurity.ensureKeyPair();
        whitelist = await window.Live2DSecurity.getWhitelist();
        usedNonceQueue = await window.Live2DSecurity.getUsedNonceEntries();
        usedNonceSet = new Set(usedNonceQueue);
        log('Security ready. publicKey=', shortKey(keyPair.publicKey), 'whitelistCount=', whitelist.length, 'usedNonceCount=', usedNonceQueue.length);

        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== 'local') {
                return;
            }
            if (changes[window.Live2DSecurity.STORAGE_WHITELIST_KEY]) {
                const updated = changes[window.Live2DSecurity.STORAGE_WHITELIST_KEY].newValue;
                whitelist = Array.isArray(updated) ? updated : [];
                log('Whitelist changed from storage. count=', whitelist.length);
            }
        });

        chrome.storage.local.get(['wsUrl'], (result) => {
            log('Loaded wsUrl from storage:', result.wsUrl || '(empty)');
            if (result.wsUrl) {
                currentWsUrl = result.wsUrl;
                connectWebSocket(currentWsUrl);
            } else {
                publishWsStatus();
            }
        });
    } catch (error) {
        errorLog('Security init failed:', error);
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

    log('Publishing WS status:', payload);
    chrome.runtime.sendMessage({ type: 'WS_CONNECTION_STATUS', data: payload }).catch((err) => {
        log('WS status publish skipped (popup likely closed):', err && err.message ? err.message : '');
        // Popup may be closed.
    });
}

function persistUsedNoncesSoon() {
    if (noncePersistTimer) {
        clearTimeout(noncePersistTimer);
    }
    noncePersistTimer = setTimeout(() => {
        window.Live2DSecurity.saveUsedNonceEntries(usedNonceQueue).catch((error) => {
            errorLog('Failed to persist nonce cache:', error);
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
        log('Reconnect skipped. shouldReconnect=', shouldReconnect, 'url=', currentWsUrl || '(empty)');
        return;
    }
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
    }
    reconnectTimer = setTimeout(() => connectWebSocket(currentWsUrl), 5000);
    log('Reconnect scheduled in 5s');
}

function connectWebSocket(url) {
    const nextUrl = (url || '').trim();
    log('connectWebSocket called. url=', nextUrl || '(empty)');
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
            log('Closing existing WebSocket before reconnect');
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
        errorLog('WebSocket constructor failed:', error.message);
        publishWsStatus();
        scheduleReconnect();
        return;
    }

    ws = socket;
    log('WebSocket instance created');

    socket.onopen = () => {
        if (ws !== socket) {
            return;
        }
        wsStatus = 'connected';
        wsStatusDetail = 'Connected, registering plugin...';
        log('WebSocket open. Sending registration...');
        publishWsStatus();
        sendRegistration();
    };

    socket.onmessage = (event) => {
        if (ws !== socket) {
            return;
        }
        handleIncomingMessage(event.data);
    };

    socket.onclose = (event) => {
        if (ws !== socket) {
            return;
        }
        ws = null;
        isRegistered = false;
        wsStatus = 'disconnected';
        wsStatusDetail = shouldReconnect ? 'Disconnected, waiting to reconnect...' : 'Disconnected';
        log('WebSocket closed. code=', event.code, 'reason=', event.reason || '(none)', 'willReconnect=', shouldReconnect);
        publishWsStatus();
        scheduleReconnect();
    };

    socket.onerror = (event) => {
        if (ws !== socket) {
            return;
        }
        wsStatus = 'error';
        wsStatusDetail = 'WebSocket error';
        errorLog('WebSocket error event:', event && event.type ? event.type : '(unknown)');
        publishWsStatus();
    };
}

function disconnectWebSocket() {
    log('disconnectWebSocket called by user');
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
        warn('sendRegistration skipped. wsReady=', !!ws && ws.readyState === WebSocket.OPEN, 'hasKey=', !!keyPair);
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

    log('Sending PLUGIN_REGISTER. publicKey=', shortKey(registerMessage.publicKey), 'nonce=', registerMessage.nonce);
    ws.send(JSON.stringify(registerMessage));
}

function handleIncomingMessage(rawMessage) {
    log('WebSocket message received:', rawMessage);
    let data;
    try {
        data = JSON.parse(rawMessage);
    } catch (error) {
        warn('Ignore non-JSON message');
        return;
    }

    if (!data || typeof data !== 'object') {
        return;
    }

    if (data.type === 'REGISTERED') {
        isRegistered = true;
        wsStatus = 'connected';
        wsStatusDetail = 'Registered';
        log('Registration acknowledged by relay. publicKey=', shortKey(data.publicKey || ''));
        publishWsStatus();
        return;
    }

    if (data.type === 'ERROR') {
        wsStatus = 'error';
        wsStatusDetail = data.message || 'Relay reported error';
        errorLog('Relay error:', wsStatusDetail);
        publishWsStatus();
        return;
    }

    if (data.type !== 'SECURE_MESSAGE') {
        log('Ignoring unsupported ws message type:', data.type);
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
        warn('SECURE_MESSAGE dropped: invalid envelope fields');
        return;
    }

    if (recipientPublicKey !== keyPair.publicKey) {
        warn('SECURE_MESSAGE dropped: recipient mismatch. expected=', shortKey(keyPair.publicKey), 'actual=', shortKey(recipientPublicKey));
        return;
    }

    if (!whitelist.includes(senderPublicKey)) {
        warn('SECURE_MESSAGE dropped: sender not in whitelist:', shortKey(senderPublicKey));
        return;
    }

    if (isNonceUsed(senderPublicKey, nonce)) {
        warn('SECURE_MESSAGE dropped: nonce replay detected. sender=', shortKey(senderPublicKey), 'nonce=', nonce);
        return;
    }

    const verified = window.Live2DSecurity.verifyObject(senderPublicKey, {
        senderPublicKey,
        recipientPublicKey,
        nonce,
        payload
    }, signature);

    if (!verified) {
        warn('SECURE_MESSAGE dropped: signature verification failed. sender=', shortKey(senderPublicKey));
        return;
    }

    addUsedNonce(senderPublicKey, nonce);
    log('SECURE_MESSAGE accepted. sender=', shortKey(senderPublicKey), 'nonce=', nonce, 'payloadKeys=', Object.keys(payload));

    window.postMessage({
        type: 'LIVE2D_COMMAND_FROM_EXTENSION',
        payload: { cmd: 'WS_PAYLOAD', data: payload }
    }, '*');
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    log('runtime message from popup:', request && request.cmd ? request.cmd : '(unknown)', request || {});
    if (request.type !== 'LIVE2D_COMMAND') {
        log('Ignoring runtime message with unsupported type:', request.type);
        return;
    }

    if (request.cmd === 'UPDATE_WS_CONFIG') {
        const nextUrl = (request.data && request.data.url ? request.data.url : '').trim();
        currentWsUrl = nextUrl;
        chrome.storage.local.set({ wsUrl: nextUrl }, () => {
            log('WS config updated from popup:', nextUrl || '(empty)');
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
        log('GET_WS_STATUS response sent');
        return;
    }

    log('Forwarding command to page script:', request.cmd);
    window.postMessage({ type: 'LIVE2D_COMMAND_FROM_EXTENSION', payload: request }, '*');
    sendResponse({ status: 'forwarded' });
});

window.addEventListener('message', (event) => {
    if (event.source !== window) {
        return;
    }
    if (event.data.type === 'LIVE2D_STATE_UPDATE_FROM_PAGE') {
        log('State update received from page. model=', event.data.payload && event.data.payload.modelName ? event.data.payload.modelName : '(unknown)');
        chrome.runtime.sendMessage({
            type: 'LIVE2D_STATE_UPDATE',
            data: event.data.payload
        }).catch(() => {
            // Popup may be closed.
        });
    }
});
