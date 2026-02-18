(function () {
    const SCRIPT_ID = 'live2d-extension-init-script';
    const ROOT_ID = 'live2d-extension-root';
    const TOGGLE_BTN_ID = 'live2d-toggle-btn';
    const MODEL_STORAGE_KEY = 'live2d_extension_current_model_v1';

    // Model Definitions (Full List)
    const MODELS = [
        // --- Original Kept Models ---
        { name: 'Koharu', path: 'assets/models/koharu/koharu.model.json' },
        { name: 'Shizuku', path: 'assets/models/shizuku/shizuku.model.json' },
        { name: 'Wanko', path: 'assets/models/wanko/wanko.model.json' },
        { name: 'Izumi', path: 'assets/models/izumi/izumi.model.json' },

        // --- fghrsh/live2d_api Models ---
        { name: 'Pio', path: 'assets/models/Potion-Maker/Pio/index.json' },
        { name: 'Tia', path: 'assets/models/Potion-Maker/Tia/index.json' },
        { name: '22 (Bilibili)', path: 'assets/models/bilibili-live/22/index.json' },
        { name: '33 (Bilibili)', path: 'assets/models/bilibili-live/33/index.json' },
        { name: 'Neptune Classic', path: 'assets/models/HyperdimensionNeptunia/neptune_classic/index.json' },
        { name: 'NepMaid', path: 'assets/models/HyperdimensionNeptunia/nepmaid/index.json' },

        // Kantai Collection
        { name: 'Murakumo', path: 'assets/models/KantaiCollection/murakumo/index.json' }
    ];

    // Filter out duplicates or explicitly removed ones just in case
    // (Simulating the previous state where I removed them)
    // For safety, I will rely on the indexes I know are good.

    function getSavedModelIndex() {
        try {
            const savedName = localStorage.getItem(MODEL_STORAGE_KEY);
            if (!savedName) {
                return 0;
            }
            const idx = MODELS.findIndex(m => m.name === savedName);
            return idx >= 0 ? idx : 0;
        } catch (e) {
            return 0;
        }
    }

    function persistCurrentModel() {
        try {
            if (MODELS[currentModelIndex]) {
                localStorage.setItem(MODEL_STORAGE_KEY, MODELS[currentModelIndex].name);
            }
        } catch (e) {
            // ignore storage failures
        }
    }

    let currentModelIndex = getSavedModelIndex();
    const SOUND_PATH = 'assets/sound/friend_06.ogg';
    let headFollowing = false;
    let isModelVisible = true;

    const scriptEl = document.currentScript || document.getElementById(SCRIPT_ID);
    const extensionBase = (scriptEl && scriptEl.dataset && scriptEl.dataset.extensionBase) || window.__live2dExtensionBase || '';

    // Helper to get full URL
    function getFullUrl(relativePath) {
        if (!relativePath) return '';
        if (relativePath.startsWith('http')) return relativePath;
        const base = extensionBase.endsWith('/') ? extensionBase.slice(0, -1) : extensionBase;
        const path = relativePath.startsWith('/') ? relativePath : '/' + relativePath;
        return base + path;
    }

    function ensureRoot() {
        if (document.getElementById(ROOT_ID)) return;
        if (!document.body) {
            document.addEventListener('DOMContentLoaded', buildUI, { once: true });
            return;
        }
        buildUI();
    }

    function buildUI() {
        if (document.getElementById(ROOT_ID)) return;

        // 1. Create Model Container (Hidden/Shown by toggle)
        const root = document.createElement('div');
        root.id = ROOT_ID;
        root.style.position = 'fixed';
        root.style.bottom = '0px';
        root.style.left = '0px';
        root.style.zIndex = '999999';
        root.style.pointerEvents = 'none'; // Click-through unless on canvas

        // 2. Create Canvas
        const canvas = document.createElement('canvas');
        canvas.id = 'live2d-canvas';
        canvas.width = 800;
        canvas.height = 1600;
        canvas.style.width = '300px';
        canvas.style.height = '600px';
        canvas.style.pointerEvents = 'auto'; // Allow interaction

        root.appendChild(canvas);

        // 3. Create Speech Bubble
        const bubble = document.createElement('div');
        bubble.id = 'live2d-bubble';
        bubble.style.position = 'absolute';
        bubble.style.bottom = '450px'; // Lowered per user request
        bubble.style.left = '50px';
        bubble.style.width = '200px';
        bubble.style.padding = '10px';
        bubble.style.backgroundColor = 'rgba(255, 255, 255, 0.5)'; // 50% opacity
        bubble.style.border = '2px solid rgba(51, 51, 51, 0.5)'; // Semi-transparent border
        bubble.style.borderRadius = '10px';
        bubble.style.color = '#000'; // Keep text black for readability
        bubble.style.fontWeight = 'bold'; // Bold text for better contrast
        bubble.style.fontFamily = 'sans-serif';
        bubble.style.fontSize = '14px';
        bubble.style.textAlign = 'center';
        bubble.style.display = 'none'; // Hidden by default
        bubble.style.zIndex = '1000001';
        bubble.style.pointerEvents = 'none';
        bubble.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';

        // Bubble tail (optional, simple css triangle)
        const tail = document.createElement('div');
        tail.style.position = 'absolute';
        tail.style.bottom = '-10px';
        tail.style.left = '50%';
        tail.style.marginLeft = '-10px';
        tail.style.width = '0';
        tail.style.height = '0';
        tail.style.borderLeft = '10px solid transparent';
        tail.style.borderRight = '10px solid transparent';
        tail.style.borderTop = '10px solid rgba(255, 255, 255, 0.5)'; // Match bubble opacity
        bubble.appendChild(tail);

        root.appendChild(bubble);

        document.body.appendChild(root);

        // 4. Create Toggle Button (Floating Icon)
        const toggleBtn = document.createElement('div');
        toggleBtn.id = TOGGLE_BTN_ID;
        toggleBtn.textContent = '👁️';
        toggleBtn.style.position = 'fixed';
        toggleBtn.style.bottom = '20px';
        toggleBtn.style.left = '20px'; // Align near model
        toggleBtn.style.width = '30px';
        toggleBtn.style.height = '30px';
        toggleBtn.style.lineHeight = '30px';
        toggleBtn.style.textAlign = 'center';
        toggleBtn.style.borderRadius = '50%';
        toggleBtn.style.backgroundColor = 'rgba(0,0,0,0.5)';
        toggleBtn.style.color = '#fff';
        toggleBtn.style.cursor = 'pointer';
        toggleBtn.style.zIndex = '1000000';
        toggleBtn.style.userSelect = 'none';
        toggleBtn.style.fontSize = '16px';
        toggleBtn.title = 'Show/Hide Live2D';

        toggleBtn.onclick = () => {
            isModelVisible = !isModelVisible;
            root.style.display = isModelVisible ? 'block' : 'none';
            toggleBtn.textContent = isModelVisible ? '👁️' : '🚫';
            toggleBtn.style.opacity = isModelVisible ? '1' : '0.5';
        };

        document.body.appendChild(toggleBtn);

        // Initialize Helper
        if (typeof Live2DHelper === 'undefined') {
            console.error('Live2DHelper not found.');
            return;
        }

        const helper = new Live2DHelper({ canvas: canvas.id });
        window.live2dExtensionHelper = helper;

        // Global config
        let modelsConfig = [];
        let modelsConfigLoaded = false;
        let isModelLoading = false;
        let pendingCommands = [];

        function loadModelsJson() {
            const url = getFullUrl('models.json');
            console.log('[Live2D] Loading models.json from:', url);
            fetch(url)
                .then(r => r.json())
                .then(data => {
                    modelsConfig = data;
                    modelsConfigLoaded = true;
                    console.log('[Live2D] models.json loaded, count:', modelsConfig.length);
                    // Refresh popup actions after tag mapping is available.
                    broadcastState();
                })
                .catch(e => console.error('[Live2D] Failed to load models.json', e));
        }

        // Helper to resolve tag
        function resolveMotion(modelName, tagOrName) {
            if (!tagOrName || !tagOrName.startsWith('tag_')) return tagOrName;

            const config = modelsConfig.find(m => m.name === modelName);
            if (!config || !config.motions) return tagOrName;

            const resolved = config.motions[tagOrName];
            return resolved || tagOrName;
        }

        function resolveExpression(modelName, tagOrName) {
            if (!tagOrName || !tagOrName.startsWith('tag_')) return tagOrName;

            const config = modelsConfig.find(m => m.name === modelName);
            if (!config || !config.expressions) return tagOrName;

            const resolved = config.expressions[tagOrName];
            return resolved || tagOrName;
        }

        function parseMotionSpec(spec) {
            if (typeof spec !== 'string' || !spec) {
                return null;
            }
            if (spec.includes(':')) {
                const parts = spec.split(':');
                return {
                    group: parts[0],
                    index: parseInt(parts[1], 10) || 0
                };
            }
            return {
                group: spec,
                index: 0
            };
        }

        function buildMotionGroupCandidates(group) {
            const candidates = [];
            const add = (v) => {
                if (!v || candidates.includes(v)) return;
                candidates.push(v);
            };
            add(group);

            if (typeof group === 'string') {
                // snake_case -> camelCase
                add(group.replace(/_([a-z])/g, (_, c) => c.toUpperCase()));
                // camelCase -> snake_case
                add(group.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase()));
            }
            return candidates;
        }

        function startMotionSafe(group, index, priority = 3, source = 'unknown') {
            try {
                const mgr = helper.live2DMgr;
                const model = mgr ? mgr.getModel(0) : null;

                if (!model || !model.modelSetting) {
                    console.warn(`[Live2D ${source}] Model not ready for motion`, group, index);
                    return false;
                }

                const candidates = buildMotionGroupCandidates(group);
                for (const candidate of candidates) {
                    const count = model.modelSetting.getMotionNum(candidate);
                    if (count > 0) {
                        const safeIndex = Math.max(0, Math.min(index, count - 1));
                        console.log(`[Live2D ${source}] startMotion`, candidate, safeIndex, `(${count} total)`);
                        model.startMotion(candidate, safeIndex, priority);
                        return true;
                    }
                }

                console.error(`[Live2D ${source}] Invalid motion group`, group, 'candidates=', candidates);
                return false;
            } catch (e) {
                console.error(`[Live2D ${source}] startMotion error`, e);
                return false;
            }
        }

        function setExpressionSafe(name, source = 'unknown') {
            try {
                const mgr = helper.live2DMgr;
                const model = mgr ? mgr.getModel(0) : null;
                let finalName = name;

                if (model && model.expressions && typeof model.expressions === 'object') {
                    const keys = Object.keys(model.expressions);
                    if (!keys.includes(finalName)) {
                        const noExt = String(name).replace(/(\.exp)?\.json$/i, '');
                        if (keys.includes(noExt)) {
                            finalName = noExt;
                        } else {
                            const withExt = `${noExt}.exp.json`;
                            if (keys.includes(withExt)) {
                                finalName = withExt;
                            }
                        }
                    }
                }

                console.log(`[Live2D ${source}] setExpression`, finalName);
                helper.setExpression(finalName, 0);
                return true;
            } catch (e) {
                console.error(`[Live2D ${source}] setExpression error`, e);
                return false;
            }
        }

        // --- Logic Functions ---

        function loadCurrentModel() {
            if (isModelLoading) {
                console.log('[Live2D] Already loading...');
                // We could cancel previous? For now just let it finish.
                // But changing currentModelIndex means the previous load might confuse things?
                // Live2DHelper handles one model at a time usually.
            }
            isModelLoading = true;
            const modelConfig = MODELS[currentModelIndex];
            persistCurrentModel();

            // Release old models
            try {
                const mgr = helper.live2DMgr;
                const gl = helper.gl;
                if (mgr && gl) {
                    for (let i = mgr.numModels() - 1; i >= 0; i--) {
                        mgr.releaseModel(gl, i);
                    }
                }
            } catch (e) {
                console.error('Error releasing models:', e);
            }

            console.log('[Live2D] Loading model:', modelConfig.name);
            helper.loadModel(getFullUrl(modelConfig.path), (model) => {
                console.log('Model loaded:', modelConfig.name);
                broadcastState(); // Notify popup

                // Grace period for SDK
                setTimeout(() => {
                    console.log('[Live2D] Model Ready. Processing queue:', pendingCommands.length);
                    isModelLoading = false;
                    while (pendingCommands.length > 0) {
                        const cmd = pendingCommands.shift();
                        try {
                            cmd();
                        } catch (e) {
                            console.error('Error processing queued command:', e);
                        }
                    }
                }, 800);
            });
        }

        function broadcastState() {
            // Collect info to send to Popup
            const internalModel = helper.live2DMgr.getModel(0);
            const state = {
                modelName: MODELS[currentModelIndex].name,
                expressions: [],
                motions: []
            };

            // Prefer tag-based motions from models.json for popup button display.
            const currentModelName = MODELS[currentModelIndex].name;
            const configModel = modelsConfig.find(m => m.name === currentModelName);
            if (configModel && configModel.motions && typeof configModel.motions === 'object') {
                const tags = Object.keys(configModel.motions).sort((a, b) => {
                    const na = parseInt(String(a).replace('tag_', ''), 10);
                    const nb = parseInt(String(b).replace('tag_', ''), 10);
                    if (Number.isFinite(na) && Number.isFinite(nb)) {
                        return na - nb;
                    }
                    return String(a).localeCompare(String(b));
                });

                tags.forEach(tag => {
                    const resolved = configModel.motions[tag];
                    const parsed = parseMotionSpec(resolved);
                    if (!parsed) {
                        return;
                    }
                    state.motions.push({
                        group: parsed.group,
                        index: parsed.index,
                        label: `${tag}`
                    });
                });
            }

            if (internalModel) {
                if (internalModel.expressions) {
                    state.expressions = Object.keys(internalModel.expressions);
                }
                // Fallback only when models.json is not ready yet, or model has no mapping entry.
                if (internalModel.modelSetting && state.motions.length === 0 && (!modelsConfigLoaded || !configModel)) {
                    const groups = ['', 'idle', 'tap_body', 'tapBody', 'flick_head', 'flickHead', 'pinch_in', 'pinchIn', 'pinch_out', 'pinchOut', 'shake', 'null'];
                    groups.forEach(group => {
                        const count = internalModel.modelSetting.getMotionNum(group);
                        for (let i = 0; i < count; i++) {
                            let label;
                            if (group === '') label = `Action ${i + 1}`;
                            else if (group === 'null') label = `Interact ${i + 1}`;
                            else label = `${group} ${i + 1}`;
                            state.motions.push({ group, index: i, label });
                        }
                    });
                }
            }

            window.postMessage({
                type: 'LIVE2D_STATE_UPDATE_FROM_PAGE',
                payload: state
            }, '*');
        }

        // --- Message Listener ---
        window.addEventListener('message', (event) => {
            if (event.source !== window) return;
            const msg = event.data;
            if (msg.type === 'LIVE2D_COMMAND_FROM_EXTENSION') {
                const { cmd, data } = msg.payload;

                switch (cmd) {
                    case 'GET_STATE':
                        broadcastState();
                        break;
                    case 'SWITCH_MODEL':
                        currentModelIndex = (currentModelIndex + 1) % MODELS.length;
                        persistCurrentModel();
                        loadCurrentModel();
                        break;
                    case 'TOGGLE_FOLLOW':
                        headFollowing = !headFollowing;
                        console.log('Head follow:', headFollowing);
                        break;
                    case 'PLAY_VOICE':
                        const sndUrl = getFullUrl(SOUND_PATH);
                        new Audio(sndUrl).play().catch(e => console.log(e));
                        break;
                    case 'SET_EXPRESSION':
                        if (isModelLoading) {
                            console.log('[Live2D UI] Model loading, queue expression:', data.name);
                            pendingCommands.push(() => setExpressionSafe(data.name, 'UI'));
                        } else {
                            setExpressionSafe(data.name, 'UI');
                        }
                        break;
                    case 'START_MOTION':
                        if (isModelLoading) {
                            console.log('[Live2D UI] Model loading, queue motion:', data.group, data.index);
                            pendingCommands.push(() => startMotionSafe(data.group, data.index, 3, 'UI'));
                        } else {
                            startMotionSafe(data.group, data.index, 3, 'UI');
                        }
                        break;
                    case 'SHOW_MESSAGE':
                        const bubble = document.getElementById('live2d-bubble');
                        if (bubble) {
                            // Remove tail (child) to set text, then re-add? Or specific text container.
                            // Simpler: just set textContent but we lose tail.
                            // Better: use innerText for the main part, but preserve structure?
                            // Let's us a span inside bubble for text.
                            // Actually, let's just rebuild content for simplicity or use a text node.
                            // Re-creating structure:
                            bubble.innerHTML = '';
                            bubble.appendChild(document.createTextNode(data.text));
                            const newTail = document.createElement('div');
                            newTail.style.position = 'absolute';
                            newTail.style.bottom = '-10px';
                            newTail.style.left = '50%';
                            newTail.style.marginLeft = '-10px';
                            newTail.style.width = '0';
                            newTail.style.height = '0';
                            newTail.style.borderLeft = '10px solid transparent';
                            newTail.style.borderRight = '10px solid transparent';
                            newTail.style.borderTop = '10px solid rgba(255, 255, 255, 0.5)';
                            bubble.appendChild(newTail);

                            bubble.style.display = 'block';

                            // Auto-hide after 5 seconds
                            if (window.bubbleTimeout) clearTimeout(window.bubbleTimeout);
                            window.bubbleTimeout = setTimeout(() => {
                                bubble.style.display = 'none';
                            }, 5000);
                        }
                        break;

                    case 'WS_PAYLOAD':
                        // Compatibility:
                        // old bridge: { cmd:'WS_PAYLOAD', data:{ data:{...} } }
                        // new secure bridge: { cmd:'WS_PAYLOAD', data:{...} }
                        const payload = (data && typeof data === 'object' && data.data && typeof data.data === 'object')
                            ? data.data
                            : data;
                        if (!payload || typeof payload !== 'object') {
                            console.warn('[Live2D WS] Invalid WS_PAYLOAD payload:', data);
                            return;
                        }
                        console.log('[Live2D WS] Received payload:', payload);

                        const processCommands = () => {
                            // 2. Change Expression
                            if (payload.expression) {
                                const currentName = MODELS[currentModelIndex].name;
                                const expressionName = resolveExpression(currentName, payload.expression);
                                setExpressionSafe(expressionName, 'WS');
                            }

                            // 3. Play Motion
                            if (payload.motion) {
                                let group = payload.motion;
                                let index = 0;

                                // 1. Attempt Tag Resolution
                                const currentName = MODELS[currentModelIndex].name;
                                group = resolveMotion(currentName, group);

                                console.log('[Live2D WS] Processing motion:', group);

                                // Support "group:index" format (e.g., "idle:2")
                                if (typeof group === 'string' && group.includes(':')) {
                                    const parts = group.split(':');
                                    group = parts[0];
                                    index = parseInt(parts[1], 10) || 0;
                                }

                                startMotionSafe(group, index, 3, 'WS');
                            }

                            // 4. Show Message
                            if (payload.message) {
                                const bubble = document.getElementById('live2d-bubble');
                                if (bubble) {
                                    bubble.innerHTML = '';
                                    bubble.appendChild(document.createTextNode(payload.message));
                                    const newTail = document.createElement('div');
                                    newTail.style.position = 'absolute';
                                    newTail.style.bottom = '-10px';
                                    newTail.style.left = '50%';
                                    newTail.style.marginLeft = '-10px';
                                    newTail.style.width = '0';
                                    newTail.style.height = '0';
                                    newTail.style.borderLeft = '10px solid transparent';
                                    newTail.style.borderRight = '10px solid transparent';
                                    newTail.style.borderTop = '10px solid rgba(255, 255, 255, 0.5)';
                                    bubble.appendChild(newTail);

                                    bubble.style.display = 'block';
                                    if (window.bubbleTimeout) clearTimeout(window.bubbleTimeout);
                                    window.bubbleTimeout = setTimeout(() => {
                                        bubble.style.display = 'none';
                                    }, 5000);
                                }
                            }
                        };

                        // 1. Switch Model (if specified and different)
                        if (payload.model) {
                            const foundIndex = MODELS.findIndex(m => m.name === payload.model);
                            if (foundIndex !== -1 && foundIndex !== currentModelIndex) {
                                console.log('[Live2D WS] Switching model to:', payload.model);
                                currentModelIndex = foundIndex;
                                persistCurrentModel();
                                // Add commands to queue
                                pendingCommands.push(processCommands);
                                loadCurrentModel(); // Triggers load, sets isLoading=true
                            } else {
                                // Same model
                                if (isModelLoading) {
                                    console.log('[Live2D WS] Model loading, queuing commands.');
                                    pendingCommands.push(processCommands);
                                } else {
                                    processCommands();
                                }
                            }
                        } else {
                            if (isModelLoading) {
                                console.log('[Live2D WS] Model loading, queuing commands (no model switch).');
                                pendingCommands.push(processCommands);
                            } else {
                                processCommands();
                            }
                        }
                        break;
                }
            }
        });



        // Initial Load
        loadModelsJson();
        loadCurrentModel();
    }

    ensureRoot();

})();
