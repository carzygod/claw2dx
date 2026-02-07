// Popup Logic
document.addEventListener('DOMContentLoaded', () => {
    const statusEl = document.getElementById('status-msg');
    const modelNameEl = document.getElementById('model-name-display');
    const exprSection = document.getElementById('expressions-section');
    const exprGrid = document.getElementById('expressions-grid');
    const motionSection = document.getElementById('motions-section');
    const motionGrid = document.getElementById('motions-grid');

    // Button Elements
    const btnSwitch = document.getElementById('btn-switch');
    const btnFollow = document.getElementById('btn-follow');
    const btnVoice = document.getElementById('btn-voice');

    // --- Message Passing Helper ---
    function sendCommand(cmd, data = {}) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0] || !tabs[0].id) {
                statusEl.textContent = 'No active tab found.';
                return;
            }
            chrome.tabs.sendMessage(tabs[0].id, { type: 'LIVE2D_COMMAND', cmd, data }, (response) => {
                if (chrome.runtime.lastError) {
                    statusEl.textContent = 'Error: Refresh the page first.';
                    console.error(chrome.runtime.lastError);
                } else {
                    statusEl.textContent = 'Command sent.';
                }
            });
        });
    }

    // --- State Update Handler ---
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'LIVE2D_STATE_UPDATE') {
            updateUI(message.data);
            statusEl.textContent = 'Connected.';
        }
    });

    function updateUI(state) {
        if (state.modelName) {
            modelNameEl.textContent = state.modelName;
        }

        // Expressions
        exprGrid.innerHTML = '';
        if (state.expressions && state.expressions.length > 0) {
            exprSection.style.display = 'block';
            state.expressions.forEach(name => {
                const btn = document.createElement('button');
                btn.textContent = name.replace(/(\.exp)?\.json$/i, '');
                btn.onclick = () => sendCommand('SET_EXPRESSION', { name });
                exprGrid.appendChild(btn);
            });
        } else {
            exprSection.style.display = 'none';
        }

        // Motions
        motionGrid.innerHTML = '';
        if (state.motions && state.motions.length > 0) {
            motionSection.style.display = 'block';
            state.motions.forEach(m => {
                const btn = document.createElement('button');
                btn.textContent = m.label;
                btn.onclick = () => sendCommand('START_MOTION', { group: m.group, index: m.index });
                motionGrid.appendChild(btn);
            });
        } else {
            motionSection.style.display = 'none';
        }
    }

    // --- Event Listeners ---
    btnSwitch.onclick = () => {
        modelNameEl.textContent = 'Loading...';
        sendCommand('SWITCH_MODEL');
    };
    btnFollow.onclick = () => sendCommand('TOGGLE_FOLLOW');
    btnVoice.onclick = () => sendCommand('PLAY_VOICE');

    // Initial Query
    sendCommand('GET_STATE');
});
