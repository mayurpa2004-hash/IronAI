// --- 1. FIREBASE CONFIG ---
const firebaseConfig = {
    apiKey: "AIzaSyAWs0NcroENosdC10uoOHZ-klhhn9uqcIA",
    authDomain: "ironai-f83d5.firebaseapp.com",
    databaseURL: "https://ironai-f83d5-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "ironai-f83d5",
    messagingSenderId: "537997914848",
    appId: "1:537997914848:web:f2775b0abbad439a8a5685"
};

try { firebase.initializeApp(firebaseConfig); } catch (e) { console.error(e); }
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
    settings: { rest: 90 },
    stats: { workoutsCompleted: 0, consistency: [0,0,0,0,0] },
    timeline: [],
    plan: "Free"
};
let timerInterval, timeLeft, audioCtx, chartInstance;

// --- 2. AUTHENTICATION (SAFETY FORCE) ---
// Force login screen after 2.5s if Firebase is slow
const safetyTimer = setTimeout(() => {
    document.getElementById('loading-screen').style.display = 'none';
    if(!currentUser) document.getElementById('auth-screen').style.display = 'flex';
}, 2500);

auth.onAuthStateChanged((user) => {
    clearTimeout(safetyTimer);
    document.getElementById('loading-screen').style.display = 'none';
    
    if (user) {
        currentUser = user;
        document.getElementById('auth-screen').style.display = 'none';
        initApp();
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

    auth.signInWithEmailAndPassword(email, pass).catch(e => {
        if(e.code === 'auth/user-not-found') {
            auth.createUserWithEmailAndPassword(email, pass).catch(error => err.innerText = error.message);
        } else {
            err.innerText = e.message;
        }
    });
}

function logout() { auth.signOut().then(() => location.reload()); }

// --- 3. APP LOGIC ---
function initApp() {
    document.getElementById('app-content').style.display = 'block';
    document.getElementById('profile-email').innerText = currentUser.email.split('@')[0];
    
    switchView('view-workout', document.querySelector('.nav-btn'));

    db.ref('users/' + currentUser.uid).once('value').then(snap => {
        if(snap.exists()) {
            const val = snap.val();
            if(val.xp) userData.xp = val.xp;
            if(val.workouts) userData.workouts = val.workouts;
            if(val.settings) userData.settings = val.settings;
            if(val.stats) userData.stats = val.stats;
            if(val.timeline) userData.timeline = val.timeline;
            if(val.plan) userData.plan = val.plan;
        }
        
        const today = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date().getDay()];
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

// --- 4. WORKOUT SYSTEM ---
function loadWorkout(day) {
    const list = document.getElementById('workout-list');
    list.innerHTML = "";
    const exercises = userData.workouts[day] || [];

    if(exercises.length === 0) { list.innerHTML = "<p style='text-align:center;color:#666;margin-top:20px;'>Rest Day</p>"; return; }

    exercises.forEach((ex, idx) => {
        list.innerHTML += `
            <div class="card">
                <div class="exercise-header">
                    <h4>${ex}</h4>
                    <button class="icon-btn" style="width:30px;height:30px;font-size:0.8rem" onclick="swapExercise('${day}', ${idx})"><i class="fas fa-sync"></i></button>
                </div>
                ${[1,2,3].map(s => `
                <div class="set-row">
                    <span>Set ${s}</span>
                    <input type="number" placeholder="kg">
                    <input type="number" placeholder="reps">
                    <i class="fas fa-check-circle check-btn" onclick="toggleSet(this)"></i>
                </div>`).join('')}
            </div>`;
    });
}

function toggleSet(btn) {
    if(btn.classList.contains('checked')) {
        btn.classList.remove('checked');
    } else {
        btn.classList.add('checked');
        startTimer(parseInt(userData.settings.rest || 90));
        userData.xp += 10;
        updateXPUI();
    }
}

function finishWorkoutSession() {
    alert("Workout Complete! +100 XP");
    userData.xp += 100;
    userData.stats.workoutsCompleted = (userData.stats.workoutsCompleted || 0) + 1;
    saveUserData();
    updateStatsUI();
    updateChart();
    updateXPUI();
}

function swapExercise(day, idx) {
    const newName = prompt("New exercise name:", userData.workouts[day][idx]);
    if(newName) {
        userData.workouts[day][idx] = newName;
        saveUserData();
        loadWorkout(day);
    }
}

function resetRoutine() {
    if(confirm("Reset to default?")) {
        userData.workouts = JSON.parse(JSON.stringify(defaultWorkouts));
        saveUserData();
        loadWorkout(document.getElementById('day-selector').value);
    }
}

// --- 5. AI DIET ---
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

// --- 6. AI PHOTO ANALYZER ---
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

// --- 7. TIMELINE ---
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
    userData.timeline.forEach(item => {
        grid.innerHTML += `<div class="gallery-item"><img src="${item.img}"><div class="gallery-date">${item.date}</div></div>`;
    });
}

// --- 8. PAYMENT & SUBSCRIPTION ---
function openPlans() {
    document.getElementById('payment-modal').style.display = 'flex';
    document.getElementById('plan-selection').classList.remove('hidden');
    document.getElementById('payment-gateway').classList.add('hidden');
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }

function selectPlan(plan, price) {
    document.getElementById('plan-selection').classList.add('hidden');
    document.getElementById('payment-gateway').classList.remove('hidden');
    document.getElementById('pay-amount').innerText = `Pay ₹${price}`;
    userData.tempPlan = plan;
}

function backToPlans() {
    document.getElementById('plan-selection').classList.remove('hidden');
    document.getElementById('payment-gateway').classList.add('hidden');
}

function switchPayMethod(method) {
    document.querySelectorAll('.pay-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.pay-view').forEach(v => v.classList.remove('active'));
    event.currentTarget.classList.add('active');
    document.getElementById('pay-' + method).classList.add('active');
}

function processPayment() {
    const btn = document.querySelector('#payment-gateway .btn-primary');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    setTimeout(() => {
        alert("Payment Successful!");
        userData.plan = userData.tempPlan;
        saveUserData();
        document.getElementById('plan-badge').innerText = userData.plan + " Plan";
        closeModal('payment-modal');
        btn.innerText = "Complete Payment";
    }, 2000);
}

// --- 9. UTILS ---
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

function triggerAlarm() {
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    let count = 0;
    const beep = () => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
        if(navigator.vibrate) navigator.vibrate(200);
        count++;
        if(count < 3) setTimeout(beep, 600);
        else setTimeout(() => stopTimer(), 1000);
    };
    beep();
}

function saveSettings() {
    userData.settings.rest = document.getElementById('setting-rest').value;
    saveUserData();
}

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