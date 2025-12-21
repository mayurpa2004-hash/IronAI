// --- 1. CONFIG & INIT ---
const safetyTimer = setTimeout(() => {
    const loader = document.getElementById('loading-screen');
    const authScreen = document.getElementById('auth-screen');
    if(loader) loader.style.display = 'none';
    if(authScreen && !currentUser) authScreen.style.display = 'flex';
}, 2500);

const firebaseConfig = {
    apiKey: "AIzaSyAWs0NcroENosdC10uoOHZ-klhhn9uqcIA",
    authDomain: "ironai-f83d5.firebaseapp.com",
    databaseURL: "https://ironai-f83d5-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "ironai-f83d5",
    messagingSenderId: "537997914848",
    appId: "1:537997914848:web:f2775b0abbad439a8a5685"
};

try { firebase.initializeApp(firebaseConfig); } catch (e) { console.error(e); }

try {
    firebase.database().enablePersistence().catch((err) => {
        if (err.code == 'failed-precondition') console.warn('Persistence error: Tabs');
        else if (err.code == 'unimplemented') console.warn('Persistence error: Browser');
    });
} catch(e) {}

const auth = firebase.auth();
const db = firebase.database();

// --- USER SPECIFIC SPLIT ---
const defaultWorkouts = {
    "Monday": ["Incline Dumbbell Press", "Flat Barbell Press", "High-to-Low Cable Fly", "Dumbbell Fly", "Rope Pushdown", "Single-Arm Cable Pushdown", "Triceps Dips"],
    "Tuesday": ["Lat Pulldown", "Bent-Over Barbell Row", "One-Arm Cable Pulldown", "Dumbbell Shrugs", "Incline Dumbbell Curl", "Barbell Curl", "Dumbbell Hammer Curl"],
    "Wednesday": ["Barbell Squats", "Leg Extensions", "Calf Curls", "Lunges", "Dumbbell Shoulder Press", "Dumbbell Lateral Raises", "Reverse Pec Fly"],
    "Thursday": ["Incline Barbell Press", "Flat Dumbbell Press", "High-to-Low Cable Fly", "Pec Deck Fly", "Bar Pushdown", "Dumbbell Kickbacks", "Close-Grip Barbell Press"],
    "Friday": ["Lat Pullover", "Chest-Supported Row", "Single-Arm Dumbbell Row", "Barbell Shrugs", "Spider Curl", "Cable Curl", "Rope Hammer Curl"],
    "Saturday": ["Romanian Deadlifts (RDLs)", "Leg Press", "Hip Thrusts", "Lying Leg Curls", "Barbell Shoulder Press", "Cable Lateral Raises", "Face Pulls"],
    "Sunday": ["Rest Day"]
};

let currentUser = null;
let currentDietPref = "nonveg"; 
let userData = { 
    xp: 0, 
    workouts: JSON.parse(JSON.stringify(defaultWorkouts)), 
    logs: {}, 
    history: {},
    settings: { rest: 90 },
    stats: { workoutsCompleted: 0, consistency: [0,0,0,0,0] },
    timeline: [],
    plan: "Free",
    tempPlan: ""
};
let timerInterval, timeLeft, audioCtx, chartInstance;

// --- 2. NETWORK ---
window.addEventListener('offline', () => { document.getElementById('network-status').classList.add('offline'); });
window.addEventListener('online', () => { document.getElementById('network-status').classList.remove('offline'); });

// --- 3. AUTH ---
auth.onAuthStateChanged((user) => {
    clearTimeout(safetyTimer);
    document.getElementById('loading-screen').style.display = 'none';
    if (user) {
        currentUser = user;
        document.getElementById('auth-screen').style.display = 'none';
        try { initApp(); } catch(e) { console.error(e); }
    } else {
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('app-content').style.display = 'none';
    }
});

function handleAuth() {
    const email = document.getElementById('email').value.trim();
    const pass = document.getElementById('password').value.trim();
    if(!email || !pass) { alert("Please enter email & password"); return; }
    auth.signInWithEmailAndPassword(email, pass).catch(e => {
        if(e.code === 'auth/user-not-found') {
            auth.createUserWithEmailAndPassword(email, pass).catch(er => alert(er.message));
        } else alert(e.message);
    });
}

