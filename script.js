// --- 1. CONFIG & INIT ---
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dmj1bhg7k/image/upload"; 
const CLOUDINARY_PRESET = "ironai_upload"; 

// DEFINED SPLITS
const splits = {
    "default_split": {
        name: "Default Split",
        schedule: {
            "Monday": { title: "Mon: Chest & Triceps", exercises: ["Barbell Bench Press", "Incline Dumbbell Press", "Pec Deck Fly", "Tricep Pushdown", "Overhead Tricep Ext"] },
            "Tuesday": { title: "Tue: Back & Biceps", exercises: ["Lat Pulldown", "Bent Over Barbell Row", "Seated Cable Row", "Barbell Curl", "Hammer Curls"] },
            "Wednesday": { title: "Wed: Legs & Shoulders", exercises: ["Barbell Squat", "Leg Press", "Overhead Press", "Lateral Raises", "Face Pulls"] },
            "Thursday": { title: "Thu: Chest & Triceps", exercises: ["Barbell Bench Press", "Incline Dumbbell Press", "Cable Flys", "Tricep Dips", "Skullcrushers"] },
            "Friday": { title: "Fri: Back & Biceps", exercises: ["Lat Pulldown", "Single Arm Row", "Deadlift", "Preacher Curl", "Cable Curls"] },
            "Saturday": { title: "Sat: Legs & Shoulders", exercises: ["Front Squat", "Walking Lunges", "Dumbbell Shoulder Press", "Lateral Raises", "Rear Delt Fly"] },
            "Sunday": { title: "Sun: Rest", exercises: [] }
        }
    },
    "bro_split": {
        name: "Bro Split",
        schedule: {
            "Monday": { title: "Mon: Chest", exercises: ["Incline Dumbbell Press", "Flat Barbell Press", "Cable Fly", "Pec Deck"] },
            "Tuesday": { title: "Tue: Back", exercises: ["Lat Pulldown", "Bent-Over Row", "Cable Pulldown", "Deadlift"] },
            "Wednesday": { title: "Wed: Shoulders", exercises: ["Overhead Press", "Lateral Raises", "Face Pulls", "Shrugs"] },
            "Thursday": { title: "Thu: Legs", exercises: ["Squats", "Leg Press", "Extensions", "Calf Raises"] },
            "Friday": { title: "Fri: Arms", exercises: ["Barbell Curl", "Hammer Curl", "Tricep Pushdown", "Dips"] },
            "Saturday": { title: "Sat: Abs/Cardio", exercises: ["Crunches", "Leg Raises", "Plank", "Treadmill"] },
            "Sunday": { title: "Sun: Rest", exercises: [] }
        }
    },
    "ppl": {
        name: "Push / Pull / Legs",
        schedule: {
            "Monday": { title: "Mon: Push", exercises: ["Bench Press", "Overhead Press", "Incline DB Press", "Lateral Raises", "Tricep Dips"] },
            "Tuesday": { title: "Tue: Pull", exercises: ["Deadlift", "Pull-Ups", "Barbell Rows", "Face Pulls", "Bicep Curls"] },
            "Wednesday": { title: "Wed: Legs", exercises: ["Squats", "RDL", "Leg Press", "Lunges", "Calf Raises"] },
            "Thursday": { title: "Thu: Push", exercises: ["Overhead Press", "Incline Bench", "Cable Fly", "Skullcrushers"] },
            "Friday": { title: "Fri: Pull", exercises: ["Lat Pulldown", "Seated Row", "Hammer Curls", "Preacher Curls"] },
            "Saturday": { title: "Sat: Legs", exercises: ["Front Squat", "Leg Extensions", "Leg Curls", "Calf Raises"] },
            "Sunday": { title: "Sun: Rest", exercises: [] }
        }
    },
    "upper_lower": {
        name: "Upper / Lower",
        schedule: {
            "Monday": { title: "Mon: Upper", exercises: ["Bench Press", "Rows", "Overhead Press", "Pull Ups", "Skullcrushers"] },
            "Tuesday": { title: "Tue: Lower", exercises: ["Squats", "RDL", "Leg Press", "Calf Raises"] },
            "Wednesday": { title: "Wed: Rest", exercises: [] },
            "Thursday": { title: "Thu: Upper", exercises: ["Incline Bench", "Pulldowns", "Lateral Raises", "Curls"] },
            "Friday": { title: "Fri: Lower", exercises: ["Deadlifts", "Split Squats", "Leg Curls", "Extensions"] },
            "Saturday": { title: "Sat: Rest", exercises: [] },
            "Sunday": { title: "Sun: Rest", exercises: [] }
        }
    },
    "full_body": {
        name: "Full Body",
        schedule: {
            "Monday": { title: "Mon: Full Body A", exercises: ["Squats", "Bench Press", "Rows", "Overhead Press"] },
            "Tuesday": { title: "Tue: Rest", exercises: [] },
            "Wednesday": { title: "Wed: Full Body B", exercises: ["Deadlift", "Incline Press", "Pull Ups", "Lunges"] },
            "Thursday": { title: "Thu: Rest", exercises: [] },
            "Friday": { title: "Fri: Full Body C", exercises: ["Leg Press", "Dips", "Chin Ups", "Lateral Raises"] },
            "Saturday": { title: "Sat: Rest", exercises: [] },
            "Sunday": { title: "Sun: Rest", exercises: [] }
        }
    }
};

