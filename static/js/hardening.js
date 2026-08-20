/* CycleFlow client hardening. Must load before app.js. */
(() => {
    'use strict';

    const STORAGE_KEY = 'cycleflow_v61_python_pro';
    const MAX_PIN_ATTEMPTS = 5;
    const LOCKOUT_MS = 30_000;

    function isValidDateString(value) {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const d = new Date(`${value}T00:00:00`);
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
        if (!isPlainObject(value.settings)) return false;
        if (!['ashkenaz', 'sepharad', 'chabad'].includes(value.settings.minhag)) return false;
        if (!Number.isFinite(Number(value.settings.cycle)) || Number(value.settings.cycle) < 1 || Number(value.settings.cycle) > 120) return false;
        if (value.settings.pinHash !== null && (typeof value.settings.pinHash !== 'string' || !/^[a-f0-9]{64}$/i.test(value.settings.pinHash))) return false;
        if (!['dark', 'light'].includes(value.settings.theme)) return false;

        const seenDates = new Set();
        for (const period of value.periods) {
            if (!isPlainObject(period)) return false;
            if (!isValidDateString(period.date)) return false;
            if (!['veset', 'spotting'].includes(period.type)) return false;
            if (typeof period.isSunset !== 'boolean') return false;
            if (period.id !== undefined && typeof period.id !== 'string') return false;
            if (seenDates.has(period.date)) return false;
            seenDates.add(period.date);
        }
        return true;
    }

    const originalGetItem = Storage.prototype.getItem;
    const originalSetItem = Storage.prototype.setItem;

    Storage.prototype.getItem = function(key) {
        const raw = originalGetItem.call(this, key);
        if (key !== STORAGE_KEY || raw === null) return raw;
        try {
            const parsed = JSON.parse(raw);
            return validateState(parsed) ? raw : null;
        } catch (_) {
            return null;
        }
    };

    Storage.prototype.setItem = function(key, value) {
        if (key === STORAGE_KEY) {
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
