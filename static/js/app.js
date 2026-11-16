/**
 * CycleFlow Pro - Clean Architecture
 */

const STORAGE_KEY = 'cycleflow_v61_python_pro';
const CalendarServices = window.CycleFlowCalendar || null;
const LocalTools = window.CycleFlowTools || null;

const Utils = {
    fmt: (d) => {
        const offset = d.getTimezoneOffset() * 60000;
        return (new Date(d - offset)).toISOString().split('T')[0];
    },
    newDate: (s) => new Date(s + 'T00:00:00'),
    diffDays: (d1, d2) => Math.floor((d1.getTime() - d2.getTime()) / 86400000),
    addDays: (d, n) => { 
        const r = new Date(d.getTime()); 
        r.setDate(r.getDate() + n); 
        return r; 
    },
    prettyDate: (d) => d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' }),
    chronologicalPeriods: (periods) => [...periods].sort((a, b) => a.date.localeCompare(b.date) || String(a.id || '').localeCompare(String(b.id || ''))),
    chronologicalVesets: (periods) => [...periods].filter(p => p.type === 'veset').sort((a, b) => a.date.localeCompare(b.date) || String(a.id || '').localeCompare(String(b.id || '')))
};

const todayCivilDate = (now = new Date()) => CalendarServices && CalendarServices.getIsraelCivilDate
    ? CalendarServices.getIsraelCivilDate(now)
    : Utils.fmt(now);

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function downloadLocalFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const SecurityService = {
    async hashPin(pin) {
        const encoder = new TextEncoder();
        const data = encoder.encode(pin);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },
    async verifyPin(inputPin, storedHash) {
        if (!storedHash) return true;
        const inputHash = await this.hashPin(inputPin);
        return inputHash === storedHash;
    }
};

const CryptoService = {
    async deriveKey(passphrase, salt) {
        const enc = new TextEncoder();
        const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
            baseKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    },
    async encrypt(plainObj, passphrase) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await this.deriveKey(passphrase, salt);
        const enc = new TextEncoder();
        const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(plainObj)));
        const combined = new Uint8Array(salt.length + iv.length + cipherBuf.byteLength);
        combined.set(salt, 0);
        combined.set(iv, salt.length);
        combined.set(new Uint8Array(cipherBuf), salt.length + iv.length);
        return btoa(String.fromCharCode(...combined));
    },
    async decrypt(base64Str, passphrase) {
        const combined = Uint8Array.from(atob(base64Str), c => c.charCodeAt(0));
        if (combined.length < 29) throw new Error('קובץ גיבוי לא תקין');
        const salt = combined.slice(0, 16);
        const iv = combined.slice(16, 28);
        const cipherBuf = combined.slice(28);
        const key = await this.deriveKey(passphrase, salt);
        const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBuf);
        return JSON.parse(new TextDecoder().decode(plainBuf));
    }
};

const StorageService = {
    load() { try { const data = localStorage.getItem(STORAGE_KEY); return data ? JSON.parse(data) : null; } catch (e) { return null; } },
    save(state) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            return true;
        } catch (error) {
            window.dispatchEvent(new CustomEvent('cycleflow:persistence-error', {
                detail: { name: error && error.name ? error.name : 'StorageError' }
            }));
            return false;
        }
    },
    async export(state, passphrase) {
        const str = await CryptoService.encrypt(state, passphrase);
        const blob = new Blob([str], {type: 'text/plain'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `cycleflow_backup_${Utils.fmt(new Date())}.enc`;
        a.click();
    },
    async import(file, passphrase) {
        const raw = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = () => reject(new Error('שגיאה בקריאת הקובץ'));
            reader.readAsText(file);
        });
        try {
            return await CryptoService.decrypt(raw, passphrase);
        } catch (err) {
            throw new Error('סיסמה שגויה או קובץ פגום');
        }
    },
    clear() { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem('cycleflow_recovery_v1'); }
};

const defaultState = { periods: [], hefseks: {}, hefsekMeta: {}, tevilot: {}, daily: {}, manualReminders: [], stainReports: [], mikvehChecklist: {}, ovulationObservations: [], settings: { minhag: 'ashkenaz', cycle: 28, pinHash: null, theme: 'dark', cityId: null } };

class StateManager {
    constructor() { this.state = StorageService.load() || defaultState; this.listeners = []; }
    subscribe(listener) { this.listeners.push(listener); }
    notify() {
        if (!StorageService.save(this.state)) return false;
        this.listeners.forEach(listener => listener(this.state));
        return true;
    }
    get() { return this.state; }
    update(updater) {
        const previous = JSON.parse(JSON.stringify(this.state));
        updater(this.state);
        if (!this.notify()) {
            this.state = previous;
            this.listeners.forEach(listener => listener(this.state));
            return false;
        }
        return true;
    }
}
const State = new StateManager();