const LOCAL_USER_ID = "ironai_local_user"; // Unique key for local storage
let currentDietPref = "nonveg";
let isDataLoaded = false; 

// INITIAL STATE
const getInitialState = () => ({ 
    xp: 0, 
    currentSplit: "default_split", 
    workouts: {}, 
    logs: {}, 
    customExercises: {}, 
    deletedExercises: {}, 
    history: {},
    timeline: {}, // Stores links to Cloudinary images
    settings: { rest: 90 },
    stats: { workoutsCompleted: 0, consistency: [0,0,0,0,0] },
    plan: "Pro"
});

let userData = getInitialState();
let timerInterval, timeLeft, audioCtx, chartInstance;

// --- 2. INIT LOGIC (No Auth) ---
document.addEventListener("DOMContentLoaded", () => {
    // Hide loader after a brief moment
    setTimeout(() => {
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
        initApp();
    }, 800);
});

function initApp() {
    switchView('view-workout', document.querySelector('.nav-btn'));
    loadLocalData();
}

function loadLocalData() {
    const localData = localStorage.getItem(LOCAL_USER_ID);
    if(localData) {
        try {
            const parsed = JSON.parse(localData);
            // Merge loaded data with initial state to ensure new fields don't break old saves
            userData = { ...getInitialState(), ...parsed };
        } catch (e) {
            console.error("Save file corrupted, loading fresh", e);
            userData = getInitialState();
        }
    } else {
        userData = getInitialState();
    }
    isDataLoaded = true;
    setupUI();
}

function saveUserData() { 
    if(!isDataLoaded) return; 
    try {
        localStorage.setItem(LOCAL_USER_ID, JSON.stringify(userData));
        showToast("Saved to Phone");
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            alert("Storage Full!");
        } else {
            console.error(e);
        }
    }
}

function setupUI() {
    let today = "Monday";
    try { today = localStorage.getItem('currentDay_local') || ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date().getDay()]; } catch(e){}
    
    const splitSelector = document.getElementById('split-selector');
    if(userData.currentSplit && splitSelector && splits[userData.currentSplit]) {
        splitSelector.value = userData.currentSplit;
        document.getElementById('current-split-badge').innerText = splits[userData.currentSplit].name;
    } else {
        userData.currentSplit = "default_split";
        splitSelector.value = "default_split";
        document.getElementById('current-split-badge').innerText = splits["default_split"].name;
    }

    updateDaySelector(userData.currentSplit, today);

    if(userData.settings && userData.settings.rest) document.getElementById('setting-rest').value = userData.settings.rest;

    calculateWeeklyConsistency();
    updateStatsUI();
    initChart();
    updateXPUI();
    updateProfileUI();
}

// --- 4. WORKOUT & SPLIT LOGIC ---
function updateDaySelector(splitKey, selectedDay) {
    const daySelect = document.getElementById('day-selector');
    daySelect.innerHTML = ""; 
    
    if(!splits[splitKey]) splitKey = "default_split";

    const schedule = splits[splitKey].schedule;
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    days.forEach(day => {
        const option = document.createElement("option");
        option.value = day;
        option.text = schedule[day] ? schedule[day].title : day; 
        if(day === selectedDay) option.selected = true;
        daySelect.appendChild(option);
    });
    
    loadWorkout(selectedDay);
}

