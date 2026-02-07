(function () {
    const SCRIPT_ID = 'live2d-extension-init-script';
    const ROOT_ID = 'live2d-extension-root';

    // Model Definitions
    const MODELS = [
        {
            name: 'Koharu',
            path: 'assets/models/koharu/koharu.model.json'
        },
        {
            name: 'Shizuku',
            path: 'assets/models/shizuku/shizuku.model.json'
        },
        {
            name: 'Wanko',
            path: 'assets/models/wanko/wanko.model.json'
        },
        {
            name: 'Haru02',
            path: 'assets/models/haru02/haru02.model.json'
        },
        {
            name: 'Izumi',
            path: 'assets/models/izumi/izumi.model.json'
        }
    ];

    let currentModelIndex = 0;
    const SOUND_PATH = 'assets/sound/friend_06.ogg';

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
        if (document.getElementById(ROOT_ID)) {
            return;
        }
        if (!document.body) {
            document.addEventListener('DOMContentLoaded', buildOverlay, { once: true });
            return;
        }
        buildOverlay();
    }

    function buildOverlay() {
        if (document.getElementById(ROOT_ID)) return;

        // 1. Create Container
        const root = document.createElement('div');
        root.id = ROOT_ID;

        // 2. Create Canvas
        const canvas = document.createElement('canvas');
        canvas.id = 'live2d-canvas';
        canvas.width = 800;
        canvas.height = 1600;
        canvas.style.width = '200px';
        canvas.style.height = '400px';

        // 3. Create Control Panel
        const panel = document.createElement('div');
        panel.className = 'live2d-control-panel';

        //  -- Header --
        const header = document.createElement('div');
        header.className = 'live2d-control-header';
        header.innerHTML = `
            <span class="live2d-control-title">Live2D Control</span>
            <span class="live2d-control-status">Active</span>
        `;
        header.style.cursor = 'pointer';
        header.onclick = () => {
            panel.classList.toggle('live2d-panel-collapsed');
        };

        // -- Button Container --
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'live2d-control-buttons';

        // -- Global/General Controls --
        const generalSection = document.createElement('div');
        generalSection.className = 'live2d-section';
        generalSection.innerHTML = '<div class="live2d-section-title">GENERAL</div>';
        const generalGrid = document.createElement('div');
        generalGrid.className = 'live2d-action-grid';

        // Switch Model
        const btnSwitch = document.createElement('button');
        btnSwitch.textContent = 'Switch: ' + MODELS[currentModelIndex].name;
        btnSwitch.onclick = () => switchModel();

        // Head Follow
        let headFollowing = false;
        const btnFollow = document.createElement('button');
        btnFollow.textContent = 'Toggle Follow';
        btnFollow.onclick = () => {
            headFollowing = !headFollowing;
            console.log('Head follow:', headFollowing);
        };

        // Play Sound
        const btnSound = document.createElement('button');
        btnSound.textContent = 'Voice';
        btnSound.onclick = () => {
            const sndUrl = getFullUrl(SOUND_PATH);
            const aud = new Audio(sndUrl);
            aud.play().catch(e => console.error('Audio play failed', e));
        };

        generalGrid.appendChild(btnSwitch);
        generalGrid.appendChild(btnFollow);
        generalGrid.appendChild(btnSound);
        generalSection.appendChild(generalGrid);
        buttonsContainer.appendChild(generalSection);

        // -- Dynamic Sections Containers --

        // Helper to create collapsible section
        function createSection(titleText) {
            const section = document.createElement('div');
            section.className = 'live2d-section';
            section.style.display = 'none'; // Hidden until active content exists

            const header = document.createElement('div');
            header.className = 'live2d-section-title';
            header.textContent = titleText + ' [+]';

            const contentDiv = document.createElement('div');
            contentDiv.className = 'live2d-section-content'; // Default hidden by CSS

            const grid = document.createElement('div');
            grid.className = 'live2d-action-grid';
            contentDiv.appendChild(grid);

            header.onclick = () => {
                const isExpanded = contentDiv.classList.toggle('expanded');
                header.textContent = titleText + (isExpanded ? ' [-]' : ' [+]');
            };

            section.appendChild(header);
            section.appendChild(contentDiv);

            return { section, grid, header };
        }

        const exprObj = createSection('EXPRESSIONS');
        const expressionsSection = exprObj.section;
        const expressionsGrid = exprObj.grid;
        buttonsContainer.appendChild(expressionsSection);

        const motionObj = createSection('MOTIONS');
        const motionsSection = motionObj.section;
        const motionsGrid = motionObj.grid;
        buttonsContainer.appendChild(motionsSection);

        panel.appendChild(header);
        panel.appendChild(buttonsContainer);
        root.appendChild(canvas);
        root.appendChild(panel);
        document.body.appendChild(root);

        // Initialize Helper
        if (typeof Live2DHelper === 'undefined') {
            console.error('Live2DHelper not found.');
            return;
        }

        // --- Core Logic ---

        const helper = new Live2DHelper({ canvas: canvas.id });
        window.live2dExtensionHelper = helper;

        function switchModel() {
            currentModelIndex = (currentModelIndex + 1) % MODELS.length;
            loadCurrentModel();
        }

        function loadCurrentModel() {
            const modelConfig = MODELS[currentModelIndex];
            btnSwitch.textContent = 'Loading...';

            // Cleanup UI
            expressionsGrid.innerHTML = '';
            motionsGrid.innerHTML = '';
            expressionsSection.style.display = 'none';
            motionsSection.style.display = 'none';

            // IMPORTANT: Completely release all old models
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

            helper.loadModel(getFullUrl(modelConfig.path), (model) => {
                console.log('Model loaded:', modelConfig.name);
                btnSwitch.textContent = 'Switch: ' + modelConfig.name;

                // Get the Internal Model (now clearly at index 0)
                const internalModel = helper.live2DMgr.getModel(0);
                if (!internalModel) return;

                // 1. Generate Expression Buttons
                if (internalModel.expressions) {
                    const exprNames = Object.keys(internalModel.expressions);
                    if (exprNames.length > 0) {
                        expressionsSection.style.display = 'block';
                        exprNames.forEach(name => {
                            const btn = document.createElement('button');
                            // Display name: strip .exp.json or .json if present for cleaner UI
                            btn.textContent = name.replace(/(\.exp)?\.json$/i, '');
                            btn.onclick = () => {
                                console.log('Setting expression:', name);
                                helper.setExpression(name, 0);
                            };
                            expressionsGrid.appendChild(btn);
                        });
                    }
                }

                // 2. Generate Motion Buttons
                if (internalModel.modelSetting) {
                    // Comprehensive list of groups to check
                    // 'null' is crucial for Izumi
                    // camelCase variants added just in case
                    const groups = [
                        '',
                        'idle',
                        'tap_body', 'tapBody',
                        'flick_head', 'flickHead',
                        'pinch_in', 'pinchIn',
                        'pinch_out', 'pinchOut',
                        'shake',
                        'null'
                    ];
                    let hasMotion = false;

                    groups.forEach(group => {
                        const count = internalModel.modelSetting.getMotionNum(group);
                        if (count > 0) {
                            hasMotion = true;
                            for (let i = 0; i < count; i++) {
                                const btn = document.createElement('button');
                                let label;
                                if (group === '') label = `Action ${i + 1}`;
                                else if (group === 'null') label = `Interact ${i + 1}`;
                                else label = `${group} ${i + 1}`;

                                btn.textContent = label;
                                btn.onclick = () => {
                                    console.log('Starting motion:', group, i);
                                    helper.startMotion(group, i, 0);
                                };
                                motionsGrid.appendChild(btn);
                            }
                        }
                    });

                    if (hasMotion) {
                        motionsSection.style.display = 'block';
                    }
                }
            });
        }

        // Initial Load
        loadCurrentModel();

        document.addEventListener('mousemove', (e) => {
            if (!headFollowing) return;
        });
    }

    ensureRoot();

})();
