document.addEventListener('DOMContentLoaded', async () => {
    const LOG_PREFIX = '[Live2D Popup]';
    function log(...args) {
        console.log(LOG_PREFIX, ...args);
    }
    function warn(...args) {
        console.warn(LOG_PREFIX, ...args);
    }

    const statusEl = document.getElementById('status-msg');
    const modelNameEl = document.getElementById('model-name-display');
    const exprSection = document.getElementById('expressions-section');
    const exprGrid = document.getElementById('expressions-grid');
    const motionSection = document.getElementById('motions-section');
    const motionGrid = document.getElementById('motions-grid');
    const wsUrlInput = document.getElementById('ws-url-input');
    const wsStatusEl = document.getElementById('ws-status');
    const publicKeyEl = document.getElementById('public-key');
    const whitelistInput = document.getElementById('whitelist-input');
    const whitelistStatusEl = document.getElementById('whitelist-status');
    const whitelistListEl = document.getElementById('whitelist-list');
    const langSelect = document.getElementById('lang-select');

    const btnSwitch = document.getElementById('btn-switch');
    const btnFollow = document.getElementById('btn-follow');
    const btnVoice = document.getElementById('btn-voice');
    const btnSendMsg = document.getElementById('btn-send-msg');
    const btnSaveWs = document.getElementById('btn-save-ws');
    const btnConnectWs = document.getElementById('btn-connect-ws');
    const btnDisconnectWs = document.getElementById('btn-disconnect-ws');
    const btnCopyPub = document.getElementById('btn-copy-pub');
    const btnExportPriv = document.getElementById('btn-export-priv');
    const btnAddWhitelist = document.getElementById('btn-add-whitelist');
    const msgInput = document.getElementById('msg-input');

    let keyPair = await window.Live2DSecurity.ensureKeyPair();
    let whitelist = await window.Live2DSecurity.getWhitelist();
    let currentLang = await window.Live2DI18n.loadSavedLang();
    window.Live2DI18n.applyToDom(currentLang);

    function t(key) {
        return window.Live2DI18n.t(key, currentLang);
    }

    function getActiveTab(callback) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0] || null;
            if (!tab || !tab.id) {
                callback(null, 'No active tab');
                return;
            }
            callback(tab, null);
        });
    }

    function sendToTab(cmd, data = {}, onResponse) {
        log('sendToTab ->', cmd, data);
        getActiveTab((tab, tabError) => {
            if (!tab) {
                statusEl.textContent = t('status_no_tab');
                warn('sendToTab failed:', tabError, 'cmd=', cmd);
                if (onResponse) {
                    onResponse(null);
                }
                return;
            }

            const tabId = tab.id;
            const tabUrl = tab.url || '';
            const isLikelyX = /^https:\/\/(.+\.)?x\.com(\/|$)/.test(tabUrl);
            if (!isLikelyX) {
                warn('Active tab may not be supported, will try sendMessage anyway:', tabUrl || '(url unavailable)');
            }

            chrome.tabs.sendMessage(tabId, { type: 'LIVE2D_COMMAND', cmd, data }, (response) => {
                if (chrome.runtime.lastError) {
                    const message = chrome.runtime.lastError.message || 'Unknown runtime error';
                    const isNoReceiver = /Receiving end does not exist/i.test(message);
                    statusEl.textContent = t('status_refresh_page');
                    updateWsStatus({
                        status: 'unavailable',
                        detail: isNoReceiver ? t('ws_no_receiver') : message
                    });
                    warn('sendMessage runtime error:', message, 'cmd=', cmd, 'tab=', tabId);
                    if (onResponse) {
                        onResponse(null);
                    }
                    return;
                }
                log('sendToTab <-', cmd, response || {});
                if (onResponse) {
                    onResponse(response || null);
                }
            });
        });
    }

    function updateWsStatus(info) {
        if (!info) {
            wsStatusEl.textContent = t('ws_no_response');
            return;
        }
        const statusKey = `ws_state_${String(info.status || '').toLowerCase()}`;
        const localizedStatus = t(statusKey) === statusKey ? String(info.status || 'unknown') : t(statusKey);
        const detail = info.detail ? ` (${info.detail})` : '';
        const reg = info.registered ? ` ${t('ws_registered')}` : '';
        wsStatusEl.textContent = `${t('ws_status_label')}: ${localizedStatus}${reg}${detail}`;
        if (info.url) {
            wsUrlInput.value = info.url;
        }
    }

    function updateUI(state) {
        if (state && state.modelName) {
            modelNameEl.textContent = state.modelName;
        }

        exprGrid.innerHTML = '';
        const expressions = state && Array.isArray(state.expressions) ? state.expressions : [];
        if (expressions.length > 0) {
            exprSection.style.display = 'block';
            expressions.forEach((name) => {
                const btn = document.createElement('button');
                btn.textContent = name.replace(/(\.exp)?\.json$/i, '');
                btn.onclick = () => sendToTab('SET_EXPRESSION', { name });
                exprGrid.appendChild(btn);
            });
        } else {
            exprSection.style.display = 'none';
        }

        motionGrid.innerHTML = '';
        const motions = state && Array.isArray(state.motions) ? state.motions : [];
        if (motions.length > 0) {
            motionSection.style.display = 'block';
            motions.forEach((motion) => {
                const btn = document.createElement('button');
                btn.textContent = motion.label;
                btn.onclick = () => sendToTab('START_MOTION', { group: motion.group, index: motion.index });
                motionGrid.appendChild(btn);
            });
        } else {
            motionSection.style.display = 'none';
        }
    }

    function maskKey(key) {
        if (!key || key.length < 16) {
            return key || '';
        }
        return `${key.slice(0, 18)}...${key.slice(-12)}`;
    }

    function renderWhitelist() {
        whitelistListEl.innerHTML = '';
        if (whitelist.length === 0) {
            whitelistListEl.textContent = t('whitelist_none');
            whitelistListEl.className = 'small';
            return;
        }

        whitelist.forEach((pubKey, index) => {
            let displayKey = pubKey;
            try {
                displayKey = window.Live2DSecurity.publicKeyBase64ToBase58(pubKey);
            } catch (error) {
                // Keep original text if conversion fails.
            }
            const row = document.createElement('div');
            row.className = 'list-item';

            const keyBox = document.createElement('div');
            keyBox.className = 'mono';
            keyBox.textContent = maskKey(displayKey);
            keyBox.title = displayKey;

            const btnRemove = document.createElement('button');
            btnRemove.textContent = t('btn_delete');
            btnRemove.onclick = async () => {
                whitelist = whitelist.filter((_, i) => i !== index);
                whitelist = await window.Live2DSecurity.saveWhitelist(whitelist);
                renderWhitelist();
                whitelistStatusEl.textContent = t('status_whitelist_updated');
                log('Whitelist key removed. total=', whitelist.length);
            };

            row.appendChild(keyBox);
            row.appendChild(btnRemove);
            whitelistListEl.appendChild(row);
        });
    }

    function setPublicKeyView() {
        publicKeyEl.textContent = window.Live2DSecurity.publicKeyBase64ToBase58(keyPair.publicKey);
    }

    chrome.runtime.onMessage.addListener((message) => {
        log('runtime message:', message);
        if (!message || typeof message !== 'object') {
            return;
        }
        if (message.type === 'LIVE2D_STATE_UPDATE') {
            updateUI(message.data || {});
            statusEl.textContent = t('status_connected');
            return;
        }
        if (message.type === 'WS_CONNECTION_STATUS') {
            updateWsStatus(message.data || {});
        }
    });

    btnSwitch.onclick = () => {
        modelNameEl.textContent = 'Loading...';
        sendToTab('SWITCH_MODEL');
    };
    btnFollow.onclick = () => sendToTab('TOGGLE_FOLLOW');
    btnVoice.onclick = () => sendToTab('PLAY_VOICE');
    btnSendMsg.onclick = () => {
        const text = msgInput.value.trim();
        if (!text) {
            return;
        }
        sendToTab('SHOW_MESSAGE', { text });
        msgInput.value = '';
    };

    btnSaveWs.onclick = () => {
        const url = wsUrlInput.value.trim();
        log('Saving WS URL:', url);
        chrome.storage.local.set({ wsUrl: url }, () => {
        sendToTab('UPDATE_WS_CONFIG', { url }, () => {
                statusEl.textContent = t('status_ws_saved');
            });
        });
    };

    btnConnectWs.onclick = () => {
        const url = wsUrlInput.value.trim();
        log('Connect clicked, url=', url);
        sendToTab('CONNECT_WS', { url }, () => {
            statusEl.textContent = t('status_ws_connecting');
            setTimeout(() => {
                sendToTab('GET_WS_STATUS', {}, (response) => updateWsStatus(response || null));
            }, 500);
        });
    };

    btnDisconnectWs.onclick = () => {
        log('Disconnect clicked');
        sendToTab('DISCONNECT_WS', {}, () => {
            statusEl.textContent = t('status_ws_disconnect_req');
            setTimeout(() => {
                sendToTab('GET_WS_STATUS', {}, (response) => updateWsStatus(response || null));
            }, 300);
        });
    };

    btnCopyPub.onclick = async () => {
        await navigator.clipboard.writeText(window.Live2DSecurity.publicKeyBase64ToBase58(keyPair.publicKey));
        log('Public key copied');
        statusEl.textContent = t('status_pub_copied');
    };

    btnExportPriv.onclick = () => {
        const content = JSON.stringify({
            publicKeyBase58: window.Live2DSecurity.publicKeyBase64ToBase58(keyPair.publicKey),
            privateKeyBase58: window.Live2DSecurity.privateKeyBase64ToBase58(keyPair.privateKey),
            publicKeyBase64: keyPair.publicKey,
            privateKeyBase64: keyPair.privateKey
        }, null, 2);
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'live2d-plugin-keypair.json';
        a.click();
        URL.revokeObjectURL(url);
        log('Private key exported');
        statusEl.textContent = t('status_priv_exported');
    };

    btnAddWhitelist.onclick = async () => {
        const input = whitelistInput.value.trim();
        if (!input) {
            whitelistStatusEl.textContent = t('status_whitelist_need_input');
            return;
        }

        let normalizedBase64 = '';
        if (window.Live2DSecurity.isValidPublicKeyBase58(input)) {
            normalizedBase64 = window.Live2DSecurity.publicKeyBase58ToBase64(input);
        } else if (window.Live2DSecurity.isValidPublicKey(input)) {
            normalizedBase64 = input;
        } else {
            whitelistStatusEl.textContent = t('status_whitelist_invalid');
            warn('Rejected whitelist key: invalid format');
            return;
        }
        if (whitelist.includes(normalizedBase64)) {
            whitelistStatusEl.textContent = t('status_whitelist_exists');
            return;
        }

        whitelist.push(normalizedBase64);
        whitelist = await window.Live2DSecurity.saveWhitelist(whitelist);
        whitelistInput.value = '';
        whitelistStatusEl.textContent = t('status_whitelist_added');
        log('Whitelist key added. total=', whitelist.length);
        renderWhitelist();
    };

    langSelect.value = currentLang;
    langSelect.onchange = async () => {
        currentLang = await window.Live2DI18n.saveLang(langSelect.value);
        window.Live2DI18n.applyToDom(currentLang);
        renderWhitelist();
        statusEl.textContent = t('popup_connecting_page');
        sendToTab('GET_WS_STATUS', {}, (response) => updateWsStatus(response || null));
    };

    chrome.storage.local.get(['wsUrl'], (result) => {
        if (result.wsUrl) {
            wsUrlInput.value = result.wsUrl;
        }
    });

    setPublicKeyView();
    renderWhitelist();
    log('Popup initialized');

    sendToTab('GET_STATE');
    sendToTab('GET_WS_STATUS', {}, (response) => updateWsStatus(response || null));
});