window.changeSplit = function(newSplit) {
    if(!splits[newSplit]) { console.error("Split not found"); return; }
    if(newSplit === userData.currentSplit) return;

    if(confirm(`Switch to ${splits[newSplit].name}? This clears logs & customizations.`)) {
        userData.currentSplit = newSplit;
        userData.logs = {}; 
        userData.customExercises = {}; 
        userData.deletedExercises = {}; 
        saveUserData();
        
        document.getElementById('current-split-badge').innerText = splits[newSplit].name;
        const currentDay = document.getElementById('day-selector').value;
        updateDaySelector(newSplit, currentDay);
        showToast("Split Updated!");
    } else {
        document.getElementById('split-selector').value = userData.currentSplit;
    }
}

window.changeDay = function(day) {
    if (!day) return;
    localStorage.setItem('currentDay_local', day);
    loadWorkout(day);
}

function loadWorkout(day) {
    try {
        const list = document.getElementById('workout-list');
        if (!list) return;

        list.innerHTML = ""; 

        const splitKey = userData.currentSplit || "default_split";
        const splitConfig = splits[splitKey] || splits["default_split"];
        const dayData = splitConfig.schedule[day];
        
        const officialExercises = (dayData && dayData.exercises) ? dayData.exercises : [];

        if (!userData.customExercises) userData.customExercises = {};
        const customExercises = userData.customExercises[day] || [];

        let allExercises = [...officialExercises, ...customExercises];

        if (!userData.deletedExercises) userData.deletedExercises = {};
        const deletedList = userData.deletedExercises[day] || [];
        
        allExercises = allExercises.filter(ex => !deletedList.includes(ex));

        if (allExercises.length === 0) { 
            list.innerHTML = `<div style='text-align:center; padding:40px; color:#666;'><i class='fas fa-bed' style='font-size:2rem; margin-bottom:10px;'></i><br>Rest Day / Empty</div>`; 
            return; 
        }

        let htmlContent = "";
        allExercises.forEach((ex, exIdx) => {
            const currentLog = (userData.logs[day] && userData.logs[day][exIdx]) || {};
            let setHtml = '';
            for(let s = 1; s <= 3; s++) {
                const setLog = currentLog[s] || {w:'', r:'', done:false};
                const isChecked = setLog.done ? 'checked' : '';
                setHtml += `<div class="set-row"><span>Set ${s}</span>
                    <input type="number" placeholder="kg" value="${setLog.w}" onchange="updateLog('${day}',${exIdx},${s},'w',this.value)">
                    <input type="number" placeholder="reps" value="${setLog.r}" onchange="updateLog('${day}',${exIdx},${s},'r',this.value)">
                    <i class="fas fa-check-circle check-btn ${isChecked}" onclick="toggleSet(this,'${day}',${exIdx},${s})"></i></div>`;
            }
            
            const isCustom = customExercises.includes(ex);
            const customBadge = isCustom ? `<span style="font-size:0.7rem; color:var(--primary); margin-left:10px;">(Custom)</span>` : "";

            htmlContent += `
            <div class="card">
                <div class="card-actions">
                     <button class="action-btn" onclick="swapExercise('${day}',${exIdx})"><i class="fas fa-sync"></i></button>
                     <button class="action-btn" style="color:var(--danger);" onclick="deleteExercise('${day}', '${ex}')"><i class="fas fa-trash"></i></button>
                </div>
                <div class="exercise-header"><h4>${ex} ${customBadge}</h4></div>
                ${setHtml}
            </div>`;
        });
        
        list.innerHTML = htmlContent;
    } catch (e) {
        console.error("Render Error:", e);
    }
}

window.addCustomExercise = function() {
    const day = document.getElementById('day-selector').value;
    const name = prompt("Enter the name of your exercise:");
    
    if (name) {
        if (!userData.customExercises) userData.customExercises = {};
        if (!userData.customExercises[day]) userData.customExercises[day] = [];
        
        userData.customExercises[day].push(name);
        saveUserData();
        loadWorkout(day);
        showToast("Exercise Added");
    }
}

window.deleteExercise = function(day, exName) {
    if(!confirm(`Remove "${exName}" from today's workout?`)) return;

    if (!userData.customExercises) userData.customExercises = {};
    if (!userData.deletedExercises) userData.deletedExercises = {};

    if (userData.customExercises[day] && userData.customExercises[day].includes(exName)) {
        userData.customExercises[day] = userData.customExercises[day].filter(e => e !== exName);
    } else {
        if (!userData.deletedExercises[day]) userData.deletedExercises[day] = [];
        userData.deletedExercises[day].push(exName);
    }

    saveUserData();
    loadWorkout(day);
    showToast("Exercise Removed");
}

