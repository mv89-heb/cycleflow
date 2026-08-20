/**
 * CycleFlow backup integrity layer.
 * Runs independently so existing local data remains backward compatible.
 */
(() => {
    'use strict';

    const STORAGE_KEY = 'cycleflow_v61_python_pro';
    const MAGIC = 'CFBK';
    const VERSION = 2;
    const ITERATIONS = 600000;
    const LEGACY_ITERATIONS = 100000;
    const MAX_FILE_BYTES = 5 * 1024 * 1024;

    const enc = new TextEncoder();
    const dec = new TextDecoder();

    function bytesToBase64(bytes) {
        let binary = '';
        for (let i = 0; i < bytes.length; i += 0x8000) {
            binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        }
        return btoa(binary);
    }

    function base64ToBytes(value) {
        if (typeof value !== 'string' || !value) throw new Error('קובץ גיבוי לא תקין');
        try { return Uint8Array.from(atob(value), c => c.charCodeAt(0)); }
        catch (_) { throw new Error('קובץ גיבוי לא תקין'); }
    }

    async function deriveKey(passphrase, salt, iterations) {
        const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
            base,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    async function encrypt(state, passphrase) {
        if (typeof passphrase !== 'string' || passphrase.length < 4) throw new Error('הסיסמה חייבת לפחות 4 תווים');
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await deriveKey(passphrase, salt, ITERATIONS);
        const cipher = new Uint8Array(await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(state))
        ));
        return JSON.stringify({
            magic: MAGIC,
            version: VERSION,
            kdf: 'PBKDF2-SHA256',
            iterations: ITERATIONS,
            salt: bytesToBase64(salt),
            iv: bytesToBase64(iv),
            ciphertext: bytesToBase64(cipher)
        });
    }

    async function decrypt(raw, passphrase) {
        if (typeof raw !== 'string' || !raw.trim()) throw new Error('קובץ גיבוי לא תקין');
        let envelope = null;
        try { envelope = JSON.parse(raw); } catch (_) {}

        if (envelope && envelope.magic === MAGIC) {
            if (envelope.version !== VERSION || envelope.kdf !== 'PBKDF2-SHA256') throw new Error('גרסת גיבוי אינה נתמכת');
            const iterations = Number(envelope.iterations);
            if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 2000000) throw new Error('פרמטרי גיבוי לא תקינים');
            const salt = base64ToBytes(envelope.salt);
            const iv = base64ToBytes(envelope.iv);
            const cipher = base64ToBytes(envelope.ciphertext);
            if (salt.length !== 16 || iv.length !== 12 || cipher.length < 16) throw new Error('קובץ גיבוי לא תקין');
            const key = await deriveKey(passphrase, salt, iterations);
            return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)));
        }

        // Original CycleFlow format: Base64([16-byte salt][12-byte IV][ciphertext]).
        const combined = base64ToBytes(raw.trim());
        if (combined.length < 29) throw new Error('קובץ גיבוי לא תקין');
        const salt = combined.slice(0, 16);
        const iv = combined.slice(16, 28);
        const cipher = combined.slice(28);
        const key = await deriveKey(passphrase, salt, LEGACY_ITERATIONS);
        return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)));
    }

    function validateState(state) {
        if (!state || typeof state !== 'object' || !Array.isArray(state.periods)) throw new Error('מבנה הגיבוי אינו תקין');
        if (state.periods.length > 10000) throw new Error('הגיבוי מכיל יותר מדי רשומות');
        for (const p of state.periods) {
            if (!p || typeof p !== 'object' || typeof p.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.date)) throw new Error('רשומת וסת לא תקינה');
            if (!['veset', 'spotting'].includes(p.type)) throw new Error('סוג רשומה לא תקין');
        }
        if (state.hefseks !== undefined && (typeof state.hefseks !== 'object' || Array.isArray(state.hefseks))) throw new Error('נתוני הפסק לא תקינים');
        if (state.daily !== undefined && (typeof state.daily !== 'object' || Array.isArray(state.daily))) throw new Error('נתוני דיווח יומי לא תקינים');
        if (state.settings !== undefined && (typeof state.settings !== 'object' || Array.isArray(state.settings))) throw new Error('הגדרות לא תקינות');
        return state;
    }

    function currentState() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) throw new Error('אין נתונים לגיבוי');
        return validateState(JSON.parse(raw));
    }

    function download(text) {
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const d = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `cycleflow_backup_${d}.cfbk`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function toast(message, error = false) {
        const el = document.getElementById('toast');
        const msg = document.getElementById('toast_msg');
        if (msg) msg.innerText = message;
        if (el) {
            el.style.borderBottomColor = error ? 'var(--danger)' : 'var(--success)';
            el.classList.add('show');
            setTimeout(() => el.classList.remove('show'), 3000);
        }
    }

    async function exportBackup() {
        try {
            const passphrase = prompt('בחרי סיסמה להצפנת הגיבוי (יש לזכור אותה):');
            if (!passphrase) return;
            if (passphrase.length < 4) throw new Error('הסיסמה חייבת לפחות 4 תווים');
            download(await encrypt(currentState(), passphrase));
            toast('גיבוי מוצפן נוצר בהצלחה');
        } catch (error) { toast(error.message || 'שגיאה ביצירת הגיבוי', true); }
    }

    async function importBackup(fileInput) {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        try {
            if (file.size > MAX_FILE_BYTES) throw new Error('קובץ גיבוי גדול מדי');
            const passphrase = prompt('הזיני את הסיסמה ששימשה ליצירת הגיבוי:');
            if (!passphrase) return;
            const raw = await file.text();
            const imported = validateState(await decrypt(raw, passphrase));
            // Transactional import: validate/decrypt everything before touching localStorage.
            const serialized = JSON.stringify(imported);
            localStorage.setItem(STORAGE_KEY, serialized);
            if (localStorage.getItem(STORAGE_KEY) !== serialized) throw new Error('שמירת הגיבוי נכשלה');
            toast('שחזור הושלם בהצלחה');
            setTimeout(() => location.reload(), 500);
        } catch (error) {
            toast(error.message === 'קובץ גיבוי לא תקין' ? error.message : 'סיסמה שגויה או קובץ פגום', true);
        } finally { fileInput.value = ''; }
    }

    document.addEventListener('click', event => {
        const button = event.target.closest('[data-action]');
        if (!button) return;
        if (button.dataset.action === 'exportBackup') {
            event.preventDefault();
            event.stopImmediatePropagation();
            exportBackup();
        } else if (button.dataset.action === 'triggerImport') {
            event.preventDefault();
            event.stopImmediatePropagation();
            document.getElementById('import_file')?.click();
        }
    }, true);

    document.addEventListener('change', event => {
        if (event.target.id !== 'import_file') return;
        event.preventDefault();
        event.stopImmediatePropagation();
        importBackup(event.target);
    }, true);
})();
