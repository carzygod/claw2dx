(function () {
    if (window.Live2DI18n) {
        return;
    }

    const STORAGE_LANG_KEY = 'live2dPopupLanguage';
    const SUPPORTED = ['en', 'zh-CN', 'zh-TW', 'ja'];

    const messages = {
        en: {
            popup_title: 'Live2D Secure Control',
            language_label: 'Language',
            section_keys: 'Plugin Keys (Base58)',
            btn_copy_pub: 'Copy Public Key',
            btn_export_priv: 'Export Private Key',
            section_ws: 'WebSocket',
            btn_save: 'Save',
            btn_connect: 'Connect',
            btn_disconnect: 'Disconnect',
            ws_status_unknown: 'Status: unknown',
            ws_status_unavailable: 'Status: unavailable',
            section_whitelist: 'Whitelist Public Keys',
            whitelist_placeholder: 'Paste sender public key (Base58 preferred, Base64 also accepted)',
            btn_add_key: 'Add Key',
            whitelist_none: 'No trusted sender key.',
            btn_delete: 'Delete',
            section_general: 'General',
            btn_switch: 'Switch Model',
            btn_follow: 'Toggle Follow',
            btn_voice: 'Play Voice',
            current_model: 'Current:',
            section_message: 'Message',
            msg_placeholder: 'Type a message...',
            btn_send: 'Send',
            section_expressions: 'Expressions',
            section_motions: 'Motions',
            popup_connecting_page: 'Connecting to page...',
            status_connected: 'Connected.',
            status_no_tab: 'No active tab found.',
            status_need_x: 'Please focus an x.com tab.',
            status_refresh_page: 'Error: open/refresh x.com page first.',
            status_cmd_sent: 'Command sent.',
            status_ws_saved: 'WebSocket URL saved.',
            status_ws_connecting: 'Connecting WebSocket...',
            status_ws_disconnect_req: 'Disconnect requested.',
            status_pub_copied: 'Public key copied.',
            status_priv_exported: 'Private key exported.',
            status_whitelist_updated: 'Whitelist updated.',
            status_whitelist_need_input: 'Please input a public key.',
            status_whitelist_invalid: 'Invalid public key format.',
            status_whitelist_exists: 'Key already in whitelist.',
            status_whitelist_added: 'Key added.',
            ws_no_receiver: 'No content script receiver. Open x.com and refresh once.',
            ws_no_response: 'Status: unavailable (no response from page)',
            ws_status_label: 'Status',
            ws_registered: 'registered',
            ws_state_connecting: 'connecting',
            ws_state_connected: 'connected',
            ws_state_disconnected: 'disconnected',
            ws_state_error: 'error',
            ws_state_unavailable: 'unavailable'
        },
        'zh-CN': {
            popup_title: 'Live2D 安全控制',
            language_label: '语言',
            section_keys: '插件密钥（Base58）',
            btn_copy_pub: '复制公钥',
            btn_export_priv: '导出私钥',
            section_ws: 'WebSocket',
            btn_save: '保存',
            btn_connect: '连接',
            btn_disconnect: '断开',
            ws_status_unknown: '状态：未知',
            ws_status_unavailable: '状态：不可用',
            section_whitelist: '白名单公钥',
            whitelist_placeholder: '粘贴发送方公钥（优先 Base58，也支持 Base64）',
            btn_add_key: '添加公钥',
            whitelist_none: '暂无可信发送方公钥。',
            btn_delete: '删除',
            section_general: '通用控制',
            btn_switch: '切换模型',
            btn_follow: '切换跟随',
            btn_voice: '播放语音',
            current_model: '当前：',
            section_message: '消息',
            msg_placeholder: '输入消息...',
            btn_send: '发送',
            section_expressions: '表情',
            section_motions: '动作',
            popup_connecting_page: '正在连接页面...',
            status_connected: '已连接。',
            status_no_tab: '未找到活动标签页。',
            status_need_x: '请切换到 x.com 标签页。',
            status_refresh_page: '错误：请先打开/刷新 x.com 页面。',
            status_cmd_sent: '指令已发送。',
            status_ws_saved: 'WebSocket 地址已保存。',
            status_ws_connecting: '正在连接 WebSocket...',
            status_ws_disconnect_req: '已请求断开连接。',
            status_pub_copied: '公钥已复制。',
            status_priv_exported: '私钥已导出。',
            status_whitelist_updated: '白名单已更新。',
            status_whitelist_need_input: '请输入公钥。',
            status_whitelist_invalid: '公钥格式无效。',
            status_whitelist_exists: '该公钥已在白名单中。',
            status_whitelist_added: '公钥已添加。',
            ws_no_receiver: '未找到内容脚本接收端。请打开 x.com 并刷新一次。',
            ws_no_response: '状态：不可用（页面无响应）',
            ws_status_label: '状态',
            ws_registered: '已注册',
            ws_state_connecting: '连接中',
            ws_state_connected: '已连接',
            ws_state_disconnected: '已断开',
            ws_state_error: '错误',
            ws_state_unavailable: '不可用'
        },
        'zh-TW': {
            popup_title: 'Live2D 安全控制',
            language_label: '語言',
            section_keys: '外掛金鑰（Base58）',
            btn_copy_pub: '複製公鑰',
            btn_export_priv: '匯出私鑰',
            section_ws: 'WebSocket',
            btn_save: '儲存',
            btn_connect: '連線',
            btn_disconnect: '中斷',
            ws_status_unknown: '狀態：未知',
            ws_status_unavailable: '狀態：不可用',
            section_whitelist: '白名單公鑰',
            whitelist_placeholder: '貼上發送方公鑰（建議 Base58，也支援 Base64）',
            btn_add_key: '新增公鑰',
            whitelist_none: '目前沒有可信任發送方公鑰。',
            btn_delete: '刪除',
            section_general: '一般控制',
            btn_switch: '切換模型',
            btn_follow: '切換跟隨',
            btn_voice: '播放語音',
            current_model: '目前：',
            section_message: '訊息',
            msg_placeholder: '輸入訊息...',
            btn_send: '送出',
            section_expressions: '表情',
            section_motions: '動作',
            popup_connecting_page: '正在連線頁面...',
            status_connected: '已連線。',
            status_no_tab: '找不到目前分頁。',
            status_need_x: '請切換到 x.com 分頁。',
            status_refresh_page: '錯誤：請先開啟/重新整理 x.com 頁面。',
            status_cmd_sent: '指令已送出。',
            status_ws_saved: 'WebSocket 位址已儲存。',
            status_ws_connecting: '正在連線 WebSocket...',
            status_ws_disconnect_req: '已要求中斷連線。',
            status_pub_copied: '公鑰已複製。',
            status_priv_exported: '私鑰已匯出。',
            status_whitelist_updated: '白名單已更新。',
            status_whitelist_need_input: '請輸入公鑰。',
            status_whitelist_invalid: '公鑰格式無效。',
            status_whitelist_exists: '該公鑰已在白名單中。',
            status_whitelist_added: '公鑰已新增。',
            ws_no_receiver: '找不到內容腳本接收端。請開啟 x.com 並重新整理一次。',
            ws_no_response: '狀態：不可用（頁面無回應）',
            ws_status_label: '狀態',
            ws_registered: '已註冊',
            ws_state_connecting: '連線中',
            ws_state_connected: '已連線',
            ws_state_disconnected: '已中斷',
            ws_state_error: '錯誤',
            ws_state_unavailable: '不可用'
        },
        ja: {
            popup_title: 'Live2D セキュア制御',
            language_label: '言語',
            section_keys: 'プラグイン鍵（Base58）',
            btn_copy_pub: '公開鍵をコピー',
            btn_export_priv: '秘密鍵をエクスポート',
            section_ws: 'WebSocket',
            btn_save: '保存',
            btn_connect: '接続',
            btn_disconnect: '切断',
            ws_status_unknown: '状態: 不明',
            ws_status_unavailable: '状態: 利用不可',
            section_whitelist: '公開鍵ホワイトリスト',
            whitelist_placeholder: '送信者公開鍵を貼り付け（Base58推奨、Base64も可）',
            btn_add_key: '鍵を追加',
            whitelist_none: '信頼済み送信者鍵はありません。',
            btn_delete: '削除',
            section_general: '一般操作',
            btn_switch: 'モデル切替',
            btn_follow: '追従切替',
            btn_voice: '音声再生',
            current_model: '現在:',
            section_message: 'メッセージ',
            msg_placeholder: 'メッセージを入力...',
            btn_send: '送信',
            section_expressions: '表情',
            section_motions: 'モーション',
            popup_connecting_page: 'ページに接続中...',
            status_connected: '接続済み。',
            status_no_tab: 'アクティブタブが見つかりません。',
            status_need_x: 'x.com タブを表示してください。',
            status_refresh_page: 'エラー: 先に x.com を開いて再読み込みしてください。',
            status_cmd_sent: 'コマンド送信済み。',
            status_ws_saved: 'WebSocket URL を保存しました。',
            status_ws_connecting: 'WebSocket に接続中...',
            status_ws_disconnect_req: '切断を要求しました。',
            status_pub_copied: '公開鍵をコピーしました。',
            status_priv_exported: '秘密鍵をエクスポートしました。',
            status_whitelist_updated: 'ホワイトリストを更新しました。',
            status_whitelist_need_input: '公開鍵を入力してください。',
            status_whitelist_invalid: '公開鍵形式が不正です。',
            status_whitelist_exists: 'その鍵は既に登録されています。',
            status_whitelist_added: '鍵を追加しました。',
            ws_no_receiver: 'コンテンツスクリプト受信先がありません。x.com を開いて再読み込みしてください。',
            ws_no_response: '状態: 利用不可（ページ応答なし）',
            ws_status_label: '状態',
            ws_registered: '登録済み',
            ws_state_connecting: '接続中',
            ws_state_connected: '接続済み',
            ws_state_disconnected: '切断済み',
            ws_state_error: 'エラー',
            ws_state_unavailable: '利用不可'
        }
    };

    function normalizeLang(input) {
        const value = (input || '').toLowerCase();
        if (value.startsWith('zh-cn') || value.startsWith('zh-sg') || value === 'zh') {
            return 'zh-CN';
        }
        if (value.startsWith('zh-tw') || value.startsWith('zh-hk') || value.startsWith('zh-mo')) {
            return 'zh-TW';
        }
        if (value.startsWith('ja')) {
            return 'ja';
        }
        return 'en';
    }

    function getCurrentLang() {
        const attrLang = document.documentElement.getAttribute('data-live2d-lang');
        if (SUPPORTED.includes(attrLang)) {
            return attrLang;
        }
        return normalizeLang(navigator.language || 'en');
    }

    function t(key, langOverride) {
        const lang = langOverride || getCurrentLang();
        const table = messages[lang] || messages.en;
        if (Object.prototype.hasOwnProperty.call(table, key)) {
            return table[key];
        }
        return messages.en[key] || key;
    }

    function applyToDom(lang) {
        const effective = SUPPORTED.includes(lang) ? lang : normalizeLang(lang);
        document.documentElement.setAttribute('data-live2d-lang', effective);

        document.querySelectorAll('[data-i18n]').forEach((el) => {
            const key = el.getAttribute('data-i18n');
            el.textContent = t(key, effective);
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.setAttribute('placeholder', t(key, effective));
        });
    }

    async function loadSavedLang() {
        return await new Promise((resolve) => {
            if (!chrome || !chrome.storage || !chrome.storage.local) {
                resolve(normalizeLang(navigator.language || 'en'));
                return;
            }
            chrome.storage.local.get([STORAGE_LANG_KEY], (result) => {
                const saved = result && result[STORAGE_LANG_KEY];
                resolve(SUPPORTED.includes(saved) ? saved : normalizeLang(navigator.language || 'en'));
            });
        });
    }

    async function saveLang(lang) {
        const effective = SUPPORTED.includes(lang) ? lang : normalizeLang(lang);
        await new Promise((resolve) => {
            if (!chrome || !chrome.storage || !chrome.storage.local) {
                resolve();
                return;
            }
            chrome.storage.local.set({ [STORAGE_LANG_KEY]: effective }, () => resolve());
        });
        applyToDom(effective);
        return effective;
    }

    window.Live2DI18n = {
        SUPPORTED,
        STORAGE_LANG_KEY,
        t,
        applyToDom,
        loadSavedLang,
        saveLang,
        normalizeLang
    };
})();