function logout() { auth.signOut().then(() => location.reload()); }

// --- 4. CORE APP ---
function initApp() {
    document.getElementById('app-content').style.display = 'block';
    if(currentUser.email) document.getElementById('profile-email').innerText = currentUser.email.split('@')[0];
    switchView('view-workout', document.querySelector('.nav-btn'));

    db.ref('users/' + currentUser.uid).once('value').then(snap => {
        if(snap.exists()) {
            const val = snap.val();
            if(val.xp) userData.xp = val.xp;
            if(val.workouts) userData.workouts = val.workouts;
            if(val.logs) userData.logs = val.logs; 
            if(val.history) userData.history = val.history; 
            if(val.settings) userData.settings = val.settings;
            if(val.stats) userData.stats = val.stats;
            if(val.timeline) userData.timeline = val.timeline;
            if(val.plan) userData.plan = val.plan;
        }
        
        let today = "Monday";
        try { today = localStorage.getItem('currentDay') || ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date().getDay()]; } catch(e){}
        document.getElementById('day-selector').value = today;
        
        if(userData.settings && userData.settings.rest) document.getElementById('setting-rest').value = userData.settings.rest;

        loadWorkout(today);
        calculateWeeklyConsistency();
        updateStatsUI();
        initChart();
        renderTimeline();
        updateXPUI();
        updateProfileUI();
    });
}

function saveUserData() { if(currentUser) db.ref('users/' + currentUser.uid).update(userData); showToast("Saved"); }

// --- 5. REAL CHART DATA ---
function calculateWeeklyConsistency() {
    if(!userData.history) return;
    const now = new Date();
    const counts = [0, 0, 0, 0, 0];
    Object.values(userData.history).forEach(session => {
        const d = new Date(session.timestamp);
        const diffTime = Math.abs(now - d);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        const weekIndex = Math.floor(diffDays / 7);
        if(weekIndex < 5) counts[4 - weekIndex]++;
    });
    userData.stats.consistency = counts;
}

// --- 6. WORKOUT & TIMER ---
function loadWorkout(day) {
    const list = document.getElementById('workout-list');
    list.innerHTML = "";
    const exercises = userData.workouts[day] || [];
    if(exercises.length === 0) { list.innerHTML = "<p style='text-align:center;color:#666;margin-top:20px;'>Rest Day</p>"; return; }

    exercises.forEach((ex, exIdx) => {
        let setHtml = '';
        for(let s = 1; s <= 3; s++) {
            const logData = (userData.logs[day] && userData.logs[day][exIdx] && userData.logs[day][exIdx][s]) || {w:'', r:'', done:false};
            const isChecked = logData.done ? 'checked' : '';
            setHtml += `<div class="set-row"><span>Set ${s}</span>
                <input type="number" placeholder="kg" value="${logData.w}" onchange="updateLog('${day}',${exIdx},${s},'w',this.value)">
                <input type="number" placeholder="reps" value="${logData.r}" onchange="updateLog('${day}',${exIdx},${s},'r',this.value)">
                <i class="fas fa-check-circle check-btn ${isChecked}" onclick="toggleSet(this,'${day}',${exIdx},${s})"></i></div>`;
        }
        list.innerHTML += `<div class="card">
            <button class="swap-btn" onclick="swapExercise('${day}',${exIdx})"><i class="fas fa-sync"></i></button>
            <div class="exercise-header"><h4>${ex}</h4></div>
            ${setHtml}
        </div>`;
    });
}

function addCustomExercise() {
    const day = document.getElementById('day-selector').value;
    const name = prompt("Enter Exercise Name (e.g. Deadlift):");
    if(name) {
        if(!userData.workouts[day]) userData.workouts[day] = [];
        userData.workouts[day].push(name);
        saveUserData();
        loadWorkout(day);
    }
}

function updateLog(day, exIdx, setNum, type, val) {
    if(!userData.logs[day]) userData.logs[day] = {};
    if(!userData.logs[day][exIdx]) userData.logs[day][exIdx] = {};
    if(!userData.logs[day][exIdx][setNum]) userData.logs[day][exIdx][setNum] = { w:'', r:'', done: false };
    userData.logs[day][exIdx][setNum][type] = val;
    saveUserData();
}