window.updateLog = function(day, exIdx, setNum, type, val) {
    if(!userData.logs[day]) userData.logs[day] = {};
    if(!userData.logs[day][exIdx]) userData.logs[day][exIdx] = {};
    if(!userData.logs[day][exIdx][setNum]) userData.logs[day][exIdx][setNum] = { w:'', r:'', done: false };
    userData.logs[day][exIdx][setNum][type] = val;
    saveUserData(); 
}

// GUARD: PREVENT XP FARMING
window.toggleSet = function(btn, day, exIdx, setNum) {
    if(!userData.logs[day]) userData.logs[day] = {};
    if(!userData.logs[day][exIdx]) userData.logs[day][exIdx] = {};
    if(!userData.logs[day][exIdx][setNum]) userData.logs[day][exIdx][setNum] = { w:'', r:'', done: false };

    if(btn.classList.contains('checked')) {
        btn.classList.remove('checked');
        userData.logs[day][exIdx][setNum].done = false;
        
        // Remove XP when unchecked to prevent farming
        userData.xp = Math.max(0, userData.xp - 10);
        
        updateXPUI();
    } else {
        btn.classList.add('checked');
        userData.logs[day][exIdx][setNum].done = true;
        const rest = (userData.settings && userData.settings.rest) ? parseInt(userData.settings.rest) : 90;
        startTimer(rest);
        userData.xp += 10;
        updateXPUI();
    }
    saveUserData();
}

// --- 5. TIMELINE LOGIC (HYBRID: CLOUD UPLOAD + LOCAL SAVE) ---
window.updateFileName = function(input) {
    if (input.files && input.files[0]) {
        const display = document.getElementById('file-name-display');
        display.innerText = input.files[0].name;
        display.style.color = "var(--primary)";
    }
}

window.uploadTimelineEntry = function() {
    if (!navigator.onLine) { alert("You must be online to upload photos."); return; }
    
    const input = document.getElementById('timeline-photo-input');
    const dateInput = document.getElementById('timeline-date');
    const noteInput = document.getElementById('timeline-note');

    const selectedDate = dateInput.value || getLocalISODate();
    
    // 1. If photo exists, Upload to Cloudinary
    if (input.files && input.files[0]) {
        const file = input.files[0];
        
        showToast("Uploading to Cloud...");

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_PRESET);

        fetch(CLOUDINARY_URL, { method: 'POST', body: formData })
        .then(response => response.json())
        .then(data => {
            if (data.error) throw new Error(data.error.message);
            // 2. Save the URL to local storage
            saveTimelineLocal(data.secure_url, selectedDate, noteInput.value);
        })
        .catch(err => {
            console.error(err);
            alert("Upload Failed: " + err.message);
        });
    } else {
        if(!noteInput.value) { alert("Please add a note or photo."); return; }
        // Save just note if no photo
        saveTimelineLocal(null, selectedDate, noteInput.value);
    }
}

function saveTimelineLocal(imageUrl, dateStr, noteStr) {
    if(!userData.timeline) userData.timeline = {};
    
    const id = Date.now().toString();
    userData.timeline[id] = {
        imageUrl: imageUrl, // URL from Cloudinary or null
        date: dateStr,
        note: noteStr || "",
        timestamp: Date.now()
    };

    saveUserData(); // Triggers save to LocalStorage
    
    showToast("Entry Saved!");
    document.getElementById('timeline-photo-input').value = "";
    document.getElementById('timeline-note').value = "";
    document.getElementById('file-name-display').innerText = "Tap to Select Photo";
    document.getElementById('file-name-display').style.color = "var(--muted)";
    
    fetchAndRenderTimeline();
}

