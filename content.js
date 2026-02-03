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

