(function () {
    const SCRIPT_ID = 'live2d-extension-init-script';
    const ROOT_ID = 'live2d-extension-root';
    const MODEL_PATH = 'assets/models/asuna/asuna_01/asuna_01.model.json';
    const SOUND_PATH = 'assets/sound/friend_06.ogg';
    const MAX_LOG_ENTRIES = 18;

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

        const logArea = document.createElement('div');
        logArea.className = 'live2d-console-log';
        logArea.setAttribute('aria-live', 'polite');
        panel.append(logArea);
        root.append(panel);

        const helper = new Live2DHelper({ canvas: canvas.id });
        window.live2dExtensionHelper = helper;

        let modelRef = null;
        let headFollowing = false;

        const log = (message) => {
            const entry = document.createElement('div');
            entry.textContent = message;
            logArea.appendChild(entry);
            while (logArea.childElementCount > MAX_LOG_ENTRIES) {
                logArea.removeChild(logArea.firstChild);
            }
            logArea.scrollTop = logArea.scrollHeight;
        };

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
            }
            helper.startTurnHead();
            headFollowing = true;
            status.textContent = '已就绪';
            log('模型就绪，头部跟随开启');
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
                log('模型尚未就绪');
                return;
            }
            if (headFollowing) {
                helper.stopTurnHead();
                headFollowing = false;
                status.textContent = '头部静止';
                log('头部跟随已暂停');
            }
            else {
                helper.startTurnHead();
                headFollowing = true;
                status.textContent = '头部跟随';
                log('头部跟随已激活');
            }
        };

        addAction('随机表情', () => {
            if (!modelRef) {
                log('模型尚未就绪');
                return;
            }
            helper.setRandomExpression();
            log('触发随机表情');
        });

        addAction('空闲动作', () => {
            if (!modelRef) {
                log('模型尚未就绪');
                return;
            }
            const played = playRandomMotion([LAppDefine.MOTION_GROUP_IDLE, '']);
            if (played !== null) {
                log('播放空闲动作');
            }
            else {
                log('当前模型没有空闲动作可播放');
            }
        });

        addAction('身体点击', () => {
            if (!modelRef) {
                log('模型尚未就绪');
                return;
            }
            const played = playRandomMotion([LAppDefine.MOTION_GROUP_TAP_BODY, '']);
            if (played !== null) {
                log('播放身体点击动作');
            }
            else {
                log('当前模型没有身体点击动作可用');
            }
        });

        addAction('头部跟随', toggleHead);

        addAction('播放语音', () => {
            helper.playSound(soundUrl);
            log('播放语音');
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
