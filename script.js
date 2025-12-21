// --- 1. SAFETY & INITIALIZATION ---
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

try { firebase.initializeApp(firebaseConfig); } catch (e) { console.error("Firebase Init Error", e); }

// --- OFFLINE PERSISTENCE (Safe Mode) ---
try {
    firebase.database().enablePersistence().catch((err) => {
        if (err.code == 'failed-precondition') console.warn('Multiple tabs open, persistence disabled');
        else if (err.code == 'unimplemented') console.warn('Browser does not support offline mode');
    });
} catch(e) { console.log("Persistence not supported"); }

const auth = firebase.auth();
const db = firebase.database();

const defaultWorkouts = {
    "Monday": ["Incline Dumbbell Press", "Pec Deck Fly", "Tricep Pushdowns"],
    "Tuesday": ["Lat Pulldowns", "Bent Over Rows", "Barbell Curls"],
    "Wednesday": ["Squats", "Leg Extensions", "Shoulder Press"],
    "Thursday": ["Flat Bench Press", "Cable Flys", "Overhead Extensions"],
    "Friday": ["Seated Rows", "Face Pulls", "Hammer Curls"],
    "Saturday": ["Deadlifts", "Lunges", "Lateral Raises"],
    "Sunday": ["Stretching", "Cardio"]
};

let currentUser = null;
let currentDietPref = "nonveg"; 
let userData = { 
    xp: 0, 
    workouts: JSON.parse(JSON.stringify(defaultWorkouts)), 
    logs: {}, // Stores current weight/reps
    history: {}, // Stores past finished workouts
    settings: { rest: 90 },
    stats: { workoutsCompleted: 0, consistency: [0,0,0,0,0] },
    timeline: [],
    plan: "Free"
};
let timerInterval, timeLeft, audioCtx, chartInstance;

// --- 2. NETWORK LISTENERS ---
window.addEventListener('offline', () => {
    const badge = document.getElementById('network-status');
    badge.classList.add('offline');
    badge.innerText = "⚠️ Offline Mode - Saving Locally";
});

window.addEventListener('online', () => {
    const badge = document.getElementById('network-status');
    badge.style.background = "#10b981"; // Green
    badge.innerText = "✅ Back Online - Syncing...";
    setTimeout(() => {
        badge.classList.remove('offline');
        badge.style.background = "#f59e0b"; // Reset to orange for next time
    }, 3000);
});

// --- 3. AUTHENTICATION LISTENER ---
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
    const err = document.getElementById('auth-error');
    
    if(!email || !pass) { err.innerText = "Please enter email & password"; return; }
    if(pass.length < 6) { err.innerText = "Password must be 6+ chars"; return; }

    auth.signInWithEmailAndPassword(email, pass).catch(e => {
        if(e.code === 'auth/user-not-found') {
            auth.createUserWithEmailAndPassword(email, pass).catch(error => err.innerText = error.message);
        } else {
            err.innerText = e.message;
        }
    });
}

function logout() { auth.signOut().then(() => location.reload()); }

// --- 4. APP LOGIC ---
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
        
        // Restore last viewed day
        let today = "Monday";
        try {
            const storedDay = localStorage.getItem('currentDay');
            today = storedDay ? storedDay : ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date().getDay()];
        } catch(e) {}

        document.getElementById('day-selector').value = today;
        loadWorkout(today);
        
        updateStatsUI();
        initChart();
        renderTimeline();
        updateXPUI();
        document.getElementById('plan-badge').innerText = userData.plan + " Plan";
    });
}

function saveUserData() {
    if(currentUser) db.ref('users/' + currentUser.uid).update(userData);
    showToast("Saved");
}

function changeDay(day) {
    try { localStorage.setItem('currentDay', day); } catch(e){}
    loadWorkout(day);
}

// --- 5. WORKOUT SYSTEM ---
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

            setHtml += `
            <div class="set-row">
                <span>Set ${s}</span>
                <input type="number" placeholder="kg" value="${logData.w}" onchange="updateLog('${day}', ${exIdx}, ${s}, 'w', this.value)">
                <input type="number" placeholder="reps" value="${logData.r}" onchange="updateLog('${day}', ${exIdx}, ${s}, 'r', this.value)">
                <i class="fas fa-check-circle check-btn ${isChecked}" onclick="toggleSet(this, '${day}', ${exIdx}, ${s})"></i>
            </div>`;
        }

        list.innerHTML += `
            <div class="card">
                <div class="exercise-header">
                    <h4>${ex}</h4>
                    <button class="icon-btn" style="width:30px;height:30px;font-size:0.8rem" onclick="swapExercise('${day}', ${exIdx})"><i class="fas fa-sync"></i></button>
                </div>
                ${setHtml}
            </div>`;
    });
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
        startTimer(parseInt(userData.settings.rest || 90));
        userData.xp += 10;
        updateXPUI();
    }
    saveUserData();
}

