/* CycleFlow client hardening. Must load before app.js. */
(() => {
    'use strict';

    const STORAGE_KEY = 'cycleflow_v61_python_pro';
    const MAX_PIN_ATTEMPTS = 5;
    const LOCKOUT_MS = 30_000;

    function isValidDateString(value) {
        return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
    }

    function validateState(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
        if (!Array.isArray(value.periods)) return false;
        if (!value.hefseks || typeof value.hefseks !== 'object') return false;
        if (!value.daily || typeof value.daily !== 'object') return false;
        if (!value.settings || typeof value.settings !== 'object') return false;
        if (!['ashkenaz', 'sepharad', 'chabad'].includes(value.settings.minhag)) return false;
        if (!Number.isFinite(Number(value.settings.cycle)) || Number(value.settings.cycle) < 1 || Number(value.settings.cycle) > 120) return false;
        if (value.settings.pinHash !== null && typeof value.settings.pinHash !== 'string') return false;

        return value.periods.every((period) => (
            period && typeof period === 'object' &&
            isValidDateString(period.date) &&
            ['veset', 'spotting'].includes(period.type) &&
            typeof period.isSunset === 'boolean'
        ));
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

    function installPinThrottle() {
        const input = document.getElementById('pin_input');
        if (!input) return;
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('spellcheck', 'false');

        input.addEventListener('input', () => {
            const now = Date.now();
            if (now < lockedUntil) {
                input.value = '';
                return;
            }
            if (input.value.length !== 4) return;

            setTimeout(() => {
                const lockScreen = document.getElementById('lock_screen');
                const stillLocked = lockScreen && !lockScreen.classList.contains('hidden');
                if (stillLocked) {
                    pinAttempts += 1;
                    input.value = '';
                    if (pinAttempts >= MAX_PIN_ATTEMPTS) {
                        lockedUntil = Date.now() + LOCKOUT_MS;
                        pinAttempts = 0;
                        input.disabled = true;
                        setTimeout(() => {
                            input.disabled = false;
                            input.focus();
                        }, LOCKOUT_MS);
                    }
                } else {
                    pinAttempts = 0;
                }
            }, 0);
        }, { passive: true });
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