const HalachaLogic = {
    getStatus(date) {
        const state = State.get();
        const dStr = Utils.fmt(date);
        const eventCalculationDate = record => {
            const info = CalendarServices && CalendarServices.getEventDateInfo
                ? CalendarServices.getEventDateInfo(record, state.settings.cityId)
                : null;
            return info && info.effectiveDate ? info.effectiveDate : record.date;
        };
        let res = { type: 'regular', text: 'אין דיווח פעיל', color: 'var(--text-muted)', bg: 'rgba(148, 163, 184, 0.08)', canHefsek: false };
        // Calendar cells represent the Hebrew date associated with the civil date at daytime.
        // An onset recorded after sunset belongs to the next Hebrew date.
        const periods = Utils.chronologicalVesets(state.periods)
            .filter(p => eventCalculationDate(p) <= dStr)
            .sort((a, b) => eventCalculationDate(a).localeCompare(eventCalculationDate(b)) || String(a.id || '').localeCompare(String(b.id || '')));
        const lastP = periods[periods.length - 1];
        if (!lastP) return { ...res, text: 'אין מספיק נתונים' };

        const pDate = Utils.newDate(eventCalculationDate(lastP));
        const daysDiff = Utils.diffDays(date, pDate);
        if (dStr === lastP.date) return { type: 'nidda', text: 'וסת (יום 1)', color: 'var(--st-nidda)', bg: 'rgba(239, 68, 68, 0.1)', canHefsek: false };

        const minWait = state.settings.minhag === 'sepharad' ? 4 : 5;
        let hefsekDate = null;
        let temp = new Date(pDate.getTime());
        while (temp <= date) {
            const key = Utils.fmt(temp);
            const meta = (state.hefsekMeta || {})[key] || {};
            const relation = CalendarServices && CalendarServices.resolveEventRelation
                ? CalendarServices.resolveEventRelation({ date: key, ...meta }, meta.cityId || state.settings.cityId)
                : 'unknown';
            // A hefsek explicitly recorded after sunset is not silently accepted as a
            // before-sunset hefsek. It remains in history for review.
            if (state.hefseks[key] && relation !== 'after') hefsekDate = new Date(temp.getTime());
            temp.setDate(temp.getDate() + 1);
        }

        if (hefsekDate) {
            const cleanDay = Utils.diffDays(date, hefsekDate);
            if (cleanDay === 0) return { type: 'hefsek', text: 'יום הפסק', color: 'var(--st-hefsek)', bg: 'rgba(245, 158, 11, 0.1)', canHefsek: false };
            if (cleanDay >= 1 && cleanDay <= 7) return { type: 'naki', text: `נקיים: יום ${cleanDay}`, color: 'var(--st-naki)', bg: 'rgba(16, 185, 129, 0.1)', cleanCount: cleanDay, canHefsek: false };

            const expectedTevilaDate = Utils.fmt(Utils.addDays(hefsekDate, 8));
            const reportedTevilaDate = Object.keys(state.tevilot || {})
                .filter(recordedDate => recordedDate >= expectedTevilaDate && recordedDate <= dStr)
                .sort()
                .pop() || null;
            const tevilaReported = Boolean(reportedTevilaDate);
            if (cleanDay === 8) {
                return {
                    type: tevilaReported ? 'tevila-done' : 'tevila',
                    text: tevilaReported ? 'טבילה סומנה' : 'ליל טבילה משוער – יש לסמן ביצוע',
                    color: 'var(--st-tevila)', bg: 'rgba(14, 165, 233, 0.1)',
                    expectedTevilaDate, reportedTevilaDate, canHefsek: false
                };
            }
            if (cleanDay > 8 && !tevilaReported) {
                const onah30 = dStr === Utils.fmt(Utils.addDays(pDate, 29));
                const onah31 = dStr === Utils.fmt(Utils.addDays(pDate, 30));
                if (onah30 || onah31) {
                    const dayNumber = onah30 ? 30 : 31;
                    return {
                        type: 'onah',
                        text: `עונה בינונית (${dayNumber}) · טרם סומנה טבילה`,
                        color: 'var(--st-onah)', bg: 'rgba(167, 139, 250, 0.1)',
                        expectedTevilaDate, reportedTevilaDate, canHefsek: false
                    };
                }
                return { type: 'pending-tevila', text: 'טרם סומנה טבילה', color: 'var(--warning)', bg: 'rgba(245, 158, 11, 0.1)', expectedTevilaDate, reportedTevilaDate, canHefsek: false };
            }
            if (cleanDay > 8 && tevilaReported) res = { ...res, text: 'לאחר טבילה מדווחת', expectedTevilaDate, reportedTevilaDate };
        } else {
            if (daysDiff < minWait) return { type: 'nidda', text: `נידה (יום ${daysDiff + 1})`, color: 'var(--st-nidda)', bg: 'rgba(239, 68, 68, 0.1)', canHefsek: false };
            return { type: 'nidda', text: 'נידה - ממתינה להפסק', color: 'var(--st-nidda)', bg: 'rgba(239, 68, 68, 0.1)', canHefsek: true };
        }

        const beinonit30 = Utils.addDays(pDate, 29);
        const beinonit31 = Utils.addDays(pDate, 30);
        if (dStr === Utils.fmt(beinonit30)) return { type: 'onah', text: 'עונה בינונית (30)', color: 'var(--st-onah)', bg: 'rgba(167, 139, 250, 0.1)', canHefsek: false, expectedTevilaDate: res.expectedTevilaDate, reportedTevilaDate: res.reportedTevilaDate };
        if (dStr === Utils.fmt(beinonit31)) return { type: 'onah', text: 'עונה בינונית (31)', color: 'var(--st-onah)', bg: 'rgba(167, 139, 250, 0.1)', canHefsek: false, expectedTevilaDate: res.expectedTevilaDate, reportedTevilaDate: res.reportedTevilaDate };
        return res;
    }
};

const FertilityLogic = {
    getAvgCycleLength() {
        const state = State.get();
        const periods = Utils.chronologicalVesets(state.periods);
        if (periods.length < 2) {
            const fixed = parseInt(state.settings.cycle, 10);
            return (fixed && fixed > 0) ? fixed : 28;
        }
        let sum = 0, count = 0;
        for (let i = 0; i < periods.length - 1; i++) {
            const diff = Utils.diffDays(Utils.newDate(periods[i+1].date), Utils.newDate(periods[i].date));
            if (diff > 10 && diff < 60) { sum += diff; count++; }
        }
        if (count === 0) return 28;
        return Math.round(sum / count);
    },

    getEstimate() {
        const state = State.get();
        const periods = Utils.chronologicalVesets(state.periods);
        const lastP = periods[periods.length - 1];
        if (!lastP) return null;

        const cycleLength = this.getAvgCycleLength();
        const lastDate = Utils.newDate(lastP.date);
        const nextPeriodEstimate = Utils.addDays(lastDate, cycleLength);
        const ovulationDate = Utils.addDays(nextPeriodEstimate, -14);
        const fertileStart = Utils.addDays(ovulationDate, -5);
        const fertileEnd = Utils.addDays(ovulationDate, 1);

        return { cycleLength, nextPeriodEstimate, ovulationDate, fertileStart, fertileEnd };
    },

    getFertility(date) {
        const est = this.getEstimate();
        if (!est) return { isFertile: false, isOvulation: false };
        const dStr = Utils.fmt(date);
        return {
            isFertile: dStr >= Utils.fmt(est.fertileStart) && dStr <= Utils.fmt(est.fertileEnd),
            isOvulation: dStr === Utils.fmt(est.ovulationDate)
        };
    }
};

const Calculator = {
    current: '0', prev: null, op: null, resetNext: false,
    reset() { this.current = '0'; this.prev = null; this.op = null; this.resetNext = false; this.render(); },
    render() { const el = document.getElementById('calc_display'); if (el) el.innerText = this.current; },
    compute() {
        const a = parseFloat(this.prev), b = parseFloat(this.current);
        if (isNaN(a) || isNaN(b)) return b;
        switch (this.op) {
            case '+': return a + b;
            case '-': return a - b;
            case '×': return a * b;
            case '÷': return b === 0 ? 0 : a / b;
            default: return b;
        }
    },
    press(key) {
        if (key === 'AC') { this.reset(); return; }
        if (key === '+/-') { this.current = (parseFloat(this.current) * -1).toString(); this.render(); return; }
        if (key === '%') { this.current = (parseFloat(this.current) / 100).toString(); this.render(); return; }
        if (['÷','×','-','+'].includes(key)) {
            if (this.prev !== null && !this.resetNext) { this.prev = this.compute().toString(); }
            else { this.prev = this.current; }
            this.op = key; this.resetNext = true; this.render(); return;
        }
        if (key === '=') {
            if (this.op && this.prev !== null) { this.current = this.compute().toString(); this.prev = null; this.op = null; }
            this.resetNext = true; this.render(); return;
        }
        if (key === '.') {
            if (this.resetNext) { this.current = '0.'; this.resetNext = false; this.render(); return; }
            if (!this.current.includes('.')) this.current += '.';
            this.render(); return;
        }
        if (this.resetNext || this.current === '0') { this.current = key; this.resetNext = false; }
        else { this.current += key; }
        this.render();
    }
};