function finishWorkoutSession() {
    const day = document.getElementById('day-selector').value;
    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    
    // 1. History Snapshot
    const sessionData = {
        date: dateStr,
        timestamp: Date.now(),
        dayName: day,
        exercises: userData.workouts[day],
        logs: userData.logs[day] || {}
    };

    if(!userData.history) userData.history = {};
    const newKey = db.ref('users/' + currentUser.uid + '/history').push().key;
    userData.history[newKey] = sessionData;
    db.ref('users/' + currentUser.uid + '/history/' + newKey).set(sessionData);

    // 2. Stats
    userData.xp += 100;
    userData.stats.workoutsCompleted = (userData.stats.workoutsCompleted || 0) + 1;
    updateStatsUI();
    updateChart();
    updateXPUI();

    // 3. Reset Option
    if(confirm("Workout Saved! +100 XP.\n\nStart fresh next week? (Clears checks, keeps weights)")) {
        if(userData.logs[day]) {
            Object.keys(userData.logs[day]).forEach(exIdx => {
                Object.keys(userData.logs[day][exIdx]).forEach(setIdx => {
                    userData.logs[day][exIdx][setIdx].done = false;
                });
            });
            saveUserData();
            loadWorkout(day); 
        }
    } else {
        saveUserData();
    }
}

function loadHistoryUI() {
    const list = document.getElementById('history-list');
    list.innerHTML = "";
    
    if (!userData.history || Object.keys(userData.history).length === 0) {
        list.innerHTML = "<p style='text-align:center;color:#666;margin-top:20px;'>No workouts recorded yet.</p>";
        return;
    }

    const entries = Object.values(userData.history).sort((a, b) => b.timestamp - a.timestamp);

    entries.forEach(entry => {
        let setCounts = 0;
        if(entry.logs) {
             Object.values(entry.logs).forEach(exLog => {
                 Object.values(exLog).forEach(set => {
                     if(set.done) setCounts++;
                 });
             });
        }

        list.innerHTML += `
            <div class="history-card">
                <div class="history-header">
                    <span class="history-title">${entry.dayName}</span>
                    <span class="history-date">${entry.date}</span>
                </div>
                <div class="history-detail">
                    <span>${setCounts} sets completed</span>
                    <span style="color:#00f2ea">+100 XP</span>
                </div>
            </div>
        `;
    });
}

function swapExercise(day, idx) {
    const newName = prompt("New exercise name:", userData.workouts[day][idx]);
    if(newName) {
        userData.workouts[day][idx] = newName;
        if(userData.logs[day] && userData.logs[day][idx]) userData.logs[day][idx] = {};
        saveUserData();
        loadWorkout(day);
    }
}

function resetRoutine() {
    if(confirm("Reset routine & logs to default?")) {
        userData.workouts = JSON.parse(JSON.stringify(defaultWorkouts));
        userData.logs = {}; 
        saveUserData();
        loadWorkout(document.getElementById('day-selector').value);
    }
}

// --- 6. AI DIET ---
function selectDietPref(pref) {
    currentDietPref = pref;
    document.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-' + pref).classList.add('active');
}

function generateDiet() {
    const weight = parseFloat(document.getElementById('diet-weight').value);
    const goal = document.getElementById('diet-goal').value;

    if(!weight) { alert("Please enter weight"); return; }

    let cals = goal === 'cut' ? weight * 22 : (goal === 'bulk' ? weight * 35 : weight * 28);
    let protein = Math.round(weight * 2.2);
    let carbs = Math.round((cals - (protein * 4) - (cals * 0.25)) / 4);

    document.getElementById('out-cals').innerText = Math.round(cals);
    document.getElementById('out-prot').innerText = protein + "g";
    document.getElementById('out-carbs').innerText = carbs + "g";

    const meals = getMeals(currentDietPref, goal);
    const list = document.getElementById('meal-list');
    list.innerHTML = "";
    
    meals.forEach(m => {
        list.innerHTML += `
            <div class="meal-card">
                <img src="${m.img}" class="meal-img">
                <div class="meal-info"><h4>${m.name}</h4><p>${m.desc}</p></div>
            </div>`;
    });

    document.getElementById('diet-results').classList.remove('hidden');
}

