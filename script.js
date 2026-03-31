window.onerror = function(msg, url, line) { console.log("Error: " + msg + " at Line: " + line); };

document.addEventListener('DOMContentLoaded', () => {
    const K_DB = 'ASTRAL_DB_V10'; 
    const K_DECK = 'ASTRAL_DECK_V10';
    const K_STATE = 'ASTRAL_STATE_V10'; 
    const K_CATS = 'ASTRAL_CATS_V10';
    const K_CATS_META = 'ASTRAL_CATS_META_V10'; 
    const K_MANUAL_ORDER = 'ASTRAL_MANUAL_ORDER_V10';
    const K_SEL = 'ASTRAL_SEL_V10';
    const K_GOAL = 'ASTRAL_GOAL_V10';
    const K_TODAY = 'ASTRAL_TODAY_V10';
    const K_PREFS = 'ASTRAL_PREFS_V10';
    const K_HISTORY = 'ASTRAL_HISTORY_V10';

    const GRID_COLS = 5;
    const GRID_SIZE = 15; 

    let currentChartView = 'Day';
    let currentCatSelection = null;
    let lastMovedCat = null;

    // --- ECHO / ME OVERLAY LOGIC ---
    const meButton = document.getElementById('meBtn');
    const meOverlay = document.getElementById('me-overlay');
    const closeMeButton = document.getElementById('closeMeBtn');

    if (meButton && meOverlay && closeMeButton) {
        meButton.addEventListener('click', () => {
            meOverlay.classList.add('show');
        });

        closeMeButton.addEventListener('click', () => {
            meOverlay.classList.remove('show');
        });
    }

    // --- CUSTOM DIALOG LOGIC ---
    function showDialog(type, title, message, defaultValue = '', confirmText = 'OK', cancelText = 'Cancel') {
        return new Promise((resolve) => {
            const overlay = document.getElementById('custom-dialog-overlay');
            const titleEl = document.getElementById('cd-title');
            const msgEl = document.getElementById('cd-message');
            const inputEl = document.getElementById('cd-input');
            const btnCancel = document.getElementById('cd-btn-cancel');
            const btnConfirm = document.getElementById('cd-btn-confirm');

            titleEl.innerText = title;
            if (message) { msgEl.innerText = message; msgEl.style.display = 'block'; } 
            else { msgEl.style.display = 'none'; }

            if (type === 'prompt') { 
                inputEl.style.display = 'block';
                inputEl.value = defaultValue; 
                inputEl.type = (title === 'Set Daily Goal') ? 'number' : 'text';
            } else { inputEl.style.display = 'none'; }

            btnConfirm.innerText = confirmText;
            btnCancel.innerText = cancelText;

            if (confirmText === 'DELETE' || confirmText === 'RESET') {
                btnConfirm.style.background = 'var(--wrong-color)';
                btnConfirm.style.color = 'white';
            } else {
                btnConfirm.style.background = '';
                btnConfirm.style.color = '';
            }

            overlay.classList.add('show');
            if (type === 'prompt') { setTimeout(() => inputEl.focus(), 100); }

            const cleanup = () => { overlay.classList.remove('show'); inputEl.onkeydown = null; };

            btnCancel.onclick = () => { 
                cleanup(); 
                resolve(null); 
                if (title === 'Set Daily Goal') {
                    document.getElementById('me-overlay').classList.add('show');
                }
            };

            btnConfirm.onclick = () => { 
                cleanup();
                resolve(type === 'prompt' ? inputEl.value : true); 
                if (title === 'Set Daily Goal') {
                    document.getElementById('me-overlay').classList.add('show');
                }
            };
            
            inputEl.onkeydown = (e) => { if (e.key === 'Enter') { btnConfirm.click(); } };
        });
    }

    // --- SNACKBAR UNDO LOGIC ---
    let snackTimeout;
    let snackState = null;

    function showSnackbar(msg, stateData) {
        snackState = stateData;
        const sb = document.getElementById('snackbar');
        document.getElementById('snack-msg').innerText = msg;
        sb.classList.add('show');
        clearTimeout(snackTimeout);
        snackTimeout = setTimeout(() => {
            sb.classList.remove('show');
            snackState = null;
        }, 5000);
    }

    window.triggerUndo = function() {
        if(!snackState) return;
        
        if (snackState.type === 'phrase') {
            phrases.splice(snackState.index, 0, snackState.phrase);
            if (snackState.inDeck) deck.push(snackState.phrase.id); 
            save(K_DB, phrases); save(K_DECK, deck);
        } else if (snackState.type === 'folder') {
            categories.splice(snackState.index, 0, snackState.catName);
            if (snackState.wasSelected) selectedCats.push(snackState.catName);
            catsMeta[snackState.catName] = snackState.meta;
            manualOrder.push(snackState.catName);
            phrases.push(...snackState.phrases);
            save(K_CATS, categories); save(K_SEL, selectedCats); save(K_CATS_META, catsMeta); save(K_DB, phrases); save(K_MANUAL_ORDER, manualOrder);
        }
        
        const sb = document.getElementById('snackbar');
        sb.classList.remove('show');
        snackState = null;
        clearTimeout(snackTimeout);
        
        updateManagerList(); window.updateList();
    }


    // --- NIGHT OWL LOGIC ---
    function getLogicalDate() {
        let d = new Date();
        if (prefs.nightOwl && d.getHours() < 4) { d.setDate(d.getDate() - 1); }
        return d;
    }
    function getLogicalDateStr() { return getLogicalDate().toDateString(); }

    function updateThemeMetaColor(isLight) {
        const metaTheme = document.getElementById('meta-theme-color');
        if (metaTheme) { metaTheme.setAttribute('content', isLight ? '#e2e8f0' : '#050510'); }
        document.documentElement.style.colorScheme = isLight ? 'light' : 'dark';
    }

    // --- CUSTOM DROPDOWN LOGIC ---
    window.toggleDropdown = function(event) { event.stopPropagation(); document.getElementById('chart-dropdown-menu').classList.toggle('show'); };
    window.selectChartView = function(view) { currentChartView = view; document.getElementById('chart-view-btn').innerText = view; document.getElementById('chart-dropdown-menu').classList.remove('show'); renderChart(); };
    window.toggleCatDropdown = function(event) { event.stopPropagation(); document.getElementById('cat-dropdown-menu').classList.toggle('show'); };
    window.selectFocusCat = function(cat) { currentCatSelection = cat; document.getElementById('cat-view-btn').innerText = cat; document.getElementById('cat-dropdown-menu').classList.remove('show'); };
    window.toggleSortDropdown = function(event) { event.stopPropagation(); document.getElementById('sort-dropdown-menu').classList.toggle('show'); };
    
    document.addEventListener('click', function(event) {
        const chartDropdown = document.getElementById('chart-dropdown');
        if (chartDropdown && !chartDropdown.contains(event.target)) { const chartMenu = document.getElementById('chart-dropdown-menu'); if(chartMenu) chartMenu.classList.remove('show'); }
        const catDropdown = document.getElementById('cat-dropdown');
        if (catDropdown && !catDropdown.contains(event.target)) { const catMenu = document.getElementById('cat-dropdown-menu'); if(catMenu) catMenu.classList.remove('show'); }
        const sortDropdown = document.getElementById('sort-dropdown');
        if (sortDropdown && !sortDropdown.contains(event.target)) { const sortMenu = document.getElementById('sort-dropdown-menu'); if(sortMenu) sortMenu.classList.remove('show'); }
    });

    function getLevelInfo(total) {
        if (total < 25) {
            return { level: 1, currentThreshold: 0, nextThreshold: 25 };
        } else {
            let level = 2 + Math.floor((total - 25) / 15);
            let currentThreshold = 25 + (level - 2) * 15;
            let nextThreshold = currentThreshold + 15;
            return { level, currentThreshold, nextThreshold };
        }
    }

    const uid = () => Date.now().toString(36) + Math.random().toString(36).substr(2);
    const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} };
    const load = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch(e){ return null; } };
    const toTitleCase = (str) => { return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '); };

    // --- PREFS LOADING & ULTIMATE SANITIZER ---
    let prefs = load(K_PREFS);
    if (!prefs || typeof prefs !== 'object') { 
        prefs = { lightMode: false, zenMode: false, showBackground: true, sound: true, haptics: true, nightOwl: false, lifetimeTotal: 0, bestStreak: 0, skipCredits: 3, lastSkipResetMonth: "", vacationMode: false, lastActiveDate: Date.now(), sortMode: 'Manual', customGuideName: "Echo" };
    } else {
        if (typeof prefs.lightMode === 'undefined') prefs.lightMode = false;
        if (typeof prefs.zenMode === 'undefined') prefs.zenMode = false;
        if (typeof prefs.showBackground === 'undefined') prefs.showBackground = true;
        if (typeof prefs.sound === 'undefined') prefs.sound = true;
        if (typeof prefs.haptics === 'undefined') prefs.haptics = true;
        if (typeof prefs.nightOwl === 'undefined') prefs.nightOwl = false;
        if (typeof prefs.vacationMode === 'undefined') prefs.vacationMode = false;
        if (typeof prefs.lastActiveDate === 'undefined') prefs.lastActiveDate = Date.now();
        if (typeof prefs.sortMode === 'undefined') prefs.sortMode = 'Manual';
        if (typeof prefs.customGuideName === 'undefined') prefs.customGuideName = "Echo";
    }

    // THE ULTIMATE SANITIZER: Catches the [object HTMLDivElement] glitch and erases it on load
    let nameCheck = String(prefs.customGuideName);
    if (!prefs.customGuideName || nameCheck.includes("undefined") || nameCheck.includes("null") || nameCheck.includes("object") || nameCheck.trim() === "") {
        prefs.customGuideName = "Echo";
        save(K_PREFS, prefs); 
    }

    // --- MONTHLY SKIP ALLOWANCE LOGIC ---
    let currentMonthKey = new Date().getFullYear() + "-" + new Date().getMonth();
    if (prefs.lastSkipResetMonth !== currentMonthKey) {
        prefs.skipCredits = 3;
        prefs.lastSkipResetMonth = currentMonthKey;
        save(K_PREFS, prefs);
    }

    let dailyGoal = load(K_GOAL) || 10;
    let historyMap = load(K_HISTORY) || {};
    let historyMigrated = false;
    Object.keys(historyMap).forEach(k => {
        if (typeof historyMap[k] === 'number') {
            historyMap[k] = { c: historyMap[k], g: dailyGoal };
            historyMigrated = true;
        }
    });
    if (historyMigrated) { save(K_HISTORY, historyMap); }

    let categories = load(K_CATS) || ["Confidence", "Money", "Health"];
    currentCatSelection = categories.length > 0 ? categories[0] : null;

    let catsMeta = load(K_CATS_META) || {};
    let metaUpdated = false;
    categories.forEach(c => {
        if (!catsMeta[c]) { catsMeta[c] = Date.now(); metaUpdated = true; }
    });
    if (metaUpdated) save(K_CATS_META, catsMeta);

    // --- MANUAL SORT ORDER LOADING ---
    let manualOrder = load(K_MANUAL_ORDER);
    if (!Array.isArray(manualOrder) || manualOrder.length !== categories.length) {
        let newOrder = Array.isArray(manualOrder) ? manualOrder.filter(c => categories.includes(c)) : [];
        categories.forEach(c => { if (!newOrder.includes(c)) newOrder.push(c); });
        manualOrder = newOrder;
        save(K_MANUAL_ORDER, manualOrder);
    }

    let phrases = load(K_DB) || [
        {id: uid(), text: "I AM CAPABLE", count: 0, category: "Confidence"},
        {id: uid(), text: "I AM DOING THE BEST I CAN", count: 0, category: "Confidence"},
        {id: uid(), text: "I BELIEVE IN MYSELF", count: 0, category: "Confidence"},
        {id: uid(), text: "WEALTH FLOWS TO ME EFFORTLESSLY", count: 0, category: "Money"},
        {id: uid(), text: "I AM WORTHY OF FINANCIAL ABUNDANCE", count: 0, category: "Money"},
        {id: uid(), text: "I AM GRATEFUL FOR ALL OF THE MONEY THAT COMES INTO MY LIFE", count: 0, category: "Money"},
        {id: uid(), text: "MY BODY IS VIBRANT AND HEALING", count: 0, category: "Health"},
        {id: uid(), text: "MY BODY HEALS ITSELF NATURALLY", count: 0, category: "Health"},
        {id: uid(), text: "I FEEL BETTER AND BETTER IN EVERY WAY WITH EVERY PASSING DAY", count: 0, category: "Health"}
    ];
    phrases.forEach(p => { if (typeof p.lifetimeCount === 'undefined') p.lifetimeCount = p.count || 0; });
    save(K_DB, phrases);

    // --- SORT SYSTEM LOGIC ---
    function applySort() {
        if (prefs.sortMode === 'Manual') {
            categories = [...manualOrder];
        } else if (prefs.sortMode === 'Alphabetical') {
            categories.sort((a, b) => a.localeCompare(b));
        } else if (prefs.sortMode === 'Newest First') {
            categories.sort((a, b) => (catsMeta[b] || 0) - (catsMeta[a] || 0));
        } else if (prefs.sortMode === 'Frequency') {
            categories.sort((a, b) => {
                let aTotal = phrases.filter(p=>p.category===a).reduce((s,p)=>s+(p.lifetimeCount||0),0);
                let bTotal = phrases.filter(p=>p.category===b).reduce((s,p)=>s+(p.lifetimeCount||0),0);
                return bTotal - aTotal;
            });
        }
        save(K_CATS, categories);
    }

    window.setSortMode = function(mode) {
        prefs.sortMode = mode;
        save(K_PREFS, prefs);
        document.getElementById('sort-dropdown-menu').classList.remove('show');
        applySort();
        
        if (document.startViewTransition) {
            document.startViewTransition(() => {
                updateManagerList(); window.updateList();
            });
        } else {
            updateManagerList(); window.updateList();
        }
    }

    // --- SELECTED CATS LOADING ---
    let selectedCats = load(K_SEL);
    if (!Array.isArray(selectedCats)) {
        selectedCats = [...categories]; 
        save(K_SEL, selectedCats);
    }
    
    let todayString = getLogicalDateStr();
    let dailyProgress = load(K_TODAY) || { date: todayString, count: 0 };
    if (dailyProgress.date !== todayString) { dailyProgress = { date: todayString, count: 0 };
    save(K_TODAY, dailyProgress); phrases.forEach(p => p.count = 0); save(K_DB, phrases); }
    
    let expandedFocusesMain = {};
    let expandedFocusesManage = {};

    let deck = load(K_DECK) || []; let activeState = load(K_STATE) || null; let audioCtx = null;
    
    // Initial Setup
    if(prefs.lightMode) { document.body.classList.add('light-mode'); document.documentElement.classList.add('light-mode'); updateThemeMetaColor(true);
    } else { document.documentElement.classList.remove('light-mode'); updateThemeMetaColor(false); }
    
    const sText = document.getElementById('skips-remaining-text');
    if (sText) sText.innerText = prefs.skipCredits !== undefined ? prefs.skipCredits : 3;
    
    applyZenModeUI();
    applyBackgroundUI();
    applySort(); 

    // --- VACATION MODE ON LOAD LOGIC ---
    let nowTime = Date.now();

    if (prefs.vacationMode && prefs.lastActiveDate) {
        let lastD = new Date(prefs.lastActiveDate);
        lastD.setHours(0,0,0,0);
        let todayD = getLogicalDate();
        todayD.setHours(0,0,0,0);
        
        let loopD = new Date(lastD);
        while(loopD <= todayD) {
            let dStr = loopD.toDateString();
            if (!historyMap[dStr]) historyMap[dStr] = { c: 0, g: dailyGoal, v: true };
            else if (typeof historyMap[dStr] === 'number') historyMap[dStr] = { c: historyMap[dStr], g: dailyGoal, v: true };
            else historyMap[dStr].v = true;
            loopD.setDate(loopD.getDate() + 1);
        }
        save(K_HISTORY, historyMap);
    }

    if (prefs.vacationMode && prefs.lastActiveDate && (nowTime - prefs.lastActiveDate > 24 * 60 * 60 * 1000)) {
        setTimeout(async () => {
            const result = await showDialog('confirm', 'Welcome Back!', 'Ready to jump back in, or stay in Vacation Mode?', '', "I'M BACK", "STAY ON VACATION");
            if (result) {
                prefs.vacationMode = false;
                save(K_PREFS, prefs);
                applyVacationUI();
            }
        }, 500); 
    }

    prefs.lastActiveDate = nowTime;
    save(K_PREFS, prefs);
    applyVacationUI();

    function applyVacationUI() {
        const banner = document.getElementById('vacation-banner');
        if (banner) banner.style.display = prefs.vacationMode ? 'flex' : 'none';
        
        const toggle = document.getElementById('vacation-toggle');
        if (toggle) toggle.checked = !!prefs.vacationMode;
    }

    window.toggleVacation = function() {
        prefs.vacationMode = document.getElementById('vacation-toggle').checked;
        if (prefs.vacationMode) {
            prefs.lastActiveDate = Date.now();
            let dStr = getLogicalDateStr();
            if (!historyMap[dStr]) historyMap[dStr] = { c: 0, g: dailyGoal };
            if (typeof historyMap[dStr] === 'number') historyMap[dStr] = { c: historyMap[dStr], g: dailyGoal };
            historyMap[dStr].v = true;
            save(K_HISTORY, historyMap);
        }
        save(K_PREFS, prefs);
        applyVacationUI();
    };

    window.toggleTheme = function() {
        prefs.lightMode = document.getElementById('theme-toggle').checked;
        if(prefs.lightMode) { document.body.classList.add('light-mode'); document.documentElement.classList.add('light-mode'); updateThemeMetaColor(true); } 
        else { document.body.classList.remove('light-mode'); document.documentElement.classList.remove('light-mode'); updateThemeMetaColor(false); }
        save(K_PREFS, prefs);
    }

    function applyZenModeUI() {
        if(prefs.zenMode) { document.body.classList.add('zen-mode'); } 
        else { document.body.classList.remove('zen-mode'); }
    }

    window.toggleZenMode = function() { 
        prefs.zenMode = document.getElementById('zen-toggle').checked; 
        save(K_PREFS, prefs); 
        applyZenModeUI(); 
    }

    function applyBackgroundUI() {
        if(!prefs.showBackground) { document.body.classList.add('no-bg'); } 
        else { document.body.classList.remove('no-bg'); }
    }

    window.toggleBackground = function() { 
        prefs.showBackground = document.getElementById('bg-toggle').checked; 
        save(K_PREFS, prefs); 
        applyBackgroundUI(); 
    }

    window.toggleSound = function() { prefs.sound = document.getElementById('sound-toggle').checked; save(K_PREFS, prefs); }
    window.toggleHaptics = function() { prefs.haptics = document.getElementById('haptics-toggle').checked; save(K_PREFS, prefs); }
    window.toggleNightOwl = function() { 
        prefs.nightOwl = document.getElementById('nightowl-toggle').checked;
        save(K_PREFS, prefs); 
        todayString = getLogicalDateStr();
        if (dailyProgress.date !== todayString) {
            dailyProgress = { date: todayString, count: 0 };
            save(K_TODAY, dailyProgress);
            phrases.forEach(p => p.count = 0); save(K_DB, phrases);
        }
        window.updateProgressUI(); window.updateList();
    }

    // --- APPLY SKIP SHIELD LOGIC ---
    window.applySkip = async function() {
        if (prefs.skipCredits <= 0) {
            await showDialog('confirm', 'Out of Shields', 'You have used your 3 shields for this month. They will reset on the 1st!', '', 'OK');
            return;
        }
        
        let yesterday = getLogicalDate();
        yesterday.setDate(yesterday.getDate() - 1);
        let yStr = yesterday.toDateString();
        
        let val = historyMap[yStr];
        let isMet = false;
        if (val && typeof val === 'object') { 
            isMet = (val.c >= val.g) || val.s === true || val.v === true; 
        } else if (typeof val === 'number') { 
            isMet = val >= dailyGoal; 
        } else if (val === true) { 
            isMet = true; 
        }
        
        if (isMet) {
            await showDialog('confirm', 'Streak Intact', 'You did not miss yesterday (or it was already protected)! No shield needed.', '', 'OK');
            return;
        }
        
        const confirmed = await showDialog('confirm', 'Apply Silver Shield?', `Use one shield to save yesterday's streak?\nShields remaining: ${prefs.skipCredits}`, '', 'APPLY');
        if (confirmed) {
            prefs.skipCredits--;
            save(K_PREFS, prefs);
            document.getElementById('skips-remaining-text').innerText = prefs.skipCredits;
            
            if (!historyMap[yStr]) historyMap[yStr] = { c: 0, g: dailyGoal };
            if (typeof historyMap[yStr] === 'number') historyMap[yStr] = { c: historyMap[yStr], g: dailyGoal };
            
            historyMap[yStr].s = true; 
            save(K_HISTORY, historyMap);
            
            await showDialog('confirm', 'Streak Protected', 'Your Silver Shield has been applied for yesterday. Check your calendar!', '', 'OK');
        }
    }

    window.toggleAllBreakdowns = function() {
        const btnText = document.querySelector('#toggle-all-breakdown-btn span');
        const btnIcon = document.getElementById('expand-all-icon');
        const contents = document.querySelectorAll('.breakdown-content');
        const isExpanding = btnText.innerText === 'EXPAND ALL';

        contents.forEach(c => {
            if (isExpanding) {
                c.classList.add('show');
            } else {
                c.classList.remove('show');
            }
        });

        btnText.innerText = isExpanding ? 'COLLAPSE ALL' : 'EXPAND ALL';
        btnIcon.innerHTML = isExpanding ? '<polyline points="18 15 12 9 6 15"></polyline>' : '<polyline points="6 9 12 15 18 9"></polyline>';
    };

    // --- EXPORT/IMPORT LOGIC ---
    window.openExport = function() {
        document.getElementById('data-title').innerText = "Export Data";
        document.getElementById('data-desc').innerText = "Copy this code or save it as a file to back up your progress.";
        
        const data = {
            db: phrases, deck: deck, state: activeState, cats: categories, catsMeta: catsMeta, manualOrder: manualOrder,
            sel: selectedCats, goal: dailyGoal, today: dailyProgress, prefs: prefs, history: historyMap
        };
        const str = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
        const ta = document.getElementById('data-textarea');
        ta.value = str;
        ta.readOnly = true;
        
        const btn1 = document.getElementById('data-btn-1');
        btn1.innerText = "Copy Code";
        btn1.onclick = () => {
            ta.select(); document.execCommand('copy');
            btn1.innerText = "Copied!";
            setTimeout(() => btn1.innerText = "Copy Code", 2000);
        };
        
        const btn2 = document.getElementById('data-btn-2');
        btn2.innerText = "Save File";
        btn2.onclick = () => {
            const blob = new Blob([str], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = "astral_backup.txt";
            a.click();
            URL.revokeObjectURL(url);
        };
        
        document.getElementById('data-overlay').classList.add('show');
    }

    window.openImport = function() {
        document.getElementById('data-title').innerText = "Import Data";
        document.getElementById('data-desc').innerText = "Paste your backup code below or upload a file. This will replace current data.";
        
        const ta = document.getElementById('data-textarea');
        ta.value = "";
        ta.readOnly = false;
        ta.placeholder = "Paste your code here...";
        
        const btn1 = document.getElementById('data-btn-1');
        btn1.innerText = "Upload File";
        btn1.onclick = () => document.getElementById('file-import-input').click();
        
        const btn2 = document.getElementById('data-btn-2');
        btn2.innerText = "Import Data";
        btn2.onclick = () => processImport(ta.value);
        
        document.getElementById('data-overlay').classList.add('show');
    }

    document.getElementById('file-import-input').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('data-textarea').value = e.target.result;
            document.getElementById('data-btn-1').innerText = "File Loaded";
        };
        reader.readAsText(file);
    });

    async function processImport(base64Str) {
        if(!base64Str || !base64Str.trim()) {
            await showDialog('confirm', 'Error', 'Please paste a code or upload a file.', '', 'OK');
            return;
        }
        try {
            const jsonStr = decodeURIComponent(escape(atob(base64Str.trim())));
            const data = JSON.parse(jsonStr);
            
            if(!data.db || !data.cats) throw new Error("Invalid format");
            
            phrases = data.db; deck = data.deck || []; activeState = data.state || null;
            categories = data.cats; catsMeta = data.catsMeta || {}; selectedCats = data.sel || [];
            manualOrder = data.manualOrder || [...categories];
            dailyGoal = data.goal || 10; dailyProgress = data.today || { date: getLogicalDateStr(), count: 0 };
            prefs = data.prefs || {}; historyMap = data.history || {};
            
            save(K_DB, phrases); save(K_DECK, deck); save(K_STATE, activeState);
            save(K_CATS, categories); save(K_CATS_META, catsMeta); save(K_SEL, selectedCats); save(K_MANUAL_ORDER, manualOrder);
            save(K_GOAL, dailyGoal); save(K_TODAY, dailyProgress); save(K_PREFS, prefs); save(K_HISTORY, historyMap);
            
            if (document.getElementById('theme-toggle')) { 
                document.getElementById('theme-toggle').checked = !!prefs.lightMode; 
            }
            document.getElementById('zen-toggle').checked = !!prefs.zenMode;
            document.getElementById('vacation-toggle').checked = !!prefs.vacationMode;
            document.getElementById('bg-toggle').checked = !!prefs.showBackground;
            document.getElementById('sound-toggle').checked = !!prefs.sound;
            document.getElementById('haptics-toggle').checked = !!prefs.haptics;
            document.getElementById('nightowl-toggle').checked = !!prefs.nightOwl;
            document.getElementById('skips-remaining-text').innerText = prefs.skipCredits !== undefined ? prefs.skipCredits : 3;

            applyZenModeUI(); applyBackgroundUI(); applyVacationUI();
            
            closeDataOverlay();
            updateManagerList(); window.updateList(); window.updateProgressUI();
            
            await showDialog('confirm', 'Success!', 'Your data has been perfectly restored.', '', 'OK');
            
        } catch(err) {
            await showDialog('confirm', 'Invalid Code', 'The code or file you provided is invalid or corrupted.', '', 'OK');
        }
    }
    
    window.closeDataOverlay = () => { 
        document.getElementById('data-overlay').classList.remove('show'); 
        document.getElementById('file-import-input').value = ""; 
    }

    window.openSettings = () => {
        if (document.getElementById('theme-toggle')) { document.getElementById('theme-toggle').checked = !!prefs.lightMode; }
        document.getElementById('zen-toggle').checked = !!prefs.zenMode;
        document.getElementById('vacation-toggle').checked = !!prefs.vacationMode;
        document.getElementById('bg-toggle').checked = !!prefs.showBackground;
        document.getElementById('sound-toggle').checked = !!prefs.sound;
        document.getElementById('haptics-toggle').checked = !!prefs.haptics;
        document.getElementById('nightowl-toggle').checked = !!prefs.nightOwl;
        document.getElementById('settings-overlay').classList.add('show');
    };
    
    window.openStats = () => { renderStats(); document.getElementById('stats-overlay').classList.add('show'); };
    window.openManager = () => { updateManagerList(); document.getElementById('manage-overlay').classList.add('show'); };
    window.closeOverlays = () => { document.querySelectorAll('.glass-overlay').forEach(el => el.classList.remove('show')); };
    
    window.closeManager = () => { 
        document.getElementById('manage-overlay').classList.remove('show'); 
        window.updateList(); 
        document.getElementById('me-overlay').classList.add('show');
    };
    window.openBreakdown = () => { renderBreakdown(); document.getElementById('breakdown-overlay').classList.add('show'); };
    window.closeBreakdown = () => { document.getElementById('breakdown-overlay').classList.remove('show'); };
    
    // --- GUIDE & THEME OVERLAY LOGIC ---
    window.openGuides = () => { 
        document.querySelectorAll('.guide-card').forEach(c => c.classList.remove('active-selection'));
        const currentUrl = prefs.activeGuideUrl || '';
        document.querySelectorAll('.guide-card.unlocked').forEach(card => {
            const img = card.querySelector('img');
            if (img && img.src === currentUrl) card.classList.add('active-selection');
        });
        document.getElementById('guides-overlay').classList.add('show'); 
    };
    
    window.closeGuides = () => { document.getElementById('guides-overlay').classList.remove('show'); document.getElementById('me-overlay').classList.add('show'); };
    
    window.openThemes = () => { 
        document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active-selection'));
        const currentTheme = prefs.activeTheme || 'Astral';
        document.querySelectorAll('.theme-card.unlocked').forEach(card => {
            if (card.getAttribute('data-theme-name') === currentTheme) card.classList.add('active-selection');
        });
        document.getElementById('themes-overlay').classList.add('show'); 
    };
    window.closeThemes = () => { document.getElementById('themes-overlay').classList.remove('show'); document.getElementById('me-overlay').classList.add('show'); };

    function renderBreakdown() {
        let currentD = getLogicalDate(); currentD.setHours(0,0,0,0);
        let html = '';
        let sortedCategories = categories.map(cat => { let catPhrases = phrases.filter(p => p.category === cat); let catTotal = catPhrases.reduce((sum, p) => sum + (p.lifetimeCount || 0), 0); return { cat: cat, phrases: catPhrases, total: catTotal }; }).sort((a, b) => b.total - a.total);
        
        sortedCategories.forEach(item => {
            let cat = item.cat; let catPhrases = item.phrases; let catTotal = item.total; if (catPhrases.length === 0) return; 
            
            let catMinTime = catsMeta[cat] || Date.now();
            let catMinDateObj = new Date(catMinTime);
            catMinDateObj.setHours(0,0,0,0);
            
            let catDaysDiff = Math.floor((currentD - catMinDateObj) / (1000 * 60 * 60 * 24)) + 1;
            if (catDaysDiff < 1) catDaysDiff = 1;
            
            let rawPace = catTotal / catDaysDiff; let catPace = rawPace % 1 === 0 ? rawPace : parseFloat(rawPace.toFixed(1));
            
            html += `<div class="breakdown-card"><div class="breakdown-header" onclick="this.nextElementSibling.classList.toggle('show')"><span>${cat}</span><span class="breakdown-total">${catTotal.toLocaleString()} <span style="font-size:10px;opacity:0.5">▼</span></span></div><div class="breakdown-content"><div style="font-size: 11px; color: var(--text-muted); margin-top: 8px; margin-bottom: 12px; font-style: italic; text-align: center; border-bottom: 1px solid var(--border-glass); padding-bottom: 10px;">You're averaging <span style="color: var(--correct-color); font-weight: bold;">${catPace}</span> <strong>${cat}</strong> affirmations a day!</div>`;
            catPhrases.sort((a,b) => (b.lifetimeCount||0) - (a.lifetimeCount||0)).forEach(p => { html += `<div class="breakdown-item"><span class="b-text">${p.text}</span><span class="b-count">${(p.lifetimeCount||0).toLocaleString()}</span></div>`; });
            html += `</div></div>`;
        });
        document.getElementById('breakdown-list').innerHTML = html || '<div style="text-align:center; padding:20px; color:var(--text-muted);">No history yet. Complete an affirmation to see it here!</div>';
    }
    
    function renderChart() {
        const today = getLogicalDate();
        let pastD = new Date(today); let allDates = Object.keys(historyMap).map(k => new Date(k)).filter(d => !isNaN(d));
        let minHistoryDate = allDates.length > 0 ? new Date(Math.min(...allDates)) : new Date(); minHistoryDate.setHours(0,0,0,0);
        if (currentChartView === 'Day') { pastD.setDate(today.getDate() - 13); } else if (currentChartView === 'Week') { pastD.setDate(today.getDate() - 56);
        } else if (currentChartView === 'Month') { pastD.setMonth(today.getMonth() - 5); } else if (currentChartView === 'Year') { pastD.setFullYear(today.getFullYear() - 1); }
        let loopDate = minHistoryDate < pastD ? minHistoryDate : pastD; loopDate.setHours(0,0,0,0); today.setHours(0,0,0,0);
        let bins = []; let binData = {};
        while(loopDate <= today) {
            let label = '';
            if (currentChartView === 'Day') { label = loopDate.toLocaleDateString('en-US', {month:'numeric', day:'numeric'});
            } else if (currentChartView === 'Week') { let temp = new Date(loopDate); temp.setDate(temp.getDate() - temp.getDay()); label = temp.toLocaleDateString('en-US', {month:'numeric', day:'numeric'});
            } else if (currentChartView === 'Month') { label = loopDate.toLocaleDateString('en-US', {month:'short', year:'2-digit'});
            } else if (currentChartView === 'Year') { label = loopDate.getFullYear().toString(); }
            if (binData[label] === undefined) { bins.push(label); binData[label] = 0; }
            
            let val = historyMap[loopDate.toDateString()];
            let c = typeof val === 'object' ? val.c : (typeof val === 'number' ? val : 0);
            binData[label] += c; loopDate.setDate(loopDate.getDate() + 1);
        }
        let maxVal = Math.max(...bins.map(b => binData[b]), dailyGoal, 1);
        const barChart = document.getElementById('bar-chart'); barChart.innerHTML = '';
        bins.forEach(b => {
            let count = binData[b]; let pct = Math.min(100, (count / maxVal) * 100); let wrap = document.createElement('div'); wrap.className = 'bar-wrapper'; let numColorClass = count > 0 ? '' : 'style="opacity: 0.3;"';
            wrap.innerHTML = `<div class="bar-num" ${numColorClass}>${count}</div><div class="bar"><div class="bar-fill" style="height: ${pct}%"></div></div><div class="bar-day">${b}</div>`; barChart.appendChild(wrap);
        });
        const scrollCont = document.getElementById('scroll-chart-container'); setTimeout(() => { scrollCont.scrollLeft = scrollCont.scrollWidth; }, 10);
    }

    function renderStats() {
        const total = prefs.lifetimeTotal || 0;
        const levelContainer = document.getElementById('level-container');

        if (levelContainer) {
            let { level, currentThreshold, nextThreshold } = getLevelInfo(total);
            let pct = Math.min(100, ((total - currentThreshold) / (nextThreshold - currentThreshold)) * 100);
            
            levelContainer.innerHTML = `
                <div class="level-header"><div class="level-title">Level ${level}</div></div>
                <div class="level-track">
                    <div class="level-fill" style="width: ${pct}%;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); font-weight: bold; margin-top: 5px; padding: 0 5px;">
                    <span>${level}</span>
                    <span>${level + 1}</span>
                </div>
            `;
        }

        let currentStreak = 0; let bestStreak = prefs.bestStreak || 0;
        let d = getLogicalDate();
        while(true) { 
            let dateStr = d.toDateString();
            let val = historyMap[dateStr]; 
            let isMet = false;
            
            if (val && typeof val === 'object') { isMet = (val.c >= val.g) || val.s === true || val.v === true;
            } 
            else if (typeof val === 'number') { isMet = val >= dailyGoal;
            } 
            else if (val === true) { isMet = true;
            }
            
            if(isMet || (currentStreak === 0 && d.toDateString() === todayString)) { if(isMet) currentStreak++;
            } else { break; } d.setDate(d.getDate() - 1); 
        }
        document.getElementById('streak-count').innerText = currentStreak;
        if (currentStreak > bestStreak) { bestStreak = currentStreak; prefs.bestStreak = bestStreak; save(K_PREFS, prefs); }
        document.getElementById('stat-best-streak').innerText = bestStreak;

        let allDates = Object.keys(historyMap).map(k => new Date(k)).filter(dateObj => !isNaN(dateObj));
        let minDate = allDates.length > 0 ? new Date(Math.min(...allDates)) : new Date(); minDate.setHours(0,0,0,0); let currentD = getLogicalDate(); currentD.setHours(0,0,0,0);
        let daysDiff = Math.floor((currentD - minDate) / (1000 * 60 * 60 * 24)) + 1;
        if (daysDiff < 1) daysDiff = 1;
        let dailyPace = Math.round(total / daysDiff); document.getElementById('stat-daily-pace').innerText = dailyPace;
        
        let formattedTotal = total.toLocaleString();
        let totalEl = document.getElementById('legacy-total-value'); totalEl.innerText = formattedTotal;
        if (formattedTotal.length > 8) totalEl.style.fontSize = '24px';
        else if (formattedTotal.length > 5) totalEl.style.fontSize = '32px'; else totalEl.style.fontSize = '42px';
        
        const btnEl = document.getElementById('chart-view-btn');
        if (btnEl) btnEl.innerText = currentChartView;
        renderChart();

        const calContainer = document.getElementById('calendar-container'); calContainer.innerHTML = '';
        let loopCalDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
        let todayCal = getLogicalDate(); todayCal.setHours(23, 59, 59, 999); let html = '';
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        while(loopCalDate <= todayCal || (loopCalDate.getMonth() === todayCal.getMonth() && loopCalDate.getFullYear() === todayCal.getFullYear())) {
            let y = loopCalDate.getFullYear();
            let m = loopCalDate.getMonth();
            html += `<div class="month-block"><div class="month-name">${monthNames[m]} ${y}</div><div class="day-label-grid"><span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span></div><div class="month-grid">`;
            let firstDayOfWeek = new Date(y, m, 1).getDay();
            let daysInMonth = new Date(y, m + 1, 0).getDate();
            for(let i=0; i<firstDayOfWeek; i++) { html += `<div class="cal-day empty"></div>`; }
            for(let day=1; day<=daysInMonth; day++) {
                let loopD = new Date(y, m, day);
                if (loopD > todayCal) { html += `<div class="cal-day empty"></div>`; continue; }
                
                let val = historyMap[loopD.toDateString()];
                let count = typeof val === 'object' ? (val.c || 0) : (typeof val === 'number' ? val : 0);
                let g = typeof val === 'object' ? (val.g || dailyGoal) : dailyGoal;
                let isSkip = typeof val === 'object' ? val.s : false; 
                let isVacation = typeof val === 'object' ? val.v : false;
                
                let dayClass = '';
                if (count >= g && g > 0) { dayClass = 'met'; } 
                else if (isSkip || (isVacation && count < g)) { dayClass = 'skip'; } 
                else if (count >= (g / 2) && count > 0) { dayClass = 'half'; } 
                
                html += `<div class="cal-day ${dayClass}">${day}</div>`;
            }
            html += `</div></div>`; loopCalDate.setMonth(loopCalDate.getMonth() + 1);
        }
        calContainer.innerHTML = html; setTimeout(() => { calContainer.scrollLeft = calContainer.scrollWidth; }, 10);
    }

    function initAudio() { if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); }
    function vibrateDevice(type) { 
        if (!window.navigator.vibrate || !prefs.haptics) return;
        try { 
            if (type === 'correct') window.navigator.vibrate(40);
            else if (type === 'wrong') window.navigator.vibrate([100, 50, 100]); 
            else if (type === 'win') window.navigator.vibrate([100, 150, 100, 150, 100, 150, 450]);
            else if (type === 'goal') window.navigator.vibrate([100, 150, 100, 150, 100, 150, 450]);
            else if (type === 'rank') window.navigator.vibrate([50, 50, 50, 50, 50, 50, 50, 50, 600]);
        } catch(e){} 
    }
    function playTone(freq, type, duration, startTime=0, vol=0.1) { if(!audioCtx || !prefs.sound) return;
        const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain(); osc.type = type; osc.frequency.setValueAtTime(freq, audioCtx.currentTime + startTime); gain.gain.setValueAtTime(vol, audioCtx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + startTime + duration); osc.connect(gain); gain.connect(audioCtx.destination); osc.start(audioCtx.currentTime + startTime); osc.stop(audioCtx.currentTime + startTime + duration);
    }
    
    function soundCorrect() { playTone(600, 'sine', 0.1, 0, 0.05); setTimeout(() => playTone(900, 'sine', 0.2, 0, 0.05), 50); }
    function soundWrong() { playTone(100, 'triangle', 0.3, 0, 1); }
    function soundWin() { playTone(500, 'sine', 0.2, 0); playTone(700, 'sine', 0.2, 0.1); playTone(900, 'sine', 0.2, 0.2); playTone(1200, 'sine', 0.4, 0.3); }
    function soundGoalReached() { playTone(440, 'sine', 0.8, 0, 0.15); playTone(554, 'sine', 0.8, 0.15, 0.15); playTone(659, 'sine', 0.8, 0.3, 0.15); playTone(880, 'sine', 1.2, 0.45, 0.2); }
    
    function soundRankUp() {
        if(!audioCtx || !prefs.sound) return;
        playTone(440, 'sine', 0.15, 0, 0.1);      
        playTone(554.37, 'sine', 0.15, 0.1, 0.1); 
        playTone(659.25, 'sine', 0.15, 0.2, 0.1); 
        playTone(880, 'sine', 0.15, 0.3, 0.15);   
        playTone(1318.51, 'sine', 1.0, 0.45, 0.25); 
    }

    window.editGoal = async function() { 
        const input = await showDialog('prompt', 'Set Daily Goal', '', dailyGoal, 'SAVE');
        if (input !== null && input.toString().trim() !== '' && !isNaN(input) && parseInt(input) > 0) { 
            dailyGoal = parseInt(input);
            save(K_GOAL, dailyGoal); 
            
            let currentStr = getLogicalDateStr();
            if (historyMap[currentStr]) {
                if (typeof historyMap[currentStr] === 'number') { historyMap[currentStr] = { c: historyMap[currentStr], g: dailyGoal };
                } 
                else { historyMap[currentStr].g = dailyGoal;
                }
                save(K_HISTORY, historyMap);
            }
            window.updateProgressUI(); window.updateGameProgressUI();
        } 
    }
    
    window.updateProgressUI = function() {
        const fill = document.getElementById('prog-fill'); 
        const text = document.getElementById('prog-text'); 
        if(!fill || !text) return;
        let percentage = Math.min(100, (dailyProgress.count / dailyGoal) * 100);
        
        fill.style.width = percentage + '%';
        
        if (dailyProgress.count >= dailyGoal) { 
            text.innerHTML = `Goal Met: ${dailyProgress.count} / ${dailyGoal}`; 
            text.style.color = 'var(--correct-color)';
        } else { 
            text.innerHTML = `Daily Goal: ${dailyProgress.count} / ${dailyGoal}`; 
            text.style.color = 'var(--text-main)';
        }
    }

    window.updateGameProgressUI = function() {
        const fill = document.getElementById('game-progress-fill'); if(!fill) return; let percentage = Math.min(100, (dailyProgress.count / dailyGoal) * 100); fill.style.width = percentage + '%';
        if (percentage >= 100 && !fill.classList.contains('progress-dimmed')) { fill.style.boxShadow = '0 0 15px var(--correct-color), 0 0 30px var(--correct-color)';
        } else { fill.style.boxShadow = '0 0 10px var(--correct-color)'; }
    }

    window.addFocus = async function() {
        const inputEl = document.getElementById('new-focus-in');
        const name = inputEl.value;
        if(name && name.trim()) {
            const cleanName = toTitleCase(name.trim());
            if(!categories.includes(cleanName)) {
                categories.push(cleanName); selectedCats.push(cleanName);
                catsMeta[cleanName] = Date.now();
                manualOrder.push(cleanName);
                expandedFocusesManage[cleanName] = true; currentCatSelection = cleanName; save(K_CATS, categories); save(K_CATS_META, catsMeta); save(K_SEL, selectedCats); save(K_MANUAL_ORDER, manualOrder);
                updateManagerList(); window.updateList();
                inputEl.value = '';
            } else {
                await showDialog('confirm', 'Error', 'A focus with this name already exists.', '', 'OK');
            }
        }
    }

    window.editFolder = async function(oldName, event) {
        event.stopPropagation();
        const newNameRaw = await showDialog('prompt', 'Rename Focus', 'Enter new name for this Focus:', oldName, 'SAVE');
        if (newNameRaw && newNameRaw.trim()) {
            const cleanName = toTitleCase(newNameRaw.trim());
            if (cleanName === oldName) return;
            if (categories.includes(cleanName)) {
                await showDialog('confirm', 'Error', 'A focus with this name already exists.', '', 'OK');
                return;
            }
            
            let idx = categories.indexOf(oldName);
            if (idx !== -1) categories[idx] = cleanName;
            
            let mIdx = manualOrder.indexOf(oldName);
            if (mIdx !== -1) manualOrder[mIdx] = cleanName;
            
            let sIdx = selectedCats.indexOf(oldName);
            if (sIdx !== -1) selectedCats[sIdx] = cleanName;
            
            phrases.forEach(p => {
                if (p.category === oldName) p.category = cleanName;
            });
            
            if (catsMeta[oldName]) {
                catsMeta[cleanName] = catsMeta[oldName];
                delete catsMeta[oldName];
            }
            
            if (expandedFocusesMain[oldName]) {
                expandedFocusesMain[cleanName] = true;
                delete expandedFocusesMain[oldName];
            }
            if (expandedFocusesManage[oldName]) {
                expandedFocusesManage[cleanName] = true;
                delete expandedFocusesManage[oldName];
            }
            
            if (currentCatSelection === oldName) currentCatSelection = cleanName;
            
            save(K_CATS, categories); save(K_MANUAL_ORDER, manualOrder); save(K_SEL, selectedCats); save(K_DB, phrases); save(K_CATS_META, catsMeta);
            
            updateManagerList(); window.updateList();
        }
    }

    window.deleteFolder = function(cat, event) {
        event.stopPropagation();
        let catPhrases = phrases.filter(p => p.category === cat);
        let catIndex = categories.indexOf(cat);
        
        let state = {
            type: 'folder',
            catName: cat,
            phrases: catPhrases,
            index: catIndex,
            wasSelected: selectedCats.includes(cat),
            meta: catsMeta[cat]
        };
        
        categories = categories.filter(c => c !== cat);
        delete catsMeta[cat];
        manualOrder = manualOrder.filter(c => c !== cat);
        selectedCats = selectedCats.filter(c => c !== cat); 
        phrases = phrases.filter(p => p.category !== cat);
        if(currentCatSelection === cat) currentCatSelection = categories[0] || null;
        
        save(K_CATS, categories); save(K_CATS_META, catsMeta); save(K_SEL, selectedCats); save(K_DB, phrases); save(K_MANUAL_ORDER, manualOrder);
        updateManagerList(); window.updateList();
        
        showSnackbar('Focus deleted', state);
    }

    window.toggleCat = function(cat, isChecked, event) {
        event.stopPropagation();
        if(isChecked) { if(!selectedCats.includes(cat)) selectedCats.push(cat); } else { selectedCats = selectedCats.filter(c => c !== cat); }
        save(K_SEL, selectedCats); window.updateList();
    }
    
    window.toggleAllFocuses = function(event) {
        const isChecked = event.target.checked;
        if (isChecked) { selectedCats = [...categories]; } else { selectedCats = []; }
        save(K_SEL, selectedCats); window.updateList();
    };

    window.toggleExpandMain = function(cat) { expandedFocusesMain[cat] = !expandedFocusesMain[cat]; window.updateList(); }
    window.toggleExpandManage = function(cat) { expandedFocusesManage[cat] = !expandedFocusesManage[cat]; updateManagerList(); }

    window.moveCat = function(cat, dir, event) {
        event.stopPropagation();
        let idx = categories.indexOf(cat);
        if (idx < 0) return;
        let newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= categories.length) return;
        
        let temp = categories[newIdx];
        categories[newIdx] = cat;
        categories[idx] = temp;
        
        manualOrder = [...categories];
        save(K_MANUAL_ORDER, manualOrder);
        
        prefs.sortMode = 'Manual';
        save(K_PREFS, prefs);
        
        lastMovedCat = cat; 
        
        if (document.startViewTransition) {
            document.startViewTransition(() => {
                updateManagerList(); window.updateList();
            });
        } else {
            updateManagerList(); window.updateList();
        }
    }

    window.updateList = function() {
        const c = document.getElementById('list');
        if(!c) return;
        const selectAllCb = document.getElementById('select-all-checkbox');
        if (selectAllCb) { selectAllCb.checked = (categories.length > 0 && selectedCats.length === categories.length); }
        let html = '';
        categories.forEach(cat => {
            const catPhrases = phrases.filter(p => p.category === cat);
            const isChecked = selectedCats.includes(cat) ? 'checked' : '';
            const isExpanded = expandedFocusesMain[cat];
            const arrow = isExpanded ? '▼' : '▶';
            const totalCompletions = catPhrases.reduce((sum, p) => sum + (p.count || 0), 0);
            const fractionHtml = catPhrases.length > 0 && !isExpanded ? `<span class="fraction-text">${totalCompletions} / ${catPhrases.length}</span>` : '';

            html += `<div class="category-card"><div class="category-header" onclick="toggleExpandMain('${cat}')"><label class="custom-cb-label" onclick="event.stopPropagation()"><input type="checkbox" ${isChecked} onchange="toggleCat('${cat}', this.checked, event)"><span class="cb-mark"></span></label><h3><span class="expand-icon">${arrow}</span> ${cat}</h3>${fractionHtml}</div><div class="focus-content" style="display: ${isExpanded ? 'block' : 'none'};">`;
            if(catPhrases.length === 0) { html += `<div style="text-align:center; color:var(--text-muted); font-size:13px; padding: 7px 15px 15px 15px; font-style: italic;">This Focus is empty.<br>Go to Manage Focuses to add affirmations.</div>`; }
            catPhrases.forEach(p => { let colorClass = p.count > 0 ? 'color: var(--correct-color);' : 'color: var(--text-muted); opacity: 0.5;'; html += `<div class="item"><span class="phrase-text">${p.text}</span><div class="meta-container"><span class="count-tag" style="${colorClass}">${p.count}</span></div></div>`; });
            html += `</div></div>`; 
        });
        c.innerHTML = html; save(K_DB, phrases); window.updateProgressUI(); 
    }

    window.updateManagerList = function() {
        const c = document.getElementById('manage-list'); const catMenu = document.getElementById('cat-dropdown-menu'); const catBtn = document.getElementById('cat-view-btn'); if(!c) return;
        
        document.querySelectorAll('#sort-dropdown-menu .dropdown-item').forEach(el => el.classList.remove('active-sort'));
        let activeSortEl = document.getElementById('sort-opt-' + prefs.sortMode);
        if (activeSortEl) activeSortEl.classList.add('active-sort');

        if (catMenu && catBtn) { 
            catMenu.innerHTML = categories.map(cat => `<div class="dropdown-item" onclick="selectFocusCat('${cat}')">${cat}</div>`).join(''); 
            if (!categories.includes(currentCatSelection)) { currentCatSelection = categories[0] || null; } 
            catBtn.innerText = currentCatSelection || "No Focuses"; 
        }
        let html = '';
        categories.forEach(cat => {
            const catPhrases = phrases.filter(p => p.category === cat); const isExpanded = expandedFocusesManage[cat]; const arrow = isExpanded ? '▼' : '▶';
            
            let arrowsHtml = '';
            if (prefs.sortMode === 'Manual') {
                let isFirst = categories.indexOf(cat) === 0;
                let isLast = categories.indexOf(cat) === categories.length - 1;
                arrowsHtml = `<div class="sort-arrows">
                    <span onclick="moveCat('${cat}', -1, event)" style="opacity: ${isFirst ? '0.2' : '0.8'}; pointer-events: ${isFirst ? 'none' : 'auto'}">▲</span>
                    <span onclick="moveCat('${cat}', 1, event)" style="opacity: ${isLast ? '0.2' : '0.8'}; pointer-events: ${isLast ? 'none' : 'auto'}">▼</span>
                </div>`;
            }

            let highlightClass = (cat === lastMovedCat) ? ' moved-highlight' : '';
            let safeName = "manage-focus-" + cat.replace(/[^a-zA-Z0-9]/g, '');

            html += `<div class="category-card${highlightClass}" style="view-transition-name: ${safeName};"><div class="category-header" onclick="toggleExpandManage('${cat}')"><h3 style="padding-left: 5px;"><span class="expand-icon">${arrow}</span> ${cat}</h3>${arrowsHtml}<span class="icon-action-btn edit-folder" onclick="editFolder('${cat}', event)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></span><span class="icon-action-btn delete" onclick="deleteFolder('${cat}', event)">×</span></div><div class="focus-content" style="display: ${isExpanded ? 'block' : 'none'};">`;
            if(catPhrases.length === 0) { html += `<div style="text-align:center; color:var(--text-muted); font-size:13px; padding: 7px 15px 15px 15px; font-style: italic;">This Focus is empty.<br>Add an affirmation to begin.</div>`; }
            catPhrases.forEach(p => { 
                html += `<div class="item"><span class="phrase-text" style="color: var(--text-muted);">${p.text}</span><div class="meta-container">
                    <span class="icon-action-btn edit" onclick="editPhrase('${p.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></span>
                    <span class="icon-action-btn delete" onclick="removePhrase('${p.id}')">×</span>
                </div></div>`; 
            });
            html += `</div></div>`; 
        });
        c.innerHTML = html;
        lastMovedCat = null; 
    }

    window.addPhrase = async function() { 
        const i = document.getElementById('add-in');
        const cat = currentCatSelection;
        if(!cat) { await showDialog('confirm', 'Error', 'Please create a Focus first.', '', 'OK'); return; }
        if(i.value.trim()){ phrases.push({id: uid(), text: i.value.trim().toUpperCase(), count: 0, lifetimeCount: 0, category: cat}); i.value='';
        expandedFocusesManage[cat] = true; updateManagerList(); window.updateList(); } 
    }

    window.editPhrase = async function(id) {
        let p = phrases.find(p => p.id === id);
        if(!p) return;
        const newText = await showDialog('prompt', 'Edit Phrase', '', p.text, 'SAVE');
        if(newText && newText.trim()) {
            p.text = newText.trim().toUpperCase();
            save(K_DB, phrases);
            updateManagerList(); window.updateList();
        }
    }

    window.processBulk = async function() {
        const cat = currentCatSelection;
        if(!cat) { await showDialog('confirm', 'Error', 'Please create a Focus first.', '', 'OK'); return; }
        const lines = document.getElementById('bulk-in').value.split('\n');
        lines.forEach(l => { if(l.trim()) phrases.push({id: uid(), text: l.trim().toUpperCase(), count: 0, lifetimeCount: 0, category: cat}); });
        document.getElementById('bulk-in').value = '';
        expandedFocusesManage[cat] = true; 
        updateManagerList(); window.updateList();
    }

    window.removePhrase = function(id) { 
        let pIndex = phrases.findIndex(p => p.id === id);
        let phraseObj = phrases[pIndex];
        let inDeck = deck.includes(id);
        
        let state = { type: 'phrase', phrase: phraseObj, index: pIndex, inDeck: inDeck };
        
        phrases = phrases.filter(p => p.id !== id); 
        deck = deck.filter(dId => dId !== id); 
        save(K_DECK, deck); 
        if(activeState && activeState.phraseId === id) { activeState = null; save(K_STATE, null); } 
        
        updateManagerList(); window.updateList(); 
        showSnackbar('Phrase deleted', state);
    }

    // --- RESET ALL DATA (THE ONLY COPY!) ---
    window.resetAll = async function() {
        const confirmed = await showDialog('confirm', 'Reset All Data', 'Are you sure you want to erase everything? This cannot be undone.', '', 'RESET');
        if (confirmed) {
            localStorage.clear(); 
            window.location.reload(); 
        }
    };

    // --- GAME LOOP LOGIC ---
    window.startSession = async function() {
        const activePhrases = phrases.filter(p => selectedCats.includes(p.category));
        if(activePhrases.length === 0) { await showDialog('confirm', 'No Affirmations', 'Please select at least one Focus that contains affirmations.', '', 'OK'); return; }
        let newTodayStr = getLogicalDateStr();
        if (dailyProgress.date !== newTodayStr) { dailyProgress = { date: newTodayStr, count: 0 }; save(K_TODAY, dailyProgress); phrases.forEach(ph => ph.count = 0); save(K_DB, phrases); window.updateProgressUI(); document.getElementById('game-progress-fill').classList.remove('progress-dimmed'); } else if (dailyProgress.count >= dailyGoal) { document.getElementById('game-progress-fill').classList.add('progress-dimmed'); } else { document.getElementById('game-progress-fill').classList.remove('progress-dimmed'); }
        window.updateGameProgressUI(); initAudio(); document.getElementById('lib').style.display = 'none'; document.getElementById('game').style.display = 'flex'; document.body.classList.add('game-active');
        if (activeState && activePhrases.find(p => p.id === activeState.phraseId)) { 
            activeState.charIdx = 0; 
            save(K_STATE, activeState); 
            generateNewGrid(); 
            renderUI(); 
        } else { 
            nextRound(); 
        }
    }
    
    window.stopSession = function() { document.getElementById('lib').style.display = 'flex'; document.getElementById('game').style.display = 'none'; document.body.classList.remove('screen-goal-breathe'); document.body.classList.remove('world-expand'); document.body.classList.remove('game-active'); document.getElementById('goal-overlay').classList.remove('show'); document.getElementById('level-overlay').classList.remove('show'); window.updateList(); }
    
    window.continueGame = function() { document.getElementById('goal-overlay').classList.remove('show'); document.body.classList.remove('screen-goal-breathe'); document.body.classList.remove('world-expand'); nextRound(); }
    
    window.continueFromLevel = function() { document.getElementById('level-overlay').classList.remove('show'); document.body.classList.remove('screen-goal-breathe'); document.body.classList.remove('world-expand'); nextRound(); }
    
    window.finishGame = function() { stopSession(); }

    window.skipCurrentPhrase = function() {
        if (!activeState) return;
        deck.push(activeState.phraseId);
        save(K_DECK, deck);
        activeState = null; save(K_STATE, null);
        nextRound();
    }

    let currentObj = null; let charIdx = 0; let gridData = [];
    function nextRound() {
        document.body.classList.remove('screen-win-pulse'); document.getElementById('text-out').classList.remove('text-win-cyan');
        const activePhrases = phrases.filter(p => selectedCats.includes(p.category));
        if(activePhrases.length === 0) { stopSession(); return; }
        
        deck = deck.filter(id => activePhrases.some(p => p.id === id));
        
        if (deck.length === 0) {
            deck = activePhrases.map(p => p.id);
            for (let i = deck.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [deck[i], deck[j]] = [deck[j], deck[i]];
            }
        }
        
        const selectedId = deck.shift();
        save(K_DECK, deck);
        activeState = { phraseId: selectedId, charIdx: 0 }; save(K_STATE, activeState); generateNewGrid(); renderUI();
    }

    function getNeighbors(idx) {
        const r = Math.floor(idx / GRID_COLS); const c = idx % GRID_COLS; const neighbors = [];
        for (let dr = -1; dr <= 1; dr++) { for (let dc = -1; dc <= 1; dc++) { if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < 3 && nc >= 0 && nc < GRID_COLS) neighbors.push(nr * GRID_COLS + nc); } }
        return neighbors;
    }

    function generateNewGrid() {
        currentObj = phrases.find(p => p.id === activeState.phraseId);
        if(!currentObj) { nextRound(); return; } 
        const p = currentObj.text; charIdx = activeState.charIdx;
        let sequence = []; let tempIdx = charIdx;
        while (sequence.length < GRID_SIZE && tempIdx < p.length) { if (/[A-Z0-9]/.test(p[tempIdx])) sequence.push({ char: p[tempIdx], pIdx: tempIdx }); tempIdx++; }
        let slots = new Array(GRID_SIZE).fill(null); let usedIndices = new Set();
        let lastPos = -1;
        sequence.forEach(item => {
            let pos;
            if (lastPos === -1) pos = Math.floor(Math.random() * GRID_SIZE);
            else { let neighbors = getNeighbors(lastPos); let emptyNeighbors = neighbors.filter(n => !usedIndices.has(n)); if (emptyNeighbors.length > 0) pos = emptyNeighbors[Math.floor(Math.random() * emptyNeighbors.length)]; else { let emptySlots = slots.map((_, i) => i).filter(i => !usedIndices.has(i)); if(emptySlots.length > 0) pos = emptySlots[Math.floor(Math.random() * emptySlots.length)]; } }
            if (pos !== undefined) { slots[pos] = { ...item, solved: false }; usedIndices.add(pos); lastPos = pos; }
        });
        const pool = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        for (let i = 0; i < GRID_SIZE; i++) if (!slots[i]) slots[i] = { char: pool[Math.floor(Math.random() * pool.length)], pIdx: -1, solved: false };
        gridData = slots;
    }

    function renderUI() {
        currentObj = phrases.find(p => p.id === activeState.phraseId);
        if(!currentObj) { nextRound(); return; } 
        const p = currentObj.text; charIdx = activeState.charIdx;
        while (charIdx < p.length && !/[A-Z0-9]/.test(p[charIdx])) charIdx++;
        activeState.charIdx = charIdx; save(K_STATE, activeState);
        if (charIdx >= p.length) {
            let previousCount = dailyProgress.count;
            let newTodayStr = getLogicalDateStr();
            
            if (dailyProgress.date !== newTodayStr) { dailyProgress = { date: newTodayStr, count: 0 }; previousCount = 0; phrases.forEach(ph => ph.count = 0); }
            
            let oldTotal = prefs.lifetimeTotal || 0;
            let newTotal = oldTotal + 1;
            let oldLevelInfo = getLevelInfo(oldTotal);
            let newLevelInfo = getLevelInfo(newTotal);
            let justLeveledUp = newLevelInfo.level > oldLevelInfo.level;

            currentObj.count = (currentObj.count || 0) + 1; 
            currentObj.lifetimeCount = (currentObj.lifetimeCount || 0) + 1;
            prefs.lifetimeTotal = newTotal; 
            save(K_PREFS, prefs);
            
            dailyProgress.count++; 
            save(K_TODAY, dailyProgress); 
            window.updateGameProgressUI(); 
            
            let isSkip = historyMap[newTodayStr] ? historyMap[newTodayStr].s : false;
            let isVac = historyMap[newTodayStr] ? historyMap[newTodayStr].v : false;
            historyMap[newTodayStr] = { c: dailyProgress.count, g: dailyGoal, s: isSkip, v: isVac }; 
            save(K_HISTORY, historyMap);
            
            let justHitGoal = (previousCount < dailyGoal && dailyProgress.count >= dailyGoal);
            activeState = null; save(K_STATE, null); save(K_DB, phrases);
            const txtOut = document.getElementById('text-out'); txtOut.classList.add('text-win-cyan'); txtOut.innerHTML = p;
            
            if (justLeveledUp && !prefs.zenMode) {
                soundRankUp();
                vibrateDevice('rank'); 
                document.getElementById('game-progress-fill').classList.add('progress-dimmed'); 
                document.body.classList.add('screen-goal-breathe'); 
                document.body.classList.add('world-expand'); 
                
                document.getElementById('level-overlay-title').innerText = "LEVEL " + newLevelInfo.level;
                
                const rewardText = document.getElementById('level-reward-text');
                const btnContainer = document.getElementById('level-btns');
                const subtitle = document.getElementById('level-subtitle');

                if (newLevelInfo.level === 5) {
                    subtitle.innerText = "A new presence joins your orbit.";
                    rewardText.innerText = "✦ NEW GUIDE UNLOCKED: AURA ✦";
                    btnContainer.innerHTML = `<button class="btn-ghost" onclick="stopSession(); openGuides();">VIEW NEW GUIDE</button><button class="btn-ghost" style="border-color: transparent; background: transparent; box-shadow: none;" onclick="continueFromLevel()">CONTINUE</button>`;
                } else if (newLevelInfo.level === 10) {
                    subtitle.innerText = "The colors of the cosmos shift around you.";
                    rewardText.innerText = "✦ NEW THEME UNLOCKED: NEBULA ✦";
                    btnContainer.innerHTML = `<button class="btn-ghost" onclick="stopSession(); openThemes();">VIEW NEW THEME</button><button class="btn-ghost" style="border-color: transparent; background: transparent; box-shadow: none;" onclick="continueFromLevel()">CONTINUE</button>`;
                } else {
                    subtitle.innerText = "Your cosmic energy expands and your inner light grows brighter.";
                    rewardText.innerText = "";
                    btnContainer.innerHTML = `<button class="btn-ghost" onclick="continueFromLevel()">CONTINUE JOURNEY</button>`;
                }
                
                if (typeof window.checkUnlocks === 'function') window.checkUnlocks();

                setTimeout(() => { document.getElementById('level-overlay').classList.add('show'); }, 800);
            }
            else if (justHitGoal && !prefs.zenMode) { 
                soundGoalReached();
                vibrateDevice('goal'); 
                document.getElementById('game-progress-fill').classList.add('progress-dimmed'); 
                document.body.classList.add('screen-goal-breathe'); 
                
                const mainPetImg = document.getElementById('companion-image-display');
                const overlayPetImg = document.getElementById('overlay-companion-img');
                if (mainPetImg && overlayPetImg) {
                    overlayPetImg.src = mainPetImg.src;
                }

                setTimeout(() => { document.getElementById('goal-overlay').classList.add('show'); }, 800);
            }
            else { 
                soundWin();
                vibrateDevice('win'); document.body.classList.add('screen-win-pulse'); setTimeout(nextRound, 1400); 
            }
            return;
        }
        if (!gridData.some(b => !b.solved && b.char === p[charIdx])) { generateNewGrid(); renderUI(); return; }
        document.getElementById('text-out').innerHTML = p.split('').map((c, i) => !/[A-Z0-9]/.test(c) ? c : `<span class="${i === charIdx ? 'active-letter' : ''}">${c}</span>`).join('');
        const grid = document.getElementById('grid'); grid.innerHTML = '';
        gridData.forEach((item) => {
            const b = document.createElement('button'); b.className = `bub ${item.solved ? 'correct' : ''}`; b.innerText = item.char;
            b.onclick = () => { if (item.solved) return; if (item.char === p[charIdx]) { item.solved = true; b.classList.add('correct'); activeState.charIdx = charIdx + 1; save(K_STATE, activeState); vibrateDevice('correct'); if (charIdx < p.length - 1) soundCorrect(); renderUI(); } else { soundWrong(); vibrateDevice('wrong'); b.classList.add('wrong'); setTimeout(() => b.classList.remove('wrong'), 300); } };
            grid.appendChild(b);
        });
    }

    // --- GUIDE EQUIPMENT & STATUS LOGIC (THE ONLY COPY!) ---
    window.equipGuide = function(cardElement) {
        let url;
        if (!cardElement) return;
        
        if (typeof cardElement === 'string') {
            url = cardElement;
        } else {
            const img = cardElement.querySelector('.collection-img');
            if(img) url = img.src;
        }
        
        if(!url) return;

        if (!prefs.customGuideName) prefs.customGuideName = "Echo";

        const mainImg = document.getElementById('companion-image-display');
        const overlayImg = document.getElementById('overlay-companion-img');
        if(mainImg) mainImg.src = url;
        if(overlayImg) overlayImg.src = url;

        prefs.activeGuideUrl = url;
        save(K_PREFS, prefs);

        document.querySelectorAll('.guide-card').forEach(c => c.classList.remove('active-selection'));
        if (typeof cardElement !== 'string') {
            cardElement.classList.add('active-selection');
        } else {
            document.querySelectorAll('.guide-card.unlocked').forEach(card => {
                const img = card.querySelector('.collection-img');
                if (img && img.src === url) card.classList.add('active-selection');
            });
        }
        window.updateGuideLabels();
    };

    window.updateGuideLabels = function() {
        document.querySelectorAll('.guide-card').forEach(card => {
            const img = card.querySelector('.collection-img');
            const label = card.querySelector('.guide-status-label');
            if (!img || !label) return;

            if (img.src === prefs.activeGuideUrl) {
                label.innerText = "Equipped";
                label.style.color = "var(--correct-color)";
            } else if (card.classList.contains('locked')) {
                label.innerText = "Locked";
                label.style.color = "var(--text-muted)";
            } else {
                label.innerText = "Select";
                label.style.color = "var(--text-main)";
            }
        });
    };

    window.equipTheme = function(themeName, cardElement) {
        if (typeof applyThemeVariables === 'function') {
            applyThemeVariables(themeName);
        }

        prefs.activeTheme = themeName;
        save(K_PREFS, prefs);

        document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active-selection'));
        if(cardElement) {
            cardElement.classList.add('active-selection');
        } else {
            document.querySelectorAll('.theme-card.unlocked').forEach(card => {
                if (card.getAttribute('data-theme-name') === themeName) card.classList.add('active-selection');
            });
        }
    };

    window.editGuideName = async function() {
        const currentName = prefs.customGuideName || "Echo";
        const newName = await showDialog('prompt', 'Name Your Companion', 'What should we call your guide? (Max 14 chars)', currentName, 'SAVE');
        
        if (newName && newName.trim()) {
            let cleanName = newName.trim();
            if (cleanName.length > 14) cleanName = cleanName.substring(0, 14);
            
            prefs.customGuideName = cleanName;
            save(K_PREFS, prefs);
            
            const mainName = document.getElementById('companion-name-display');
            if(mainName) mainName.innerText = "Guide: " + prefs.customGuideName;
            
            const menuNameBtn = document.getElementById('guides-menu-name-btn');
            if(menuNameBtn) menuNameBtn.innerHTML = `${prefs.customGuideName} <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
        }
    };

    // --- INITIALIZE COMPANION ON LOAD ---
    const mainImg = document.getElementById('companion-image-display');
    const mainName = document.getElementById('companion-name-display'); 
    const menuNameBtn = document.getElementById('guides-menu-name-btn'); 
    
    if (prefs.activeGuideUrl) {
        if(mainImg) mainImg.src = prefs.activeGuideUrl;
    } else {
        const defaultGuideCard = document.querySelector('.guide-card.unlocked');
        if (defaultGuideCard) {
            window.equipGuide(defaultGuideCard);
        }
    }
    
    if(mainName) mainName.innerText = "Guide: " + prefs.customGuideName;
    if(menuNameBtn) {
        menuNameBtn.innerHTML = `${prefs.customGuideName} <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
    }

    window.updateGuideLabels();

    // --- AUTO-PAINT THEME CARDS ---
    if (typeof APP_THEMES !== 'undefined') {
        document.querySelectorAll('.theme-card').forEach(card => {
            const themeName = card.getAttribute('data-theme-name');
            if (themeName && APP_THEMES[themeName]) {
                const themeData = APP_THEMES[themeName];
                const previewDiv = card.querySelector('.theme-preview');
                
                if (previewDiv && !previewDiv.classList.contains('blurred')) {
                    previewDiv.style.backgroundImage = themeData["--bg-image"];
                    previewDiv.style.backgroundSize = "cover";
                    previewDiv.style.backgroundPosition = "center";
                    previewDiv.style.borderRadius = "8px";

                    previewDiv.innerHTML = `
                        <div style="position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); display: flex; gap: 4px; background: rgba(0,0,0,0.5); padding: 4px 6px; border-radius: 12px; backdrop-filter: blur(4px);">
                            <div style="width: 12px; height: 12px; border-radius: 50%; background: ${themeData["--bg-base"]}; border: 1px solid rgba(255,255,255,0.3);"></div>
                            <div style="width: 12px; height: 12px; border-radius: 50%; background: ${themeData["--text-main"]}; border: 1px solid rgba(255,255,255,0.3);"></div>
                            <div style="width: 12px; height: 12px; border-radius: 50%; background: ${themeData["--correct-color"]}; border: 1px solid rgba(255,255,255,0.3);"></div>
                        </div>
                    `;
                }
            }
        });
    }

    // --- MASTER UNLOCK LOGIC ---
    window.checkUnlocks = function() {
        const total = prefs.lifetimeTotal || 0;
        const currentLevelInfo = getLevelInfo(total);
        const currentLevel = currentLevelInfo.level;

        document.querySelectorAll('.unlockable-item').forEach(item => {
            const reqLevel = parseInt(item.getAttribute('data-unlock-level'));
            
            if (currentLevel >= reqLevel) {
                item.classList.remove('locked');
                item.classList.add('unlocked');
                
                const lockGlass = item.querySelector('.locked-glass');
                if (lockGlass) lockGlass.style.display = 'none';
                
                const img = item.querySelector('.collection-img');
                if (img) img.classList.remove('silhouette');
                
                const preview = item.querySelector('.theme-preview');
                if (preview) preview.classList.remove('blurred');
            }
        });
        
        if (typeof window.updateGuideLabels === 'function') window.updateGuideLabels();
    };

    window.checkUnlocks(); 
    window.updateList();

}); // <-- The ONLY DOMContentLoaded closing bracket

// --- GLOBAL WINDOW FUNCTIONS ---
window.closeGoalOverlay = function() {
    document.getElementById('goal-overlay').classList.remove('show');
    document.body.classList.remove('screen-goal-breathe');
};

window.goHome = function() {
    stopSession();
};
