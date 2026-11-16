/* CycleFlow client hardening. Must load before app.js. */
(() => {
    'use strict';

    const STORAGE_KEY = 'cycleflow_v61_python_pro';
    const RECOVERY_KEY = 'cycleflow_recovery_v1';
    const MAX_PIN_ATTEMPTS = 5;
    const LOCKOUT_MS = 30_000;

    function isValidDateString(value) {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const d = new Date(`${value}T12:00:00Z`);
        return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
    }

    function isPlainObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    function validateDaily(value) {
        if (!isPlainObject(value)) return false;
        return Object.entries(value).every(([date, entry]) => {
            if (!isValidDateString(date) || !isPlainObject(entry)) return false;
            if (entry.note !== undefined && typeof entry.note !== 'string') return false;
            if (entry.checks !== undefined) {
                if (!isPlainObject(entry.checks)) return false;
                for (const key of ['morning', 'moch', 'sunset']) {
                    if (entry.checks[key] !== undefined && typeof entry.checks[key] !== 'boolean') return false;
                }
            }
            return true;
        });
    }

    function validateHefseks(value) {
        if (!isPlainObject(value)) return false;
        return Object.entries(value).every(([date, enabled]) => isValidDateString(date) && enabled === true);
    }

    function validateState(value) {
        if (!isPlainObject(value)) return false;
        if (!Array.isArray(value.periods) || !validateHefseks(value.hefseks) || !validateDaily(value.daily)) return false;
        if (value.tevilot !== undefined && (!isPlainObject(value.tevilot) || !Object.entries(value.tevilot).every(([date, enabled]) => isValidDateString(date) && enabled === true))) return false;
        if (!isPlainObject(value.settings)) return false;
        if (!['ashkenaz', 'sepharad', 'chabad'].includes(value.settings.minhag)) return false;
        if (!Number.isFinite(Number(value.settings.cycle)) || Number(value.settings.cycle) < 1 || Number(value.settings.cycle) > 120) return false;
        if (value.settings.pinHash !== null && (typeof value.settings.pinHash !== 'string' || !/^[a-f0-9]{64}$/i.test(value.settings.pinHash))) return false;
        if (!['dark', 'light'].includes(value.settings.theme)) return false;
        const cityIds = ["beit-shemesh","jerusalem","bnei-brak","tel-aviv","haifa","ashdod","ashkelon","netanya","petah-tikva","modiin","other"];
        if (value.settings.cityId !== undefined && value.settings.cityId !== null && !cityIds.includes(value.settings.cityId)) return false;
        if (value.hefsekMeta !== undefined) {
            if (!isPlainObject(value.hefsekMeta)) return false;
            for (const [date, meta] of Object.entries(value.hefsekMeta)) {
                if (!isValidDateString(date) || !isPlainObject(meta)) return false;
                if (meta.eventTime !== undefined && meta.eventTime !== null && (typeof meta.eventTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(meta.eventTime))) return false;
                if (meta.cityId !== undefined && meta.cityId !== null && !cityIds.includes(meta.cityId)) return false;
                if (meta.sunsetRelation !== undefined && !['before', 'after', 'unknown'].includes(meta.sunsetRelation)) return false;
            }
        }

        const checklistIds = ['body-prep', 'hair', 'nails', 'barriers', 'clothing', 'towel', 'schedule', 'personal'];
        const toolTypes = ['opk_positive', 'bbt_shift', 'ultrasound', 'estimate', 'other'];
        const validTime = time => typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
        if (value.manualReminders !== undefined) {
            if (!Array.isArray(value.manualReminders) || value.manualReminders.length > 500) return false;
            const ids = new Set();
            for (const item of value.manualReminders) {
                if (!isPlainObject(item) || typeof item.id !== 'string' || ids.has(item.id) || !isValidDateString(item.date)) return false;
                ids.add(item.id);
                if (typeof item.title !== 'string' || !item.title.trim() || item.title.length > 120) return false;
                if (item.time !== undefined && item.time !== null && !validTime(item.time)) return false;
                if (item.notes !== undefined && (typeof item.notes !== 'string' || item.notes.length > 500)) return false;
            }
        }
        if (value.stainReports !== undefined) {
            if (!Array.isArray(value.stainReports) || value.stainReports.length > 500) return false;
            const ids = new Set();
            for (const item of value.stainReports) {
                if (!isPlainObject(item) || typeof item.id !== 'string' || ids.has(item.id) || !isValidDateString(item.date)) return false;
                ids.add(item.id);
                if (item.time !== undefined && item.time !== null && !validTime(item.time)) return false;
                if (!['red', 'pink', 'brown', 'yellow', 'clear', 'other', 'unknown'].includes(item.color)) return false;
                if (!['small', 'medium', 'large', 'multiple', 'unknown'].includes(item.size)) return false;
                if (!['white_underwear', 'colored_underwear', 'sheet', 'tissue', 'pad', 'bedikah_cloth', 'other', 'unknown'].includes(item.surface)) return false;
                if (!['unknown', 'external', 'medical', 'other'].includes(item.source)) return false;
                if (item.note !== undefined && (typeof item.note !== 'string' || item.note.length > 1000)) return false;
            }
        }
        if (value.mikvehChecklist !== undefined) {
            if (!isPlainObject(value.mikvehChecklist)) return false;
            for (const [date, checked] of Object.entries(value.mikvehChecklist)) {
                if (!isValidDateString(date) || !Array.isArray(checked) || checked.some(id => !checklistIds.includes(id)) || new Set(checked).size !== checked.length) return false;
            }
        }
        if (value.ovulationObservations !== undefined) {
            if (!Array.isArray(value.ovulationObservations) || value.ovulationObservations.length > 500) return false;
            const ids = new Set();
            for (const item of value.ovulationObservations) {
                if (!isPlainObject(item) || typeof item.id !== 'string' || ids.has(item.id) || !isValidDateString(item.date) || !toolTypes.includes(item.type)) return false;
                ids.add(item.id);
                if (item.time !== undefined && item.time !== null && !validTime(item.time)) return false;
                if (item.immersionDate !== undefined && item.immersionDate !== null && !isValidDateString(item.immersionDate)) return false;
                if (item.note !== undefined && (typeof item.note !== 'string' || item.note.length > 500)) return false;
            }
        }

        const seenDates = new Set();
        for (const period of value.periods) {
            if (!isPlainObject(period)) return false;
            if (!isValidDateString(period.date)) return false;
            if (!['veset', 'spotting'].includes(period.type)) return false;
            if (typeof period.isSunset !== 'boolean') return false;
            if (period.id !== undefined && typeof period.id !== 'string') return false;
            if (period.eventTime !== undefined && period.eventTime !== null && (typeof period.eventTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(period.eventTime))) return false;
            if (period.cityId !== undefined && period.cityId !== null && !cityIds.includes(period.cityId)) return false;
            if (period.sunsetRelation !== undefined && !['before', 'after', 'unknown'].includes(period.sunsetRelation)) return false;
            if (seenDates.has(period.date)) return false;
            seenDates.add(period.date);
        }
        return true;
    }

    let recoveryRequired = false;
    const originalGetItem = Storage.prototype.getItem;
    const originalSetItem = Storage.prototype.setItem;
    const originalRemoveItem = Storage.prototype.removeItem;

    Storage.prototype.getItem = function(key) {
        const raw = originalGetItem.call(this, key);
        if (key !== STORAGE_KEY || raw === null) return raw;
        try {
            const parsed = JSON.parse(raw);
            if (validateState(parsed)) return raw;
        } catch (_) {
            // Preserve malformed data below instead of silently treating it as empty.
        }
        recoveryRequired = true;
        window.__cycleflowRecoveryRequired = true;
        try {
            if (originalGetItem.call(this, RECOVERY_KEY) === null) {
                originalSetItem.call(this, RECOVERY_KEY, raw);
            }
            window.dispatchEvent(new CustomEvent('cycleflow:state-recovery-needed'));
        } catch (recoveryError) {
            console.error('CycleFlow could not preserve an invalid local state.', recoveryError);
        }
        return null;
    };

    Storage.prototype.setItem = function(key, value) {
        if (key === STORAGE_KEY) {
            if (recoveryRequired || originalGetItem.call(this, RECOVERY_KEY) !== null) {
                window.dispatchEvent(new CustomEvent('cycleflow:state-write-blocked'));
                throw new Error('Existing CycleFlow data requires recovery before overwrite');
            }
            try {
                const parsed = JSON.parse(value);
                if (!validateState(parsed)) {
                    window.dispatchEvent(new CustomEvent('cycleflow:storage-rejected'));
                    throw new Error('Invalid CycleFlow state');
                }
            } catch (error) {
                window.dispatchEvent(new CustomEvent('cycleflow:storage-error', { detail: error }));
                throw error;
            }
        }
        return originalSetItem.call(this, key, value);
    };

    Storage.prototype.removeItem = function(key) {
        const result = originalRemoveItem.call(this, key);
        if (key === RECOVERY_KEY) {
            recoveryRequired = false;
            window.__cycleflowRecoveryRequired = false;
        }
        return result;
    };

    let pinAttempts = 0;
    let lockedUntil = 0;
    let pinHandlerInstalled = false;

    async function verifyPinLocally(input) {
        const storedHash = (() => {
            try {
                const raw = originalGetItem.call(localStorage, STORAGE_KEY);
                if (!raw) return null;
                const state = JSON.parse(raw);
                return validateState(state) ? state.settings.pinHash : null;
            } catch (_) {
                return null;
            }
        })();
        if (!storedHash) return true;
        const data = new TextEncoder().encode(input);
        const digest = await crypto.subtle.digest('SHA-256', data);
        const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
        return hash === storedHash;
    }

    function installPinThrottle() {
        if (pinHandlerInstalled) return;
        const input = document.getElementById('pin_input');
        if (!input) return;
        pinHandlerInstalled = true;
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('spellcheck', 'false');

        // Capture phase prevents the duplicate async PIN listener in app.js from racing this handler.
        input.addEventListener('input', async (event) => {
            const now = Date.now();
            if (now < lockedUntil) {
                event.stopImmediatePropagation();
                input.value = '';
                return;
            }
            if (input.value.length !== 4) return;

            event.stopImmediatePropagation();
            const candidate = input.value;
            const valid = await verifyPinLocally(candidate);
            if (valid) {
                pinAttempts = 0;
                document.getElementById('lock_screen')?.classList.add('hidden');
                input.value = '';
                return;
            }

            pinAttempts += 1;
            input.value = '';
            window.dispatchEvent(new CustomEvent('cycleflow:pin-failed', { detail: { attempts: pinAttempts } }));
            if (pinAttempts >= MAX_PIN_ATTEMPTS) {
                pinAttempts = 0;
                lockedUntil = Date.now() + LOCKOUT_MS;
                input.disabled = true;
                setTimeout(() => {
                    lockedUntil = 0;
                    input.disabled = false;
                    input.focus();
                }, LOCKOUT_MS);
            }
        }, true);
    }

    window.addEventListener('cycleflow:storage-error', () => {
        console.warn('CycleFlow storage rejected invalid/corrupt state.');
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', installPinThrottle, { once: true });
    } else {
        installPinThrottle();
    }
})();