function getMeals(pref, goal) {
    if(pref === 'veg') {
        return [
            { name: "Protein Oats", desc: "Oats, Almond Milk, Peanut Butter", img: "https://images.unsplash.com/photo-1517673132405-a56a62b18caf?w=150" },
            { name: "Paneer Stir Fry", desc: "200g Paneer, Veggies, Rice", img: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=150" },
            { name: "Lentil Curry", desc: "Dal, 2 Roti, Salad", img: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=150" }
        ];
    } else {
        return [
            { name: "Eggs & Toast", desc: "4 Eggs, Whole Wheat Toast", img: "https://images.unsplash.com/photo-1525351484164-983058b1f41f?w=150" },
            { name: "Chicken & Rice", desc: "Grilled Chicken, White Rice, Broccoli", img: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=150" },
            { name: "Fish & Potato", desc: "White Fish, Sweet Potato", img: "https://images.unsplash.com/photo-1467003909585-2f8a7270028d?w=150" }
        ];
    }
}

// --- 7. AI PHOTO ANALYZER ---
function analyzePhoto(input) {
    if (input.files && input.files[0]) {
        document.getElementById('scan-loading').classList.remove('hidden');
        document.getElementById('scan-result').classList.add('hidden');
        
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('scan-preview').src = e.target.result;
            setTimeout(() => {
                document.getElementById('scan-loading').classList.add('hidden');
                document.getElementById('scan-result').classList.remove('hidden');
                document.getElementById('ai-obs').innerHTML = "<strong>Analysis:</strong><br>Good definition.<br>Target: Upper Chest & Shoulders.<br>Body Fat: ~16%.";
            }, 2000);
        }
        reader.readAsDataURL(input.files[0]);
    }
}

// --- 8. TIMELINE ---
function uploadTimelinePhoto(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const entry = { img: e.target.result, date: new Date().toLocaleDateString() };
            if(!userData.timeline) userData.timeline = [];
            userData.timeline.unshift(entry);
            saveUserData();
            renderTimeline();
        }
        reader.readAsDataURL(input.files[0]);
    }
}

function renderTimeline() {
    const grid = document.getElementById('timeline-grid');
    grid.innerHTML = "";
    if(!userData.timeline) return;
    
    userData.timeline.forEach((item, index) => {
        grid.innerHTML += `
        <div class="gallery-item">
            <img src="${item.img}">
            <div class="gallery-date">${item.date}</div>
            <button class="delete-photo-btn" onclick="deleteTimelineItem(${index})"><i class="fas fa-trash"></i></button>
        </div>`;
    });
}

function deleteTimelineItem(index) {
    if(confirm("Delete this photo?")) {
        userData.timeline.splice(index, 1);
        saveUserData();
        renderTimeline();
    }
}

// --- 9. UTILS & UI HELPERS ---
function updateStatsUI() {
    document.getElementById('stat-workouts').innerText = userData.stats.workoutsCompleted || 0;
}

function updateXPUI() {
    const currentXP = userData.xp;
    const progress = Math.min((currentXP / 1000) * 100, 100);
    document.getElementById('weekly-xp-current').innerText = currentXP + " XP";
    document.getElementById('weekly-xp-fill').style.width = progress + "%";
}

function initChart() {
    const ctx = document.getElementById('consistencyChart');
    if(!ctx) return;
    const dataPoints = userData.stats.consistency || [0,0,0,0,0]; 
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['W1', 'W2', 'W3', 'W4', 'Cur'],
            datasets: [{ label: 'Workouts', data: dataPoints, borderColor: '#00f2ea', backgroundColor: 'rgba(0, 242, 234, 0.1)', fill: true, tension: 0.4 }]
        },
        options: { plugins: { legend: { display: false } }, maintainAspectRatio: false }
    });
}

function updateChart() {
    if(chartInstance && userData.stats.consistency) {
        chartInstance.data.datasets[0].data = userData.stats.consistency;
        chartInstance.update();
    }
}