function fetchAndRenderTimeline() {
    const grid = document.getElementById('timeline-grid');
    if (!grid) return;
    
    grid.innerHTML = '<p style="color:#666; text-align:center; width:100%;">Loading...</p>';
    
    if (!userData.timeline || Object.keys(userData.timeline).length === 0) { 
        grid.innerHTML = "<p style='text-align:center; color:#666; grid-column:span 2;'>No entries yet.</p>"; 
        return; 
    }

    grid.innerHTML = ""; 
    let entries = Object.keys(userData.timeline).map(key => { return { id: key, ...userData.timeline[key] }; });
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));

    entries.forEach(item => {
        const card = document.createElement('div');
        card.className = "gallery-item";
        
        let visual = "";
        if(item.imageUrl) {
            // Load image from Cloudinary
            visual = `<img src="${item.imageUrl}" loading="lazy" onclick="window.open('${item.imageUrl}', '_blank')">`;
        } else {
            visual = `<div style="width:100%; height:100%; background:#111; display:flex; align-items:center; justify-content:center; color:#333;"><i class="fas fa-sticky-note" style="font-size:2rem;"></i></div>`;
        }

        card.innerHTML = `${visual}<div class="gallery-overlay"><span class="gallery-date">${item.date}</span>${item.note ? `<p class="gallery-note">"${item.note}"</p>` : ''}</div><button class="delete-btn" onclick="deleteTimelineItem('${item.id}')"><i class="fas fa-trash"></i></button>`;
        grid.appendChild(card);
    });
}

window.deleteTimelineItem = function(id) {
    if(confirm("Delete this memory?")) {
        delete userData.timeline[id];
        saveUserData();
        fetchAndRenderTimeline();
    }
}

// --- 6. UTILS, TIMER, ANALYTICS ---

// HELPER: Get local date string YYYY-MM-DD
function getLocalISODate(dateInput = null) {
    const d = dateInput ? new Date(dateInput) : new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
}

function startTimer(seconds) {
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if(audioCtx.state === 'suspended') audioCtx.resume();
    clearInterval(timerInterval);
    timeLeft = seconds;
    const ui = document.getElementById('rest-timer');
    ui.classList.add('active');
    ui.style.borderColor = "var(--primary)";
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        if(timeLeft <= 0) {
            clearInterval(timerInterval);
            ui.style.borderColor = "var(--danger)";
            triggerAlarm();
        }
    }, 1000);
}

// GUARD: PREVENT NEGATIVE TIME
window.adjustTime = function(val) { 
    if(timeLeft + val < 0) return; 
    timeLeft += val; 
    updateTimerDisplay(); 
}

window.stopTimer = function() { clearInterval(timerInterval); document.getElementById('rest-timer').classList.remove('active'); }

function updateTimerDisplay() {
    const m = Math.floor(timeLeft / 60).toString().padStart(2,'0');
    const s = (timeLeft % 60).toString().padStart(2,'0');
    document.getElementById('timer-val').innerText = `${m}:${s}`;
}

function triggerAlarm() {
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    let count = 0;
    const beep = () => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        gain.gain.setValueAtTime(1.0, audioCtx.currentTime); 
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
        osc.start(); osc.stop(audioCtx.currentTime + 0.5);
        if(navigator.vibrate) navigator.vibrate(500);
        count++;
        if(count < 3) setTimeout(beep, 800);
        else setTimeout(() => stopTimer(), 1000);
    };
    beep();
}

function calculateWeeklyConsistency() {
    if(!userData.history) {
        document.getElementById('stat-streak').innerText = "0 🔥";
        document.getElementById('stat-cals').innerText = "0 kcal";
        return;
    }

    const now = new Date();
    const counts = [0, 0, 0, 0, 0];
    let totalCals = 0;
    const uniqueDates = new Set(); 

    Object.values(userData.history).forEach(session => {
        const d = new Date(session.timestamp);
        const diffDays = Math.ceil(Math.abs(now - d) / (1000 * 60 * 60 * 24)); 
        const weekIndex = Math.floor(diffDays / 7);
        if(weekIndex < 5) counts[4 - weekIndex]++;
        
        if(session.logs) {
            Object.values(session.logs).forEach(ex => {
                Object.values(ex).forEach(s => { if(s.done) totalCals += 8; });
            });
        }

        if(session.date) uniqueDates.add(session.date);
    });

    // STREAK LOGIC (LOCAL TIMEZONE FIXED)
    let streak = 0;
    const sortedDates = Array.from(uniqueDates).sort().reverse(); 
    
    // Get Local Today & Yesterday
    const todayStr = getLocalISODate();
    const yestDate = new Date(); 
    yestDate.setDate(yestDate.getDate() - 1);
    const yestStr = getLocalISODate(yestDate);

    if (sortedDates.length > 0) {
        // Streak is valid if last workout was Today OR Yesterday
        if (sortedDates[0] === todayStr || sortedDates[0] === yestStr) {
            streak = 1;
            let currentRef = new Date(sortedDates[0]);
            
            // Check consecutive days backwards
            for (let i = 1; i < sortedDates.length; i++) {
                currentRef.setDate(currentRef.getDate() - 1); 
                const expectedDate = getLocalISODate(currentRef);
                
                if (sortedDates[i] === expectedDate) {
                    streak++;
                } else {
                    break;
                }
            }
        }
    }

    userData.stats.consistency = counts;
    document.getElementById('stat-cals').innerText = totalCals + " kcal";
    document.getElementById('stat-streak').innerText = streak + " 🔥";
}

