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
        if (typeof passphrase !== 'string' || passphrase.length < 10) throw new Error('סיסמת גיבוי חייבת להכיל לפחות 10 תווים');
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

    function isValidDateString(value) {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const date = new Date(value + 'T12:00:00Z');
        return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }

    function validateState(state) {
        if (!state || typeof state !== 'object' || !Array.isArray(state.periods)) throw new Error('מבנה הגיבוי אינו תקין');
        if (state.periods.length > 10000) throw new Error('הגיבוי מכיל יותר מדי רשומות');
        const cityIds = ["beit-shemesh","jerusalem","bnei-brak","tel-aviv","haifa","ashdod","ashkelon","netanya","petah-tikva","modiin","other"];
        for (const p of state.periods) {
            if (!p || typeof p !== 'object' || !isValidDateString(p.date)) throw new Error('רשומת וסת לא תקינה');
            if (!['veset', 'spotting'].includes(p.type)) throw new Error('סוג רשומה לא תקין');
            if (p.eventTime !== undefined && p.eventTime !== null && (typeof p.eventTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.eventTime))) throw new Error('שעת אירוע לא תקינה');
            if (p.cityId !== undefined && p.cityId !== null && !cityIds.includes(p.cityId)) throw new Error('יישוב אירוע לא תקין');
            if (p.sunsetRelation !== undefined && !['before', 'after', 'unknown'].includes(p.sunsetRelation)) throw new Error('יחס שקיעה לא תקין');
        }
        if (state.hefseks !== undefined && (typeof state.hefseks !== 'object' || Array.isArray(state.hefseks))) throw new Error('נתוני הפסק לא תקינים');
        if (state.tevilot !== undefined && (state.tevilot === null || typeof state.tevilot !== 'object' || Array.isArray(state.tevilot) || Object.entries(state.tevilot).some(([date, enabled]) => !isValidDateString(date) || enabled !== true))) throw new Error('נתוני טבילה לא תקינים');
        if (state.daily !== undefined && (typeof state.daily !== 'object' || Array.isArray(state.daily))) throw new Error('נתוני דיווח יומי לא תקינים');
        if (state.settings !== undefined && (typeof state.settings !== 'object' || Array.isArray(state.settings))) throw new Error('הגדרות לא תקינות');
        if (state.settings && state.settings.cityId !== undefined && state.settings.cityId !== null && !cityIds.includes(state.settings.cityId)) throw new Error('יישוב לא תקין');
        if (state.hefsekMeta !== undefined) {
            if (!state.hefsekMeta || typeof state.hefsekMeta !== 'object' || Array.isArray(state.hefsekMeta)) throw new Error('נתוני זמן הפסק לא תקינים');
            for (const [date, meta] of Object.entries(state.hefsekMeta)) {
                if (!isValidDateString(date) || !meta || typeof meta !== 'object' || Array.isArray(meta)) throw new Error('נתוני זמן הפסק לא תקינים');
                if (meta.eventTime !== undefined && meta.eventTime !== null && (typeof meta.eventTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(meta.eventTime))) throw new Error('שעת הפסק לא תקינה');
                if (meta.cityId !== undefined && meta.cityId !== null && !cityIds.includes(meta.cityId)) throw new Error('יישוב הפסק לא תקין');
                if (meta.sunsetRelation !== undefined && !['before', 'after', 'unknown'].includes(meta.sunsetRelation)) throw new Error('יחס שקיעה לא תקין');
            }
        }
        const checklistIds = ['body-prep', 'hair', 'nails', 'barriers', 'clothing', 'towel', 'schedule', 'personal'];
        const toolTypes = ['opk_positive', 'bbt_shift', 'ultrasound', 'estimate', 'other'];
        const validTime = time => typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
        if (state.manualReminders !== undefined) {
            if (!Array.isArray(state.manualReminders) || state.manualReminders.length > 500) throw new Error('רשימת התזכורות אינה תקינה');
            const ids = new Set();
            for (const item of state.manualReminders) {
                if (!item || typeof item !== 'object' || typeof item.id !== 'string' || item.id.length > 80 || ids.has(item.id) || !isValidDateString(item.date)) throw new Error('תזכורת לא תקינה');
                ids.add(item.id);
                if (typeof item.title !== 'string' || !item.title.trim() || item.title.length > 120) throw new Error('כותרת תזכורת לא תקינה');
                if (item.time !== undefined && item.time !== null && !validTime(item.time)) throw new Error('שעת תזכורת לא תקינה');
                if (item.notes !== undefined && (typeof item.notes !== 'string' || item.notes.length > 500)) throw new Error('הערות תזכורת לא תקינות');
            }
        }
        if (state.stainReports !== undefined) {
            if (!Array.isArray(state.stainReports) || state.stainReports.length > 500) throw new Error('רישומי כתמים אינם תקינים');
            const ids = new Set();
            for (const item of state.stainReports) {
                if (!item || typeof item !== 'object' || typeof item.id !== 'string' || ids.has(item.id) || !isValidDateString(item.date)) throw new Error('רישום כתם לא תקין');
                ids.add(item.id);
                if (item.time !== undefined && item.time !== null && !validTime(item.time)) throw new Error('שעת כתם לא תקינה');
                if (!['red', 'pink', 'brown', 'yellow', 'clear', 'other', 'unknown'].includes(item.color)) throw new Error('צבע כתם לא תקין');
                if (!['small', 'medium', 'large', 'multiple', 'unknown'].includes(item.size)) throw new Error('גודל כתם לא תקין');
                if (!['white_underwear', 'colored_underwear', 'sheet', 'tissue', 'pad', 'bedikah_cloth', 'other', 'unknown'].includes(item.surface)) throw new Error('משטח כתם לא תקין');
                if (!['unknown', 'external', 'medical', 'other'].includes(item.source)) throw new Error('מקור כתם לא תקין');
                if (item.note !== undefined && (typeof item.note !== 'string' || item.note.length > 1000)) throw new Error('הערת כתם ארוכה מדי');
            }
        }
        if (state.mikvehChecklist !== undefined) {
            if (!state.mikvehChecklist || typeof state.mikvehChecklist !== 'object' || Array.isArray(state.mikvehChecklist) || Object.keys(state.mikvehChecklist).length > 500) throw new Error('רשימת הכנות למקווה אינה תקינה');
            for (const [date, checked] of Object.entries(state.mikvehChecklist)) {
                if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(checked) || checked.some(id => !checklistIds.includes(id)) || new Set(checked).size !== checked.length) throw new Error('סימון הכנה למקווה אינו תקין');
            }
        }
        if (state.ovulationObservations !== undefined) {
            if (!Array.isArray(state.ovulationObservations) || state.ovulationObservations.length > 500) throw new Error('תיעודי ביוץ אינם תקינים');
            const ids = new Set();
            for (const item of state.ovulationObservations) {
                if (!item || typeof item !== 'object' || typeof item.id !== 'string' || ids.has(item.id) || !/^\d{4}-\d{2}-\d{2}$/.test(item.date) || !toolTypes.includes(item.type)) throw new Error('תיעוד ביוץ לא תקין');
                ids.add(item.id);
                if (item.time !== undefined && item.time !== null && !validTime(item.time)) throw new Error('שעת ביוץ לא תקינה');
                if (item.immersionDate !== undefined && item.immersionDate !== null && !isValidDateString(item.immersionDate)) throw new Error('תאריך טבילה להשוואה לא תקין');
                if (item.note !== undefined && (typeof item.note !== 'string' || item.note.length > 500)) throw new Error('הערת ביוץ ארוכה מדי');
            }
        }
        return state;
    }

    if (window.__CYCLEFLOW_TEST__) {
        window.__CycleFlowBackupTest = { encrypt, decrypt, validateState, importBackup };
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
            if (passphrase.length < 10) throw new Error('סיסמת גיבוי חייבת להכיל לפחות 10 תווים');
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
            // A validated user-selected backup is the explicit recovery path.
            localStorage.removeItem('cycleflow_recovery_v1');
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
