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

    // --- THE MASTER REWARD DICTIONARY ---
    const LEVEL_REWARDS = {
        5:  { 
            type: "GUIDE", 
            name: "CUMULUS",
            visual: `<img src="images/cumulus.png" class="reward-image-preview">`,
            actionHtml: `<button class="btn-ghost" onclick="stopSession(); openGuides(); document.getElementById('level-up-overlay').classList.remove('active');">VIEW REWARD</button>`
        },
        10: { 
            type: "THEME", 
            name: "CRYSTALLINE CAVE",
            visual: `<img src="images/gem-cave.png" class="reward-image-preview">`, 
            actionHtml: `<button class="btn-ghost" onclick="stopSession(); openThemes(); document.getElementById('level-up-overlay').classList.remove('active');">VIEW REWARD</button>`
        },
        15: { 
            type: "SHAPE", 
            name: "HEXAGON BUBBLES",
            visual: `<div class="reward-emoji-preview">⬡</div>`,
            actionHtml: `<button class="btn-ghost" onclick="closeLevelUp()">VIEW REWARD</button>`
        },
        20: { 
            type: "RARE ITEM", 
            name: "CHRONO-SHIELD",
            visual: `<div class="reward-emoji-preview">🛡️</div>`,
            actionHtml: `<button class="btn-ghost" onclick="closeLevelUp()">VIEW REWARD</button>`
        }
    };

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
            
            // NEW: Dynamically generate a multi-line text area if it doesn't exist yet
            let textAreaEl = document.getElementById('cd-textarea');
            if (!textAreaEl) {
                textAreaEl = document.createElement('textarea');
                textAreaEl.id = 'cd-textarea';
                
                // THE CSS FIX: Copy the exact inline styles (like width: 100%) from the input!
                textAreaEl.style.cssText = inputEl.style.cssText; 
                
                // --- THE MOBILE KEYBOARD FIXES ---
                textAreaEl.setAttribute('autocomplete', 'nope'); 
                textAreaEl.setAttribute('autocorrect', 'on');    
                textAreaEl.setAttribute('spellcheck', 'true');   
                
                // --- THE MOBILE & SPACING FIXES ---
                textAreaEl.style.resize = 'none'; 
                textAreaEl.style.height = '120px'; 
                textAreaEl.style.fontFamily = 'inherit';
                
                inputEl.parentNode.insertBefore(textAreaEl, inputEl.nextSibling);
            }

            const btnCancel = document.getElementById('cd-btn-cancel');
            const btnConfirm = document.getElementById('cd-btn-confirm');

            titleEl.innerHTML = title;
            
            // Safely convert new lines to HTML line breaks
            if (message) { 
                msgEl.innerHTML = String(message).replace(/\n/g, '<br>'); 
                msgEl.style.display = 'block'; 
            } else { 
                msgEl.style.display = 'none'; 
            }

            // Hide both inputs by default
            let activeInput = inputEl;
            inputEl.style.display = 'none';
            textAreaEl.style.display = 'none';

            if (type === 'prompt') { 
                if (title === 'Edit Affirmation') { 
                    activeInput = textAreaEl;
                } else {
                    activeInput = inputEl;
                    activeInput.type = (title === 'Set Daily Goal') ? 'number' : 'text';
                }
                activeInput.style.display = 'block';
                activeInput.value = defaultValue; 
            }

            btnConfirm.innerHTML = confirmText;
            
            if (cancelText === '') {
                btnCancel.style.display = 'none';
            } else {
                btnCancel.style.display = 'block';
                btnCancel.innerHTML = cancelText;
            }

            if (confirmText === 'DELETE' || confirmText === 'RESET') {
                btnConfirm.style.background = 'var(--wrong-color)';
                btnConfirm.style.color = 'white';
            } else {
                btnConfirm.style.background = '';
                btnConfirm.style.color = '';
            }

            // THE RENDERING FIX: Removed the appendChild line so the browser stops turning the popup invisible!
            overlay.style.setProperty('z-index', '999999', 'important');
            overlay.classList.add('show');
            
            if (type === 'prompt') { setTimeout(() => activeInput.focus(), 100); }

            const cleanup = () => { 
                overlay.classList.remove('show'); 
                activeInput.onkeydown = null; 
            };

            btnCancel.onclick = () => { 
                cleanup(); 
                resolve(null); 
                if (title === 'Set Daily Goal') {
                    document.getElementById('me-overlay').classList.add('show');
                }
            };

            btnConfirm.onclick = () => { 
                cleanup();
                resolve(type === 'prompt' ? activeInput.value : true); 
                if (title === 'Set Daily Goal') {
                    document.getElementById('me-overlay').classList.add('show');
                }
            };
            
            activeInput.onkeydown = (e) => { 
                // Allow Shift+Enter for new lines, but normal Enter auto-saves
                if (e.key === 'Enter' && !e.shiftKey) { 
                    e.preventDefault();
                    btnConfirm.click(); 
                } 
            };
        });
    }

    // --- SNACKBAR UNDO LOGIC ---
    let snackTimeout;
    let snackState = null;

    function showSnackbar(msg, stateData) {
        snackState = stateData;
        const sb = document.getElementById('snackbar');
        const msgEl = document.getElementById('snack-msg');
        
        msgEl.innerText = msg;
        
        // Let's dynamically fix the CSS layout dead space!
        const undoBtn = sb.querySelector('[onclick*="triggerUndo"]');
        if (undoBtn) {
            if (stateData) {
                // Undo state: Show button, spread them out, restore normal width
                undoBtn.style.display = 'inline-block';
                sb.style.justifyContent = 'space-between';
                sb.style.minWidth = ''; // Restores your original CSS default
                msgEl.style.textAlign = 'left';
                msgEl.style.marginRight = '15px'; // Keeps text from touching the button
            } else {
                // Alert state: Hide button, shrink the dead space, center the text!
                undoBtn.style.display = 'none';
                sb.style.justifyContent = 'center';
                sb.style.minWidth = 'max-content'; // This shrinks the capsule!
                msgEl.style.textAlign = 'center';
                msgEl.style.marginRight = '0px'; 
            }
        }

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
        prefs = { lightMode: false, zenMode: false, showBackground: true, soundUI: true, soundGame: true, haptics: true, nightOwl: false, lifetimeTotal: 0, bestStreak: 0, skipCredits: 3, lastSkipResetMonth: "", vacationMode: false, lastActiveDate: Date.now(), sortMode: 'Manual', customGuideName: "Echo" };
    } else {
        if (typeof prefs.lightMode === 'undefined') prefs.lightMode = false;
        if (typeof prefs.zenMode === 'undefined') prefs.zenMode = false;
        if (typeof prefs.showBackground === 'undefined') prefs.showBackground = true;
        // The Sound Fix:
        if (typeof prefs.soundUI === 'undefined') prefs.soundUI = prefs.sound !== undefined ? prefs.sound : true;
        if (typeof prefs.soundGame === 'undefined') prefs.soundGame = prefs.sound !== undefined ? prefs.sound : true;
        if (typeof prefs.haptics === 'undefined') prefs.haptics = true;
        if (typeof prefs.nightOwl === 'undefined') prefs.nightOwl = false;
        if (typeof prefs.vacationMode === 'undefined') prefs.vacationMode = false;
        if (typeof prefs.lastActiveDate === 'undefined') prefs.lastActiveDate = Date.now();
        if (typeof prefs.sortMode === 'undefined') prefs.sortMode = 'Manual';
        if (typeof prefs.customGuideName === 'undefined') prefs.customGuideName = "Echo";
    }

    let nameCheck = String(prefs.customGuideName);
    if (!prefs.customGuideName || nameCheck.includes("undefined") || nameCheck.includes("null") || nameCheck.includes("object") || nameCheck.trim() === "") {
        prefs.customGuideName = "Echo";
        save(K_PREFS, prefs); 
    }

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

    let selectedCats = load(K_SEL);
    if (!Array.isArray(selectedCats)) {
        selectedCats = [...categories]; 
        save(K_SEL, selectedCats);
    }
    
    // --- THE PRO FIX: Restore Progress on Date Change ---
    let todayString = getLogicalDateStr();
    let dailyProgress = load(K_TODAY) || { date: todayString, count: 0 };
    
    if (dailyProgress.date !== todayString) { 
        let recoveredCount = 0;
        // Check if we already have progress saved for this logical day
        if (historyMap[todayString]) {
            recoveredCount = historyMap[todayString].c !== undefined ? historyMap[todayString].c : (typeof historyMap[todayString] === 'number' ? historyMap[todayString] : 0);
        }
        dailyProgress = { date: todayString, count: recoveredCount };
        save(K_TODAY, dailyProgress); 
        phrases.forEach(p => p.count = 0); 
        save(K_DB, phrases); 
    }
    
    let expandedFocusesMain = {};
    let expandedFocusesManage = {};

    let deck = load(K_DECK) || []; let activeState = load(K_STATE) || null; let audioCtx = null;
    
    if(prefs.lightMode) { document.body.classList.add('light-mode'); document.documentElement.classList.add('light-mode'); updateThemeMetaColor(true);
    } else { document.documentElement.classList.remove('light-mode'); updateThemeMetaColor(false); }
    
    const sText = document.getElementById('skips-remaining-text');
    if (sText) sText.innerText = prefs.skipCredits !== undefined ? prefs.skipCredits : 3;
    
    applyZenModeUI();
    applyBackgroundUI();
    applySort(); 

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

    // --- NEW VACATION MODE RETURN PROMPT ---
    function checkVacationStatus() {
        if (!prefs.vacationMode) return; 

        let today = getLogicalDateStr();

        // If the current logical day is DIFFERENT from the day they started vacation...
        if (prefs.vacationDate && prefs.vacationDate !== today) {
            
            let guideName = prefs.customGuideName || "Echo";

            window.guideSpeak(
                "Welcome Back", 
                `I see you're in vacation mode. Are you ready to resume your practice with me?`, 
                "RESUME", 
                () => {
                    // Turn off vacation mode and hide the banner!
                    prefs.vacationMode = false;
                    save(K_PREFS, prefs);
                    applyVacationUI();
                },
                "NOT YET", 
                () => {
                    // Update the vacation date to TODAY so we don't bother them again until tomorrow!
                    prefs.vacationDate = today;
                    save(K_PREFS, prefs);
                }
            );
        }
    }
    setTimeout(checkVacationStatus, 1000);

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
        let dStr = getLogicalDateStr();

        if (prefs.vacationMode) {
            prefs.lastActiveDate = Date.now();
            prefs.vacationDate = dStr; // <--- ADDED THIS LINE!
            if (!historyMap[dStr]) historyMap[dStr] = { c: 0, g: dailyGoal };
            if (typeof historyMap[dStr] === 'number') historyMap[dStr] = { c: historyMap[dStr], g: dailyGoal };
            historyMap[dStr].v = true;
            save(K_HISTORY, historyMap);
        } else {
            // --- THE FIX: Erase the free pass if they turn it off! ---
            if (historyMap[dStr] && typeof historyMap[dStr] === 'object') {
                historyMap[dStr].v = false;
                save(K_HISTORY, historyMap);
            }
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

    // THE FIX: Two new functions to replace the single toggleSound
    window.toggleUISound = function() { prefs.soundUI = document.getElementById('sound-ui-toggle').checked; save(K_PREFS, prefs); }
    window.toggleGameSound = function() { prefs.soundGame = document.getElementById('sound-game-toggle').checked; save(K_PREFS, prefs); }

    window.toggleHaptics = function() { prefs.haptics = document.getElementById('haptics-toggle').checked; save(K_PREFS, prefs); }
    window.toggleNightOwl = function() { 
        prefs.nightOwl = document.getElementById('nightowl-toggle').checked;
        save(K_PREFS, prefs); 
        todayString = getLogicalDateStr();
        
        if (dailyProgress.date !== todayString) {
            let recoveredCount = 0;
            // Catch the progress instead of resetting to 0
            if (historyMap[todayString]) {
                recoveredCount = historyMap[todayString].c !== undefined ? historyMap[todayString].c : (typeof historyMap[todayString] === 'number' ? historyMap[todayString] : 0);
            }
            dailyProgress = { date: todayString, count: recoveredCount };
            save(K_TODAY, dailyProgress);
            phrases.forEach(p => p.count = 0); save(K_DB, phrases);
        }
        window.updateProgressUI(); window.updateList();
    }

    window.applySkip = async function() {
        if (prefs.skipCredits <= 0) {
            await showDialog('confirm', 'Out of Shields', 'You\'re out of silver shields for now, but don\'t worry! The cosmos grants you three new ones on the 1st.', '', 'GOT IT', '');
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
            await showDialog('confirm', 'Streak Intact', 'No missed activity recorded for yesterday. Your streak is safe without a shield!', '', 'GOT IT', '');
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
            
            // NEW LOGIC: Gives them the option to jump straight to the Calendar!
            const viewCal = await showDialog('confirm', 'Streak Protected', 'One shield used. Your calendar has been updated!', '', 'VIEW CALENDAR', 'OK');
            if (viewCal) {
                closeOverlays();
                openStats();
            }
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
            
            // THE FIX: Sync all the individual arrows to match the "Expand All" state!
            const poly = c.previousElementSibling.querySelector('polyline');
            if (poly) {
                poly.setAttribute('points', isExpanding ? '18 15 12 9 6 15' : '6 9 12 15 18 9');
            }
        });

        btnText.innerText = isExpanding ? 'COLLAPSE ALL' : 'EXPAND ALL';
        btnIcon.innerHTML = isExpanding ? '<polyline points="18 15 12 9 6 15"></polyline>' : '<polyline points="6 9 12 15 18 9"></polyline>';
    };

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
            if (document.getElementById('sound-ui-toggle')) document.getElementById('sound-ui-toggle').checked = !!prefs.soundUI;
            if (document.getElementById('sound-game-toggle')) document.getElementById('sound-game-toggle').checked = !!prefs.soundGame;
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
        
        // THE FIX: Assign the two sound toggles safely
        if (document.getElementById('sound-ui-toggle')) document.getElementById('sound-ui-toggle').checked = !!prefs.soundUI;
        if (document.getElementById('sound-game-toggle')) document.getElementById('sound-game-toggle').checked = !!prefs.soundGame;

        document.getElementById('haptics-toggle').checked = !!prefs.haptics;
        document.getElementById('nightowl-toggle').checked = !!prefs.nightOwl;
        document.getElementById('settings-overlay').classList.add('show');
    };
    
    window.openStats = () => { renderStats(); document.getElementById('stats-overlay').classList.add('show'); };
    window.openManager = () => { updateManagerList(); document.getElementById('manage-overlay').classList.add('show'); };
    window.closeOverlays = () => { document.querySelectorAll('.glass-overlay').forEach(el => el.classList.remove('show')); };
    
    window.closeManager = () => { 
        document.getElementById('manage-overlay').classList.remove('show'); 
        
        // --- NEW: Reset the Bulk Upload UI ---
        document.getElementById('bulk-area').style.display = 'none';
        document.getElementById('bulk-toggle-btn').style.display = 'block';
        document.getElementById('bulk-in').value = ''; // Clears the text box too!
        
        window.updateList(); 
        document.getElementById('me-overlay').classList.add('show');
    };
    window.openBreakdown = () => { 
        renderBreakdown(); 
        document.getElementById('breakdown-overlay').classList.add('show'); 
        
        // THE FIX: Reset the Expand All button back to its default state every time you open the menu!
        const btnText = document.querySelector('#toggle-all-breakdown-btn span');
        const btnIcon = document.getElementById('expand-all-icon');
        if (btnText) btnText.innerText = 'EXPAND ALL';
        if (btnIcon) btnIcon.innerHTML = '<polyline points="6 9 12 15 18 9"></polyline>';
    };
    window.closeBreakdown = () => { document.getElementById('breakdown-overlay').classList.remove('show'); };
    
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
            
            // THE FIX: The onclick now toggles the 'show' class AND manually flips the SVG points up or down!
            html += `<div class="breakdown-card"><div class="breakdown-header" onclick="const content = this.nextElementSibling; const isShowing = content.classList.toggle('show'); const poly = this.querySelector('polyline'); if(poly) poly.setAttribute('points', isShowing ? '18 15 12 9 6 15' : '6 9 12 15 18 9');"><span>${cat}</span><span class="breakdown-total">${catTotal.toLocaleString()} <span style="opacity:0.5; display: flex; align-items: center;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></span></span></div><div class="breakdown-content"><div style="font-size: 11px; color: var(--text-muted); margin-top: 8px; margin-bottom: 12px; font-style: italic; text-align: center; border-bottom: 1px solid var(--border-glass); padding-bottom: 10px;">You're averaging <span style="color: var(--correct-color); font-weight: bold;">${catPace}</span> <strong>${cat}</strong> affirmations a day!</div>`;
            catPhrases.sort((a,b) => (b.lifetimeCount||0) - (a.lifetimeCount||0)).forEach(p => { html += `<div class="breakdown-item"><span class="b-text">${p.text}</span><span class="b-count">${(p.lifetimeCount||0).toLocaleString()}</span></div>`; });
            html += `</div></div>`;
        });
        document.getElementById('breakdown-list').innerHTML = html || '<div style="text-align:center; padding:20px; color:var(--text-muted);">No history yet. Complete an affirmation to see it here!</div>';
    }
    
    function renderChart() {
        const today = getLogicalDate();
        let pastD = new Date(today); let allDates = Object.keys(historyMap).map(k => new Date(k)).filter(d => !isNaN(d));
        let minHistoryDate = allDates.length > 0 ? new Date(Math.min(...allDates)) : new Date(); minHistoryDate.setHours(0,0,0,0);
        if (currentChartView === 'Day') { 
            pastD.setDate(today.getDate() - 13); 
        } else if (currentChartView === 'Week') { 
            pastD.setDate(today.getDate() - 56);
        } else if (currentChartView === 'Month') { 
            pastD.setMonth(today.getMonth() - 5); 
        } else if (currentChartView === 'Year') { 
            pastD = new Date(minHistoryDate); 
        }
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
    
    // THE FIX: Game sounds use prefs.soundGame
    function playTone(freq, type, duration, startTime=0, vol=0.1) { if(!audioCtx || !prefs.soundGame) return;
        const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain(); osc.type = type; osc.frequency.setValueAtTime(freq, audioCtx.currentTime + startTime); gain.gain.setValueAtTime(vol, audioCtx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + startTime + duration); osc.connect(gain); gain.connect(audioCtx.destination); osc.start(audioCtx.currentTime + startTime); osc.stop(audioCtx.currentTime + startTime + duration);
    }
    
    function soundCorrect() { playTone(600, 'sine', 0.1, 0, 0.05); setTimeout(() => playTone(900, 'sine', 0.2, 0, 0.05), 50); }
    function soundWrong() { playTone(100, 'triangle', 0.3, 0, 1); }
    function soundWin() { playTone(500, 'sine', 0.2, 0); playTone(700, 'sine', 0.2, 0.1); playTone(900, 'sine', 0.2, 0.2); playTone(1200, 'sine', 0.4, 0.3); }
    function soundGoalReached() { playTone(440, 'sine', 0.8, 0, 0.15); playTone(554, 'sine', 0.8, 0.15, 0.15); playTone(659, 'sine', 0.8, 0.3, 0.15); playTone(880, 'sine', 1.2, 0.45, 0.2); }
    
    function soundRankUp() {
        if(!audioCtx || !prefs.soundGame) return;
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
                
                // --- FIXED: The snackbar is now in the right place! ---
                showSnackbar('Category created!', null);
            } else {
                await showDialog('confirm', 'Oops!', 'A category with this name already exists. Please pick a new one.', '', 'GOT IT', '');
            }
        }
    }

    window.editFolder = async function(oldName, event) {
        event.stopPropagation();
        if(window.playGlassTap) window.playGlassTap(); // THE AUDIO FIX!
        const newNameRaw = await showDialog('prompt', 'Rename Category', 'Enter new name for this Category:', oldName, 'SAVE');
        if (newNameRaw && newNameRaw.trim()) {
            const cleanName = toTitleCase(newNameRaw.trim());
            if (cleanName === oldName) return;
            if (categories.includes(cleanName)) {
                await showDialog('confirm', 'Oops!', 'A category with this name already exists. Please pick a new one.', '', 'GOT IT', '');
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
        if(window.playGlassTap) window.playGlassTap(); // THE AUDIO FIX!
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
        
        showSnackbar('Category deleted', state);
    }

    window.toggleCat = function(cat, isChecked, event) {
        event.stopPropagation();
        if(window.playGlassTap) window.playGlassTap(); // THE AUDIO FIX!
        if(isChecked) { if(!selectedCats.includes(cat)) selectedCats.push(cat); } else { selectedCats = selectedCats.filter(c => c !== cat); }
        save(K_SEL, selectedCats); window.updateList();
    }
    
    window.toggleAllFocuses = function(event) {
        if(window.playGlassTap) window.playGlassTap(); // THE AUDIO FIX!
        const isChecked = event.target.checked;
        if (isChecked) { selectedCats = [...categories]; } else { selectedCats = []; }
        save(K_SEL, selectedCats); window.updateList();
    };

    window.toggleExpandMain = function(cat) { expandedFocusesMain[cat] = !expandedFocusesMain[cat]; window.updateList(); }
    window.toggleExpandManage = function(cat) { expandedFocusesManage[cat] = !expandedFocusesManage[cat]; updateManagerList(); }

    window.moveCat = function(cat, dir, event) {
        event.stopPropagation();
        if(window.playGlassTap) window.playGlassTap(); // THE AUDIO FIX!
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
        
        // --- NEW: THE MAIN PAGE EMPTY STATE ---
        if (categories.length === 0) {
            c.innerHTML = `<div style="text-align:center; color:var(--text-muted); font-size:14px; padding: 20px; font-style: italic; line-height: 1.6;">Your journey begins here.<br><br>Go to <strong>Account > Manage Affirmations</strong> to create your first category.</div>`;
            save(K_DB, phrases); window.updateProgressUI(); 
            return; // Stop running the rest of the function!
        }

        let html = '';
        categories.forEach(cat => {
            let safeCat = cat.replace(/'/g, "\\'"); 
            const catPhrases = phrases.filter(p => p.category === cat);
            const isChecked = selectedCats.includes(cat) ? 'checked' : '';
            const isExpanded = expandedFocusesMain[cat];
            const arrow = isExpanded 
                ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top: 2px;"><polyline points="6 9 12 15 18 9"></polyline></svg>`
                : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top: 2px;"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
            const totalCompletions = catPhrases.reduce((sum, p) => sum + (p.count || 0), 0);
            const fractionHtml = catPhrases.length > 0 && !isExpanded ? `<span class="fraction-text">${totalCompletions} / ${catPhrases.length}</span>` : '';

            html += `<div class="category-card"><div class="category-header" onclick="toggleExpandMain('${safeCat}')"><label class="custom-cb-label" onclick="event.stopPropagation()"><input type="checkbox" ${isChecked} onchange="toggleCat('${safeCat}', this.checked, event)"><span class="cb-mark"></span></label><h3><span class="expand-icon">${arrow}</span> ${cat}</h3>${fractionHtml}</div><div class="focus-content" style="display: ${isExpanded ? 'block' : 'none'};">`;
            if(catPhrases.length === 0) { html += `<div style="text-align:center; color:var(--text-muted); font-size:13px; padding: 7px 15px 15px 15px; font-style: italic;">It's a little quiet here.<br>Go to Manage Affirmations to add an affirmation to this category.</div>`; }
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
            catBtn.innerText = currentCatSelection || "No Categories"; 
        }

        // --- NEW: THE MANAGE PAGE EMPTY STATE ---
        if (categories.length === 0) {
            c.innerHTML = `<div style="text-align:center; color:var(--text-muted); font-size:14px; padding: 20px; font-style: italic; line-height: 1.6;">Your collection is empty.<br><br>Use the tools above to create your first category!</div>`;
            lastMovedCat = null; 
            return; // Stop running the rest of the function!
        }

        let html = '';
        categories.forEach(cat => {
            let safeCat = cat.replace(/'/g, "\\'");
            const catPhrases = phrases.filter(p => p.category === cat); const isExpanded = expandedFocusesManage[cat]; const arrow = isExpanded 
                ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top: 2px;"><polyline points="6 9 12 15 18 9"></polyline></svg>`
                : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top: 2px;"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
            
            let arrowsHtml = '';
            if (prefs.sortMode === 'Manual') {
                let isFirst = categories.indexOf(cat) === 0;
                let isLast = categories.indexOf(cat) === categories.length - 1;
                arrowsHtml = `<div class="sort-arrows">
                    <span onclick="moveCat('${safeCat}', -1, event)" style="opacity: ${isFirst ? '0.2' : '0.8'}; pointer-events: ${isFirst ? 'none' : 'auto'}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                    </span>
                    <span onclick="moveCat('${safeCat}', 1, event)" style="opacity: ${isLast ? '0.2' : '0.8'}; pointer-events: ${isLast ? 'none' : 'auto'}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </span>
                </div>`;
            }

            let highlightClass = (cat === lastMovedCat) ? ' moved-highlight' : '';
            let safeName = "manage-focus-" + cat.replace(/[^a-zA-Z0-9]/g, '');

            html += `<div class="category-card${highlightClass}" style="view-transition-name: ${safeName};"><div class="category-header" onclick="toggleExpandManage('${safeCat}')"><h3 style="padding-left: 5px;"><span class="expand-icon">${arrow}</span> ${cat}</h3>${arrowsHtml}<span class="icon-action-btn edit-folder" onclick="editFolder('${safeCat}', event)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></span><span class="icon-action-btn delete" onclick="deleteFolder('${safeCat}', event)">×</span></div><div class="focus-content" style="display: ${isExpanded ? 'block' : 'none'};">`;
            if(catPhrases.length === 0) { html += `<div style="text-align:center; color:var(--text-muted); font-size:13px; padding: 7px 15px 15px 15px; font-style: italic;">This category is empty.<br>Add an affirmation to begin.</div>`; }
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
        if(!cat) { await showDialog('confirm', 'Error', 'Please create a Category first.', '', 'OK'); return; }
        
        if(i.value.trim()){ 
            phrases.push({id: uid(), text: i.value.trim().toUpperCase(), count: 0, lifetimeCount: 0, category: cat}); 
            i.value='';
            expandedFocusesManage[cat] = true; 
            updateManagerList(); window.updateList(); 
            
            // --- FIXED: Only the Affirmation message triggers here ---
            showSnackbar('Affirmation added!', null); 
        } 
    }

    window.editPhrase = async function(id) {
        let p = phrases.find(p => p.id === id);
        if(!p) return;
        
        // CHANGED: "Edit Phrase" is now "Edit Affirmation"
        const newText = await showDialog('prompt', 'Edit Affirmation', '', p.text, 'SAVE');
        
        if(newText && newText.trim()) {
            p.text = newText.trim().toUpperCase();
            save(K_DB, phrases);
            updateManagerList(); window.updateList();
        }
    }

    window.processBulk = async function() {
        const cat = currentCatSelection;
        if(!cat) { await showDialog('confirm', 'Error', 'Please create a Category first.', '', 'OK'); return; }
        
        const lines = document.getElementById('bulk-in').value.split('\n');
        let addedCount = 0; // Keep track of how many we actually added
        
        lines.forEach(l => { 
            if(l.trim()) {
                phrases.push({id: uid(), text: l.trim().toUpperCase(), count: 0, lifetimeCount: 0, category: cat}); 
                addedCount++;
            }
        });
        
        document.getElementById('bulk-in').value = '';
        expandedFocusesManage[cat] = true; 
        updateManagerList(); window.updateList();
        
        // --- NEW: SHOW DYNAMIC SUCCESS MESSAGE ---
        if (addedCount > 0) {
            showSnackbar(`${addedCount} affirmations imported!`, null);
        }
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
        const confirmed = await showDialog('confirm', 'Reset All Data', 'Permanently erase all data? This action cannot be undone.', '', 'RESET');
        if (confirmed) {
            localStorage.clear(); 
            window.location.reload(); 
        }
    };

    // --- GAME LOOP LOGIC ---
    window.startSession = async function() {
        const activePhrases = phrases.filter(p => selectedCats.includes(p.category));
        
        if(activePhrases.length === 0) { 
            // THE FIX: Now includes the header title as the first parameter!
            window.guideSpeak("No Affirmations Selected", "Please select at least one category to begin our session.", "GOT IT");
            return; 
        }
        
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
    
    window.stopSession = function() { 
        document.getElementById('lib').style.display = 'flex'; 
        document.getElementById('game').style.display = 'none'; 
        document.body.classList.remove('screen-goal-breathe'); 
        document.body.classList.remove('game-active'); 
        document.getElementById('goal-overlay').classList.remove('show'); 
        document.getElementById('level-up-overlay').classList.remove('active'); 
        
        // Stops the bounce if they leave the screen!
        const overlayPetImg = document.getElementById('overlay-companion-img');
        if (overlayPetImg) overlayPetImg.classList.remove('bounce-fast');
        
        window.updateList(); 
    }

    window.continueGame = function() { 
        document.getElementById('goal-overlay').classList.remove('show'); 
        document.body.classList.remove('screen-goal-breathe'); 
        
        // Stops the bounce!
        const overlayPetImg = document.getElementById('overlay-companion-img');
        if (overlayPetImg) overlayPetImg.classList.remove('bounce-fast');
        
        nextRound(); 
    }
    
    window.closeLevelUp = function() { document.getElementById('level-up-overlay').classList.remove('active'); document.body.classList.remove('screen-goal-breathe'); nextRound(); }

    window.finishGame = function() { stopSession(); }

    window.skipCurrentPhrase = function() {
        if (!activeState) return;
        deck.push(activeState.phraseId);
        save(K_DECK, deck);
        activeState = null; save(K_STATE, null);
        nextRound();
    }

    // --- GOAL MESSAGES DECK LOGIC ---
    const GOAL_MESSAGES = [
        "The stars have aligned. You've completed your daily practice.",
        "Your inner light is beaming and growing brighter each day.",
        "The path is unfolding right beneath your feet.",
        "{NAME}, your energy is unmatched today. Beautifully done.",
        "You are the architect of your life.",
        "Energy shifted. Intentions set. Dreams ignited.",
        "You are a magnet for everything you desire.",
        "You've found your center among the stars.",
        "You've honored your intentions today, and the universe takes notice.",
        "Every affirmation is a testament to your growth.",
        "Another step forward on your journey. I am proud to guide you.",
        "Take a deep breath, {NAME}. You did wonderfully today."
    ];

    window.getGoalMessage = function() {
        let goalDeck = load('ASTRAL_GOAL_DECK_V10') || [];
        if (goalDeck.length === 0) {
            goalDeck = [...GOAL_MESSAGES];
            for (let i = goalDeck.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [goalDeck[i], goalDeck[j]] = [goalDeck[j], goalDeck[i]];
            }
        }
        let msg = goalDeck.pop();
        save('ASTRAL_GOAL_DECK_V10', goalDeck);

        let displayName = (prefs.username && prefs.username.trim() !== "") ? prefs.username : "Stargazer";
        return msg.replace("{NAME}", displayName);
    };

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
            
            // --- THE NEW CLEAN LEVEL-UP LOGIC ---
            if (justLeveledUp && !prefs.zenMode) {
                soundRankUp();
                vibrateDevice('rank');
                document.getElementById('game-progress-fill').classList.add('progress-dimmed');
                
                const currentLevel = getLevelInfo(prefs.lifetimeTotal || 0).level;
                
                const levelNumEl = document.getElementById('level-up-number');
                const descEl = document.getElementById('level-up-desc');
                const nameEl = document.getElementById('reward-name');
                const visualEl = document.getElementById('reward-visual');
                const btnContainer = document.getElementById('level-btns-container');

                const orbHTML = `
                    <div class="celestial-orb-wrapper">
                        <div class="orbit-ring orbit-ring-2"></div>
                        <div class="orbit-ring"></div>
                        <div class="celestial-orb"></div>
                    </div>
                `;

                levelNumEl.innerText = `You've reached Level ${currentLevel}!`;
                nameEl.style.display = 'block';

                const reward = LEVEL_REWARDS[currentLevel];

                if (reward) {
                    descEl.innerText = `✦ NEW ${reward.type} ✦`;
                    visualEl.innerHTML = reward.visual;
                    nameEl.innerText = reward.name;
                    
                    btnContainer.innerHTML = `
                        ${reward.actionHtml}
                        <button class="btn-main" onclick="closeLevelUp()">CONTINUE</button>
                    `;
                } else if (currentLevel % 5 === 0) {
                    descEl.innerText = `✦ MYSTERY REWARD ✦`;
                    visualEl.innerHTML = orbHTML;
                    nameEl.innerText = "UNKNOWN ITEM";
                    btnContainer.innerHTML = `<button class="btn-main" style="width: 100%;" onclick="closeLevelUp()">CONTINUE JOURNEY</button>`;
                } else {
                    descEl.innerText = "YOUR COSMIC ENERGY HAS EXPANDED";
                    nameEl.style.display = 'none'; 
                    visualEl.innerHTML = orbHTML; 
                    btnContainer.innerHTML = `<button class="btn-main" style="width: 100%;" onclick="closeLevelUp()">CONTINUE JOURNEY</button>`;
                }
                
                if (typeof window.checkUnlocks === 'function') window.checkUnlocks();

                setTimeout(() => { document.getElementById('level-up-overlay').classList.add('active'); }, 800);
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
                    overlayPetImg.classList.add('bounce-fast'); // <--- ADDED CELEBRATION BOUNCE!
                }

                // <--- PULLS A RANDOM MESSAGE FROM THE DECK!
                const subtitle = document.querySelector('#goal-overlay .goal-subtitle');
                if (subtitle) {
                    subtitle.innerText = getGoalMessage();
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

    // --- SMART GUIDE EQUIPMENT LOGIC ---
    window.equipGuide = function(guideName, element) {
        // 1. Is it locked?
        if (element.classList.contains('locked')) {
            const reqLevel = element.getAttribute('data-unlock-level');
            showDialog('alert', 'Guide Locked', `You must reach Level ${reqLevel} to unlock ${guideName}. Keep up your daily practice!`, '', 'GOT IT', '');
            return; 
        }

        // 2. SMART GRAB: Get the image source directly from the HTML card!
        const clickedImg = element.querySelector('.collection-img');
        if (clickedImg) {
            prefs.activeGuideUrl = clickedImg.src;
        }

        // 3. Save to your local storage
        prefs.activeGuide = guideName;
        save(K_PREFS, prefs);

        // 4. Move the glowing selection border
        document.querySelectorAll('.guide-card').forEach(c => c.classList.remove('active-selection'));
        element.classList.add('active-selection');

        // 5. Update the companion on the main page!
        const mainImg = document.getElementById('companion-image-display');
        const mainName = document.getElementById('companion-name-display');
        
        // FIX: Add "Guide: " in front of the custom name!
        if (mainName) mainName.innerText = `Guide: ${prefs.customGuideName}`;
        
        if (mainImg && prefs.activeGuideUrl) {
            mainImg.src = prefs.activeGuideUrl;
        }
    };

    window.equipTheme = function(themeName, cardElement) {
        // 1. Check if the theme is locked first!
        if (cardElement && cardElement.classList.contains('locked')) {
            const reqLevel = cardElement.getAttribute('data-unlock-level');
            showDialog('alert', 'Theme Locked', `You must reach Level ${reqLevel} to unlock ${themeName}. Keep up your daily practice!`, '', 'GOT IT', '');
            return; 
        }

        // 2. If unlocked, apply it!
        if (typeof applyThemeVariables === 'function') {
            applyThemeVariables(themeName);
        }

        prefs.activeTheme = themeName;
        save(K_PREFS, prefs);

        // 3. Move the glowing selection border
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
        const newName = await showDialog('prompt', 'Name Your Guide', 'What do you want to call your guide?\n(Max 14 characters)', currentName, 'SAVE');
        
        if (newName && newName.trim()) {
            let cleanName = newName.trim();
            if (cleanName.length > 14) cleanName = cleanName.substring(0, 14);
            
            // --- THE INVISIBLE FENCE (Letters, Numbers, Spaces, Hyphens ONLY) ---
            const isSafeName = /^[a-zA-Z0-9\s\-]+$/.test(cleanName);

            if (!isSafeName) {
                showDialog('alert', 'Oops!', 'Please use only letters, numbers, spaces, and hyphens for your guide\'s name.', '', 'TRY AGAIN');
                return; // Stops them from saving weird symbols or emojis!
            }
            // --------------------------------------------------------------------

            prefs.customGuideName = cleanName;
            save(K_PREFS, prefs);
            
            const mainName = document.getElementById('companion-name-display');
            // FIX: Add "Guide: " after renaming!
            if(mainName) mainName.innerText = `Guide: ${prefs.customGuideName}`;
            
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
            window.equipGuide(defaultGuideCard.getAttribute('data-guide-name') || 'Echo', defaultGuideCard);
        }
    }
    
    // FIX: Add "Guide: " when the app boots up!
    if(mainName) mainName.innerText = `Guide: ${prefs.customGuideName}`;
    
    if(menuNameBtn) {
        menuNameBtn.innerHTML = `${prefs.customGuideName} <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
    }

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

                    // --- NEW BLOCK: NO GRAY PILL, ORIGINAL SIZED DOTS ---
                    previewDiv.innerHTML = `
                        <div style="position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); display: flex; gap: 4px;">
                            <div style="width: 12px; height: 12px; border-radius: 50%; background: ${themeData["--bg-base"]}; border: 1px solid rgba(255,255,255,0.4); box-shadow: 0 1px 3px rgba(0,0,0,0.6);"></div>
                            <div style="width: 12px; height: 12px; border-radius: 50%; background: ${themeData["--text-main"]}; border: 1px solid rgba(255,255,255,0.4); box-shadow: 0 1px 3px rgba(0,0,0,0.6);"></div>
                            <div style="width: 12px; height: 12px; border-radius: 50%; background: ${themeData["--correct-color"]}; border: 1px solid rgba(255,255,255,0.4); box-shadow: 0 1px 3px rgba(0,0,0,0.6);"></div>
                        </div>
                    `;
                }
            }
        });
    }

    // --- ONBOARDING LOGIC (SPEECH BUBBLE) ---
    window.checkOnboarding = async function() {
        // If they already have a username saved, do nothing!
        if (prefs.username !== undefined) return;

        // Find the CONTAINER instead of the podium to bypass the Safari bug
        const container = document.querySelector('.pet-container');
        if (!container) return;

        // Create the beautiful glass bubble dynamically
        const bubble = document.createElement('div');
        bubble.className = 'echo-bubble-container';
        bubble.innerHTML = `
            <div class="echo-bubble-text" id="echo-b-text">The cosmos is vast, but you are here.<br><br>What should I call you?</div>
            <input type="text" id="echo-b-input" class="echo-bubble-input" placeholder="Your name..." autocomplete="off">
            <div class="echo-bubble-btns" id="echo-b-btns">
                <button class="btn-ghost" id="echo-b-skip" style="padding: 10px; flex: 1; font-size: 11px;">SKIP</button>
                <button class="btn-main" id="echo-b-save" style="padding: 10px; flex: 1; font-size: 11px;">SAVE</button>
            </div>
        `;
        container.appendChild(bubble);

        // A tiny delay so the fade-in and slide-up animation triggers gracefully
        // (Removed the autoplay chime from here to obey browser rules!)
        setTimeout(() => bubble.classList.add('show'), 600);

        const input = document.getElementById('echo-b-input');
        const btnSave = document.getElementById('echo-b-save');
        const btnSkip = document.getElementById('echo-b-skip');
        const text = document.getElementById('echo-b-text');
        const btns = document.getElementById('echo-b-btns');

        // Allow pressing "Enter" on the keyboard to save
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') btnSave.click();
        });

        // What happens when they finish
        function finishOnboarding(name) {
            // Hide the input and buttons smoothly
            input.style.display = 'none';
            btns.style.display = 'none';
            
            // THE FIX: Play the chime now that they have clicked a button!
            if (window.playCosmicChime) window.playCosmicChime();
            
            // Grab the guide's current name!
            let guideName = prefs.customGuideName || "Echo";
            
            // Swap the text to the personal greeting
            if (name) {
                text.innerHTML = `Welcome to Astral Affirmations, <strong style="color: var(--correct-color);">${name}</strong>.<br><br>I'm ${guideName}, your guide to help you on this journey.`;
            } else {
                text.innerHTML = `It's ok to stay a mystery.<br><br>Welcome to Astral Affirmations. I'm ${guideName}, your guide to help you on this journey.`;
            }

            // Let them read it for 4.5 seconds, then fade it out and remove it
            setTimeout(() => {
                bubble.classList.remove('show');
                setTimeout(() => bubble.remove(), 500); 
            }, 4500);
        }

        btnSave.onclick = () => {
            let name = input.value.trim();
            prefs.username = name;
            save(K_PREFS, prefs);
            finishOnboarding(name);
        };

        btnSkip.onclick = () => {
            prefs.username = ""; 
            save(K_PREFS, prefs);
            finishOnboarding("");
        };
    };

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
    window.checkOnboarding(); // <--- Triggers the welcome screen if they are new!

    // --- GLOBAL WINDOW FUNCTIONS ---
    window.closeGoalOverlay = function() {
        document.getElementById('goal-overlay').classList.remove('show');
        document.body.classList.remove('screen-goal-breathe');
        
        // Stops the bounce!
        const overlayPetImg = document.getElementById('overlay-companion-img');
        if (overlayPetImg) overlayPetImg.classList.remove('bounce-fast');
    };

    window.goHome = function() {
        stopSession();
    };

    window.showHelpPopup = function() {
        showDialog('alert', 'Manage Collection', '• Rename or delete categories using the icons.\n\n• Reorder categories to update the main page.\n\n• Expand a category to manage individual affirmations.', '', 'GOT IT', '');
    };

    // --- GENTLE COSMIC CHIME (ECHO'S VOICE) ---
    window.playCosmicChime = function() {
        if (!prefs.soundUI) return; 

        try {
            if (!audioCtx) {
                const AudioContextWrapper = window.AudioContext || window.webkitAudioContext;
                audioCtx = new AudioContextWrapper();
            }
            if (audioCtx.state === 'suspended') audioCtx.resume();

            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.type = 'sine'; 
            osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); 
            osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); 
            
            gain.gain.setValueAtTime(0, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.05); 
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
            
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.6);
        } catch (e) { console.log("Chime failed:", e); }
    };

    // --- WOOD BLOCK (THE "DOORS") ---
    window.playWoodBlock = function() {
        if (prefs.haptics && window.navigator.vibrate) {
            try { window.navigator.vibrate(25); } catch(e) {}
        }
        if (!prefs.soundUI) return;
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, audioCtx.currentTime); 
            gain.gain.setValueAtTime(0, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(); osc.stop(audioCtx.currentTime + 0.1);
        } catch (e) {}
    };

    // --- GLASS TAP (THE "INTERACTIONS") ---
    window.playGlassTap = function() {
        if (prefs.haptics && window.navigator.vibrate) {
            try { window.navigator.vibrate(15); } catch(e) {}
        }
        if (!prefs.soundUI) return;
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(2000, audioCtx.currentTime); 
            gain.gain.setValueAtTime(0, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(); osc.stop(audioCtx.currentTime + 0.05);
        } catch (e) {}
    };

    // --- SMART HIERARCHY LISTENER ---
    document.addEventListener('click', function(e) {
        // Find the closest interactive element
        const el = e.target.closest('button, .icon-action-btn, .custom-cb-label, .category-header, .breakdown-header, .dropdown-item, .cat-select-btn, .switch, .snack-undo, #bulk-toggle-btn, #guides-menu-name-btn, #vacation-banner, .legacy-card, .setting-row[onclick], .collection-card');
        
        // If not clickable or it's a game bubble, do nothing
        if (!el || el.classList.contains('bub')) return;

        // THE WOOD LIST: Only "Entry" links
        // Matches the Lifetime Card and the specific Settings links we identified
        const isWoodDoor = el.matches('.legacy-card, .setting-row[onclick]');

        if (isWoodDoor) {
            window.playWoodBlock();
        } else {
            // EVERYTHING ELSE: Buttons, Toggles, and "Inside" actions are Glass
            window.playGlassTap();
        }
    });

    // --- REUSABLE GUIDE SPEECH BUBBLE (UPGRADED) ---
    window.guideSpeak = function(title, message, primaryBtnText = "OKAY", onPrimary = null, secondaryBtnText = null, onSecondary = null) {
        const container = document.querySelector('.pet-container');
        if (!container) return;

        // Remove an existing bubble if they click rapidly
        const existing = document.getElementById('guide-dynamic-bubble');
        if (existing) existing.remove();

        // Create the beautiful glass bubble dynamically
        const bubble = document.createElement('div');
        bubble.id = 'guide-dynamic-bubble';
        bubble.className = 'echo-bubble-container';
        
        let titleHtml = title ? `<div style="font-weight: bold; color: var(--correct-color); margin-bottom: 8px; font-size: 15px; text-align: center; text-transform: uppercase; letter-spacing: 0.5px;">${title}</div>` : '';

        // Dynamically build 1 or 2 buttons!
        let buttonsHtml = '';
        if (secondaryBtnText) {
            buttonsHtml = `
                <button class="btn-ghost" id="guide-btn-sec" style="flex: 1; padding: 10px; font-size: 11px;">${secondaryBtnText}</button>
                <button class="btn-main" id="guide-btn-pri" style="flex: 1; padding: 10px; font-size: 11px;">${primaryBtnText}</button>
            `;
        } else {
            buttonsHtml = `
                <button class="btn-main" id="guide-btn-pri" style="width: 100%; padding: 10px; font-size: 12px;">${primaryBtnText}</button>
            `;
        }

        bubble.innerHTML = `
            ${titleHtml}
            <div class="echo-bubble-text" style="margin-bottom: 12px;">${message}</div>
            <div class="echo-bubble-btns">
                ${buttonsHtml}
            </div>
        `;
        container.appendChild(bubble);

        // Slide it in smoothly
        setTimeout(() => bubble.classList.add('show'), 50);
        
        // Play the gentle chime!
        if (window.playCosmicChime) window.playCosmicChime();

        // Primary Button Logic
        const btnPri = bubble.querySelector('#guide-btn-pri');
        btnPri.onclick = () => {
            bubble.classList.remove('show');
            setTimeout(() => bubble.remove(), 500);
            if (onPrimary) onPrimary(); // Trigger the action!
        };

        // Secondary Button Logic (if it exists)
        if (secondaryBtnText) {
            const btnSec = bubble.querySelector('#guide-btn-sec');
            btnSec.onclick = () => {
                bubble.classList.remove('show');
                setTimeout(() => bubble.remove(), 500);
                if (onSecondary) onSecondary(); // Trigger the action!
            };
        }
    };

    // --- THE GRAND REVEAL ---
    // window.addEventListener('load') tells the browser to wait until EVERY image is finished downloading.
    // Once the images are ready, it triggers the smooth fade-in!
    window.addEventListener('load', () => {
        document.body.style.visibility = "visible";
        document.body.style.opacity = "1";
    });

});
