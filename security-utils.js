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
    const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const BASE58_MAP = (() => {
        const map = Object.create(null);
        for (let i = 0; i < BASE58_ALPHABET.length; i++) {
            map[BASE58_ALPHABET[i]] = i;
        }
        return map;
    })();

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

    function bytesToBase58(bytesInput) {
        const bytes = bytesInput instanceof Uint8Array ? bytesInput : new Uint8Array(bytesInput);
        if (bytes.length === 0) {
            return '';
        }

        let zeros = 0;
        while (zeros < bytes.length && bytes[zeros] === 0) {
            zeros++;
        }

        const digits = [0];
        for (let i = zeros; i < bytes.length; i++) {
            let carry = bytes[i];
            for (let j = 0; j < digits.length; j++) {
                const value = digits[j] * 256 + carry;
                digits[j] = value % 58;
                carry = Math.floor(value / 58);
            }
            while (carry > 0) {
                digits.push(carry % 58);
                carry = Math.floor(carry / 58);
            }
        }

        let output = '';
        for (let i = 0; i < zeros; i++) {
            output += '1';
        }
        for (let i = digits.length - 1; i >= 0; i--) {
            output += BASE58_ALPHABET[digits[i]];
        }
        return output;
    }

    function base58ToBytes(input) {
        const value = (input || '').trim();
        if (!value) {
            return new Uint8Array();
        }

        let zeros = 0;
        while (zeros < value.length && value[zeros] === '1') {
            zeros++;
        }

        const bytes = [0];
        for (let i = zeros; i < value.length; i++) {
            const char = value[i];
            const digit = BASE58_MAP[char];
            if (digit == null) {
                throw new Error('Invalid Base58 character');
            }

            let carry = digit;
            for (let j = 0; j < bytes.length; j++) {
                const value58 = bytes[j] * 58 + carry;
                bytes[j] = value58 & 255;
                carry = value58 >> 8;
            }

            while (carry > 0) {
                bytes.push(carry & 255);
                carry = carry >> 8;
            }
        }

        const output = new Uint8Array(zeros + bytes.length);
        for (let i = 0; i < zeros; i++) {
            output[i] = 0;
        }
        for (let i = 0; i < bytes.length; i++) {
            output[output.length - 1 - i] = bytes[i];
        }
        return output;
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

    function publicKeyBase64ToBase58(publicKeyBase64) {
        return bytesToBase58(base64ToBytes(publicKeyBase64));
    }

    function privateKeyBase64ToBase58(privateKeyBase64) {
        return bytesToBase58(base64ToBytes(privateKeyBase64));
    }

    function publicKeyBase58ToBase64(publicKeyBase58) {
        return bytesToBase64(base58ToBytes(publicKeyBase58));
    }

    function privateKeyBase58ToBase64(privateKeyBase58) {
        return bytesToBase64(base58ToBytes(privateKeyBase58));
    }

    function isValidPublicKeyBase58(publicKeyBase58) {
        try {
            return base58ToBytes(publicKeyBase58).length === nacl.sign.publicKeyLength;
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
        bytesToBase58,
        base58ToBytes,
        canonicalize,
        isValidPublicKey,
        isValidPrivateKey,
        isValidPublicKeyBase58,
        publicKeyBase64ToBase58,
        privateKeyBase64ToBase58,
        publicKeyBase58ToBase64,
        privateKeyBase58ToBase64,
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