function toggleSet(btn, day, exIdx, setNum) {
    if(!userData.logs[day]) userData.logs[day] = {};
    if(!userData.logs[day][exIdx]) userData.logs[day][exIdx] = {};
    if(!userData.logs[day][exIdx][setNum]) userData.logs[day][exIdx][setNum] = { w:'', r:'', done: false };

    if(btn.classList.contains('checked')) {
        btn.classList.remove('checked');
        userData.logs[day][exIdx][setNum].done = false;
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

function updateTimerDisplay() {
    const m = Math.floor(timeLeft / 60).toString().padStart(2,'0');
    const s = (timeLeft % 60).toString().padStart(2,'0');
    document.getElementById('timer-val').innerText = `${m}:${s}`;
}
function adjustTime(val) { timeLeft += val; updateTimerDisplay(); }
function stopTimer() { clearInterval(timerInterval); document.getElementById('rest-timer').classList.remove('active'); }

function triggerAlarm() {
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if(audioCtx.state === 'suspended') audioCtx.resume();
    
    let count = 0;
    const beep = () => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        gain.gain.setValueAtTime(1.0, audioCtx.currentTime); 
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
        if(navigator.vibrate) navigator.vibrate(500);
        count++;
        if(count < 3) setTimeout(beep, 800);
        else setTimeout(() => stopTimer(), 1000);
    };
    beep();
}

// --- 7. SETTINGS & PROFILE & LEVEL ---
function saveSettings() {
    const restVal = parseInt(document.getElementById('setting-rest').value);
    if(restVal && restVal > 0) {
        if(!userData.settings) userData.settings = {};
        userData.settings.rest = restVal;
        saveUserData();
    } else alert("Enter valid seconds");
}

function resetXP() {
    if(confirm("Are you sure? This will reset your XP to 0.")) {
        userData.xp = 0;
        saveUserData();
        updateXPUI();
        showToast("XP Reset");
    }
}

function updateProfileUI() {
    const badge = document.getElementById('plan-badge');
    const card = document.getElementById('profile-card-ui');
    const avatar = document.querySelector('.avatar');
    const lockIcon = document.getElementById('lock-icon');
    badge.innerText = userData.plan + " Plan";
    if (userData.plan !== "Free") {
        badge.classList.add('pro-badge');
        card.classList.add('pro-user');
        avatar.classList.add('pro');
        if(lockIcon) lockIcon.style.display = 'none';
    } else {
        badge.classList.remove('pro-badge');
        card.classList.remove('pro-user');
        avatar.classList.remove('pro');
        if(lockIcon) lockIcon.style.display = 'block';
    }
}

function updateXPUI() { 
    // LEVEL SYSTEM LOGIC
    const lvl = Math.floor(userData.xp / 1000) + 1;
    document.getElementById('user-level').innerText = lvl;
    document.getElementById('weekly-xp-current').innerText = (userData.xp % 1000) + " XP"; 
    document.getElementById('weekly-xp-fill').style.width = ((userData.xp % 1000)/1000)*100 + "%"; 
}

// --- 8. CONFETTI ---
function triggerConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
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

// --- 9. PAYMENTS ---
function openPlans() { document.getElementById('payment-modal').style.display = 'flex'; document.getElementById('plan-selection').classList.remove('hidden'); document.getElementById('payment-gateway').classList.add('hidden'); }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function selectPlan(plan, price) { document.getElementById('plan-selection').classList.add('hidden'); document.getElementById('payment-gateway').classList.remove('hidden'); document.getElementById('pay-amount').innerText = `Pay ₹${price}`; userData.tempPlan = plan; }
function backToPlans() { document.getElementById('plan-selection').classList.remove('hidden'); document.getElementById('payment-gateway').classList.add('hidden'); }
function switchPayMethod(method) {
    document.querySelectorAll('.pay-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.pay-view').forEach(v => v.classList.remove('active'));
    event.currentTarget.classList.add('active');
    document.getElementById('pay-' + method).classList.add('active');
}
function processPayment() {
    const activeMethod = document.querySelector('.pay-tab.active').innerText;
    let isValid = false;
    if (activeMethod === "UPI") {
        const upiVal = document.getElementById('upi-input').value;
        if(upiVal.length > 5 && upiVal.includes('@')) isValid = true;
    } else {
        const cardVal = document.getElementById('card-num').value;
        if(cardVal.length >= 16) isValid = true;
    }
    if (!isValid) { alert("Invalid payment details."); return; }
    
    const btn = document.querySelector('#payment-gateway .btn-primary');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    setTimeout(() => {
        alert("Success! Welcome to " + userData.tempPlan);
        userData.plan = userData.tempPlan;
        saveUserData();
        updateProfileUI();
        closeModal('payment-modal');
        btn.innerText = "Complete Payment";
    }, 2000);
}

// --- 10. CHATBOT ---
function toggleChat() {
    const win = document.getElementById('chat-window');
    win.classList.toggle('hidden');
    if(!win.classList.contains('hidden')) setTimeout(() => document.getElementById('chat-input').focus(), 100);
}
function handleChatEnter(e) { if(e.key === 'Enter') sendMessage(); }
function sendMessage() {
    const input = document.getElementById('chat-input');
    const txt = input.value.trim();
    if(!txt) return;
    addMessage(txt, 'user');
    input.value = "";
    const loadingId = addMessage("Thinking...", 'bot');
    setTimeout(() => {
        const reply = getSimulatedAIResponse(txt);
        const msgDiv = document.getElementById(loadingId);
        if(msgDiv) msgDiv.innerText = reply;
    }, 600);
}
function addMessage(text, sender) {
    const id = 'msg-' + Date.now();
    const div = document.createElement('div');
    div.className = `msg ${sender}`;
    div.id = id;
    div.innerText = text;
    const box = document.getElementById('chat-messages');
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    return id;
}
function getSimulatedAIResponse(input) {
    const text = input.toLowerCase().trim();
    if (['hi', 'hello', 'hey'].some(w => text.includes(w))) return "Hey! Ready to lift? Ask me about workouts, diet, or specific exercises.";
    if (text.includes('chest') || text.includes('bench')) return "For Chest: Incline Press (Upper), Flat Bench (Middle), Cable Flys (Inner).";
    if (text.includes('back') || text.includes('lat')) return "For Back: Lat Pulldowns (Width), Bent Over Rows (Thickness).";
    if (text.includes('leg') || text.includes('squat')) return "For Legs: Squats are king. Hit depth! Add extensions for detail.";
    if (text.includes('diet') || text.includes('protein')) return "Eat 2g protein per kg bodyweight. Chicken, eggs, and whey are key.";
    if (text.includes('creatine')) return "Creatine Monohydrate (5g/day) is safe and effective for strength.";
    if (text.includes('fat') || text.includes('loss')) return "Calorie Deficit is required. Eat less than you burn. Keep protein high.";
    return "I didn't catch that. Ask about 'Chest', 'Diet', 'Squats', or 'Creatine'.";
}

// --- 11. HELPERS & HISTORY UI ---
function switchView(viewId, btn) {
    if (viewId === 'view-coach' && userData.plan === 'Free') {
        if(confirm("Upgrade to unlock AI Coach?")) openPlans();
        return;
    }
    document.querySelectorAll('.container').forEach(e => e.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
}
function switchSubTab(subId, btn) {
    document.querySelectorAll('.sub-view').forEach(e => e.classList.remove('active'));
    document.getElementById(subId).classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}
function changeDay(day) { try { localStorage.setItem('currentDay', day); } catch(e){} loadWorkout(day); }
function finishWorkoutSession() {
    triggerConfetti(); 
    const day = document.getElementById('day-selector').value;
    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const sessionData = { date: dateStr, timestamp: Date.now(), dayName: day, exercises: userData.workouts[day], logs: userData.logs[day] || {} };
    if(!userData.history) userData.history = {};
    const newKey = db.ref('users/' + currentUser.uid + '/history').push().key;
    userData.history[newKey] = sessionData;
    db.ref('users/' + currentUser.uid + '/history/' + newKey).set(sessionData);
    userData.xp += 100;
    userData.stats.workoutsCompleted = (userData.stats.workoutsCompleted || 0) + 1;
    calculateWeeklyConsistency(); 
    updateStatsUI(); updateXPUI(); updateChart();
    if(confirm("Workout Saved! +100 XP.\n\nClear checks for next week?")) {
        if(userData.logs[day]) Object.keys(userData.logs[day]).forEach(ex => Object.keys(userData.logs[day][ex]).forEach(s => userData.logs[day][ex][s].done = false));
        saveUserData(); loadWorkout(day);
    } else saveUserData();
}

function loadHistoryUI() {
    const list = document.getElementById('history-list');
    list.innerHTML = "";
    if (!userData.history || Object.keys(userData.history).length === 0) { list.innerHTML = "<p style='text-align:center;color:#666;'>No workouts yet.</p>"; return; }
    
    // Sort Newest First
    const allEntries = Object.entries(userData.history).sort(([,a], [,b]) => b.timestamp - a.timestamp);
    const isPro = userData.plan !== 'Free';
    const entriesToShow = isPro ? allEntries : allEntries.slice(0, 3); 

    let currentMonth = "";

    entriesToShow.forEach(([key, entry]) => {
        // Group by Month
        const entryDate = new Date(entry.timestamp);
        const monthStr = entryDate.toLocaleString('default', { month: 'long', year: 'numeric' });
        
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
        
        // Added Delete Button (trash icon) logic
        list.innerHTML += `
            <div class="history-card" onclick="this.classList.toggle('open')">
                <i class="fas fa-trash history-delete" onclick="deleteHistoryEntry('${key}'); event.stopPropagation();"></i>
                <div class="history-header"><span class="history-title">${entry.dayName}</span><span class="history-date">${entry.date}</span></div>
                <div class="history-summary"><span>${setCounts} Sets</span><i class="fas fa-chevron-down"></i></div>
                <div class="history-extended">${detailsHtml || '<p style="font-size:0.8rem; color:#666;">No details recorded.</p>'}</div>
            </div>`;
    });

    if (!isPro && allEntries.length > 3) {
        list.innerHTML += `<div class="upgrade-card" onclick="openPlans()"><p>🔒 ${allEntries.length - 3} older workouts hidden</p><button class="btn-primary" style="font-size:0.8rem; padding:8px;">Upgrade to View All</button></div>`;
    }
}

function deleteHistoryEntry(key) {
    if(confirm("Delete this workout from history?")) {
        delete userData.history[key];
        db.ref('users/' + currentUser.uid + '/history/' + key).remove();
        loadHistoryUI();
        calculateWeeklyConsistency(); 
        updateChart();
    }
}

function generateDiet() {
    const weight = parseFloat(document.getElementById('diet-weight').value);
    const goal = document.getElementById('diet-goal').value;
    if(!weight) { alert("Please enter weight"); return; }

    let cals = goal === 'cut' ? weight * 22 : (goal === 'bulk' ? weight * 35 : weight * 29);
    let protein = Math.round(weight * 2.2);
    let carbs = Math.round((cals - (protein * 4) - (cals * 0.25)) / 4);

    document.getElementById('out-cals').innerText = Math.round(cals);
    document.getElementById('out-prot').innerText = protein + "g";
    document.getElementById('out-carbs').innerText = carbs + "g";

    const suffix = (cals > 2800) ? " (Large Portion)" : (cals < 1800) ? " (Small Portion)" : "";

    const list = document.getElementById('meal-list');
    list.innerHTML = "";
    [{name:"Oats & Whey", desc:"High Protein Breakfast" + suffix, img:"https://images.unsplash.com/photo-1517673132405-a56a62b18caf?w=400&q=80"},
     {name:"Chicken & Rice", desc:"Standard Bodybuilder Lunch" + suffix, img:"https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&q=80"},
     {name:"Salmon & Veg", desc:"Healthy Fats Dinner" + suffix, img:"https://images.unsplash.com/photo-1467003909585-2f8a7270028d?w=400&q=80"}]
    .forEach(m => list.innerHTML += `<div class="meal-card"><img src="${m.img}" class="meal-img" onerror="this.src='https://placehold.co/150x150?text=No+Image'"><div class="meal-info"><h4>${m.name}</h4><p>${m.desc}</p></div></div>`);
    document.getElementById('diet-results').classList.remove('hidden');
}
function analyzePhoto(input) {
    if (input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('scan-preview').src = e.target.result;
            document.getElementById('scan-loading').classList.remove('hidden');
            document.getElementById('scan-result').classList.add('hidden');
            setTimeout(() => {
                document.getElementById('scan-loading').classList.add('hidden');
                document.getElementById('scan-result').classList.remove('hidden');
                document.getElementById('ai-obs').innerText = "Analysis: Good definition. Focus on Upper Chest and Side Delts.";
            }, 2000);
        };
        reader.readAsDataURL(input.files[0]);
    }
}
function uploadTimelinePhoto(input) {
    if (input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const entry = { img: e.target.result, date: new Date().toLocaleDateString() };
            if(!userData.timeline) userData.timeline = [];
            userData.timeline.unshift(entry);
            saveUserData();
            renderTimeline();
        };
        reader.readAsDataURL(input.files[0]);
    }
}
function renderTimeline() {
    const grid = document.getElementById('timeline-grid');
    grid.innerHTML = "";
    if(userData.timeline) userData.timeline.forEach((item,idx) => grid.innerHTML += `<div class="gallery-item"><img src="${item.img}"><div class="gallery-date">${item.date}</div><button class="delete-photo-btn" onclick="if(confirm('Delete?')){userData.timeline.splice(${idx},1);saveUserData();renderTimeline();}"><i class="fas fa-trash"></i></button></div>`);
}
function calculate1RM() {
    const w = parseFloat(document.getElementById('rm-weight').value);
    const r = parseFloat(document.getElementById('rm-reps').value);
    if(w && r) {
        document.getElementById('rm-result').innerHTML = `Est Max: <span style="color:#fff">${Math.round(w * (1 + r/30))} kg</span>`;
        document.getElementById('rm-result').classList.remove('hidden');
    }
}
function updateStatsUI() { document.getElementById('stat-workouts').innerText = userData.stats.workoutsCompleted || 0; }
function updateXPUI() { 
    // LEVEL SYSTEM
    const lvl = Math.floor(userData.xp / 1000) + 1;
    document.getElementById('user-level').innerText = lvl;
    document.getElementById('weekly-xp-current').innerText = (userData.xp % 1000) + " XP"; 
    document.getElementById('weekly-xp-fill').style.width = ((userData.xp % 1000)/1000)*100 + "%"; 
}
function initChart() {
    const ctx = document.getElementById('consistencyChart');
    if(!ctx) return;
    chartInstance = new Chart(ctx, { type: 'line', data: { labels: ['4 Wks Ago','3 Wks Ago','2 Wks Ago','Last Week','This Week'], datasets: [{ data: userData.stats.consistency || [0,0,0,0,0], borderColor: '#00f2ea', backgroundColor: 'rgba(0,242,234,0.1)', fill: true }] }, options: { plugins: { legend: { display: false } }, maintainAspectRatio: false } });
}
function updateChart() {
    if(chartInstance && userData.stats.consistency) {
        chartInstance.data.datasets[0].data = userData.stats.consistency;
        chartInstance.update();
    }
}
function showToast(msg) { const t = document.getElementById('toast'); t.innerText = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2000); }
function swapExercise(day, idx) { const n = prompt("New name:", userData.workouts[day][idx]); if(n) { userData.workouts[day][idx] = n; if(userData.logs[day] && userData.logs[day][idx]) userData.logs[day][idx] = {}; saveUserData(); loadWorkout(day); } }
function resetRoutine() { if(confirm("Reset routine?")) { userData.workouts = JSON.parse(JSON.stringify(defaultWorkouts)); userData.logs = {}; saveUserData(); loadWorkout(document.getElementById('day-selector').value); } }
function selectDietPref(pref) { currentDietPref = pref; document.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('active')); document.getElementById('btn-' + pref).classList.add('active'); }
