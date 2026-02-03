(function () {
    const SCRIPT_ID = 'live2d-extension-init-script';
    const ROOT_ID = 'live2d-extension-root';
    const MODEL_PATH = 'assets/models/asuna/asuna_01/asuna_01.model.json';
    const SOUND_PATH = 'assets/sound/friend_06.ogg';

    const scriptEl = document.currentScript || document.getElementById(SCRIPT_ID);
    const extensionBase = (scriptEl && scriptEl.dataset && scriptEl.dataset.extensionBase) || window.__live2dExtensionBase || '';
    if (!extensionBase) {
        console.warn('Live2D extension: missing base path.');
        return;
    }

    window.__live2dExtensionBase = extensionBase;

    if (window.live2dExtensionRootCreated) {
        return;
    }
    window.live2dExtensionRootCreated = true;

    const modelUrl = `${extensionBase}${MODEL_PATH}`;
    const soundUrl = `${extensionBase}${SOUND_PATH}`;

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

    ensureRoot();

    function buildOverlay() {
        if (document.getElementById(ROOT_ID)) {
            return;
        }

        const root = document.createElement('div');
        root.id = ROOT_ID;
        root.className = 'live2d-extension-root';
        root.setAttribute('role', 'complementary');
        root.setAttribute('aria-label', 'Live2D 助手');
        document.body.appendChild(root);

        const wrapper = document.createElement('div');
        wrapper.className = 'live2d-extension-wrapper';
        const canvas = document.createElement('canvas');
        canvas.id = 'live2d-extension-canvas';
        canvas.width = 320;
        canvas.height = 460;
        wrapper.appendChild(canvas);
        root.appendChild(wrapper);

        const panel = document.createElement('div');
        panel.className = 'live2d-control-panel';
        const header = document.createElement('div');
        header.className = 'live2d-control-header';

        const title = document.createElement('span');
        title.className = 'live2d-control-title';
        title.textContent = 'Live2D 控制台';

        const status = document.createElement('span');
        status.className = 'live2d-control-status';
        status.textContent = '加载中';

        const toggle = document.createElement('button');
        toggle.className = 'live2d-control-toggle';
        toggle.type = 'button';
        toggle.textContent = '-';
        toggle.addEventListener('click', () => {
            panel.classList.toggle('live2d-panel-collapsed');
            toggle.textContent = panel.classList.contains('live2d-panel-collapsed') ? '+' : '-';
        });

        header.append(title, status, toggle);
        panel.append(header);

        const buttons = document.createElement('div');
        buttons.className = 'live2d-control-buttons';
        panel.append(buttons);

        const expressionSection = document.createElement('div');
        expressionSection.className = 'live2d-section';
        const expressionTitle = document.createElement('div');
        expressionTitle.className = 'live2d-section-title';
        expressionTitle.textContent = '表情';
        const expressionButtons = document.createElement('div');
        expressionButtons.className = 'live2d-action-grid';
        expressionButtons.textContent = '等待模型加载';
        expressionSection.append(expressionTitle, expressionButtons);
        panel.append(expressionSection);

        const motionSection = document.createElement('div');
        motionSection.className = 'live2d-section';
        const motionTitle = document.createElement('div');
        motionTitle.className = 'live2d-section-title';
        motionTitle.textContent = '身体动作';
        const motionButtons = document.createElement('div');
        motionButtons.className = 'live2d-action-grid';
        motionButtons.textContent = '等待模型加载';
        motionSection.append(motionTitle, motionButtons);
        panel.append(motionSection);

        const createActionButton = (label, handler) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.addEventListener('click', handler);
            return button;
        };

        const populateExpressionButtons = () => {
            expressionButtons.innerHTML = '';
            if (!modelRef || !modelRef.modelSetting) {
                expressionButtons.textContent = '加载中...';
                return;
            }
            const total = modelRef.modelSetting.getExpressionNum();
            if (!total) {
                expressionButtons.textContent = '暂无表情';
                return;
            }
            for (let index = 0; index < total; index++) {
                const name = modelRef.modelSetting.getExpressionName(index) || `表情 ${index + 1}`;
                expressionButtons.appendChild(createActionButton(name, () => {
                    helper.setExpression(name);
                    status.textContent = `表情：${name}`;
                }));
            }
        };

        const populateMotionButtons = () => {
            motionButtons.innerHTML = '';
            if (!modelRef || !modelRef.modelSetting) {
                motionButtons.textContent = '加载中...';
                return;
            }
            const groups = [LAppDefine.MOTION_GROUP_TAP_BODY, ''];
            let added = 0;
            groups.forEach((group) => {
                const count = modelRef.modelSetting.getMotionNum(group);
                if (count <= 0) {
                    return;
                }
                for (let index = 0; index < count; index++) {
                    const file = modelRef.modelSetting.getMotionFile(group, index) || `${group || '默认'} ${index + 1}`;
                    const label = file.split('/').pop() || `动作 ${index + 1}`;
                    motionButtons.appendChild(createActionButton(label, () => {
                        modelRef.startMotion(group, index, LAppDefine.PRIORITY_FORCE);
                        status.textContent = `动作：${label}`;
                    }));
                    added++;
                }
            });
            if (!added) {
                motionButtons.textContent = '暂无身体动作';
            }
        };
        root.append(panel);

        const helper = new Live2DHelper({ canvas: canvas.id });
        window.live2dExtensionHelper = helper;

        let modelRef = null;
        let headFollowing = false;

        const playRandomMotion = (candidates, priority = LAppDefine.PRIORITY_FORCE) => {
            if (!modelRef || !modelRef.modelSetting) {
                return null;
            }
            const list = Array.isArray(candidates) ? candidates : [candidates];
            for (const candidate of list) {
                if (candidate === null || candidate === undefined) {
                    continue;
                }
                const groupName = candidate === '' ? '' : candidate;
                if (modelRef.modelSetting.getMotionNum(groupName) <= 0) {
                    continue;
                }
                modelRef.startRandomMotion(groupName, priority);
                return groupName || '(default)';
            }
            return null;
        };

        helper.loadModel(modelUrl, () => {
            modelRef = helper.live2DMgr.models[0];
            if (modelRef) {
                playRandomMotion([LAppDefine.MOTION_GROUP_IDLE, ''], LAppDefine.PRIORITY_IDLE);
                populateExpressionButtons();
                populateMotionButtons();
            }
            helper.startTurnHead();
            headFollowing = true;
            status.textContent = '模型已就绪';
        });

        const addAction = (label, handler) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.addEventListener('click', () => handler());
            buttons.appendChild(button);
        };

        const toggleHead = () => {
            if (!modelRef) {
                status.textContent = '模型尚未就绪';
                return;
            }
            if (headFollowing) {
                helper.stopTurnHead();
                headFollowing = false;
                status.textContent = '头部静止';
            }
            else {
                helper.startTurnHead();
                headFollowing = true;
                status.textContent = '头部跟随';
            }
        };

        addAction('头部跟随', toggleHead);

        addAction('播放语音', () => {
            helper.playSound(soundUrl);
            status.textContent = '播放语音';
        });

        const handlePointer = (event) => {
            if (!headFollowing) {
                return;
            }
            helper.followPointer(event);
        };

        wrapper.addEventListener('pointermove', handlePointer);
        wrapper.addEventListener('pointerdown', handlePointer);
    }
})();