window.handleCalendarPick = function(input) {
    if(!input.value) return;
    switchView('view-analytics', document.querySelectorAll('.nav-btn')[1]);
    switchSubTab('sub-history', document.querySelectorAll('.tab-btn')[1]);
    document.getElementById('history-filter-msg').classList.remove('hidden');
    document.getElementById('history-date-display').innerText = input.value;
    loadHistoryUI(input.value); 
}

window.clearHistoryFilter = function() {
    document.getElementById('history-filter-msg').classList.add('hidden');
    document.getElementById('calendar-picker').value = "";
    loadHistoryUI();
}

window.finishWorkoutSession = function() {
    triggerConfetti(); 
    const day = document.getElementById('day-selector').value;
    
    let officialExercises = (splits[userData.currentSplit].schedule[day] && splits[userData.currentSplit].schedule[day].exercises) ? splits[userData.currentSplit].schedule[day].exercises : [];
    let customExercises = (userData.customExercises && userData.customExercises[day]) ? userData.customExercises[day] : [];
    
    let exercises = [...officialExercises, ...customExercises];
    if (userData.deletedExercises && userData.deletedExercises[day]) {
        exercises = exercises.filter(ex => !userData.deletedExercises[day].includes(ex));
    }

    // [FIX: Save as LOCAL date]
    const dateStr = getLocalISODate(); 
    
    const sessionData = { date: dateStr, timestamp: Date.now(), dayName: day, exercises: exercises, logs: userData.logs[day] || {} };
    if(!userData.history) userData.history = {};
    const newKey = Date.now().toString(); // Simple ID for local
    userData.history[newKey] = sessionData;
    
    userData.xp += 100;
    userData.stats.workoutsCompleted = (userData.stats.workoutsCompleted || 0) + 1;
    calculateWeeklyConsistency(); 
    updateStatsUI(); 
    updateXPUI(); 
    updateChart(); 

    if(confirm("Workout Saved! +100 XP.\n\nClear checks for next week?")) {
        if(userData.logs[day]) Object.keys(userData.logs[day]).forEach(ex => Object.keys(userData.logs[day][ex]).forEach(s => userData.logs[day][ex][s].done = false));
        saveUserData(); loadWorkout(day);
    } else saveUserData();
}

window.loadHistoryUI = function(filterDate = null) {
    const list = document.getElementById('history-list');
    list.innerHTML = "";
    if (!userData.history || Object.keys(userData.history).length === 0) { list.innerHTML = "<p style='text-align:center;color:#666;'>No workouts yet.</p>"; return; }
    let allEntries = Object.entries(userData.history).sort(([,a], [,b]) => b.timestamp - a.timestamp);
    
    if(filterDate) {
        allEntries = allEntries.filter(([,entry]) => entry.date === filterDate);
        if(allEntries.length === 0) { list.innerHTML = "<p style='text-align:center;color:#666;'>No workouts found for this date.</p>"; return; }
    }
    
    let currentMonth = "";
    allEntries.forEach(([key, entry]) => {
        const entryDate = new Date(entry.timestamp);
        const monthStr = entryDate.toLocaleString('default', { month: 'long', year: 'numeric' });
        const displayDate = entryDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

        if (monthStr !== currentMonth) {
            currentMonth = monthStr;
            list.innerHTML += `<div class="history-month-header">${currentMonth}</div>`;
        }
        let detailsHtml = '';
        if(entry.exercises) {
            entry.exercises.forEach((exName, exIdx) => {
                let bestSet = "0kg";
                if(entry.logs && entry.logs[exIdx]) {
                    Object.values(entry.logs[exIdx]).forEach(set => { if(set.w) bestSet = `${set.w}kg x ${set.r}`; });
                }
                detailsHtml += `<div class="ex-row"><span>${exName}</span><span>${bestSet}</span></div>`;
            });
        }
        let setCounts = 0;
        if(entry.logs) Object.values(entry.logs).forEach(ex => Object.values(ex).forEach(s => { if(s.done) setCounts++; }));
        list.innerHTML += `
            <div class="history-card" onclick="this.classList.toggle('open')">
                <i class="fas fa-trash history-delete" onclick="deleteHistoryEntry('${key}'); event.stopPropagation();"></i>
                <div class="history-header"><span class="history-title">${entry.dayName}</span><span class="history-date">${displayDate}</span></div>
                <div class="history-summary"><span>${setCounts} Sets</span><i class="fas fa-chevron-down"></i></div>
                <div class="history-extended">${detailsHtml || '<p style="font-size:0.8rem; color:#666;">No details recorded.</p>'}</div>
            </div>`;
    });
}
window.deleteHistoryEntry = function(key) {
    if(confirm("Delete this workout from history?")) {
        delete userData.history[key];
        saveUserData(); loadHistoryUI(); calculateWeeklyConsistency(); updateChart();
    }
}