function calculate1RM() {
    const w = parseFloat(document.getElementById('rm-weight').value);
    const r = parseFloat(document.getElementById('rm-reps').value);
    if(w && r) {
        const max = Math.round(w * (1 + r/30));
        const res = document.getElementById('rm-result');
        res.innerHTML = `Est Max: <span style="color:#fff">${max} kg</span>`;
        res.classList.remove('hidden');
    }
}

function startTimer(seconds) {
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

function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
}

function switchView(viewId, btn) {
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

// --- 10. CHATBOT LOGIC (BRAIN 2.0) ---
function toggleChat() {
    const win = document.getElementById('chat-window');
    win.classList.toggle('hidden');
    if(!win.classList.contains('hidden')) {
        setTimeout(() => document.getElementById('chat-input').focus(), 100);
    }
}

function handleChatEnter(e) {
    if(e.key === 'Enter') sendMessage();
}

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

// 🧠 EXPANDED KEYWORD MATCHING
function getSimulatedAIResponse(input) {
    const text = input.toLowerCase().trim();
    console.log("AI Processing:", text); // Debugging

    // 1. GREETINGS
    if (['hi', 'hello', 'hey', 'yo', 'sup'].some(w => text.includes(w))) {
        return "Hey! Ready to lift? Ask me about workouts, diet, or specific exercises.";
    }

    // 2. MUSCLE GROUPS (More comprehensive)
    if (text.includes('chest') || text.includes('pec') || text.includes('bench')) 
        return "For Chest: Focus on Incline Dumbbell Press (Upper), Flat Bench (Middle), and Cable Flys (Inner). Pinch your shoulder blades back!";
    
    if (text.includes('back') || text.includes('lat') || text.includes('pull')) 
        return "For Back: Lat Pulldowns give you width. Bent Over Rows give you thickness. Don't swing your body—control the weight.";

    if (text.includes('bicep') || text.includes('arms') || text.includes('curl')) 
        return "For Biceps: Keep your elbows tucked by your side. Try Hammer Curls for thickness and Preacher Curls for the peak.";

    if (text.includes('tricep') || text.includes('pushdown')) 
        return "For Triceps: They make up 70% of your arm size! Focus on Rope Pushdowns and Skullcrushers. Full extension at the bottom.";

    if (text.includes('leg') || text.includes('squat') || text.includes('quad') || text.includes('hamstring')) 
        return "For Legs: Squats are king. Ensure you hit parallel depth. Add Leg Extensions for definition and Hamstring Curls for balance.";

    if (text.includes('shoulder') || text.includes('delts') || text.includes('press')) 
        return "For Shoulders: Overhead Press for mass. Lateral Raises for width (side delts). Face Pulls for rear delts and posture.";

    if (text.includes('abs') || text.includes('core') || text.includes('belly')) 
        return "Abs are made in the kitchen! You need low body fat to see them. For training, do Hanging Leg Raises and Cable Crunches.";

    // 3. DIET & SUPPLEMENTS
    if (text.includes('diet') || text.includes('eat') || text.includes('food') || text.includes('nutrition')) 
        return "Nutrition Rule #1: Protein! Aim for 1.6g to 2.2g per kg of bodyweight. Prioritize whole foods like eggs, chicken, rice, and veggies.";

    if (text.includes('creatine') || text.includes('supplements') || text.includes('whey')) 
        return "Supplements: Creatine Monohydrate (5g/day) is highly recommended. Whey Protein is great for hitting protein goals convenience.";

    if (text.includes('fat') || text.includes('weight loss') || text.includes('cut')) 
        return "To lose fat, you MUST be in a Calorie Deficit (burn more than you eat). Heavy lifting helps keep the muscle while you burn the fat.";

    if (text.includes('bulk') || text.includes('gain') || text.includes('muscle')) 
        return "To build muscle, eat in a slight surplus (+300 calories). Focus on getting stronger on compound lifts (Squat, Bench, Deadlift) over time.";

    // 4. GENERAL APP HELP
    if (text.includes('save') || text.includes('log') || text.includes('track')) 
        return "I track everything automatically! Just check the boxes and click 'Finish Workout' at the bottom to save to History.";

    if (text.includes('help') || text.includes('support')) 
        return "I can help with: Chest, Back, Legs, Arms, Diet, Creatine, Fat Loss, and Bulking. Just type a topic!";

    // 5. IMPROVED DEFAULT FALLBACK
    return "I didn't catch that specific topic. Try asking about 'Chest', 'Diet', 'Squats', or 'Creatine'. I'm a gym coach, not a philosopher! 😉";
}
