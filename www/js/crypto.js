class CryptoManager {
    constructor() {
        this.keyBase64 = 'QJBNiBmV55PDrewyne3GsA==';
        this._cryptoKey = null;
    }

    async _getKey() {
        if (this._cryptoKey) return this._cryptoKey;
        const keyBytes = Uint8Array.from(atob(this.keyBase64), c => c.charCodeAt(0));
        this._cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyBytes,
            { name: 'AES-CBC' },
            false,
            ['decrypt']
        );
        return this._cryptoKey;
    }

    async decryptU3enc(encryptedData) {
        if (!encryptedData || encryptedData.length < 16) return null;
        try {
            const iv = encryptedData.slice(0, 16);
            const ciphertext = encryptedData.slice(16);
            const key = await this._getKey();
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-CBC', iv: iv },
                key,
                ciphertext
            );
            return new Uint8Array(decrypted);
        } catch (error) {
            console.error('u3enc decrypt failed:', error);
            return null;
        }
    }

    arrayBufferToString(uint8Array) {
        return new TextDecoder('utf-8').decode(uint8Array);
    }
}

window.CryptoManager = CryptoManager;