// --- 6. EXTRAS & COACH ---
window.generateDiet = function() {
    const weight = parseFloat(document.getElementById('diet-weight').value);
    const height = parseFloat(document.getElementById('diet-height').value);
    const goal = document.getElementById('diet-goal').value;
    
    if(!weight) { alert("Please enter weight"); return; }
    
    if(height && height > 0) {
        const h_m = height / 100;
        const bmi = (weight / (h_m * h_m)).toFixed(1);
        document.getElementById('out-bmi').innerText = bmi;
        const bmiEl = document.getElementById('out-bmi');
        if(bmi < 18.5) bmiEl.style.color = "#f39c12"; 
        else if(bmi < 24.9) bmiEl.style.color = "#2ecc71"; 
        else bmiEl.style.color = "#e74c3c"; 
    }

    let cals, protein;
    if (goal === 'cut') { cals = weight * 26; protein = weight * 2.4; } 
    else if (goal === 'bulk') { cals = weight * 43; protein = weight * 2.0; } 
    else { cals = weight * 33; protein = weight * 1.8; }
    
    const finalCals = Math.round(cals);
    const finalProt = Math.round(protein);
    const finalCarbs = Math.round((cals - (protein * 4) - (cals * 0.25)) / 4);
    
    document.getElementById('out-cals').innerText = finalCals;
    document.getElementById('out-prot').innerText = finalProt + "g";
    document.getElementById('out-carbs').innerText = finalCarbs + "g";

    const mealList = document.getElementById('meal-list');
    let mealsHtml = "";

    if (currentDietPref === "veg") {
        mealsHtml = `<div class="card" style="margin-top:10px;"><div class="exercise-header"><h4>🥑 Breakfast</h4></div><p style="color:#aaa; font-size:0.9rem; margin-top:5px;">Oats (80g), Whey Protein (1 scoop), Almonds (10g), Milk (200ml)</p></div><div class="card"><div class="exercise-header"><h4>🥗 Lunch</h4></div><p style="color:#aaa; font-size:0.9rem; margin-top:5px;">Paneer Bhurji (${Math.round(finalProt * 0.3)}g), 2 Roti, Green Salad, Dal Tadka</p></div><div class="card"><div class="exercise-header"><h4>🍎 Snack</h4></div><p style="color:#aaa; font-size:0.9rem; margin-top:5px;">Greek Yogurt, Apple, 1 Slice Brown Bread with Peanut Butter</p></div><div class="card"><div class="exercise-header"><h4>🍲 Dinner</h4></div><p style="color:#aaa; font-size:0.9rem; margin-top:5px;">Soya Chunks Curry, Rice (1 bowl), Mixed Veggies</p></div>`;
    } else {
        mealsHtml = `<div class="card" style="margin-top:10px;"><div class="exercise-header"><h4>🍳 Breakfast</h4></div><p style="color:#aaa; font-size:0.9rem; margin-top:5px;">3 Eggs (Boiled/Scrambled), Toast (2 slices), Black Coffee</p></div><div class="card"><div class="exercise-header"><h4>🍗 Lunch</h4></div><p style="color:#aaa; font-size:0.9rem; margin-top:5px;">Chicken Breast (${Math.round(finalProt * 0.4)}g), Rice, Broccoli/Beans</p></div><div class="card"><div class="exercise-header"><h4>🍌 Snack</h4></div><p style="color:#aaa; font-size:0.9rem; margin-top:5px;">Whey Protein Shake, Banana, Walnuts</p></div><div class="card"><div class="exercise-header"><h4>🐟 Dinner</h4></div><p style="color:#aaa; font-size:0.9rem; margin-top:5px;">Grilled Fish or Lean Meat, Sweet Potato, Salad</p></div>`;
    }

    mealList.innerHTML = mealsHtml;
    document.getElementById('diet-results').classList.remove('hidden');
}

