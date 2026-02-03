# Live2D x.com Overlay Extension

This Chrome extension injects the Live2D helper from `live2d-helper.js/` into `https://x.com` pages and renders the bundled Asuna model plus a tiny control console in the **lower-left corner** without a background.

## Quick start
1. Open `chrome://extensions` (or `edge://extensions`) and toggle **Developer mode**.
2. Click **Load unpacked**, then select this `extension/` directory.
3. Visit `https://x.com/` (or any subpage under `*.x.com`); the overlay should appear automatically.
4. Use the control buttons to trigger random expressions, idle/body motions, head-follow toggling, and sound.

## Architecture
- `manifest.json`: Defines the hosts, injects `content.js`, and exposes the helper scripts/assets via `web_accessible_resources`.
- `content.js`: Runs as a content script, injects the stylesheet, the Live2D runtime/helper, a runtime patch (`patch-live2d-helper.js`), and finally `init-live2d.js`.
- `patch-live2d-helper.js`: Monkey-patches the helper to avoid the legacy `modelsViewPointer` call and keep optional helpers safe.
- `init-live2d.js`: Runs in the page context, builds the canvas + console, loads the Asuna model/assets, drives actions, and keeps a short log.
- `lib/`, `dist/`, and `assets/`: Copied from `live2d-helper.js/` so everything is self-contained; the console relies on `Live2DHelper`, `LAppDefine`, and the bundled model data.

## Troubleshooting
- If the overlay does not appear, confirm the extension shows “Enabled” in `chrome://extensions` and that the current URL matches `https://x.com/*`.
- Open DevTools (Ctrl+Shift+I) → Console if the model fails to load; the helper logs each action and will mention missing motion groups/sound.
- When updating the Live2D helper, copy the fresh `lib/live2d.min.js`, `dist/live2d-helper.min.js`, and `assets/` contents into this directory before reloading the extension.

## Attribution
- Original helper: [huiyadanli/live2d-helper.js](https://github.com/huiyadanli/live2d-helper.js)
- Live2D runtime: Cubism SDK 2 WebGL

