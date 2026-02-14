(function () {
    if (window.Live2DSecurity) {
        return;
    }
    if (typeof nacl === 'undefined') {
        throw new Error('tweetnacl is required before security-utils.js');
    }

    const LOCAL_KEYPAIR_KEY = 'live2d_secure_keypair_v1';
    const STORAGE_KEYPAIR_KEY = 'live2dSecureKeypairV1';
    const STORAGE_WHITELIST_KEY = 'live2dWhitelistPublicKeysV1';
    const STORAGE_USED_NONCES_KEY = 'live2dUsedNoncesV1';
    const MAX_NONCES = 5000;

    const textEncoder = new TextEncoder();

    function bytesToBase64(bytes) {
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    function base64ToBytes(input) {
        const normalized = (input || '').trim();
        const binary = atob(normalized);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    function canonicalize(value) {
        if (Array.isArray(value)) {
            return '[' + value.map(canonicalize).join(',') + ']';
        }

        if (value && typeof value === 'object') {
            const keys = Object.keys(value).sort();
            const pairs = keys.map((key) => JSON.stringify(key) + ':' + canonicalize(value[key]));
            return '{' + pairs.join(',') + '}';
        }

        return JSON.stringify(value);
    }

    function isValidPublicKey(publicKey) {
        try {
            return base64ToBytes(publicKey).length === nacl.sign.publicKeyLength;
        } catch (error) {
            return false;
        }
    }

    function isValidPrivateKey(privateKey) {
        try {
            return base64ToBytes(privateKey).length === nacl.sign.secretKeyLength;
        } catch (error) {
            return false;
        }
    }

    function normalizeKeyPair(raw) {
        if (!raw || typeof raw !== 'object') {
            return null;
        }
        if (!isValidPublicKey(raw.publicKey) || !isValidPrivateKey(raw.privateKey)) {
            return null;
        }
        return {
            publicKey: raw.publicKey.trim(),
            privateKey: raw.privateKey.trim()
        };
    }

    function getStorage(keys) {
        return new Promise((resolve) => {
            if (!chrome || !chrome.storage || !chrome.storage.local) {
                resolve({});
                return;
            }
            chrome.storage.local.get(keys, (result) => resolve(result || {}));
        });
    }

    function setStorage(data) {
        return new Promise((resolve) => {
            if (!chrome || !chrome.storage || !chrome.storage.local) {
                resolve();
                return;
            }
            chrome.storage.local.set(data, () => resolve());
        });
    }

    function getLocalKeyPair() {
        try {
            const raw = localStorage.getItem(LOCAL_KEYPAIR_KEY);
            if (!raw) {
                return null;
            }
            return normalizeKeyPair(JSON.parse(raw));
        } catch (error) {
            return null;
        }
    }

    function setLocalKeyPair(keyPair) {
        try {
            localStorage.setItem(LOCAL_KEYPAIR_KEY, JSON.stringify(keyPair));
        } catch (error) {
            // Ignore localStorage failures (e.g. blocked contexts)
        }
    }

    async function ensureKeyPair() {
        const fromLocal = getLocalKeyPair();
        if (fromLocal) {
            await setStorage({ [STORAGE_KEYPAIR_KEY]: fromLocal });
            return fromLocal;
        }

        const stored = await getStorage([STORAGE_KEYPAIR_KEY]);
        const fromStorage = normalizeKeyPair(stored[STORAGE_KEYPAIR_KEY]);
        if (fromStorage) {
            setLocalKeyPair(fromStorage);
            return fromStorage;
        }

        const generated = nacl.sign.keyPair();
        const created = {
            publicKey: bytesToBase64(generated.publicKey),
            privateKey: bytesToBase64(generated.secretKey)
        };
        setLocalKeyPair(created);
        await setStorage({ [STORAGE_KEYPAIR_KEY]: created });
        return created;
    }

    function signObject(privateKeyBase64, payload) {
        const secretKey = base64ToBytes(privateKeyBase64);
        const message = textEncoder.encode(canonicalize(payload));
        return bytesToBase64(nacl.sign.detached(message, secretKey));
    }

    function verifyObject(publicKeyBase64, payload, signatureBase64) {
        try {
            const publicKey = base64ToBytes(publicKeyBase64);
            const signature = base64ToBytes(signatureBase64);
            const message = textEncoder.encode(canonicalize(payload));
            return nacl.sign.detached.verify(message, signature, publicKey);
        } catch (error) {
            return false;
        }
    }

    function createNonce() {
        return bytesToBase64(nacl.randomBytes(24));
    }

    async function getWhitelist() {
        const result = await getStorage([STORAGE_WHITELIST_KEY]);
        const list = Array.isArray(result[STORAGE_WHITELIST_KEY]) ? result[STORAGE_WHITELIST_KEY] : [];
        const normalized = [];
        const seen = new Set();
        list.forEach((item) => {
            const key = typeof item === 'string' ? item.trim() : '';
            if (!key || seen.has(key) || !isValidPublicKey(key)) {
                return;
            }
            seen.add(key);
            normalized.push(key);
        });
        return normalized;
    }

    async function saveWhitelist(list) {
        const normalized = [];
        const seen = new Set();
        (Array.isArray(list) ? list : []).forEach((item) => {
            const key = typeof item === 'string' ? item.trim() : '';
            if (!key || seen.has(key) || !isValidPublicKey(key)) {
                return;
            }
            seen.add(key);
            normalized.push(key);
        });
        await setStorage({ [STORAGE_WHITELIST_KEY]: normalized });
        return normalized;
    }

    async function getUsedNonceEntries() {
        const result = await getStorage([STORAGE_USED_NONCES_KEY]);
        const items = Array.isArray(result[STORAGE_USED_NONCES_KEY]) ? result[STORAGE_USED_NONCES_KEY] : [];
        return items.filter((item) => typeof item === 'string' && item.length > 0);
    }

    async function saveUsedNonceEntries(items) {
        const trimmed = Array.isArray(items) ? items.slice(-MAX_NONCES) : [];
        await setStorage({ [STORAGE_USED_NONCES_KEY]: trimmed });
    }

    window.Live2DSecurity = {
        LOCAL_KEYPAIR_KEY,
        STORAGE_KEYPAIR_KEY,
        STORAGE_WHITELIST_KEY,
        STORAGE_USED_NONCES_KEY,
        bytesToBase64,
        base64ToBytes,
        canonicalize,
        isValidPublicKey,
        isValidPrivateKey,
        ensureKeyPair,
        signObject,
        verifyObject,
        createNonce,
        getWhitelist,
        saveWhitelist,
        getUsedNonceEntries,
        saveUsedNonceEntries
    };
})();