// HELPERS
function showToast(msg) { const t = document.getElementById('toast'); t.innerText = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2000); }
window.swapExercise = function(day, idx) { alert("Swapping exercises is temporarily disabled in Strict Mode."); }
window.resetRoutine = function() { if(confirm("Reset routine?")) { userData.workouts = JSON.parse(JSON.stringify(splits["bro_split"])); userData.logs = {}; saveUserData(); loadWorkout(document.getElementById('day-selector').value); } }
window.selectDietPref = function(pref) { currentDietPref = pref; document.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('active')); document.getElementById('btn-' + pref).classList.add('active'); }
window.calculate1RM = function() {
    const w = parseFloat(document.getElementById('rm-weight').value);
    const r = parseFloat(document.getElementById('rm-reps').value);
    if(w && r) {
        document.getElementById('rm-result').innerHTML = `Est Max: <span style="color:#fff">${Math.round(w * (1 + r/30))} kg</span>`;
        document.getElementById('rm-result').classList.remove('hidden');
    }
}
function updateXPUI() { 
    const lvl = Math.floor(userData.xp / 1000) + 1;
    document.getElementById('user-level').innerText = lvl;
    document.getElementById('weekly-xp-current').innerText = (userData.xp % 1000) + " XP"; 
    document.getElementById('weekly-xp-fill').style.width = ((userData.xp % 1000)/1000)*100 + "%"; 
}
function updateStatsUI() { document.getElementById('stat-workouts').innerText = userData.stats.workoutsCompleted || 0; }

function initChart() {
    const ctx = document.getElementById('consistencyChart');
    if(!ctx) return;
    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, { 
        type: 'line', 
        data: { 
            labels: ['4 Wks Ago','3 Wks Ago','2 Wks Ago','Last Week','This Week'], 
            datasets: [{ data: userData.stats.consistency || [0,0,0,0,0], borderColor: '#00f2ea', backgroundColor: 'rgba(0,242,234,0.1)', fill: true, tension: 0.4 }] 
        }, 
        options: { plugins: { legend: { display: false } }, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: '#333' } }, x: { grid: { display: false } } } } 
    });
}

// DEFENSIVE CHART UPDATE
window.updateChart = function() {
    if(chartInstance && chartInstance.data && chartInstance.data.datasets && userData && userData.stats) {
        chartInstance.data.datasets[0].data = userData.stats.consistency || [0,0,0,0,0];
        chartInstance.update();
    }
}

function updateProfileUI() {
    document.getElementById('plan-badge').innerText = "Pro Plan";
    document.getElementById('plan-badge').classList.add('pro-badge');
    document.getElementById('profile-card-ui').classList.add('pro-user');
    document.querySelector('.avatar').classList.add('pro');
}
function triggerConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    let particles = [];
    for(let i=0; i<100; i++) particles.push({x:canvas.width/2,y:canvas.height/2,vx:(Math.random()-0.5)*10,vy:(Math.random()-0.5)*10,color:`hsl(${Math.random()*360},100%,50%)`});
    let opacity = 1;
    function animate() {
        ctx.clearRect(0,0,canvas.width,canvas.height);
        particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;ctx.fillStyle=p.color;ctx.globalAlpha=opacity;ctx.fillRect(p.x,p.y,5,5);});
        opacity-=0.02; if(opacity>0)requestAnimationFrame(animate);
    }
    animate();
}
window.saveSettings = function() {
    const restVal = parseInt(document.getElementById('setting-rest').value);
    if(restVal && restVal > 0) { if(!userData.settings) userData.settings = {}; userData.settings.rest = restVal; saveUserData(); } else alert("Enter valid seconds");
}
window.resetXP = function() {
    if(confirm("Are you sure? This will reset your XP to 0.")) { userData.xp = 0; saveUserData(); updateXPUI(); showToast("XP Reset"); }
}
window.switchView = function(viewId, btn) {
    document.querySelectorAll('.container').forEach(e => e.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
}
window.switchSubTab = function(subId, btn) {
    document.querySelectorAll('.sub-view').forEach(e => e.classList.remove('active'));
    document.getElementById(subId).classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (subId === 'sub-timeline') fetchAndRenderTimeline();
}
