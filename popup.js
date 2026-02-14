document.addEventListener('DOMContentLoaded', async () => {
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

    function getActiveTabId(callback) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0] || !tabs[0].id) {
                callback(null);
                return;
            }
            callback(tabs[0].id);
        });
    }

    function sendToTab(cmd, data = {}, onResponse) {
        getActiveTabId((tabId) => {
            if (!tabId) {
                statusEl.textContent = 'No active tab found.';
                if (onResponse) {
                    onResponse(null);
                }
                return;
            }

            chrome.tabs.sendMessage(tabId, { type: 'LIVE2D_COMMAND', cmd, data }, (response) => {
                if (chrome.runtime.lastError) {
                    statusEl.textContent = 'Error: refresh x.com page first.';
                    if (onResponse) {
                        onResponse(null);
                    }
                    return;
                }
                if (onResponse) {
                    onResponse(response || null);
                }
            });
        });
    }

    function updateWsStatus(info) {
        if (!info) {
            wsStatusEl.textContent = 'Status: unknown';
            return;
        }
        const detail = info.detail ? ` (${info.detail})` : '';
        const reg = info.registered ? ' registered' : '';
        wsStatusEl.textContent = `Status: ${info.status}${reg}${detail}`;
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
            whitelistListEl.textContent = 'No trusted sender key.';
            whitelistListEl.className = 'small';
            return;
        }

        whitelist.forEach((pubKey, index) => {
            const row = document.createElement('div');
            row.className = 'list-item';

            const keyBox = document.createElement('div');
            keyBox.className = 'mono';
            keyBox.textContent = maskKey(pubKey);
            keyBox.title = pubKey;

            const btnRemove = document.createElement('button');
            btnRemove.textContent = 'Delete';
            btnRemove.onclick = async () => {
                whitelist = whitelist.filter((_, i) => i !== index);
                whitelist = await window.Live2DSecurity.saveWhitelist(whitelist);
                renderWhitelist();
                whitelistStatusEl.textContent = 'Whitelist updated.';
            };

            row.appendChild(keyBox);
            row.appendChild(btnRemove);
            whitelistListEl.appendChild(row);
        });
    }

    function setPublicKeyView() {
        publicKeyEl.textContent = keyPair.publicKey;
    }

    chrome.runtime.onMessage.addListener((message) => {
        if (!message || typeof message !== 'object') {
            return;
        }
        if (message.type === 'LIVE2D_STATE_UPDATE') {
            updateUI(message.data || {});
            statusEl.textContent = 'Connected.';
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
        chrome.storage.local.set({ wsUrl: url }, () => {
            sendToTab('UPDATE_WS_CONFIG', { url }, () => {
                statusEl.textContent = 'WebSocket URL saved.';
            });
        });
    };

    btnConnectWs.onclick = () => {
        const url = wsUrlInput.value.trim();
        sendToTab('CONNECT_WS', { url }, () => {
            statusEl.textContent = 'Connecting WebSocket...';
        });
    };

    btnDisconnectWs.onclick = () => {
        sendToTab('DISCONNECT_WS', {}, () => {
            statusEl.textContent = 'Disconnect requested.';
        });
    };

    btnCopyPub.onclick = async () => {
        await navigator.clipboard.writeText(keyPair.publicKey);
        statusEl.textContent = 'Public key copied.';
    };

    btnExportPriv.onclick = () => {
        const content = JSON.stringify({
            publicKey: keyPair.publicKey,
            privateKey: keyPair.privateKey
        }, null, 2);
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'live2d-plugin-keypair.json';
        a.click();
        URL.revokeObjectURL(url);
        statusEl.textContent = 'Private key exported.';
    };

    btnAddWhitelist.onclick = async () => {
        const input = whitelistInput.value.trim();
        if (!input) {
            whitelistStatusEl.textContent = 'Please input a public key.';
            return;
        }
        if (!window.Live2DSecurity.isValidPublicKey(input)) {
            whitelistStatusEl.textContent = 'Invalid public key format.';
            return;
        }
        if (whitelist.includes(input)) {
            whitelistStatusEl.textContent = 'Key already in whitelist.';
            return;
        }

        whitelist.push(input);
        whitelist = await window.Live2DSecurity.saveWhitelist(whitelist);
        whitelistInput.value = '';
        whitelistStatusEl.textContent = 'Key added.';
        renderWhitelist();
    };

    chrome.storage.local.get(['wsUrl'], (result) => {
        if (result.wsUrl) {
            wsUrlInput.value = result.wsUrl;
        }
    });

    setPublicKeyView();
    renderWhitelist();

    sendToTab('GET_STATE');
    sendToTab('GET_WS_STATUS', {}, (response) => updateWsStatus(response || null));
});
