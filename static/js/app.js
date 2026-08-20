/**
 * CycleFlow Pro - Clean Architecture
 */

const STORAGE_KEY = 'cycleflow_v61_python_pro';

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
    save(state) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {} },
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
    clear() { localStorage.removeItem(STORAGE_KEY); }
};

const defaultState = { periods: [], hefseks: {}, daily: {}, settings: { minhag: 'ashkenaz', cycle: 28, pinHash: null, theme: 'dark' } };

class StateManager {
    constructor() { this.state = StorageService.load() || defaultState; this.listeners = []; }
    subscribe(listener) { this.listeners.push(listener); }
    notify() { StorageService.save(this.state); this.listeners.forEach(listener => listener(this.state)); }
    get() { return this.state; }
    update(updater) { updater(this.state); this.notify(); }
}
const State = new StateManager();

const HalachaLogic = {
    getStatus(date) {
        const state = State.get();
        const dStr = Utils.fmt(date);
        const periods = Utils.chronologicalPeriods(state.periods);
        const lastP = periods[periods.length-1];
        
        let res = { type: 'regular', text: 'טהורה', color: 'var(--st-naki)', bg: 'rgba(16, 185, 129, 0.1)', canHefsek: false };
        if (!lastP) return res;
        
        const pDate = Utils.newDate(lastP.date);
        const daysDiff = Utils.diffDays(date, pDate);
        
        if (dStr === lastP.date) return { type: 'nidda', text: 'וסת (יום 1)', color: 'var(--st-nidda)', bg: 'rgba(239, 68, 68, 0.1)', canHefsek: false };
        
        const minWait = state.settings.minhag === 'sepharad' ? 4 : 5;
        let hefsekDate = null;
        let temp = new Date(pDate.getTime());
        
        while(temp <= date) { 
            if (state.hefseks[Utils.fmt(temp)]) hefsekDate = new Date(temp.getTime()); 
            temp.setDate(temp.getDate() + 1);
        }
        
        if (hefsekDate) {
            const cleanDay = Utils.diffDays(date, hefsekDate);
            if (cleanDay === 0) return { type: 'hefsek', text: 'יום הפסק', color: 'var(--st-hefsek)', bg: 'rgba(245, 158, 11, 0.1)', canHefsek: false };
            if (cleanDay >= 1 && cleanDay <= 7) return { type: 'naki', text: `נקיים: יום ${cleanDay}`, color: 'var(--st-naki)', bg: 'rgba(16, 185, 129, 0.1)', cleanCount: cleanDay, canHefsek: false };
            if (cleanDay === 8) return { type: 'tevila', text: 'ליל טבילה', color: '#000', bg: 'var(--st-tevila)', canHefsek: false };
        } else {
            if (daysDiff < minWait) return { type: 'nidda', text: `נידה (יום ${daysDiff+1})`, color: 'var(--st-nidda)', bg: 'rgba(239, 68, 68, 0.1)', canHefsek: false }; 
            return { type: 'nidda', text: `נידה - ממתינה להפסק`, color: 'var(--st-nidda)', bg: 'rgba(239, 68, 68, 0.1)', canHefsek: true };
        }
        
        const beinonit30 = Utils.addDays(pDate, 29);
        const beinonit31 = Utils.addDays(pDate, 30);
        
        if (dStr === Utils.fmt(beinonit30)) return { type: 'onah', text: 'עונה בינונית (30)', color: 'var(--st-onah)', bg: 'rgba(167, 139, 250, 0.1)', canHefsek: false };
        if (dStr === Utils.fmt(beinonit31)) return { type: 'onah', text: 'עונה בינונית (31)', color: 'var(--st-onah)', bg: 'rgba(167, 139, 250, 0.1)', canHefsek: false };
        
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
    navDate: new Date(),
    selectedDate: null,
    chartInstance: null,

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.applyTheme(State.get().settings.theme || 'dark');
        document.getElementById('report_date').value = Utils.fmt(new Date());
        State.subscribe(() => this.renderCurrentView());
        this.switchTab('dashboard');
        this.checkSecurity();
    },

    applyTheme(theme) {
        document.body.classList.toggle('light-theme', theme === 'light');
        const icon = document.querySelector('#theme_toggle_btn i');
        if (icon) icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
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
            const action = btn.dataset.action;
            if (typeof this.actions[action] === 'function') this.actions[action].call(this, btn, e);
        });
        
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
        
        const s = State.get().settings;
        document.getElementById('set_minhag').value = s.minhag;
        document.getElementById('set_cycle_len').value = s.cycle;
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
        if (st.type === 'naki' || st.type === 'hefsek' || st.type === 'tevila') {
            cdContainer.classList.remove('hidden');
            let html = '';
            const currentCount = st.type === 'hefsek' ? 0 : (st.type === 'tevila' ? 8 : st.cleanCount);
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
            if (st.type === 'naki' || st.type === 'tevila') card.classList.add('pure');
            
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
        document.getElementById('cal_year_subtitle').innerText = y;
        
        const firstDay = new Date(y, m, 1).getDay();
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const todayStr = Utils.fmt(new Date());

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
                const colorMap = { 'nidda': 'b-nidda', 'hefsek': 'b-hefsek', 'naki': 'b-naki', 'tevila': 'b-tevila', 'onah': 'b-onah' };
                badgeHtml = `<div class="day-badge ${colorMap[st.type]}">${st.text}</div>`;
            } else if (fert.isOvulation) {
                badgeHtml = `<div class="day-badge b-fertile">ביוץ משוער</div>`;
            } else if (fert.isFertile) {
                badgeHtml = `<div class="day-badge b-fertile">פורייה</div>`;
            }
            
            let dots = '';
            if (daily && (daily.checks.morning || daily.checks.sunset || daily.note)) {
                dots += `<div style="position:absolute; top:6px; left:6px; width:6px; height:6px; background-color:var(--accent); border-radius:50%"></div>`;
            }
            if (fert.isFertile) {
                dots += `<div style="position:absolute; top:6px; right:6px; width:6px; height:6px; background-color:#f472b6; border-radius:50%" title="ימי פוריות משוערים"></div>`;
            }
            div.innerHTML = `${dots}<div class="day-num">${i}</div>${badgeHtml}`;
            grid.appendChild(div);
        }
    },
    
    renderHistory() {
        const list = document.getElementById('history_list');
        list.innerHTML = '';
        const periods = Utils.chronologicalPeriods(State.get().periods).reverse();
        
        periods.forEach(p => { 
            const pid = p.id || p.date;
            list.innerHTML += `
                <div class="flex-between" style="padding:16px 0; border-bottom: 1px solid var(--border-light)">
                    <div>
                        <div class="font-bold text-main">${Utils.prettyDate(Utils.newDate(p.date))}</div>
                        <div class="text-sm text-muted" style="font-size:0.85rem">${p.isSunset ? 'אחרי שקיעה' : 'לפני שקיעה'}</div>
                    </div>
                    <div class="flex" style="align-items:center; gap:12px;">
                        <div class="text-danger font-bold">${p.type === 'veset' ? 'וסת' : 'כתם'}</div>
                        <button data-action="deletePeriod" data-id="${pid}" title="מחיקת רישום" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1rem;"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </div>`; 
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
                
                if (typeof Chart !== 'undefined') {
                    this.renderChart(chartData);
                } else {
                    document.querySelector('.chart-container').innerHTML = '<div style="display:flex; height:100%; align-items:center; justify-content:center; color:var(--text-muted)">הגרף לא זמין</div>';
                }
            }
        }
    },
    
    renderChart(dataPoints) {
        const canvas = document.getElementById('cycleChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (this.chartInstance) this.chartInstance.destroy();
        
        this.chartInstance = new Chart(ctx, {
            type: 'line',
            data: { 
                labels: dataPoints.map((_, i) => `מחזור ${i+1}`), 
                datasets: [{ 
                    label: 'אורך', 
                    data: dataPoints, 
                    borderColor: '#6366f1', 
                    backgroundColor: 'rgba(99, 102, 241, 0.1)', 
                    fill: true, 
                    tension: 0.3,
                    borderWidth: 2,
                    pointBackgroundColor: '#1e293b',
                    pointBorderColor: '#6366f1',
                    pointBorderWidth: 2,
                    pointRadius: 4
                }] 
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { legend: { display: false } }, 
                scales: { 
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' }, beginAtZero: false }, 
                    x: { grid: { display: false }, ticks: { display: false } } 
                } 
            }
        });
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
        btnH.classList.remove('hidden'); 
        btnU.classList.add('hidden');
        
        if (st.type === 'hefsek') { 
            btnH.classList.add('hidden'); 
            btnU.classList.remove('hidden');
        }
        
        btnH.disabled = (!st.canHefsek && st.type !== 'hefsek'); 
        btnH.style.opacity = btnH.disabled ? 0.4 : 1;
        
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

            const todayStr = Utils.fmt(new Date());
            if (d > todayStr) { this.toast('לא ניתן לדווח תאריך עתידי', true); return; }

            const state = State.get();
            if (state.periods.some(p => p.date === d)) { this.toast('כבר קיים דיווח לתאריך זה', true); return; }

            State.update(state => { 
                state.periods.push({ 
                    id: Date.now().toString(36),
                    date: d, 
                    isSunset: document.getElementById('chk_sunset_report').checked, 
                    type: document.getElementById('chk_spotting_report').checked ? 'spotting' : 'veset' 
                }); 
                const cutoff = Utils.newDate(d); 
                Object.keys(state.hefseks).forEach(k => { 
                    if (Utils.newDate(k) >= cutoff) delete state.hefseks[k]; 
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
                State.update(s => s.hefseks[Utils.fmt(new Date())] = true); 
                this.toast('הפסק טהרה בוצע!'); 
            } else {
                this.toast('לא ניתן לבצע הפסק כרגע', true); 
            }
        },
        doHefsekPanel() { 
            if (!this.selectedDate) return; 
            State.update(s => s.hefseks[Utils.fmt(this.selectedDate)] = true); 
            this.actions.closePanel.call(this); 
        },
        undoHefsekPanel() { 
            if (!this.selectedDate) return; 
            State.update(s => delete s.hefseks[Utils.fmt(this.selectedDate)]); 
            this.actions.closePanel.call(this); 
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
            State.update(s => { s.settings.minhag = document.getElementById('set_minhag').value; s.settings.cycle = document.getElementById('set_cycle_len').value; }); 
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