const UI = {
    navDate: Utils.newDate(todayCivilDate()),
    selectedDate: null,
    chartInstance: null,

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.showRecoveryNotice();
        window.addEventListener('cycleflow:persistence-error', () => {
            // Let action handlers finish before displaying the failure toast.
            setTimeout(() => this.toast('השמירה נכשלה. אין לרענן לפני בדיקת שטח האחסון.', true), 0);
        });
        this.applyTheme(State.get().settings.theme || 'dark');
        document.getElementById('report_date').value = todayCivilDate();
        State.subscribe(() => this.renderCurrentView());
        this.switchTab('dashboard');
        this.checkSecurity();
    },

    applyTheme(theme) {
        document.body.classList.toggle('light-theme', theme === 'light');
        const icon = document.querySelector('#theme_toggle_btn i');
        if (icon) icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    },
    
    showRecoveryNotice() {
        if (localStorage.getItem('cycleflow_recovery_v1') === null && !window.__cycleflowRecoveryRequired) return;
        const notice = document.createElement('section');
        notice.className = 'card';
        notice.setAttribute('role', 'alert');
        const heading = document.createElement('h3');
        heading.textContent = 'נמצאו נתונים קיימים שדורשים שחזור';
        const message = document.createElement('p');
        message.className = 'text-muted';
        message.textContent = 'עותק של הנתונים המקוריים נשמר במכשיר. כדי למנוע דריסת מידע, שמירת שינויים הושהתה. אפשר להוריד עותק שחזור או לייבא גיבוי תקין.';
        const button = document.createElement('button');
        button.className = 'btn btn-outline';
        button.dataset.action = 'exportRecovery';
        button.textContent = 'הורדת עותק נתונים לשחזור';
        notice.append(heading, message, button);
        document.getElementById('main_content')?.prepend(notice);
    },

    cacheDOM() {
        this.views = document.querySelectorAll('.app-view');
        this.navItems = document.querySelectorAll('.nav-item');
        this.toastEl = document.getElementById('toast');
        this.toastMsg = document.getElementById('toast_msg');
    },
    
    bindEvents() {
        document.body.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            if (btn.matches('select[data-action], input[type="checkbox"][data-action]')) return;
            const action = btn.dataset.action;
            if (typeof this.actions[action] === 'function') this.actions[action].call(this, btn, e);
        });
        document.body.addEventListener('change', (e) => {
            const control = e.target.closest('[data-action]');
            if (!control) return;
            const action = control.dataset.action;
            if (action === 'saveSettings' && control.tagName === 'SELECT') {
                this.actions.saveSettings.call(this, control, e);
            } else if (action === 'saveDaily' && control.matches('input[type="checkbox"]')) {
                this.actions.saveDaily.call(this, control, e);
            }
        });
        
        document.getElementById('mikveh_checklist_date')?.addEventListener('change', () => this.renderTools());

        const acBtn = document.getElementById('calc_ac');
        if (acBtn) {
            let pressTimer = null;
            const startPress = () => { pressTimer = setTimeout(() => this.actions.closeFakeApp.call(this), 800); };
            const cancelPress = () => { clearTimeout(pressTimer); };
            acBtn.addEventListener('mousedown', startPress);
            acBtn.addEventListener('touchstart', startPress);
            acBtn.addEventListener('mouseup', cancelPress);
            acBtn.addEventListener('mouseleave', cancelPress);
            acBtn.addEventListener('touchend', cancelPress);
        }

        const pinInput = document.getElementById('pin_input');
        if(pinInput) {
            pinInput.addEventListener('input', async (e) => {
                const val = e.target.value;
                if (val.length === 4) {
                    const isValid = await SecurityService.verifyPin(val, State.get().settings.pinHash);
                    if (isValid) { document.getElementById('lock_screen').classList.add('hidden'); e.target.value = ''; } 
                    else { this.toast('קוד שגוי', true); e.target.value = ''; }
                }
            });
        }

        const importFile = document.getElementById('import_file');
        if(importFile) {
            importFile.addEventListener('change', async (e) => {
                if (!e.target.files[0]) return;
                const passphrase = prompt('הזיני את הסיסמה ששימשה ליצירת הגיבוי:');
                if (!passphrase) { importFile.value = ''; return; }
                try {
                    const data = await StorageService.import(e.target.files[0], passphrase);
                    if (!data || typeof data !== 'object' || !Array.isArray(data.periods)) {
                        throw new Error('מבנה הקובץ אינו תקין');
                    }
                    State.update(s => Object.assign(s, data));
                    this.toast('שחזור הושלם בהצלחה');
                    setTimeout(() => location.reload(), 1000);
                } catch (err) { this.toast(err.message, true); }
                importFile.value = '';
            });
        }

        const dailyNote = document.getElementById('daily_note');
        if (dailyNote) {
            let noteTimer = null;
            dailyNote.addEventListener('input', () => {
                clearTimeout(noteTimer);
                noteTimer = setTimeout(() => this.actions.saveDaily.call(this), 400);
            });
        }
    },
    
    checkSecurity() { 
        if (State.get().settings.pinHash) {
            document.getElementById('lock_screen').classList.remove('hidden'); 
        }
    },
    
    switchTab(tabId, triggerBtn = null) {
        this.views.forEach(v => v.classList.add('hidden'));
        document.getElementById('view_' + tabId).classList.remove('hidden');
        this.navItems.forEach(n => n.classList.remove('active'));
        if (triggerBtn) triggerBtn.classList.add('active');
        else document.querySelector(`[data-tab="${tabId}"]`)?.classList.add('active');
        this.currentTab = tabId;
        this.renderCurrentView();
    },
    
    renderCurrentView() {
        if (this.currentTab === 'dashboard') this.renderDashboard();
        if (this.currentTab === 'calendar') this.renderCalendar();
        if (this.currentTab === 'history') this.renderHistory();
        if (this.currentTab === 'tools') this.renderTools();
        
        const s = State.get().settings;
        document.getElementById('set_minhag').value = s.minhag;
        document.getElementById('set_cycle_len').value = s.cycle;
        const citySelect = document.getElementById('set_city');
        if (citySelect) citySelect.value = s.cityId || '';
        const sunsetHint = document.getElementById('sunset_hint');
        if (sunsetHint) {
            const sunset = CalendarServices && s.cityId ? CalendarServices.getSunset(todayCivilDate(), s.cityId) : null;
            sunsetHint.textContent = sunset ? `שקיעה משוערת היום: ${sunset.time} (${sunset.timeZone}). החישוב אסטרונומי משוער בלבד.` : 'בחרי יישוב כדי להציג שעת שקיעה משוערת. אין שימוש במיקום GPS.';
        }
    },
    
    renderTools() {
        if (!LocalTools) return;
        const state = State.get();
        const today = todayCivilDate();
        const setDefault = (id, value) => {
            const input = document.getElementById(id);
            if (input && !input.value) input.value = value;
        };
        ['reminder_date', 'stain_date', 'mikveh_checklist_date', 'ovulation_date'].forEach(id => setDefault(id, today));
        setDefault('doctor_to', today);
        setDefault('doctor_from', Utils.fmt(Utils.addDays(new Date(), -180)));

        const reminders = [...(state.manualReminders || [])].sort((a, b) => a.date.localeCompare(b.date) || String(a.time || '').localeCompare(String(b.time || '')));
        const reminderList = document.getElementById('reminders_list');
        reminderList.innerHTML = reminders.length ? reminders.map(item => `
            <div class="tool-list-row"><div><strong>${escapeHTML(item.title)}</strong><div class="text-muted small-note">${item.date} · ${item.time || 'כל היום'}</div></div>
            <button class="btn btn-outline" data-action="deleteReminder" data-id="${escapeHTML(item.id)}">מחיקה</button></div>`).join('') : '<p class="text-muted small-note">אין עדיין תזכורות שמורות.</p>';

        const stains = [...(state.stainReports || [])].sort((a, b) => b.date.localeCompare(a.date));
        document.getElementById('stain_reports_list').innerHTML = stains.length ? stains.map(item => {
            const color = LocalTools.STAIN_LABELS.color[item.color] || 'לא ידוע';
            const size = LocalTools.STAIN_LABELS.size[item.size] || 'לא ידוע';
            return `<div class="tool-list-row"><div><strong>${item.date} · ${escapeHTML(color)}</strong><div class="text-muted small-note">${escapeHTML(size)} · ${escapeHTML(LocalTools.STAIN_LABELS.surface[item.surface] || 'לא ידוע')}</div></div>
            <div class="flex gap-10"><button class="btn btn-outline" data-action="copyStainSummary" data-id="${escapeHTML(item.id)}">העתקה</button><button class="btn btn-outline" data-action="downloadStainSummary" data-id="${escapeHTML(item.id)}">הורדה</button><button class="btn btn-outline" data-action="deleteStainReport" data-id="${escapeHTML(item.id)}">מחיקה</button></div></div>`;
        }).join('') : '<p class="text-muted small-note">אין עדיין תיאורי כתמים שמורים.</p>';

        const checklistDate = document.getElementById('mikveh_checklist_date').value || today;
        const checked = (state.mikvehChecklist || {})[checklistDate] || [];
        const checklistContainer = document.getElementById('mikveh_checklist_items');
        checklistContainer.innerHTML = LocalTools.CHECKLIST_ITEMS.map(item => `
            <label><input type="checkbox" data-action="toggleMikvehChecklist" data-item="${item.id}" data-date="${escapeHTML(checklistDate)}" ${checked.includes(item.id) ? 'checked' : ''}><span>${escapeHTML(item.label)}</span></label>`).join('');
        checklistContainer.querySelectorAll('input[data-action="toggleMikvehChecklist"]').forEach(input => {
            input.addEventListener('change', e => this.actions.toggleMikvehChecklist.call(this, input, e));
        });

        const observations = [...(state.ovulationObservations || [])].sort((a, b) => b.date.localeCompare(a.date));
        const indicator = document.getElementById('ovulation_indicator');
        indicator.textContent = observations.length ? LocalTools.earlyOvulationIndicator(observations[0]) : 'אין עדיין תיעוד ביוץ.';
        document.getElementById('ovulation_list').innerHTML = observations.length ? observations.map(item => `
            <div class="tool-list-row"><div><strong>${item.date}${item.time ? ' · ' + item.time : ''}</strong><div class="text-muted small-note">${escapeHTML(LocalTools.OVULATION_LABELS[item.type] || item.type)} · ${escapeHTML(LocalTools.earlyOvulationIndicator(item))}</div></div><button class="btn btn-outline" data-action="deleteOvulationObservation" data-id="${escapeHTML(item.id)}">מחיקה</button></div>`).join('') : '<p class="text-muted small-note">אין עדיין תיעודי ביוץ.</p>';
    },

    renderDashboard() {
        const today = new Date();
        const st = HalachaLogic.getStatus(today);
        const state = State.get();
        const card = document.getElementById('status_card');
        const badge = document.getElementById('status_badge');
        
        badge.innerText = st.text; 
        badge.style.color = st.color; 
        
        const cdContainer = document.getElementById('clean_days_container');
        if (st.type === 'naki' || st.type === 'hefsek' || st.type === 'tevila' || st.type === 'tevila-done') {
            cdContainer.classList.remove('hidden');
            let html = '';
            const currentCount = st.type === 'hefsek' ? 0 : ((st.type === 'tevila' || st.type === 'tevila-done') ? 8 : st.cleanCount);
            for(let i=1; i<=7; i++) {
                let cls = 'cd-step' + (i < currentCount ? ' passed' : '') + (i === currentCount ? ' active' : '');
                html += `<div class="${cls}">${i}</div>`;
            }
            cdContainer.innerHTML = html;
        } else {
            cdContainer.classList.add('hidden');
        }

        const vesets = Utils.chronologicalVesets(state.periods);
        const last = vesets[vesets.length - 1];
        if (last) {
            const diff = Utils.diffDays(today, Utils.newDate(last.date)) + 1;
            document.getElementById('main_counter').innerText = diff;
            
            card.className = "card status-hero";
            if (st.type === 'nidda') card.classList.add('nidda');
            if (st.type === 'naki' || st.type === 'tevila' || st.type === 'tevila-done') card.classList.add('pure');
            if (st.type === 'pending-tevila') card.classList.add('pending');
            
            const lastDate = Utils.newDate(last.date);
            const fert = FertilityLogic.getEstimate();
            let fertHtml = '';
            if (fert) {
                const daysToNext = Utils.diffDays(fert.nextPeriodEstimate, today);
                const nextLabel = daysToNext > 0 ? `בעוד ${daysToNext} ימים` : (daysToNext === 0 ? 'היום' : 'צפויה כעת');
                fertHtml = `
                <div class="flex-between" style="padding:12px 0; border-bottom:1px solid var(--border-light)">
                    <span>וסת הבאה (משוער)</span><span style="color:var(--st-nidda); font-weight:600;">${Utils.prettyDate(fert.nextPeriodEstimate)} · ${nextLabel}</span>
                </div>
                <div class="flex-between" style="padding:12px 0; border-bottom:1px solid var(--border-light)">
                    <span>ביוץ משוער</span><span style="color:#f472b6; font-weight:600;">${Utils.prettyDate(fert.ovulationDate)}</span>
                </div>
                <div class="flex-between" style="padding:12px 0; border-bottom:1px solid var(--border-light)">
                    <span>חלון פוריות משוער</span><span style="color:#f472b6; font-weight:600;">${Utils.prettyDate(fert.fertileStart)} - ${Utils.prettyDate(fert.fertileEnd)}</span>
                </div>`;
            }
            document.getElementById('future_list').innerHTML = `
                ${fertHtml}
                <div class="flex-between" style="padding:12px 0; border-bottom:1px solid var(--border-light)">
                    <span>עונה בינונית (30)</span><span style="color:var(--st-onah); font-weight:600;">${Utils.prettyDate(Utils.addDays(lastDate, 29))}</span>
                </div>
                <div class="flex-between" style="padding:12px 0;">
                    <span>עונה בינונית (31)</span><span style="color:var(--st-onah); font-weight:600;">${Utils.prettyDate(Utils.addDays(lastDate, 30))}</span>
                </div>
                ${fert ? '<div style="font-size:0.75rem; color:var(--text-muted); margin-top:10px; line-height:1.4;">* הערכה סטטיסטית בלבד (שיטת לוח שנה) המבוססת על ' + fert.cycleLength + ' ימי מחזור ממוצע. אינה תחליף לבדיקה רפואית או אמצעי מניעה מדויק.</div>' : ''}`;
        }
    },
    
    renderCalendar() {
        const grid = document.getElementById('cal_grid');
        grid.innerHTML = '';
        const y = this.navDate.getFullYear(); 
        const m = this.navDate.getMonth();
        
        document.getElementById('cal_month_title').innerText = this.navDate.toLocaleDateString('he-IL', { month: 'long' });
        const hebrewMonth = CalendarServices ? CalendarServices.formatHebrewMonth(new Date(y, m, 15)) : '';
        document.getElementById('cal_year_subtitle').innerText = hebrewMonth ? `${y} · ${hebrewMonth}` : y;
        
        const firstDay = new Date(y, m, 1).getDay();
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const todayStr = todayCivilDate();

        for(let i=0; i<firstDay; i++) grid.innerHTML += '<div></div>';
        
        for(let i=1; i<=daysInMonth; i++) {
            const d = new Date(y, m, i); 
            const dStr = Utils.fmt(d); 
            const st = HalachaLogic.getStatus(d); 
            const fert = FertilityLogic.getFertility(d);
            const daily = State.get().daily[dStr];
            
            const div = document.createElement('div');
            div.className = 'cal-day ' + (dStr === todayStr ? 'today' : '') + (fert.isFertile ? ' fertile-day' : '');
            div.addEventListener('click', () => this.openDayPanel(d, st));
            
            let badgeHtml = '';
            if (st.type !== 'regular') {
                const colorMap = { 'nidda': 'b-nidda', 'hefsek': 'b-hefsek', 'naki': 'b-naki', 'tevila': 'b-tevila', 'tevila-done': 'b-naki', 'pending-tevila': 'b-pending', 'onah': 'b-onah' };
                badgeHtml = `<div class="day-badge ${colorMap[st.type]}">${st.text}</div>`;
            } else if (fert.isOvulation) {
                badgeHtml = `<div class="day-badge b-fertile">ביוץ משוער</div>`;
            } else if (fert.isFertile) {
                badgeHtml = `<div class="day-badge b-fertile">פורייה</div>`;
            }
            
            let dots = '';
            if (daily && (daily.checks?.morning || daily.checks?.sunset || daily.note)) {
                dots += `<div style="position:absolute; top:6px; left:6px; width:6px; height:6px; background-color:var(--accent); border-radius:50%"></div>`;
            }
            if (fert.isFertile) {
                dots += `<div style="position:absolute; top:6px; right:6px; width:6px; height:6px; background-color:#f472b6; border-radius:50%" title="ימי פוריות משוערים"></div>`;
            }
            const hebrewDate = CalendarServices ? CalendarServices.formatHebrewDate(d) : '';
            div.innerHTML = `${dots}<div class="day-num">${i}</div><div class="day-hebrew">${hebrewDate}</div>${badgeHtml}`;
            grid.appendChild(div);
        }
    },
    
    renderHistory() {
        const list = document.getElementById('history_list');
        list.replaceChildren();
        const periods = Utils.chronologicalPeriods(State.get().periods).reverse();

        periods.forEach(p => {
            const pid = p.id || p.date;
            const row = document.createElement('div');
            row.className = 'flex-between';
            row.style.cssText = 'padding:16px 0; border-bottom: 1px solid var(--border-light)';
            const eventInfo = CalendarServices ? CalendarServices.getEventDateInfo(p, State.get().settings.cityId) : { hebrewDate: '', relation: 'unknown', sunsetTime: null };
            const relationLabel = eventInfo.relation === 'after' ? 'אחרי שקיעה' : (eventInfo.relation === 'before' ? 'לפני שקיעה' : 'זמן ביחס לשקיעה לא ידוע');
            row.innerHTML = `
                <div>
                    <div class="font-bold text-main">${Utils.prettyDate(Utils.newDate(p.date))}</div>
                    ${eventInfo.hebrewDate ? `<div class="text-sm text-muted">${eventInfo.hebrewDate}</div>` : ''}
                    <div class="text-sm text-muted" style="font-size:0.85rem">${p.eventTime ? `שעה ${p.eventTime} · ` : ''}${relationLabel}${eventInfo.sunsetTime ? ` · שקיעה משוערת ${eventInfo.sunsetTime}` : ''}</div>
                </div>
                <div class="flex" style="align-items:center; gap:12px;">
                    <div class="text-danger font-bold">${p.type === 'veset' ? 'וסת' : 'כתם'}</div>
                    <button data-action="deletePeriod" title="מחיקת רישום" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1rem;"><i class="fas fa-trash-alt"></i></button>
                </div>`;
            // Assign untrusted persisted identifiers through the DOM API, never HTML interpolation.
            row.querySelector('button[data-action="deletePeriod"]').dataset.id = String(pid);
            list.appendChild(row);
        });

        const vesets = Utils.chronologicalVesets(State.get().periods);
        if (vesets.length >= 2) {
            let sum = 0, min = 999, max = 0, count = 0;
            const chartData = [];

            for(let i=0; i<vesets.length-1; i++) {
                const diff = Utils.diffDays(Utils.newDate(vesets[i+1].date), Utils.newDate(vesets[i].date));
                if (diff > 0 && diff < 100) {
                    sum += diff;
                    if(diff < min) min = diff;
                    if(diff > max) max = diff;
                    count++;
                    chartData.push(diff);
                }
            }
            if (count > 0) {
                const avg = Math.round(sum/count);
                document.getElementById('stat_avg').innerText = avg;
                document.getElementById('stat_min').innerText = min;
                document.getElementById('stat_max').innerText = max;

                this.renderChart(chartData);
            }
        }
    },

    renderChart(dataPoints) {
        const container = document.querySelector('.chart-container');
        if (!container || !Array.isArray(dataPoints) || !dataPoints.length) return;
        const width = 640, height = 220, pad = 28;
        const min = Math.min(...dataPoints), max = Math.max(...dataPoints);
        const range = Math.max(1, max - min);
        const points = dataPoints.map((value, index) => {
            const x = pad + (dataPoints.length === 1 ? 0 : index * (width - pad * 2) / (dataPoints.length - 1));
            const y = height - pad - ((value - min) / range) * (height - pad * 2);
            return { x, y, value };
        });
        const polyline = points.map(point => `${point.x},${point.y}`).join(' ');
        const circles = points.map(point => `<circle cx="${point.x}" cy="${point.y}" r="5" fill="#6366f1"><title>${point.value} ימים</title></circle>`).join('');
        const labels = points.map((point, index) => `<text x="${point.x}" y="${height - 5}" text-anchor="middle" font-size="11" fill="currentColor">${index + 1}</text>`).join('');
        container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="גרף אורכי מחזורים" style="width:100%;height:100%;overflow:visible"><line x1="${pad}" y1="${height-pad}" x2="${width-pad}" y2="${height-pad}" stroke="currentColor" opacity=".2"/><polyline points="${polyline}" fill="none" stroke="#6366f1" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${circles}${labels}</svg>`;
    },

    openDayPanel(date, st) {
        this.selectedDate = date;
        document.getElementById('day_panel').classList.add('open'); 
        document.getElementById('day_panel_overlay').style.display = 'block';
        document.getElementById('panel_date').innerText = Utils.prettyDate(date);
        
        const banner = document.getElementById('panel_status_banner');
        banner.innerText = st.text; 
        banner.style.color = st.color; 
        banner.style.backgroundColor = st.bg;
        
        const btnH = document.getElementById('btn_hefsek_panel');
        const btnU = document.getElementById('btn_undo_panel');
        const btnT = document.getElementById('btn_tevila_panel');
        btnH.classList.remove('hidden');
        btnU.classList.add('hidden');
        btnT.classList.add('hidden');
        if (st.type === 'hefsek') {
            btnH.classList.add('hidden');
            btnU.classList.remove('hidden');
        }
        btnH.disabled = (!st.canHefsek && st.type !== 'hefsek');
        btnH.style.opacity = btnH.disabled ? 0.4 : 1;
        if (st.expectedTevilaDate) {
            btnT.classList.remove('hidden');
            btnT.textContent = st.reportedTevilaDate ? `ביטול סימון טבילה (${st.reportedTevilaDate})` : 'סמני טבילה בוצעה';
        }
        
        const dStr = Utils.fmt(date); 
        const daily = State.get().daily[dStr] || { checks: {}, note: '' };
        
        document.getElementById('chk_morning').checked = daily.checks.morning || false;
        document.getElementById('chk_moch').checked = daily.checks.moch || false;
        document.getElementById('chk_sunset').checked = daily.checks.sunset || false;
        document.getElementById('daily_note').value = daily.note || '';
    },
    
    toast(msg, isError = false) {
        this.toastMsg.innerText = msg; 
        const icon = this.toastEl.querySelector('i');
        
        if(isError) {
            this.toastEl.style.borderBottomColor = 'var(--danger)';
            icon.className = 'fas fa-exclamation-circle text-danger';
        } else {
            this.toastEl.style.borderBottomColor = 'var(--success)';
            icon.className = 'fas fa-check-circle text-success';
        }
        
        this.toastEl.classList.add('show'); 
        setTimeout(() => this.toastEl.classList.remove('show'), 3000);
    },
    
    actions: {
        toggleTheme() {
            const current = State.get().settings.theme || 'dark';
            const next = current === 'light' ? 'dark' : 'light';
            State.update(s => { s.settings.theme = next; });
            this.applyTheme(next);
        },
        switchTab(btn) { this.switchTab(btn.dataset.tab, btn.classList.contains('nav-item') ? btn : null); },
        navMonth(btn) { this.navDate.setMonth(this.navDate.getMonth() + parseInt(btn.dataset.dir)); this.renderCalendar(); },
        closePanel() {
            this.actions.saveDaily.call(this);
            document.getElementById('day_panel').classList.remove('open');
            document.getElementById('day_panel_overlay').style.display = 'none';
            this.renderCalendar();
        },
        toggleDiscreet() { document.querySelectorAll('.blur-target').forEach(el => el.classList.toggle('discreet-blur')); },
        openFakeApp() {
            document.getElementById('fake_app').classList.remove('hidden');
            Calculator.reset();
        },
        closeFakeApp() { document.getElementById('fake_app').classList.add('hidden'); },
        calcInput(btn) { Calculator.press(btn.innerText.trim()); },
        reportPeriod() {
            const d = document.getElementById('report_date').value; 
            if (!d) return;

            const todayStr = todayCivilDate();
            if (d > todayStr) { this.toast('לא ניתן לדווח תאריך עתידי', true); return; }

            const state = State.get();
            if (state.periods.some(p => p.date === d)) { this.toast('כבר קיים דיווח לתאריך זה', true); return; }

            const eventTime = document.getElementById('report_time')?.value || null;
            const cityId = state.settings.cityId || null;
            const fallbackSunset = document.getElementById('chk_sunset_report').checked;
            const relationInput = { date: d, eventTime, cityId, isSunset: fallbackSunset ? true : undefined };
            const relation = CalendarServices ? CalendarServices.resolveEventRelation(relationInput, cityId) : (fallbackSunset ? 'after' : 'unknown');
            const effectiveDate = relation === 'after' && CalendarServices
                ? CalendarServices.addCivilDays(d, 1)
                : d;
            State.update(state => {
                state.periods.push({
                    id: Date.now().toString(36),
                    date: d,
                    eventTime,
                    cityId,
                    sunsetRelation: relation,
                    isSunset: relation === 'after' ? true : (relation === 'before' ? false : null),
                    type: document.getElementById('chk_spotting_report').checked ? 'spotting' : 'veset'
                });
                const cutoff = Utils.newDate(effectiveDate); 
                Object.keys(state.hefseks).forEach(k => {
                    if (Utils.newDate(k) >= cutoff) {
                        delete state.hefseks[k];
                        if (state.hefsekMeta) delete state.hefsekMeta[k];
                    }
                }); 
            });
            this.toast('וסת דווחה בהצלחה'); 
            this.switchTab('dashboard');
        },
        deletePeriod(btn) {
            const id = btn.dataset.id;
            if (!confirm('למחוק רישום זה? יש לוודא שמדובר בטעות הקלדה בלבד.')) return;
            State.update(s => { s.periods = s.periods.filter(p => (p.id || p.date) !== id); });
            this.toast('הרישום נמחק');
        },
        doHefsekDirect() { 
            const st = HalachaLogic.getStatus(new Date()); 
            if (st.canHefsek) {
                const now = new Date();
                const date = Utils.fmt(now);
                const eventTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
                const cityId = State.get().settings.cityId || null;
                const relation = CalendarServices ? CalendarServices.resolveEventRelation({ date, eventTime, cityId }, cityId) : 'unknown';
                State.update(s => { s.hefseks[date] = true; if (!s.hefsekMeta) s.hefsekMeta = {}; s.hefsekMeta[date] = { eventTime, cityId, sunsetRelation: relation }; });
                this.toast('הפסק טהרה נרשם'); 
            } else {
                this.toast('לא ניתן לבצע הפסק כרגע', true); 
            }
        },
        doHefsekPanel() { 
            if (!this.selectedDate) return; 
            const date = Utils.fmt(this.selectedDate);
            const eventTime = document.getElementById('hefsek_time')?.value || null;
            const cityId = State.get().settings.cityId || null;
            const relation = CalendarServices ? CalendarServices.resolveEventRelation({ date, eventTime, cityId }, cityId) : 'unknown';
            State.update(s => { s.hefseks[date] = true; if (!s.hefsekMeta) s.hefsekMeta = {}; s.hefsekMeta[date] = { eventTime, cityId, sunsetRelation: relation }; });
            this.actions.closePanel.call(this); 
        },
        undoHefsekPanel() {
            if (!this.selectedDate) return;
            State.update(s => { const date = Utils.fmt(this.selectedDate); delete s.hefseks[date]; if (s.hefsekMeta) delete s.hefsekMeta[date]; });
            this.actions.closePanel.call(this);
        },
        toggleTevilaPanel() {
            if (!this.selectedDate) return;
            const status = HalachaLogic.getStatus(this.selectedDate);
            if (!status.expectedTevilaDate) return;
            const recordedDate = status.reportedTevilaDate;
            State.update(s => {
                if (!s.tevilot) s.tevilot = {};
                if (recordedDate) delete s.tevilot[recordedDate];
                else s.tevilot[Utils.fmt(this.selectedDate)] = true;
            });
            this.actions.closePanel.call(this);
        },
        addReminder() {
            if (!LocalTools) return;
            const date = document.getElementById('reminder_date').value;
            const time = document.getElementById('reminder_time').value || null;
            const title = document.getElementById('reminder_title').value.trim();
            const notes = document.getElementById('reminder_notes').value.trim();
            if (!LocalTools.validDate(date) || !title) { this.toast('יש להזין תאריך וכותרת לתזכורת', true); return; }
            const item = { id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7), date, time, title, notes };
            try { LocalTools.buildIcs([item]); } catch (error) { this.toast(error.message, true); return; }
            const saved = State.update(state => { if (!state.manualReminders) state.manualReminders = []; state.manualReminders.push(item); });
            if (!saved) { this.toast('שמירת התזכורת נכשלה', true); return; }
            document.getElementById('reminder_title').value = '';
            document.getElementById('reminder_time').value = '';
            document.getElementById('reminder_notes').value = '';
            this.toast('התזכורת נשמרה במכשיר');
        },
        exportIcs() {
            try {
                const content = LocalTools.buildIcs(State.get().manualReminders || []);
                downloadLocalFile(content, 'cycleflow-reminders.ics', 'text/calendar;charset=utf-8');
                this.toast('קובץ היומן נוצר במכשיר');
            } catch (error) { this.toast(error.message, true); }
        },
        deleteReminder(btn) {
            if (!confirm('למחוק את התזכורת?')) return;
            State.update(state => { state.manualReminders = (state.manualReminders || []).filter(item => item.id !== btn.dataset.id); });
            this.toast('התזכורת נמחקה');
        },
        addStainReport() {
            if (!LocalTools) return;
            const item = {
                id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
                date: document.getElementById('stain_date').value,
                time: document.getElementById('stain_time').value || null,
                color: document.getElementById('stain_color').value,
                size: document.getElementById('stain_size').value,
                surface: document.getElementById('stain_surface').value,
                source: document.getElementById('stain_source').value,
                note: document.getElementById('stain_note').value.trim()
            };
            if (!LocalTools.validDate(item.date)) { this.toast('יש לבחור תאריך תקין', true); return; }
            try { LocalTools.buildStainSummary(item); } catch (error) { this.toast(error.message, true); return; }
            const saved = State.update(state => { if (!state.stainReports) state.stainReports = []; state.stainReports.push(item); });
            if (!saved) { this.toast('שמירת התיאור נכשלה', true); return; }
            document.getElementById('stain_note').value = '';
            this.toast('התיאור נשמר מקומית בלבד');
        },
        async copyStainSummary(btn) {
            const item = (State.get().stainReports || []).find(record => record.id === btn.dataset.id);
            if (!item) { this.toast('לא נמצא תיאור כתם', true); return; }
            const summary = LocalTools.buildStainSummary(item);
            try {
                if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
                await navigator.clipboard.writeText(summary);
                this.toast('הסיכום האנונימי הועתק');
            } catch (_) {
                downloadLocalFile(summary, 'cycleflow-stain-summary.txt', 'text/plain;charset=utf-8');
                this.toast('הסיכום הורד למכשיר');
            }
        },
        deleteStainReport(btn) {
            if (!confirm('למחוק את תיאור הכתם השמור?')) return;
            State.update(state => { state.stainReports = (state.stainReports || []).filter(item => item.id !== btn.dataset.id); });
            this.toast('תיאור הכתם נמחק');
        },
        downloadStainSummary(btn) {
            const item = (State.get().stainReports || []).find(record => record.id === btn.dataset.id);
            if (!item) { this.toast('לא נמצא תיאור כתם', true); return; }
            downloadLocalFile(LocalTools.buildStainSummary(item), 'cycleflow-stain-summary.txt', 'text/plain;charset=utf-8');
            this.toast('הסיכום הורד למכשיר');
        },
        toggleMikvehChecklist(input) {
            const date = input.dataset.date;
            const itemId = input.dataset.item;
            if (!LocalTools.validDate(date) || !LocalTools.CHECKLIST_ITEMS.some(item => item.id === itemId)) return;
            State.update(state => {
                if (!state.mikvehChecklist) state.mikvehChecklist = {};
                const checked = new Set(state.mikvehChecklist[date] || []);
                if (input.checked) checked.add(itemId); else checked.delete(itemId);
                state.mikvehChecklist[date] = [...checked];
            });
        },
        resetMikvehChecklist() {
            const date = document.getElementById('mikveh_checklist_date').value;
            if (!LocalTools.validDate(date)) { this.toast('יש לבחור תאריך תקין', true); return; }
            if (!confirm('לאפס את רשימת ההכנות לתאריך זה?')) return;
            State.update(state => { if (state.mikvehChecklist) delete state.mikvehChecklist[date]; });
            this.toast('הרשימה אופסה');
        },
        addOvulationObservation() {
            if (!LocalTools) return;
            const item = {
                id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
                date: document.getElementById('ovulation_date').value,
                time: document.getElementById('ovulation_time').value || null,
                type: document.getElementById('ovulation_type').value,
                immersionDate: document.getElementById('ovulation_immersion_date').value || null,
                note: document.getElementById('ovulation_note').value.trim()
            };
            if (!LocalTools.validDate(item.date) || (item.immersionDate && !LocalTools.validDate(item.immersionDate))) {
                this.toast('יש לבחור תאריך תקין', true); return;
            }
            const saved = State.update(state => { if (!state.ovulationObservations) state.ovulationObservations = []; state.ovulationObservations.push(item); });
            if (!saved) { this.toast('שמירת התיעוד נכשלה', true); return; }
            document.getElementById('ovulation_note').value = '';
            this.toast('תיעוד הביוץ נשמר מקומית');
        },
        deleteOvulationObservation(btn) {
            if (!confirm('למחוק את תיעוד הביוץ?')) return;
            State.update(state => { state.ovulationObservations = (state.ovulationObservations || []).filter(item => item.id !== btn.dataset.id); });
            this.toast('תיעוד הביוץ נמחק');
        },
        exportDoctorSummary() {
            const from = document.getElementById('doctor_from').value;
            const to = document.getElementById('doctor_to').value;
            try {
                const summary = LocalTools.buildDoctorSummary(State.get(), from, to, {
                    includeStains: document.getElementById('doctor_include_stains').checked
                });
                downloadLocalFile(summary, 'cycleflow-doctor-summary.txt', 'text/plain;charset=utf-8');
                this.toast('הסיכום הרפואי הורד למכשיר');
            } catch (error) { this.toast(error.message, true); }
        },
        saveDaily() { 
            if (!this.selectedDate) return; 
            const noteEl = document.getElementById('daily_note');
            const mEl = document.getElementById('chk_morning');
            if (!noteEl || !mEl) return;
            const d = Utils.fmt(this.selectedDate); 
            State.update(s => { 
                if (!s.daily[d]) s.daily[d] = {}; 
                s.daily[d] = { 
                    checks: { morning: mEl.checked, moch: document.getElementById('chk_moch').checked, sunset: document.getElementById('chk_sunset').checked }, 
                    note: noteEl.value 
                }; 
            }); 
        },
        saveSettings() {
            State.update(s => { s.settings.minhag = document.getElementById('set_minhag').value; s.settings.cycle = document.getElementById('set_cycle_len').value; s.settings.cityId = document.getElementById('set_city')?.value || null; }); 
            this.toast('הגדרות נשמרו'); 
        },
        async setNewPin() { 
            const p = document.getElementById('set_new_pin').value; 
            if (p.length === 4) { 
                const hash = await SecurityService.hashPin(p); 
                State.update(s => s.settings.pinHash = hash); 
                this.toast('קוד גישה הופעל'); 
                setTimeout(() => location.reload(), 1000); 
            } else { this.toast('חייב 4 ספרות', true); }
        },
        forgotPin() { if(confirm('איפוס קוד יבטל את ההגנה. להמשיך?')) { State.update(s => s.settings.pinHash = null); location.reload(); } },
        async exportBackup() {
            const passphrase = prompt('בחרי סיסמה להצפנת הגיבוי (יש לזכור אותה - אין אפשרות לשחזר בלעדיה):');
            if (!passphrase) return;
            if (passphrase.length < 4) { this.toast('הסיסמה חייבת לפחות 4 תווים', true); return; }
            await StorageService.export(State.get(), passphrase);
            this.toast('גיבוי מוצפן נוצר בהצלחה');
        },
        triggerImport() { document.getElementById('import_file').click(); },
        exportRecovery() {
            const raw = localStorage.getItem('cycleflow_recovery_v1');
            if (raw === null) { this.toast('לא נמצא עותק שחזור', true); return; }
            const blob = new Blob([raw], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `cycleflow_recovery_${Utils.fmt(new Date())}.json`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            this.toast('עותק השחזור הורד למכשיר. אין לשתף אותו.');
        },
        resetAll() { if(confirm('למחוק הכל? פעולה זו אינה הפיכה.')) { StorageService.clear(); location.reload(); } },
        generateRabbiText() { 
            let txt = "שלום הרב, להלן הנתונים:\n"; 
            Utils.chronologicalVesets(State.get().periods).slice(-3).forEach(p => { txt += `וסת: ${p.date} (${p.isSunset ? 'שקיעה' : 'יום'})\n`; }); 
            navigator.clipboard.writeText(txt).then(() => this.toast('הועתק ללוח'));
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('error', (e) => {
        console.error('Global error:', e.error || e.message);
    });
    window.addEventListener('unhandledrejection', (e) => {
        console.error('Unhandled promise rejection:', e.reason);
    });
    try {
        UI.init();
    } catch (err) {
        console.error('Init failed:', err);
        document.body.insertAdjacentHTML('afterbegin',
            '<div style="background:#ef4444;color:#fff;padding:16px;text-align:center;font-family:sans-serif">אירעה שגיאה בטעינת האפליקציה. נסי לרענן את הדף.</div>');
    }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/static/sw.js').catch(() => {});
    }
});
