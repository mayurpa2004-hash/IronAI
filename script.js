
"use strict";

const DB_NAME = "ironai";
// DEV NOTES: Bump DB_VERSION only with a clear migration plan; never delete stores on upgrade.
const DB_VERSION = 1;
const STORES = {
  SETTINGS: "settings",
  PROFILE: "profile",
  EXERCISES: "exercises",
  PLANS: "plans",
  WORKOUTS: "workouts",
  TIMELINE: "timeline",
};

const APP_CACHE_VERSION = "ironai-v18";

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DEFAULT_REST = 90;
const DEFAULT_SET_COUNT = 3;
const MAX_AWAY_MS = 60 * 60 * 1000;

const defaultExerciseLibrary = Array.from(new Set([
  "Barbell Bench Press",
  "Incline Dumbbell Press",
  "Overhead Dumbbell Press",
  "Dumbbell Flat Press",
  "Incline Dumbbell Press",
  "Cable Fly",
  "Dumbbell Lateral Raise",
  "Cable Triceps Pushdown",
  "Overhead Triceps Extension (Cable)",
  "Pull-ups OR Lat Pulldown",
  "Neutral-Grip Lat Pulldown",
  "Barbell Row",
  "Seated Cable Row",
  "Chest-Supported DB Row",
  "Face Pull",
  "Rear Delt Fly",
  "Barbell Curl",
  "Incline DB Curl",
  "Hammer Curl",
  "Back Squat OR Leg Press",
  "Walking Lunges",
  "Leg Extension",
  "Standing Calf Raise",
  "Romanian Deadlift",
  "Single-Leg RDL (DB)",
  "Hip Thrust",
  "Bulgarian Squat",
  "Bench Press",
  "Incline DB Press",
  "Deadlift",
  "Lat Pulldown",
  "Overhead Press",
  "Lateral Raise",
  "Tricep Pushdown",
  "Squat",
  "Leg Press",
  "Calf Raise",
  "Plank",
  "Hanging Leg Raise",
  "Cable Crunch",
  "Dips",
  "Incline Press",
]));

let swRegistration = null;
let swUpdatePending = false;

const splitTemplates = {
  Default: {
    Mon: [
      "Barbell Bench Press",
      "Incline Dumbbell Press",
      "Dumbbell Flat Press",
      "Cable Fly",
      "Cable Triceps Pushdown",
    ],
    Tue: [
      "Lat Pulldown",
      "Barbell Row",
      "Seated Cable Row",
      "Face Pull",
      "Barbell Curl",
      "Hammer Curl",
    ],
    Wed: [
      "Bulgarian Squat",
      "Romanian Deadlift",
      "Walking Lunges",
      "Leg Extension",
      "Standing Calf Raise",
      "Dumbbell Lateral Raise",
    ],
    Thu: [
      "Barbell Bench Press",
      "Incline Dumbbell Press",
      "Dumbbell Flat Press",
      "Overhead Triceps Extension (Cable)",
      "Cable Triceps Pushdown",
    ],
    Fri: [
      "Neutral-Grip Lat Pulldown",
      "Chest-Supported DB Row",
      "Rear Delt Fly",
      "Incline DB Curl",
      "Hammer Curl",
    ],
    Sat: [
      "Back Squat",
      "Romanian Deadlift",
      "Walking Lunges",
      "Standing Calf Raise",
      "Overhead Dumbbell Press",
    ],
    Sun: [],
  },
  "Bro Split": {
    Mon: ["Bench Press", "Incline DB Press", "Cable Fly"],
    Tue: ["Deadlift", "Barbell Row", "Lat Pulldown"],
    Wed: ["Overhead Press", "Lateral Raise", "Rear Delt Fly"],
    Thu: ["Barbell Curl", "Tricep Pushdown", "Hammer Curl"],
    Fri: ["Squat", "Leg Press", "Calf Raise"],
    Sat: ["Plank", "Hanging Leg Raise", "Cable Crunch"],
    Sun: [],
  },
  "Push / Pull / Legs": {
    Mon: [
      { name: "Barbell Bench Press", defaultSets: 4 },
      { name: "Incline Dumbbell Press", defaultSets: 3 },
      { name: "Overhead Dumbbell Press", defaultSets: 3 },
      { name: "Dumbbell Lateral Raise", defaultSets: 2 },
      { name: "Cable Triceps Pushdown", defaultSets: 2 },
    ],
    Tue: [
      { name: "Chest-Supported Row ", defaultSets: 4 },
      { name: "Seated Cable Row", defaultSets: 3 },
      { name: "One-Arm Dumbbell Row", defaultSets: 3 },
      { name: "Face Pull", defaultSets: 3 },
      { name: "Barbell Curl", defaultSets: 2 },
    ],
    Wed: [
      { name: "Back Squat", defaultSets: 4 },
      { name: "Walking Lunges", defaultSets: 3 },
      { name: "Leg Extension", defaultSets: 3 },
      { name: "Standing Calf Raise", defaultSets: 4 },
    ],
    Thu: [
      { name: "Dumbbell Flat Press", defaultSets: 3 },
      { name: "Incline Dumbbell Press", defaultSets: 3 },
      { name: "Cable Fly", defaultSets: 2 },
      { name: "Dumbbell Lateral Raise", defaultSets: 3 },
      { name: "Overhead Triceps Extension (Cable)", defaultSets: 2 },
    ],
    Fri: [
      { name: "Lat Pulldown", defaultSets: 4 },
      { name: "Wide Grip Cable Row", defaultSets: 3 },
      { name: "Straight-Arm Pulldown (Cable)", defaultSets: 2 },
      { name: "Rear Delt Fly (Machine)", defaultSets: 3 },
      { name: "Incline Dumbbell Curl", defaultSets: 2 },
    ],
    Sat: [
      { name: "Romanian Deadlift", defaultSets: 4 },
      { name: "Single-Leg Romanian Deadlift (DB)", defaultSets: 3 },
      { name: "Hip Thrust", defaultSets: 3 },
      { name: "Bulgarian Squat (glute bias)", defaultSets: 2 },
    ],
    Sun: [],
  },
  "Upper / Lower": {
    Mon: ["Bench Press", "Barbell Row", "Overhead Press"],
    Tue: ["Squat", "Romanian Deadlift", "Calf Raise"],
    Wed: [],
    Thu: ["Incline Press", "Pull-up", "Lateral Raise"],
    Fri: ["Deadlift", "Leg Press", "Hamstring Curl"],
    Sat: [],
    Sun: [],
  },
  "Full Body": {
    Mon: ["Squat", "Bench Press", "Barbell Row"],
    Tue: [],
    Wed: ["Deadlift", "Overhead Press", "Pull-up"],
    Thu: [],
    Fri: ["Leg Press", "Incline Press", "Lat Pulldown"],
    Sat: [],
    Sun: [],
  },
};

const splitDayMeta = {
  Default: {
    Mon: { title: "Chest Triceps", muscle: "Chest • Triceps" },
    Tue: { title: "Back Biceps", muscle: "Back • Biceps" },
    Wed: { title: "Legs Shoulder", muscle: "Legs • Shoulder" },
    Thu: { title: "Chest Triceps", muscle: "Chest • Triceps" },
    Fri: { title: "Back Biceps", muscle: "Back • Biceps" },
    Sat: { title: "Legs Shoulder", muscle: "Legs • Shoulder" },
    Sun: { title: "Rest", muscle: "Rest" },
  },
  "Push / Pull / Legs": {
    Mon: { title: "Push A", muscle: "Chest • Shoulders • Triceps" },
    Tue: { title: "Pull A", muscle: "Back • Biceps • Rear Delts" },
    Wed: { title: "Legs A", muscle: "Quads • Calves" },
    Thu: { title: "Push B", muscle: "Chest • Side Delts • Triceps" },
    Fri: { title: "Pull B", muscle: "Back • Biceps • Rear Delts" },
    Sat: { title: "Legs B", muscle: "Hamstrings • Glutes" },
    Sun: { title: "Rest", muscle: "Rest" },
  },
};
const state = {
  split: "Push / Pull / Legs",
  day: weekDays[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1],
  restDuration: DEFAULT_REST,
  workoutStart: null,
  workoutTimerId: null,
  restTimerId: null,
  restRemaining: DEFAULT_REST,
  restDueAt: null,
  restTimeoutId: null,
  chart: null,
  recentExercises: [],
  resumePromptOpen: false,
  awaitingResume: false,
  pendingElapsedMs: 0,
  calorieInputs: {},
  lastDraftToastAt: 0,
  draftRecoveryShown: false,
  pendingWorkout: null,
  historyLimit: 30,
  historyPeriodMode: "week",
  historyAnchorDate: new Date(),
  editingWorkoutId: null,
  editingWorkout: null,
  historyEditGuard: false,
  lastCalorieHintAt: 0,
  lastInputValidationToastAt: 0,
};

const db = {
  instance: null,
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const dbInstance = event.target.result;
        if (!dbInstance.objectStoreNames.contains(STORES.SETTINGS)) {
          dbInstance.createObjectStore(STORES.SETTINGS, { keyPath: "key" });
        }
        if (!dbInstance.objectStoreNames.contains(STORES.PROFILE)) {
          dbInstance.createObjectStore(STORES.PROFILE, { keyPath: "key" });
        }
        if (!dbInstance.objectStoreNames.contains(STORES.EXERCISES)) {
          dbInstance.createObjectStore(STORES.EXERCISES, { keyPath: "name" });
        }
        if (!dbInstance.objectStoreNames.contains(STORES.PLANS)) {
          dbInstance.createObjectStore(STORES.PLANS, { keyPath: "key" });
        }
        if (!dbInstance.objectStoreNames.contains(STORES.WORKOUTS)) {
          dbInstance.createObjectStore(STORES.WORKOUTS, { keyPath: "id" });
        }
        if (!dbInstance.objectStoreNames.contains(STORES.TIMELINE)) {
          dbInstance.createObjectStore(STORES.TIMELINE, { keyPath: "id" });
        }
      };
      request.onsuccess = () => {
        db.instance = request.result;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  },
  async get(store, key) {
    return new Promise((resolve, reject) => {
      const tx = db.instance.transaction(store, "readonly");
      const request = tx.objectStore(store).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
  async set(store, value) {
    return new Promise((resolve, reject) => {
      const tx = db.instance.transaction(store, "readwrite");
      tx.objectStore(store).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  async getAll(store) {
    return new Promise((resolve, reject) => {
      const tx = db.instance.transaction(store, "readonly");
      const request = tx.objectStore(store).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },
  async delete(store, key) {
    return new Promise((resolve, reject) => {
      const tx = db.instance.transaction(store, "readwrite");
      tx.objectStore(store).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  async clear(store, options = {}) {
    if (store === STORES.WORKOUTS && options.userConfirmedReset !== true) {
      console.warn("[db] blocked workouts clear without user confirmation");
      return false;
    }
    return new Promise((resolve, reject) => {
      const tx = db.instance.transaction(store, "readwrite");
      tx.objectStore(store).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  },
};

const dom = {
  views: document.querySelectorAll(".view"),
  navLinks: document.querySelectorAll("[data-view]"),
  dayTabs: document.getElementById("dayTabs"),
  exerciseList: document.getElementById("exerciseList"),
  dayTitle: document.getElementById("dayTitle"),
  daySummary: document.getElementById("daySummary"),
  daySplitLabel: document.getElementById("daySplitLabel"),
  splitSelect: document.getElementById("splitSelect"),
  workoutDuration: document.getElementById("workoutDuration"),
  startWorkoutBtn: document.getElementById("startWorkoutBtn"),
  planTodayBtn: document.getElementById("planTodayBtn"),
  finishWorkoutBtn: document.getElementById("finishWorkoutBtn"),
  addExerciseBtn: document.getElementById("addExerciseBtn"),
  exerciseModal: document.getElementById("exerciseModal"),
  exerciseSearch: document.getElementById("exerciseSearch"),
  exerciseOptions: document.getElementById("exerciseOptions"),
  customExercise: document.getElementById("customExercise"),
  exerciseAddBtn: document.getElementById("exerciseAddBtn"),
  exerciseCancelBtn: document.getElementById("exerciseCancelBtn"),
  restTimer: document.getElementById("restTimer"),
  restTime: document.getElementById("restTime"),
  restMinus: document.getElementById("restMinus"),
  restPlus: document.getElementById("restPlus"),
  restStop: document.getElementById("restStop"),
  workoutIntensity: document.getElementById("workoutIntensity"),
  toast: document.getElementById("toast"),
  confetti: document.getElementById("confetti"),
  totalWorkouts: document.getElementById("totalWorkouts"),
  workoutStreak: document.getElementById("workoutStreak"),
  userLevel: document.getElementById("userLevel"),
  levelBadge: document.getElementById("levelBadge"),
  xpFill: document.getElementById("xpFill"),
  xpText: document.getElementById("xpText"),
  insightsList: document.getElementById("insightsList"),
  weeklyPatternBtn: document.getElementById("weeklyPatternBtn"),
  weeklyPatternResult: document.getElementById("weeklyPatternResult"),
  historyList: document.getElementById("historyList"),
  weeklyChart: document.getElementById("weeklyChart"),
  rmWeight: document.getElementById("rmWeight"),
  rmReps: document.getElementById("rmReps"),
  rmCalcBtn: document.getElementById("rmCalcBtn"),
  rmResult: document.getElementById("rmResult"),
  bmiWeight: document.getElementById("bmiWeight"),
  bmiHeight: document.getElementById("bmiHeight"),
  bmiAge: document.getElementById("bmiAge"),
  bmiSex: document.getElementById("bmiSex"),
  bmiActivity: document.getElementById("bmiActivity"),
  bmiGoal: document.getElementById("bmiGoal"),
  bmiCalcBtn: document.getElementById("bmiCalcBtn"),
  bmiResult: document.getElementById("bmiResult"),
  plateTarget: document.getElementById("plateTarget"),
  plateBar: document.getElementById("plateBar"),
  plateCalcBtn: document.getElementById("plateCalcBtn"),
  plateCopyBtn: document.getElementById("plateCopyBtn"),
  plateResult: document.getElementById("plateResult"),
  coachWeight: document.getElementById("coachWeight"),
  coachGoal: document.getElementById("coachGoal"),
  coachDiet: document.getElementById("coachDiet"),
  coachBtn: document.getElementById("coachBtn"),
  coachResult: document.getElementById("coachResult"),
  weeklyGoal: document.getElementById("weeklyGoal"),
  weeklyProgress: document.getElementById("weeklyProgress"),
  weeklyStreak: document.getElementById("weeklyStreak"),
  timelinePhoto: document.getElementById("timelinePhoto"),
  timelineNote: document.getElementById("timelineNote"),
  timelineAddBtn: document.getElementById("timelineAddBtn"),
  timelineGrid: document.getElementById("timelineGrid"),
  profileName: document.getElementById("profileName"),
  profileSaveBtn: document.getElementById("profileSaveBtn"),
  restDuration: document.getElementById("restDuration"),
  restSaveBtn: document.getElementById("restSaveBtn"),
  historyCalories: document.getElementById("historyCalories"),
  historyCaloriesLabel: document.getElementById("historyCaloriesLabel"),
  historyPeriodWeek: document.getElementById("historyPeriodWeek"),
  historyPeriodMonth: document.getElementById("historyPeriodMonth"),
  historyPeriodYear: document.getElementById("historyPeriodYear"),
  historyPrevBtn: document.getElementById("historyPrevBtn"),
  historyNextBtn: document.getElementById("historyNextBtn"),
  historyPeriodLabel: document.getElementById("historyPeriodLabel"),
  historyCompare: document.getElementById("historyCompare"),
  exportBtn: document.getElementById("exportBtn"),
  importFile: document.getElementById("importFile"),
  importBtn: document.getElementById("importBtn"),
  resetBtn: document.getElementById("resetBtn"),
  offlineStatus: document.getElementById("offlineStatus"),
  offlineText: document.getElementById("offlineText"),
  shareBtn: document.getElementById("shareBtn"),
  updateModal: document.getElementById("updateModal"),
  updateBtn: document.getElementById("updateBtn"),
  resumeModal: document.getElementById("resumeModal"),
  resumeContinueBtn: document.getElementById("resumeContinueBtn"),
  resumeDiscardBtn: document.getElementById("resumeDiscardBtn"),
  finishModal: document.getElementById("finishModal"),
  finishSummary: document.getElementById("finishSummary"),
  finishSaveBtn: document.getElementById("finishSaveBtn"),
  finishEditBtn: document.getElementById("finishEditBtn"),
  historyDetailModal: document.getElementById("historyDetailModal"),
  historyDetailContent: document.getElementById("historyDetailContent"),
  cacheVersion: document.getElementById("cacheVersion"),
  mobileDaySplit: document.getElementById("mobileDaySplit"),
  mobileWorkoutDuration: document.getElementById("mobileWorkoutDuration"),
  finishCelebrate: document.getElementById("finishCelebrate"),
  editModeLabel: document.getElementById("editModeLabel"),
};

const formatTime = (seconds) => {
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
};

const getTodayKey = () => new Date().toDateString();

// DEV NOTES: Local date resolver avoids UTC day shifts and handles older entries.
const getWorkoutLocalDate = (workout) => {
  const localKey = workout?.localDayKey;
  if (typeof localKey === "string" && localKey) {
    const parsed = new Date(localKey);
    if (!Number.isNaN(parsed.getTime())) {
      return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }
  }
  const source = workout?.localDateISO || workout?.date;
  if (typeof source === "string") {
    const parsed = new Date(source);
    if (!Number.isNaN(parsed.getTime())) {
      return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }
  }
  return null;
};

const getWeekStartDate = (date) => {
  const start = new Date(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
};

// DEV NOTES: Period helpers filter history and drive the compare card.
const getPeriodRange = (mode, anchorDate) => {
  const anchor = new Date(anchorDate);
  anchor.setHours(0, 0, 0, 0);
  let startDate = new Date(anchor);
  let endDateExclusive = new Date(anchor);
  let label = "";
  if (mode === "month") {
    startDate = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    endDateExclusive = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
    label = startDate.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } else if (mode === "year") {
    startDate = new Date(anchor.getFullYear(), 0, 1);
    endDateExclusive = new Date(anchor.getFullYear() + 1, 0, 1);
    label = startDate.getFullYear().toString();
  } else {
    startDate = getWeekStartDate(anchor);
    endDateExclusive = new Date(startDate);
    endDateExclusive.setDate(startDate.getDate() + 7);
    label = "This week";
  }
  return { startDate, endDateExclusive, label };
};

const shiftAnchor = (mode, anchorDate, direction) => {
  const anchor = new Date(anchorDate);
  if (mode === "month") {
    return new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);
  }
  if (mode === "year") {
    return new Date(anchor.getFullYear() + direction, 0, 1);
  }
  const next = new Date(anchor);
  next.setDate(anchor.getDate() + direction * 7);
  return next;
};

const computeMetrics = (workouts, settings = {}) => {
  let workoutCount = 0;
  let totalVolumeKg = 0;
  let totalCaloriesKcal = 0;
  let totalDurationMin = 0;
  workouts.forEach((workout) => {
    workoutCount += 1;
    totalVolumeKg += sanitizeVolumeKg(workout.totalVolumeKg ?? workout.totalVolume ?? 0);
    const calories = getWorkoutCalories(workout, settings);
    if (Number.isFinite(calories)) totalCaloriesKcal += calories;
    const durationMin = Number(workout.durationMinutes ?? 0) || Math.round((workout.durationSec || 0) / 60);
    totalDurationMin += Number.isFinite(durationMin) ? durationMin : 0;
  });
  return { workoutCount, totalVolumeKg, totalCaloriesKcal, totalDurationMin };
};

// DEV NOTES: Weekly stats use local dates for goal progress + streak and persist to settings.
const calculateWeeklyCount = (workouts) => {
  const start = getWeekStartDate(new Date());
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return workouts.filter((workout) => {
    const date = new Date(workout.date);
    return date >= start && date < end;
  }).length;
};

const calculateWorkoutStreak = (workouts) => {
  const dateKeys = new Set(
    workouts
      .map((workout) => getWorkoutDateKey(workout))
      .filter(Boolean)
  );
  let streak = 0;
  const current = new Date();
  current.setHours(0, 0, 0, 0);
  while (dateKeys.has(current.toDateString())) {
    streak += 1;
    current.setDate(current.getDate() - 1);
  }
  return streak;
};

const updateWeeklyStats = async (workouts) => {
  const settings = await db.get(STORES.SETTINGS, "settings");
  const weeklyGoal = Number(settings?.weeklyGoal) || 4;
  const weeklyCount = calculateWeeklyCount(workouts);
  const streak = calculateWorkoutStreak(workouts);
  if (dom.weeklyGoal && document.activeElement !== dom.weeklyGoal) {
    dom.weeklyGoal.value = weeklyGoal;
  }
  if (dom.weeklyProgress) {
    dom.weeklyProgress.textContent = `This week: ${weeklyCount}/${weeklyGoal}`;
  }
  if (dom.weeklyStreak) {
    dom.weeklyStreak.textContent = `Streak: ${streak} day${streak === 1 ? "" : "s"}`;
  }
  if (settings && settings.workoutStreak !== streak) {
    await db.set(STORES.SETTINGS, { ...settings, key: "settings", workoutStreak: streak });
  }
};

// DEV NOTES: Date keys always normalize to local date strings to avoid ISO comparisons.
const getWorkoutDateKey = (workout) => {
  if (typeof workout?.localDayKey === "string" && workout.localDayKey) {
    return workout.localDayKey;
  }
  if (typeof workout?.dateKey === "string" && workout.dateKey) {
    const parsed = new Date(workout.dateKey);
    if (!Number.isNaN(parsed.getTime())) return parsed.toDateString();
  }
  if (typeof workout?.date === "string") {
    const parsed = new Date(workout.date);
    if (!Number.isNaN(parsed.getTime())) return parsed.toDateString();
  }
  return null;
};

const ensureWorkoutLocalDayKey = async (workout) => {
  if (!workout || workout.localDayKey) return false;
  const parsed = new Date(workout.date);
  if (Number.isNaN(parsed.getTime())) return false;
  const localDayKey = parsed.toDateString();
  await db.set(STORES.WORKOUTS, { ...workout, localDayKey });
  return true;
};

const normalizeWorkoutsWithLocalKeys = async (workouts) => {
  const updates = await Promise.all(
    workouts.map(async (workout) => {
      if (workout?.localDayKey) return workout;
      const parsed = new Date(workout?.date);
      if (Number.isNaN(parsed.getTime())) return workout;
      const localDayKey = parsed.toDateString();
      const updated = { ...workout, localDayKey };
      await db.set(STORES.WORKOUTS, updated);
      return updated;
    })
  );
  return updates;
};

// DEV NOTES: Workout migration fills required fields without altering existing values.
const migrateWorkouts = async () => {
  try {
    const workouts = await db.getAll(STORES.WORKOUTS);
    for (const workout of workouts) {
      if (!workout) continue;
      let updated = { ...workout };
      let hasChanges = false;
      if (!updated.localDayKey) {
        const parsed = new Date(updated.date);
        if (!Number.isNaN(parsed.getTime())) {
          updated.localDayKey = parsed.toDateString();
          hasChanges = true;
        }
      }
      if (!Number.isFinite(updated.durationSec)) {
        const durationMinutes = Number(updated.durationMinutes ?? updated.duration);
        updated.durationSec = Number.isFinite(durationMinutes)
          ? Math.max(0, Math.round(durationMinutes * 60))
          : 0;
        hasChanges = true;
      }
      if (!Number.isFinite(updated.totalVolumeKg)) {
        const volume = Number(updated.totalVolume);
        updated.totalVolumeKg = Number.isFinite(volume) ? volume : 0;
        hasChanges = true;
      }
      if (!Number.isFinite(updated.caloriesBurned)) {
        updated.caloriesBurned = null;
        hasChanges = true;
      }
      if (!Number.isFinite(updated.met)) {
        updated.met = null;
        hasChanges = true;
      }
      if (!Number.isFinite(updated.weightKgUsed)) {
        updated.weightKgUsed = Number.isFinite(Number(updated.weightKg))
          ? Number(updated.weightKg)
          : null;
        hasChanges = true;
      }
      if (hasChanges) {
        await db.set(STORES.WORKOUTS, updated);
      }
    }
  } catch (error) {
    handleStorageError(error);
  }
};

// DEV NOTES: Period calories use getWorkoutCalories and return null when no estimates exist.
const calculatePeriodCalories = (workouts, range, settings = {}) => {
  if (!Array.isArray(workouts)) return { count: 0, calories: null, hasValidCalories: false };
  const filtered = workouts.filter((workout) => {
    const localDate = getWorkoutLocalDate(workout);
    if (!localDate) return false;
    return localDate >= range.startDate && localDate < range.endDateExclusive;
  });
  let hasValidCalories = false;
  const calories = filtered.reduce((sum, workout) => {
    const stored = getWorkoutCalories(workout, settings);
    if (Number.isFinite(stored)) {
      hasValidCalories = true;
      return sum + stored;
    }
    return sum;
  }, 0);
  return {
    count: filtered.length,
    calories: hasValidCalories && Number.isFinite(calories) ? calories : null,
    hasValidCalories,
  };
};

// DEV NOTES: History burn reflects selected period; week keeps today-only display.
const updateHistoryCalories = async (workouts) => {
  if (!dom.historyCalories) return;
  try {
    const settings = await db.get(STORES.SETTINGS, "settings");
    const mode = state.historyPeriodMode || "week";
    const range = getPeriodRange(mode, state.historyAnchorDate || new Date());
    const settingsWeight = settings?.calorieInputs?.weightKg;
    const { count, calories, hasValidCalories } = calculatePeriodCalories(workouts, range, {
      weightKg: settingsWeight,
    });
    if (dom.historyCaloriesLabel) dom.historyCaloriesLabel.textContent = "Today burn";
    if (!count) {
      dom.historyCalories.textContent = "0 kcal";
      dom.historyCalories.title = "";
      return;
    }
    if (!hasValidCalories || !Number.isFinite(calories)) {
      dom.historyCalories.textContent = "--";
      dom.historyCalories.title = "Set body weight to estimate";
      showMissingWeightToastOnce();
      return;
    }
    dom.historyCalories.textContent = `${calories} kcal`;
    dom.historyCalories.title = "";
  } catch (error) {
    handleStorageError(error);
    dom.historyCalories.textContent = "0 kcal";
  }
};

const escapeSelector = (value) => {
  if (window.CSS && CSS.escape) return CSS.escape(value);
  return value.replace(/["\\]/g, "\\$&");
};

const debounce = (fn, wait = 400) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), wait);
  };
};

// DEV NOTES: Shared draft debounce to avoid per-input timers.
const scheduleDraftSave = debounce(() => {
  void updateWorkoutDraft();
}, 400);

const buildSetRowMarkup = (setNum, weightValue = "", repsValue = "") => `
  <div class="set-row">
    <span>Set ${setNum}</span>
    <input
      class="field set-weight"
      type="number"
      inputmode="numeric"
      min="${SET_INPUT_LIMITS.weightMin}"
      max="${SET_INPUT_LIMITS.weightMax}"
      placeholder="kg"
      value="${weightValue}"
    />
    <input
      class="field set-reps"
      type="number"
      inputmode="numeric"
      min="${SET_INPUT_LIMITS.repsMin}"
      max="${SET_INPUT_LIMITS.repsMax}"
      placeholder="reps"
      value="${repsValue}"
    />
    <button class="set-toggle" data-set="${setNum}">Done</button>
  </div>
`;

const bindSetToggle = (toggle, card) => {
  if (!toggle || toggle.dataset.bound === "true") return;
  toggle.dataset.bound = "true";
  toggle.addEventListener("click", async () => {
    const row = toggle.closest(".set-row");
    if (!row) return;
    const wasDone = toggle.classList.contains("done");
    toggle.classList.toggle("done");
    if (!wasDone && toggle.classList.contains("done")) {
      await handleSetCompletion(card, row);
    }
    scheduleDraftSave();
  });
};

const setEditModeLabel = (enabled) => {
  if (!dom.editModeLabel) return;
  dom.editModeLabel.classList.toggle("active", Boolean(enabled));
};

const parseInputNumber = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const SET_INPUT_LIMITS = {
  weightMin: 0,
  weightMax: 500,
  repsMin: 0,
  repsMax: 200,
};

const CALORIE_LIMITS = {
  min: 1,
  max: 2000,
};

const CALORIE_INPUT_LIMITS = {
  weightMin: 20,
  weightMax: 300,
  durationMin: 1,
  durationMax: 600,
  volumeMax: 500000,
};

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));

const sanitizeVolumeKg = (value) => {
  const volume = parseInputNumber(value);
  if (!Number.isFinite(volume) || volume < 0) return 0;
  return clampNumber(volume, 0, CALORIE_INPUT_LIMITS.volumeMax);
};

const getValidatedSetValue = (value, min, max) => {
  const num = parseInputNumber(value);
  if (!Number.isFinite(num) || num < min || num > max) return null;
  return num;
};

const showValidationToastOnce = (message) => {
  const now = Date.now();
  if (now - state.lastInputValidationToastAt < 2000) return;
  state.lastInputValidationToastAt = now;
  showToast(message);
};

const showMissingWeightToastOnce = () => {
  const now = Date.now();
  if (now - state.lastCalorieHintAt < 2400) return;
  state.lastCalorieHintAt = now;
  showToast("Set your body weight in Tools to estimate calories.");
};

const validateSetInput = (input, min, max, label) => {
  if (!input) return true;
  const raw = input.value;
  if (raw === "") {
    input.classList.remove("invalid");
    delete input.dataset.invalid;
    return true;
  }
  const value = Number(raw);
  const isValid = Number.isFinite(value) && value >= min && value <= max;
  input.classList.toggle("invalid", !isValid);
  if (!isValid && input.dataset.invalid !== "true") {
    input.dataset.invalid = "true";
    showValidationToastOnce(`${label} must be between ${min} and ${max}.`);
  }
  if (isValid) {
    delete input.dataset.invalid;
  }
  return isValid;
};

const calculateDailyCalories = ({
  sex = "male",
  age,
  heightCm,
  weightKg,
  activityFactor = 1.55,
  goal = "Maintain",
}) => {
  const weight = parseInputNumber(weightKg);
  const height = parseInputNumber(heightCm);
  const ageValue = parseInputNumber(age);
  if (
    !Number.isFinite(weight) ||
    !Number.isFinite(height) ||
    !Number.isFinite(ageValue) ||
    weight <= 0 ||
    height <= 0 ||
    ageValue <= 0
  ) {
    return {
      bmi: null,
      bmr: null,
      maintenanceCalories: null,
      goalCalories: null,
    };
  }
  const sexFactor = sex === "female" ? -161 : 5;
  const bmr = 10 * weight + 6.25 * height - 5 * ageValue + sexFactor;
  const bmi = weight / Math.pow(height / 100, 2);
  const maintenanceCalories = Math.round(bmr * (Number(activityFactor) || 1.55));
  const normalizedGoal =
    goal === "Cut" || goal === "Bulk" || goal === "Maintain" ? goal : "Maintain";
  const adjust = normalizedGoal === "Cut" ? -300 : normalizedGoal === "Bulk" ? 300 : 0;
  const goalCalories = maintenanceCalories + adjust;
  return { bmi, bmr, maintenanceCalories, goalCalories, goal: normalizedGoal };
};

// DEV NOTES: MET formula is the single calorie source of truth; volume fallback removed for accuracy.
const calculateEstimatedCalories = ({ weightKg, durationMinutes, met }) => {
  const weight = parseInputNumber(weightKg);
  const duration = parseInputNumber(durationMinutes);
  const metValue = parseInputNumber(met);
  if (
    !Number.isFinite(weight) ||
    !Number.isFinite(duration) ||
    !Number.isFinite(metValue) ||
    weight < CALORIE_INPUT_LIMITS.weightMin ||
    weight > CALORIE_INPUT_LIMITS.weightMax ||
    duration < CALORIE_INPUT_LIMITS.durationMin ||
    duration > CALORIE_INPUT_LIMITS.durationMax ||
    metValue <= 0
  ) {
    return null;
  }
  const estimate = (metValue * 3.5 * weight * duration) / 200;
  if (!Number.isFinite(estimate) || estimate <= 0) return null;
  return clampNumber(Math.round(estimate), CALORIE_LIMITS.min, CALORIE_LIMITS.max);
};

const getLatestKnownWeightKg = async () => {
  try {
    const settings = await db.get(STORES.SETTINGS, "settings");
    const fromSettings = parseInputNumber(settings?.calorieInputs?.weightKg);
    if (Number.isFinite(fromSettings) && fromSettings > 0) return fromSettings;
    const workouts = await db.getAll(STORES.WORKOUTS);
    for (let i = workouts.length - 1; i >= 0; i -= 1) {
      const candidate = parseInputNumber(workouts[i]?.weightKg);
      if (Number.isFinite(candidate) && candidate > 0) return candidate;
    }
    return null;
  } catch (error) {
    handleStorageError(error);
    return null;
  }
};

const persistCalorieInputs = async (updates) => {
  try {
    const settings = (await db.get(STORES.SETTINGS, "settings")) || { key: "settings" };
    const current = settings?.calorieInputs || {};
    const next = { ...current, ...updates };
    await db.set(STORES.SETTINGS, { ...settings, key: "settings", calorieInputs: next });
    state.calorieInputs = next;
    return next;
  } catch (error) {
    handleStorageError(error);
    return state.calorieInputs;
  }
};

const showToast = (message) => {
  dom.toast.textContent = message;
  dom.toast.classList.add("show");
  setTimeout(() => dom.toast.classList.remove("show"), 2400);
};

const handleStorageError = (error) => {
  console.warn("[db] operation failed", error);
  showToast("Storage issue detected. Please reload app.");
};

const showFinishCelebration = () => {
  if (!dom.finishCelebrate) return;
  dom.finishCelebrate.classList.remove("show");
  dom.finishCelebrate.offsetHeight;
  dom.finishCelebrate.classList.add("show");
};

const blastConfetti = () => {
  dom.confetti.style.animation = "none";
  dom.confetti.offsetHeight;
  dom.confetti.style.animation = "";
};

const playAlarm = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const gain = ctx.createGain();
    gain.gain.value = 0.25;
    gain.connect(ctx.destination);
    let at = ctx.currentTime;
    for (let i = 0; i < 3; i += 1) {
      const osc = ctx.createOscillator();
      osc.frequency.value = 880;
      osc.connect(gain);
      osc.start(at);
      osc.stop(at + 0.18);
      at += 0.28;
    }
    setTimeout(() => ctx.close(), 1200);
  } catch (error) {
    // Audio context can be blocked, fallback to vibration only.
  }
  if (navigator.vibrate) {
    navigator.vibrate([200, 120, 200, 120, 200]);
  }
};

const updateOfflineStatus = () => {
  const online = navigator.onLine;
  dom.offlineStatus.classList.toggle("offline", !online);
  dom.offlineText.textContent = online ? "Offline-ready" : "Offline mode";
};

const setView = async (viewId) => {
  if (state.historyEditGuard && viewId === "lift") {
    showToast("Edit available only in History.");
    return;
  }
  dom.views.forEach((view) => view.classList.toggle("active", view.id === viewId));
  dom.navLinks.forEach((link) => link.classList.toggle("active", link.dataset.view === viewId));
  if (viewId === "history") {
    await renderHistory();
  }
  if (viewId === "timeline") {
    await renderTimeline();
  }
  const settings = await db.get(STORES.SETTINGS, "settings");
  await db.set(STORES.SETTINGS, { ...settings, key: "settings", lastView: viewId });
};

const createDayTabs = () => {
  dom.dayTabs.innerHTML = "";
  weekDays.forEach((day) => {
    const btn = document.createElement("button");
    btn.className = `day-tab${day === state.day ? " active" : ""}`;
    btn.textContent = day;
    btn.addEventListener("click", () => {
      state.day = day;
      renderWorkoutDay();
    });
    dom.dayTabs.appendChild(btn);
  });
};

const getPlanKey = () => `${state.split}:${state.day}`;

const normalizePlanExercises = (exercises = []) =>
  exercises
    .map((exercise) => {
      if (typeof exercise === "string") {
        return { name: exercise, defaultSets: DEFAULT_SET_COUNT };
      }
      if (!exercise || typeof exercise !== "object") return null;
      const name = exercise.name || "";
      if (!name) return null;
      const rawSets = Number(exercise.defaultSets);
      const defaultSets =
        Number.isFinite(rawSets) && rawSets > 0 ? rawSets : DEFAULT_SET_COUNT;
      return { name, defaultSets };
    })
    .filter(Boolean);

const getPlanExercises = async () => {
  const custom = await db.get(STORES.PLANS, getPlanKey());
  const source = custom?.exercises || splitTemplates[state.split]?.[state.day] || [];
  return normalizePlanExercises(source);
};

const savePlanExercises = async (exercises) => {
  const existing = await db.get(STORES.PLANS, getPlanKey());
  await db.set(STORES.PLANS, {
    key: getPlanKey(),
    exercises,
    splitName: existing?.splitName,
  });
};

const getTodaySplitMeta = async () => {
  const plan = await db.get(STORES.PLANS, getPlanKey());
  const planLabelRaw = plan?.splitName || plan?.label;
  const planLabel = planLabelRaw === "Default" ? null : planLabelRaw;
  const meta = splitDayMeta[state.split]?.[state.day];
  const title = planLabel || meta?.title || state.split;
  const muscle = meta?.muscle || "";
  return { title, muscle };
};

const updateTodayUI = async () => {
  const splitMeta = await getTodaySplitMeta();
  const title = `${state.day} - ${splitMeta.title}`;
  dom.dayTitle.textContent = title;
  if (dom.daySplitLabel) {
    dom.daySplitLabel.textContent = splitMeta.muscle || splitMeta.title;
  }
  if (dom.mobileDaySplit) {
    dom.mobileDaySplit.textContent = title;
  }
  setEditModeLabel(Boolean(state.editingWorkoutId));
  return splitMeta.title;
};

const getCurrentElapsedMs = () => {
  if (state.workoutStart) {
    return Math.max(0, Date.now() - state.workoutStart);
  }
  if (state.awaitingResume && Number.isFinite(state.pendingElapsedMs)) {
    return Math.max(0, state.pendingElapsedMs);
  }
  return 0;
};

const updateWorkoutTimer = () => {
  if (!state.workoutStart && !state.awaitingResume) {
    dom.workoutDuration.textContent = "00:00";
    if (dom.mobileWorkoutDuration) {
      dom.mobileWorkoutDuration.textContent = "00:00";
    }
    return;
  }
  const elapsedMs = state.awaitingResume
    ? state.pendingElapsedMs
    : Date.now() - state.workoutStart;
  const seconds = Math.floor(elapsedMs / 1000);
  dom.workoutDuration.textContent = formatTime(seconds);
  if (dom.mobileWorkoutDuration) {
    dom.mobileWorkoutDuration.textContent = formatTime(seconds);
  }
};

const startWorkoutTimer = () => {
  if (state.workoutTimerId) return;
  if (!state.workoutStart) return;
  updateWorkoutTimer();
  state.workoutTimerId = setInterval(updateWorkoutTimer, 1000);
};

// DEV NOTES: Timer cleanup is idempotent to avoid double-start or stale intervals.
const stopWorkoutTimer = () => {
  if (state.workoutTimerId) {
    clearInterval(state.workoutTimerId);
  }
  state.workoutTimerId = null;
  state.workoutStart = null;
  dom.workoutDuration.textContent = "00:00";
  if (dom.mobileWorkoutDuration) {
    dom.mobileWorkoutDuration.textContent = "00:00";
  }
};

// DEV NOTES: Background pause persists draft + timing meta without auto-resuming on return.
const pauseWorkoutForBackground = async () => {
  try {
    const settings = await db.get(STORES.SETTINGS, "settings");
    const existingDraft = settings?.currentWorkoutDraft;
    const hasDraft = Boolean(existingDraft || state.workoutStart || state.awaitingResume);
    if (!hasDraft) return;
    const elapsedMs = getCurrentElapsedMs();
    const timerWasRunning = Boolean(state.workoutTimerId);
    if (state.workoutTimerId) {
      clearInterval(state.workoutTimerId);
    }
    state.workoutTimerId = null;
    state.workoutStart = null;
    state.awaitingResume = true;
    state.pendingElapsedMs = elapsedMs;
    updateWorkoutTimer();
    const exercises = buildWorkoutExercisesFromDom();
    const workout = {
      ...(existingDraft || {}),
      id: existingDraft?.id || null,
      dateKey: getTodayKey(),
      dayKey: getTodayKey(),
      date: new Date().toISOString(),
      split: state.split,
      day: state.day,
      exercises,
      pausedElapsedMs: elapsedMs,
      closedAtMs: Date.now(),
      resumePromptPending: true,
      maxAwayMs: MAX_AWAY_MS,
      timerWasRunning,
    };
    await db.set(STORES.SETTINGS, { ...settings, key: "settings", currentWorkoutDraft: workout });
  } catch (error) {
    handleStorageError(error);
  }
};

const startWorkoutSession = async (source) => {
  if (state.workoutStart) return false;
  state.awaitingResume = false;
  state.pendingElapsedMs = 0;
  state.workoutStart = Date.now();
  console.debug("[workout] start", { source, startTime: state.workoutStart });
  startWorkoutTimer();
  showToast("Workout started.");
  try {
    const settings = await db.get(STORES.SETTINGS, "settings");
    await db.set(STORES.SETTINGS, {
      ...settings,
      key: "settings",
      currentWorkout: { startTime: state.workoutStart, split: state.split, day: state.day },
    });
    await updateWorkoutDraft();
  } catch (error) {
    console.error("[workout] failed to persist start", error);
  }
  return true;
};

const finalizeWorkoutSession = async (reason) => {
  if (!state.workoutStart) return;
  stopWorkoutTimer();
  stopRestTimer();
  state.awaitingResume = false;
  state.pendingElapsedMs = 0;
  await clearCurrentWorkout();
  console.debug("[workout] stop", { reason });
};

const clearCurrentWorkout = async () => {
  const settings = await db.get(STORES.SETTINGS, "settings");
  await db.set(STORES.SETTINGS, { ...settings, key: "settings", currentWorkout: null });
};

const clearCurrentWorkoutDraft = async () => {
  const settings = await db.get(STORES.SETTINGS, "settings");
  await db.set(STORES.SETTINGS, { ...settings, key: "settings", currentWorkoutDraft: null });
};

const clearEditWorkoutDraft = async () => {
  const settings = await db.get(STORES.SETTINGS, "settings");
  await db.set(STORES.SETTINGS, { ...settings, key: "settings", editWorkoutDraft: null });
};

// DEV NOTES: Resume uses draft pause metadata and caps away time to MAX_AWAY_MS.
const resumeWorkout = async () => {
  try {
    const settings = await db.get(STORES.SETTINGS, "settings");
    const draft = settings?.currentWorkoutDraft;
    const todayKey = getTodayKey();
    const draftDayKey = draft?.dayKey || draft?.dateKey;
    if (!draft || draftDayKey !== todayKey) {
      state.resumePromptOpen = false;
      dom.resumeModal?.classList.remove("open");
      state.awaitingResume = false;
      state.pendingElapsedMs = 0;
      updateWorkoutTimer();
      return;
    }
    const pausedElapsedMs = Number(draft.pausedElapsedMs) || 0;
    const awayMsRaw = Number.isFinite(draft.closedAtMs)
      ? Math.max(0, Date.now() - draft.closedAtMs)
      : 0;
    const maxAwayMs = Number.isFinite(draft.maxAwayMs) ? draft.maxAwayMs : MAX_AWAY_MS;
    const timerWasRunning = draft.timerWasRunning === true;
    const creditedAwayMs = timerWasRunning ? Math.min(awayMsRaw, maxAwayMs) : 0;
    const newElapsedMs = Math.max(0, pausedElapsedMs + creditedAwayMs);
    state.resumePromptOpen = false;
    dom.resumeModal?.classList.remove("open");
    state.awaitingResume = false;
    state.pendingElapsedMs = 0;
    state.workoutStart = Date.now() - newElapsedMs;
    updateWorkoutTimer();
    startWorkoutTimer();
    const nextDraft = {
      ...draft,
      dateKey: draft.dateKey || todayKey,
      dayKey: draftDayKey || todayKey,
      pausedElapsedMs: newElapsedMs,
      closedAtMs: null,
      resumePromptPending: false,
      maxAwayMs,
      timerWasRunning: true,
    };
    const currentWorkout = settings?.currentWorkout || {
      startTime: state.workoutStart,
      split: state.split,
      day: state.day,
    };
    await db.set(STORES.SETTINGS, {
      ...settings,
      key: "settings",
      currentWorkout: { ...currentWorkout, startTime: state.workoutStart },
      currentWorkoutDraft: nextDraft,
    });
    console.log("[workout] resume");
  } catch (error) {
    handleStorageError(error);
  }
};

const resetWorkout = async () => {
  state.resumePromptOpen = false;
  dom.resumeModal?.classList.remove("open");
  state.awaitingResume = false;
  state.pendingElapsedMs = 0;
  stopWorkoutTimer();
  stopRestTimer();
  state.restRemaining = DEFAULT_REST;
  dom.restTime.textContent = state.restRemaining;
  await clearCurrentWorkout();
  await clearCurrentWorkoutDraft();
  renderWorkoutDay();
  showToast("Workout discarded.");
  console.log("[workout] reset");
};

const openResumePrompt = async () => {
  if (dom.resumeModal && dom.resumeContinueBtn && dom.resumeDiscardBtn) {
    const title = dom.resumeModal.querySelector("h3");
    const text = dom.resumeModal.querySelector("p");
    if (title) title.textContent = "Resume workout?";
    if (text) {
      text.textContent = "You left the app. Resume timer from where you stopped?";
    }
    state.resumePromptOpen = true;
    dom.resumeModal.classList.add("open");
    return;
  }
  const resume = confirm("Resume workout? You left the app. Resume timer from where you stopped?");
  if (resume) {
    await resumeWorkout();
  } else {
    await resetWorkout();
  }
};

// DEV NOTES: Resume prompt only opens when draft resumePromptPending is true.
const handleDraftOnReturn = async () => {
  try {
    const settings = await db.get(STORES.SETTINGS, "settings");
    const draft = settings?.currentWorkoutDraft;
    if (!draft) {
      state.workoutStart = null;
      state.awaitingResume = false;
      state.pendingElapsedMs = 0;
      updateWorkoutTimer();
      dom.resumeModal?.classList.remove("open");
      state.resumePromptOpen = false;
      return;
    }
    const todayKey = getTodayKey();
    const draftDayKey = draft.dayKey || draft.dateKey;
    if (draftDayKey !== todayKey) {
      await clearCurrentWorkoutDraft();
      state.workoutStart = null;
      state.awaitingResume = false;
      state.pendingElapsedMs = 0;
      updateWorkoutTimer();
      dom.resumeModal?.classList.remove("open");
      state.resumePromptOpen = false;
      return;
    }
    if (draft.resumePromptPending) {
      state.workoutStart = null;
      state.awaitingResume = true;
      state.pendingElapsedMs = Number(draft.pausedElapsedMs) || 0;
      updateWorkoutTimer();
      if (!state.resumePromptOpen) {
        await openResumePrompt();
      }
    }
  } catch (error) {
    handleStorageError(error);
  }
};

const updateCurrentWorkoutStart = async () => {
  const settings = await db.get(STORES.SETTINGS, "settings");
  const workout = settings?.currentWorkout;
  if (!workout || !state.workoutStart) return;
  await db.set(STORES.SETTINGS, {
    ...settings,
    key: "settings",
    currentWorkout: { ...workout, startTime: state.workoutStart },
  });
};

const startRestTimer = (seconds) => {
  state.restRemaining = seconds;
  state.restDueAt = Date.now() + seconds * 1000;
  dom.restTime.textContent = state.restRemaining;
  dom.restTimer.classList.add("active");
  clearInterval(state.restTimerId);
  clearTimeout(state.restTimeoutId);
  state.restTimeoutId = null;
  state.restTimerId = setInterval(() => {
    state.restRemaining -= 1;
    dom.restTime.textContent = state.restRemaining;
    if (state.restRemaining <= 0) {
      clearInterval(state.restTimerId);
      dom.restTimer.classList.remove("active");
      state.restDueAt = null;
      playAlarm();
    }
  }, 1000);
};

const stopRestTimer = () => {
  clearInterval(state.restTimerId);
  clearTimeout(state.restTimeoutId);
  state.restTimeoutId = null;
  state.restDueAt = null;
  dom.restTimer.classList.remove("active");
};

const renderExerciseCard = async (exercise, index, options = {}) => {
  const name = exercise.name;
  const prefillFromLast = options.prefillFromLast !== false;
  const setCount =
    Number.isFinite(Number(exercise.defaultSets)) && Number(exercise.defaultSets) > 0
      ? Number(exercise.defaultSets)
      : DEFAULT_SET_COUNT;
  const exerciseData = (await db.get(STORES.EXERCISES, name)) || {
    name,
    notes: "",
    lastWeight: "",
    lastReps: "",
    prs: [],
  };
  const card = document.createElement("div");
  card.className = "exercise-card";
  card.dataset.exercise = name;
  const lastWeight = Number(exerciseData.lastWeight) || 0;
  const lastReps = Number(exerciseData.lastReps) || 0;
  const lastText = lastWeight && lastReps ? `${lastWeight}kg x ${lastReps}` : "No last data";
  const latestPr = (exerciseData.prs || [])[0];
  const prText = latestPr ? `Best: ${latestPr.weight}kg x ${latestPr.reps}` : "Best: -";
  const prefillWeight = prefillFromLast ? exerciseData.lastWeight ?? "" : "";
  const prefillReps = prefillFromLast ? exerciseData.lastReps ?? "" : "";
  card.dataset.lastWeight = String(lastWeight);
  card.dataset.lastReps = String(lastReps);

  card.innerHTML = `
    <div class="exercise-title">
      <strong>${name}</strong>
      <div class="exercise-actions">
        <button class="chip icon-btn rename-exercise" data-index="${index}" aria-label="Rename exercise" title="Rename exercise" type="button">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M3 17.25V21h3.75L19.81 7.94l-3.75-3.75L3 17.25zm2.92 2.33H5v-.92l9.06-9.06.92.92L5.92 19.58zM20.71 5.63a1 1 0 0 0 0-1.41l-1.93-1.93a1 1 0 0 0-1.41 0l-1.1 1.1 3.75 3.75 1.69-1.51z"/>
          </svg>
        </button>
        <button class="chip icon-btn remove-exercise" data-index="${index}" aria-label="Remove exercise" title="Remove exercise" type="button">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v8h-2V9zm4 0h2v8h-2V9zM7 9h2v8H7V9z"/>
          </svg>
        </button>
      </div>
    </div>
    <input class="field exercise-notes" type="text" placeholder="Notes" value="${exerciseData.notes || ""}" />
    <div class="meta-row">
      <div class="meta-left">
        <div class="muted last-stats">Last: ${lastText}</div>
        <div class="muted last-stats pr-history">${prText}</div>
      </div>
      <!-- DEV NOTES: Set controls moved inline; handlers remain bound to set-add/set-remove. -->
      <div class="set-controls-inline">
        <button class="chip set-btn set-add" type="button" data-action="add-set" aria-label="Add set">+</button>
        <button class="chip set-btn set-remove" type="button" data-action="remove-set" aria-label="Remove set">−</button>
      </div>
    </div>
    <div class="set-grid">
      ${Array.from({ length: setCount }, (_, idx) => idx + 1)
        .map((setNum) => buildSetRowMarkup(setNum, prefillWeight, prefillReps))
        .join("")}
    </div>
  `;

  card.querySelector(".exercise-notes").addEventListener("change", async (event) => {
    await db.set(STORES.EXERCISES, { ...exerciseData, notes: event.target.value, name });
  });

  card.querySelectorAll(".set-toggle").forEach((toggle) => {
    bindSetToggle(toggle, card);
  });

  card.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const row = event.target.closest(".set-row");
    if (!row) return;
    event.preventDefault();
    const toggle = row.querySelector(".set-toggle");
    if (toggle && !toggle.classList.contains("done")) {
      toggle.click();
    }
  });

  card.querySelector(".remove-exercise").addEventListener("click", async () => {
    const exercises = await getPlanExercises();
    exercises.splice(index, 1);
    await savePlanExercises(exercises);
    await renderWorkoutDay();
    void updateWorkoutDraft();
  });

  card.querySelector(".rename-exercise").addEventListener("click", async () => {
    const nextName = prompt("Rename exercise", name)?.trim();
    if (!nextName || nextName === name) return;
    const exercises = await getPlanExercises();
    if (!exercises[index]) return;
    exercises[index] = { ...exercises[index], name: nextName };
    await savePlanExercises(exercises);
    const existing = await db.get(STORES.EXERCISES, name);
    const existingNew = await db.get(STORES.EXERCISES, nextName);
    if (existing && !existingNew) {
      await db.set(STORES.EXERCISES, { ...existing, name: nextName });
      await db.delete(STORES.EXERCISES, name);
    }
    await renderWorkoutDay();
    void updateWorkoutDraft();
  });

  const setGrid = card.querySelector(".set-grid");
  const addButton = card.querySelector(".set-add");
  const removeButton = card.querySelector(".set-remove");
  const updateRemoveState = () => {
    const rowCount = setGrid.querySelectorAll(".set-row").length;
    if (removeButton) removeButton.disabled = rowCount <= 1;
  };
  updateRemoveState();

  // DEV NOTES: Set add/remove mutates set rows and triggers debounced draft save.
  addButton?.addEventListener("click", () => {
    const rowCount = setGrid.querySelectorAll(".set-row").length;
    const newRow = buildSetRowMarkup(rowCount + 1);
    setGrid.insertAdjacentHTML("beforeend", newRow);
    const added = setGrid.lastElementChild;
    bindSetToggle(added?.querySelector(".set-toggle"), card);
    updateRemoveState();
    scheduleDraftSave();
  });

  removeButton?.addEventListener("click", () => {
    const rows = setGrid.querySelectorAll(".set-row");
    if (rows.length <= 1) return;
    const lastRow = rows[rows.length - 1];
    const weightValue = lastRow.querySelector(".set-weight")?.value;
    const repsValue = lastRow.querySelector(".set-reps")?.value;
    const done = lastRow.querySelector(".set-toggle")?.classList.contains("done");
    const hasData = Boolean(weightValue || repsValue || done);
    if (hasData && !confirm("Remove last set?")) return;
    lastRow.remove();
    updateRemoveState();
    scheduleDraftSave();
  });

  return card;
};

const renderWorkoutDay = async () => {
  createDayTabs();
  await updateTodayUI();
  let exercises = await getPlanExercises();
  dom.exerciseList.innerHTML = "";
  const settings = await db.get(STORES.SETTINGS, "settings");
  const workoutDraft = settings?.currentWorkoutDraft;
  const editDraft = settings?.editWorkoutDraft;
  const editing = state.editingWorkout;
  if (editing) {
    const source = editDraft?.id === editing.id ? editDraft.exercises : editing.exercises;
    exercises = (source || []).map((exercise) => ({
      name: exercise.name,
      defaultSets: exercise.sets?.length || DEFAULT_SET_COUNT,
    }));
  }
  const hasDraft =
    workoutDraft && workoutDraft.day === state.day && workoutDraft.split === state.split;

  if (!exercises.length) {
    dom.daySummary.textContent = "Rest day. Reset and recover.";
    dom.exerciseList.innerHTML = `<div class="exercise-card">No exercises scheduled.</div>`;
    return;
  }

  const totalSets = exercises.reduce(
    (sum, exercise) => sum + (exercise.defaultSets || DEFAULT_SET_COUNT),
    0
  );
  dom.daySummary.textContent = `${exercises.length} exercises  -  ${totalSets} sets`;
  for (let i = 0; i < exercises.length; i += 1) {
    const card = await renderExerciseCard(exercises[i], i, {
      prefillFromLast: !hasDraft && !editing,
    });
    dom.exerciseList.appendChild(card);
  }

  setEditModeLabel(Boolean(editing));
  if (editing) {
    applyWorkoutState(editDraft?.id === editing.id ? editDraft : editing);
    return;
  }
  if (hasDraft) {
    applyWorkoutState(workoutDraft);
    if (!state.draftRecoveryShown) {
      state.draftRecoveryShown = true;
      showToast("Recovered last workout draft.");
    }
  }
};

const handleSetCompletion = async (card, row) => {
  const weightInput = row.querySelector(".set-weight");
  const repsInput = row.querySelector(".set-reps");
  const exerciseName = card.dataset.exercise;
  const prior = (await db.get(STORES.EXERCISES, exerciseName)) || {};
  const weightValue = getValidatedSetValue(
    weightInput?.value,
    SET_INPUT_LIMITS.weightMin,
    SET_INPUT_LIMITS.weightMax
  );
  const repsValue = getValidatedSetValue(
    repsInput?.value,
    SET_INPUT_LIMITS.repsMin,
    SET_INPUT_LIMITS.repsMax
  );
  const isValidSet =
    Number.isFinite(weightValue) && Number.isFinite(repsValue) && repsValue > 0;
  const weight = isValidSet ? weightValue : Number(prior.lastWeight) || 0;
  const reps = isValidSet ? repsValue : Number(prior.lastReps) || 0;
  const isPr = isValidSet && (weight > (prior.lastWeight || 0) || reps > (prior.lastReps || 0));
  const prs = Array.isArray(prior.prs) ? prior.prs.slice() : [];
  if (isPr) {
    prs.unshift({ weight, reps, date: new Date().toISOString() });
  }
  await db.set(STORES.EXERCISES, {
    name: exerciseName,
    lastWeight: isValidSet ? weight : Number(prior.lastWeight) || 0,
    lastReps: isValidSet ? reps : Number(prior.lastReps) || 0,
    notes: card.querySelector(".exercise-notes").value || "",
    prs: prs.slice(0, 5),
  });
  if (isPr) {
    card.classList.add("pr");
    showToast("PR! New personal best.");
  }
  if (row.dataset.xpAwarded !== "true") {
    row.dataset.xpAwarded = "true";
    await applyXp(10);
  }
  startRestTimer(state.restDuration);
  focusNextInput(card);
  updateWorkoutDraft();
};

// DEV NOTES: focusNextInput guards against missing nodes and DOM changes.
const focusNextInput = (card) => {
  if (!card?.querySelectorAll) return;
  const inputs = Array.from(card.querySelectorAll(".set-weight, .set-reps"));
  if (!inputs.length) return;
  const current = document.activeElement;
  const idx = inputs.indexOf(current);
  if (idx !== -1 && inputs[idx + 1]) {
    inputs[idx + 1].focus();
    return;
  }
  const nextCard = card.nextElementSibling;
  if (nextCard?.querySelector) {
    const nextInput = nextCard.querySelector(".set-weight");
    if (nextInput?.focus) nextInput.focus();
  }
};

// DEV NOTES: Draft autosave preserves nulls and catches storage errors on fast exits.
const updateWorkoutDraft = async () => {
  try {
    const settings = await db.get(STORES.SETTINGS, "settings");
    const exercises = buildWorkoutExercisesFromDom();
    const hasChanges = Array.from(dom.exerciseList.querySelectorAll(".exercise-card")).some(
      (card) => {
        const notesInput = card.querySelector(".exercise-notes");
        const notes = notesInput?.value?.trim();
        const notesDirty = notesInput?.dataset.dirty === "true";
        if (notes || notesDirty) return true;
        const rows = card.querySelectorAll(".set-row");
        return Array.from(rows).some((row) => {
          const toggle = row.querySelector(".set-toggle");
          if (toggle?.classList.contains("done")) return true;
          const weightDirty = row.querySelector(".set-weight")?.dataset.dirty === "true";
          const repsDirty = row.querySelector(".set-reps")?.dataset.dirty === "true";
          return weightDirty || repsDirty;
        });
      }
    );
    if (!hasChanges) return;
    const existingDraft = state.editingWorkoutId
      ? settings?.editWorkoutDraft
      : settings?.currentWorkoutDraft;
    const workout = {
      ...(existingDraft || {}),
      id: state.editingWorkoutId || existingDraft?.id || null,
      dateKey: getTodayKey(),
      dayKey: getTodayKey(),
      date: new Date().toISOString(),
      split: state.split,
      day: state.day,
      exercises,
      pausedElapsedMs: null,
      closedAtMs: null,
      resumePromptPending: false,
      maxAwayMs: MAX_AWAY_MS,
      timerWasRunning: Boolean(state.workoutTimerId),
    };
    const payload = state.editingWorkoutId
      ? { ...settings, key: "settings", editWorkoutDraft: workout }
      : { ...settings, key: "settings", currentWorkoutDraft: workout };
    await db.set(STORES.SETTINGS, payload);
    const now = Date.now();
    if (now - state.lastDraftToastAt > 2000) {
      state.lastDraftToastAt = now;
      showToast("Draft saved.");
    }
  } catch (error) {
    handleStorageError(error);
  }
};

// DEV NOTES: Restore only saved values; null stays blank to prevent phantom sets.
const applyWorkoutState = (workout) => {
  if (!workout?.exercises) return;
  workout.exercises.forEach((exercise) => {
    const selector = `[data-exercise="${escapeSelector(exercise.name)}"]`;
    const card = dom.exerciseList.querySelector(selector);
    if (!card) return;
  const notes = card.querySelector(".exercise-notes");
  if (notes) notes.value = exercise.notes || "";
    const setGrid = card.querySelector(".set-grid");
    if (!setGrid) return;
    const desiredCount = Math.max(1, exercise.sets?.length || 0);
    const rows = Array.from(setGrid.querySelectorAll(".set-row"));
    if (rows.length !== desiredCount) {
      setGrid.innerHTML = Array.from({ length: desiredCount }, (_, idx) =>
        buildSetRowMarkup(idx + 1)
      ).join("");
    }
    setGrid.querySelectorAll(".set-toggle").forEach((toggle) => bindSetToggle(toggle, card));
    const updatedRows = setGrid.querySelectorAll(".set-row");
    (exercise.sets || []).forEach((set, index) => {
      const row = updatedRows[index];
      if (!row) return;
      const weight = row.querySelector(".set-weight");
      const reps = row.querySelector(".set-reps");
      if (weight) {
        weight.value = set.weight ?? "";
        if (set.weight !== null && set.weight !== undefined) {
          weight.dataset.dirty = "true";
        }
      }
      if (reps) {
        reps.value = set.reps ?? "";
        if (set.reps !== null && set.reps !== undefined) {
          reps.dataset.dirty = "true";
        }
      }
      const toggle = row.querySelector(".set-toggle");
      if (toggle && set.done) {
        toggle.classList.add("done");
        row.dataset.xpAwarded = "true";
      }
    });
    const removeButton = card.querySelector(".set-remove");
    if (removeButton) removeButton.disabled = desiredCount <= 1;
  });
};

const applyXp = async (amount) => {
  const profile = (await db.get(STORES.PROFILE, "profile")) || {
    key: "profile",
    username: "",
    totalXp: 0,
    level: 1,
  };
  const totalXp = profile.totalXp + amount;
  const level = Math.floor(totalXp / 1000) + 1;
  await db.set(STORES.PROFILE, { ...profile, totalXp, level });
  updateXpUi(totalXp, level);
  showToast(`+${amount} XP`);
};

const updateXpUi = (totalXp, level) => {
  const levelXp = totalXp % 1000;
  dom.levelBadge.textContent = `Lv ${level}`;
  dom.userLevel.textContent = level;
  dom.xpText.textContent = `${levelXp} / 1000 XP`;
  dom.xpFill.style.width = `${Math.min(100, (levelXp / 1000) * 100)}%`;
};

const buildWorkoutExercisesFromDom = () => {
  const cards = Array.from(dom.exerciseList.querySelectorAll(".exercise-card"));
  return cards.map((card) => {
    const sets = [];
    card.querySelectorAll(".set-row").forEach((row) => {
      const weightInput = row.querySelector(".set-weight");
      const repsInput = row.querySelector(".set-reps");
      const done = row.querySelector(".set-toggle").classList.contains("done");
      const weightDirty = weightInput?.dataset.dirty === "true";
      const repsDirty = repsInput?.dataset.dirty === "true";
      const weight = weightDirty || done
        ? getValidatedSetValue(
            weightInput?.value ?? "",
            SET_INPUT_LIMITS.weightMin,
            SET_INPUT_LIMITS.weightMax
          )
        : null;
      const reps = repsDirty || done
        ? getValidatedSetValue(
            repsInput?.value ?? "",
            SET_INPUT_LIMITS.repsMin,
            SET_INPUT_LIMITS.repsMax
          )
        : null;
      sets.push({
        weight,
        reps,
        done,
      });
    });
    return {
      name: card.dataset.exercise,
      notes: card.querySelector(".exercise-notes")?.value || "",
      sets,
    };
  });
};

const calculateWorkoutSummary = (exercises) => {
  let totalSets = 0;
  let totalReps = 0;
  let totalTonnage = 0;
  let exercisesCount = 0;
  exercises.forEach((exercise) => {
    let exerciseHasSet = false;
    (exercise.sets || []).forEach((set) => {
      const weight = getValidatedSetValue(
        set.weight,
        SET_INPUT_LIMITS.weightMin,
        SET_INPUT_LIMITS.weightMax
      );
      const reps = getValidatedSetValue(
        set.reps,
        SET_INPUT_LIMITS.repsMin,
        SET_INPUT_LIMITS.repsMax
      );
      if (!Number.isFinite(weight) || weight < 0) return;
      if (!Number.isFinite(reps) || reps <= 0) return;
      exerciseHasSet = true;
      totalSets += 1;
      totalReps += reps;
      totalTonnage += weight * reps;
    });
    if (exerciseHasSet) exercisesCount += 1;
  });
  return {
    exercisesCount,
    totalSets,
    totalReps,
    totalVolume: totalTonnage,
  };
};

const calculateWorkoutSummaryFromDom = () => {
  const exercises = Array.from(dom.exerciseList.querySelectorAll(".exercise-card"));
  let totalSets = 0;
  let totalReps = 0;
  let totalTonnage = 0;
  let exercisesCount = 0;
  exercises.forEach((card) => {
    let exerciseHasSet = false;
    card.querySelectorAll(".set-row").forEach((row) => {
      const weight = getValidatedSetValue(
        row.querySelector(".set-weight")?.value,
        SET_INPUT_LIMITS.weightMin,
        SET_INPUT_LIMITS.weightMax
      );
      const reps = getValidatedSetValue(
        row.querySelector(".set-reps")?.value,
        SET_INPUT_LIMITS.repsMin,
        SET_INPUT_LIMITS.repsMax
      );
      if (!Number.isFinite(weight) || weight < 0) return;
      if (!Number.isFinite(reps) || reps <= 0) return;
      exerciseHasSet = true;
      totalSets += 1;
      totalReps += reps;
      totalTonnage += weight * reps;
    });
    if (exerciseHasSet) exercisesCount += 1;
  });
  return {
    exercisesCount,
    totalSets,
    totalReps,
    totalVolume: totalTonnage,
  };
};

// DEV NOTES: Finish modal uses a single pre-save snapshot for summary and storage.
const buildPendingWorkout = async () => {
  if (!state.workoutStart && !state.editingWorkout) {
    showToast("No workout in progress.");
    return null;
  }
  const exercises = buildWorkoutExercisesFromDom();
  const summary = calculateWorkoutSummary(exercises);
  const completedSets = exercises.reduce(
    (sum, exercise) => sum + (exercise.sets || []).filter((set) => set.done).length,
    0
  );
  const editing = state.editingWorkout;
  const now = editing ? new Date(editing.date) : new Date();
  const endTime = editing?.endTime || now.getTime();
  const durationSec = editing
    ? Number(editing.durationSec) || Math.max(1, Math.round((editing.durationMinutes || 1) * 60))
    : Math.max(1, Math.floor((endTime - state.workoutStart) / 1000));
  const durationMinutes = Math.max(1, Math.round(durationSec / 60));
  const duration = durationMinutes;
  const weightFromUi =
    parseInputNumber(dom.bmiWeight?.value) ?? parseInputNumber(dom.coachWeight?.value);
  const weightKg = Number.isFinite(weightFromUi) && weightFromUi > 0
    ? weightFromUi
    : Number.isFinite(editing?.weightKgUsed)
      ? editing.weightKgUsed
      : await getLatestKnownWeightKg();
  const intensityOption = dom.workoutIntensity?.selectedOptions?.[0];
  const intensityLabel =
    editing?.intensityLabel ||
    intensityOption?.dataset?.label ||
    intensityOption?.textContent?.trim() ||
    "General";
  const met = Number.isFinite(editing?.met)
    ? editing.met
    : parseInputNumber(dom.workoutIntensity?.value) ?? 3.5;
  const caloriesBurned = calculateEstimatedCalories({
    weightKg,
    durationMinutes,
    met,
  });
  if (!Number.isFinite(caloriesBurned)) {
    showMissingWeightToastOnce();
  }
  return {
    now,
    endTime,
    durationSec,
    durationMinutes,
    duration,
    weightKg,
    intensityLabel,
    met,
    caloriesBurned,
    summary,
    completedSets,
    exercises,
  };
};

const openFinishModal = async () => {
  const pending = await buildPendingWorkout();
  if (!pending) return;
  state.pendingWorkout = pending;
  const caloriesText = Number.isFinite(pending.caloriesBurned)
    ? `${pending.caloriesBurned} kcal`
    : "--";
  dom.finishSummary.innerHTML = `
    <span>Duration: <strong>${pending.durationMinutes} min</strong></span>
    <span>Exercises: <strong>${pending.summary.exercisesCount}</strong></span>
    <span>Completed sets: <strong>${pending.completedSets}</strong></span>
    <span>Training volume (kg-reps): <strong>${Math.round(pending.summary.totalVolume)}</strong></span>
    <span>Estimated Calories Burned: <strong>${caloriesText}</strong></span>
  `;
  dom.finishModal.classList.add("open");
};

const finishWorkout = async () => {
  await openFinishModal();
};

const closeFinishModal = () => {
  dom.finishModal.classList.remove("open");
  state.pendingWorkout = null;
};

const savePendingWorkout = async () => {
  const pending = state.pendingWorkout;
  if (!pending) return;
  if (pending.completedSets === 0) {
    const confirmSave = confirm("No completed sets recorded. Save anyway?");
    if (!confirmSave) return;
  }
  await applyXp(100);
  // DEV NOTES: Edit mode overwrites existing workout entry (same ID), no duplicates.
  const exercisesDetailed = (pending.exercises || [])
    .map((exercise) => {
      const sets = (exercise.sets || [])
        .map((set, index) => {
          const weight = getValidatedSetValue(
            set.weight,
            SET_INPUT_LIMITS.weightMin,
            SET_INPUT_LIMITS.weightMax
          );
          const reps = getValidatedSetValue(
            set.reps,
            SET_INPUT_LIMITS.repsMin,
            SET_INPUT_LIMITS.repsMax
          );
          if (!Number.isFinite(weight) || !Number.isFinite(reps) || reps <= 0) return null;
          return {
            setIndex: index + 1,
            weight,
            reps,
            done: Boolean(set.done),
          };
        })
        .filter(Boolean);
      return {
        name: exercise.name,
        notes: exercise.notes || "",
        sets,
      };
    })
    .filter((exercise) => exercise.sets.length);
  const base = state.editingWorkout || {};
  const workout = {
    id: state.editingWorkoutId || `w_${Date.now()}`,
    date: state.editingWorkoutId ? base.date : pending.now.toISOString(),
    localDateISO: state.editingWorkoutId ? base.localDateISO || base.date : pending.now.toISOString(),
    localDayKey: state.editingWorkoutId
      ? base.localDayKey || new Date(base.date).toDateString()
      : pending.now.toDateString(),
    dateKey: state.editingWorkoutId ? base.dateKey || getTodayKey() : getTodayKey(),
    day: state.editingWorkoutId ? base.day : state.day,
    split: state.editingWorkoutId ? base.split : state.split,
    startTime: state.editingWorkoutId ? base.startTime ?? null : state.workoutStart,
    endTime: state.editingWorkoutId ? base.endTime ?? pending.endTime : pending.endTime,
    durationSec: Number(pending.durationSec) || 0,
    duration: pending.duration,
    durationMinutes: pending.durationMinutes,
    met: Number.isFinite(pending.met) ? pending.met : null,
    intensityLabel: pending.intensityLabel,
    weightKg:
      Number.isFinite(Number(pending.weightKg)) && Number(pending.weightKg) > 0
        ? Number(pending.weightKg)
        : null,
    weightKgUsed:
      Number.isFinite(Number(pending.weightKg)) && Number(pending.weightKg) > 0
        ? Number(pending.weightKg)
        : null,
    xp: 100 + pending.summary.totalSets * 10,
    exercisesCount: pending.summary.exercisesCount,
    totalSets: pending.summary.totalSets,
    totalReps: pending.summary.totalReps,
    totalVolume: pending.summary.totalVolume,
    totalVolumeKg: Number(pending.summary.totalVolume) || 0,
    caloriesBurned: Number.isFinite(pending.caloriesBurned) ? pending.caloriesBurned : null,
    exercises: pending.exercises,
    exercisesDetailed,
  };
  try {
    await db.set(STORES.WORKOUTS, workout);
  } catch (error) {
    handleStorageError(error);
    return;
  }
  closeFinishModal();
  if (state.editingWorkoutId) {
    await clearEditWorkoutDraft();
    state.editingWorkoutId = null;
    state.editingWorkout = null;
    setEditModeLabel(false);
  } else {
    await clearCurrentWorkout();
    await clearCurrentWorkoutDraft();
    stopWorkoutTimer();
  }
  blastConfetti();
  showFinishCelebration();
  showToast("Workout complete!");
  console.log("[workout] finish cleared");
  await refreshDashboard();
  await renderHistory();
};

const refreshDashboard = async () => {
  let workouts = [];
  try {
    workouts = await db.getAll(STORES.WORKOUTS);
    workouts = await normalizeWorkoutsWithLocalKeys(workouts);
  } catch (error) {
    handleStorageError(error);
    return;
  }
  dom.totalWorkouts.textContent = workouts.length;
  dom.workoutStreak.textContent = `${calculateWorkoutStreak(workouts)} days`;

  const profile = await db.get(STORES.PROFILE, "profile");
  updateXpUi(profile?.totalXp || 0, profile?.level || 1);

  renderWeeklyChart(workouts);
  renderInsights(workouts);
  await updateWeeklyStats(workouts);
  await updateHistoryCalories(workouts);
};

const calculateStreak = (workouts) => calculateWorkoutStreak(workouts);

const renderWeeklyChart = (workouts) => {
  const labels = [];
  const data = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const label = date.toLocaleDateString("en-US", { weekday: "short" });
    labels.push(label);
    const count = workouts.filter(
      (w) => new Date(w.date).toDateString() === date.toDateString()
    ).length;
    data.push(count);
  }

  if (state.chart) {
    state.chart.update(labels, data);
  } else {
    state.chart = new Chart(dom.weeklyChart.getContext("2d"), {
      type: "bar",
      data: {
        labels,
        datasets: [{ data, backgroundColor: "#ff8a3d" }],
      },
    });
  }
};

const renderInsights = (workouts) => {
  if (!workouts.length) {
    dom.insightsList.innerHTML = "<li>Complete a workout to unlock insights.</li>";
    return;
  }
  const last = workouts[workouts.length - 1];
  const lastVolume = last.totalVolumeKg ?? last.totalVolume ?? 0;
  dom.insightsList.innerHTML = `
    <li>Last workout: ${last.duration} min  -  ${last.totalSets} sets</li>
    <li>Training volume (kg-reps): ${lastVolume}</li>
    <li>XP earned: ${last.xp}</li>
  `;
};

// DEV NOTES: Weekly pattern stats are computed on demand for performance.
const parseMuscleLabels = (raw) =>
  String(raw)
    .replace(/\u0007/g, ",")
    .split(/[,/]|&/)
    .map((item) => item.trim())
    .filter((item) => item && item.toLowerCase() !== "rest");

const getMuscleLabels = (workout) => {
  const raw =
    splitDayMeta?.[workout.split]?.[workout.day]?.muscle ||
    splitDayMeta?.[workout.split]?.[workout.day]?.title ||
    workout.split ||
    workout.day ||
    "Workout";
  return parseMuscleLabels(raw);
};

const formatWeekOverWeek = (current, previous) => {
  if (!Number.isFinite(previous) || previous <= 0) return "Week-over-week training volume: n/a";
  const delta = ((current - previous) / previous) * 100;
  const sign = delta >= 0 ? "+" : "";
  return `Week-over-week training volume: ${sign}${delta.toFixed(1)}%`;
};

const renderWeeklyPattern = async () => {
  if (!dom.weeklyPatternResult) return;
  const workouts = await normalizeWorkoutsWithLocalKeys(await db.getAll(STORES.WORKOUTS));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const counts = new Map();
  let last7Volume = 0;
  let prev7Volume = 0;

  workouts.forEach((workout) => {
    const date = new Date(workout.date);
    date.setHours(0, 0, 0, 0);
    const daysAgo = Math.floor((today - date) / (24 * 60 * 60 * 1000));
    if (daysAgo < 0) return;
    if (daysAgo <= 6) {
      last7Volume += Number(workout.totalVolumeKg ?? workout.totalVolume ?? 0);
      getMuscleLabels(workout).forEach((label) => {
        counts.set(label, (counts.get(label) || 0) + 1);
      });
    } else if (daysAgo <= 13) {
      prev7Volume += Number(workout.totalVolumeKg ?? workout.totalVolume ?? 0);
    }
  });

  const patternList = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => `${label} ${count}x`);
  const patternText = patternList.length
    ? `Last 7 days: ${patternList.join(", ")}`
    : "Last 7 days: none yet";

  const expected = new Set();
  Object.values(splitDayMeta?.[state.split] || {}).forEach((meta) => {
    parseMuscleLabels(meta?.muscle || meta?.title || "").forEach((label) => expected.add(label));
  });
  let underText = "Under-training: none detected.";
  if (!patternList.length) {
    underText = "Under-training: log a workout to build a pattern.";
  } else if (expected.size) {
    const missing = Array.from(expected).find((label) => !counts.has(label));
    if (missing) {
      underText = `Under-training: ${missing} (0x last 7 days).`;
    } else {
      const lowest = Array.from(counts.entries()).sort((a, b) => a[1] - b[1])[0];
      if (lowest && lowest[1] <= 1) {
        underText = `Under-training: ${lowest[0]} (${lowest[1]}x last 7 days).`;
      }
    }
  }

  const wowText = formatWeekOverWeek(last7Volume, prev7Volume);
  const settings = await db.get(STORES.SETTINGS, "settings");
  const goal = settings?.calorieInputs?.goal || "Maintain";
  const goalText =
    goal === "Cut"
      ? "Goal reminder: Cut selected. Keep protein high and plan recovery."
      : goal === "Bulk"
        ? "Goal reminder: Bulk selected. Aim for a steady surplus."
        : "Goal reminder: Maintain selected.";

  dom.weeklyPatternResult.innerHTML = `${patternText}<br>${underText}<br>${wowText}<br>${goalText}`;
};

const promptNumber = (label, currentValue) => {
  const input = prompt(`${label}`, String(currentValue ?? 0));
  if (input === null) return null;
  const value = Number(input);
  if (Number.isNaN(value)) {
    showToast("Enter a valid number.");
    return null;
  }
  return value;
};

// DEV NOTES: Unified calorie resolver prefers stored, then MET-based estimate (no volume fallback).
const getWorkoutCalories = (workout, settings = {}) => {
  if (Number.isFinite(workout.caloriesBurned)) return workout.caloriesBurned;
  const durationMinutes =
    Number(workout.durationMinutes) || Math.round((workout.durationSec || 0) / 60);
  let weight = parseInputNumber(workout.weightKgUsed);
  if (!Number.isFinite(weight) || weight <= 0) {
    weight = parseInputNumber(workout.weightKg);
  }
  if (!Number.isFinite(weight) || weight <= 0) {
    weight = parseInputNumber(settings?.weightKg);
  }
  const metBased = calculateEstimatedCalories({
    weightKg: weight,
    durationMinutes,
    met: workout.met ?? 3.5,
  });
  if (Number.isFinite(metBased)) return metBased;
  return null;
};

const renderHistoryDetailView = (workout) => {
  if (!dom.historyDetailModal || !dom.historyDetailContent) return;
  state.historyEditGuard = false;
  const calories = getWorkoutCalories(workout, { weightKg: state.calorieInputs?.weightKg });
  const volume = sanitizeVolumeKg(workout.totalVolumeKg ?? workout.totalVolume);
  const durationMin = Number(workout.duration) || Math.round((workout.durationSec || 0) / 60);
  const intensity = workout.intensityLabel || "General";
  const fallbackWeight = parseInputNumber(state.calorieInputs?.weightKg);
  const weightValue =
    Number.isFinite(Number(workout.weightKg)) && Number(workout.weightKg) > 0
      ? Number(workout.weightKg)
      : Number.isFinite(fallbackWeight) && fallbackWeight > 0
        ? fallbackWeight
        : null;
  const weightText = Number.isFinite(weightValue) ? weightValue : "--";
  const calorieText = Number.isFinite(calories) ? `${calories} kcal` : "--";
  const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];
  const exerciseBlocks = exercises
    .map((exercise) => {
      const sets = (exercise.sets || [])
        .map((set) => {
          const weight = getValidatedSetValue(
            set.weight,
            SET_INPUT_LIMITS.weightMin,
            SET_INPUT_LIMITS.weightMax
          );
          const reps = getValidatedSetValue(
            set.reps,
            SET_INPUT_LIMITS.repsMin,
            SET_INPUT_LIMITS.repsMax
          );
          if (!Number.isFinite(weight) || !Number.isFinite(reps) || reps <= 0) return null;
          return `<div class="history-set">${weight}kg x ${reps}</div>`;
        })
        .filter(Boolean)
        .join("");
      const notes = exercise.notes ? `<div class="history-notes">${exercise.notes}</div>` : "";
      return `
        <div class="history-exercise">
          <strong>${exercise.name}</strong>
          ${notes}
          <div class="history-sets">
            ${sets || '<div class="muted">No sets recorded.</div>'}
          </div>
        </div>
      `;
    })
    .join("");
  dom.historyDetailContent.innerHTML = `
    <div class="history-detail-header">
      <div>
        <h3>${new Date(workout.date).toLocaleDateString()}</h3>
        <div class="muted">${workout.day || "--"}  -  ${workout.split || "--"}</div>
      </div>
      <div class="history-detail-actions">
        <button class="chip" id="historyDetailEdit" type="button">Edit</button>
        <button class="chip" id="historyDetailClose" type="button">Close</button>
      </div>
    </div>
    <div class="history-detail-meta">
      <span>
        Estimated Calories Burned
        <span
          class="info-tooltip"
          role="img"
          aria-label="Calculated using standard formulas. Actual burn may vary."
          title="Calculated using standard formulas. Actual burn may vary."
        >i</span>: ${calorieText}
      </span>
      <span>Duration: ${durationMin || 0} min • Intensity: ${intensity} • Weight: ${weightText} kg</span>
      <span>Training volume (kg-reps): ${volume}</span>
    </div>
    <div class="history-detail-body">
      ${exerciseBlocks || '<div class="muted">No exercises recorded.</div>'}
    </div>
  `;
  dom.historyDetailModal.classList.add("open");
  dom.historyDetailContent
    .querySelector("#historyDetailEdit")
    ?.addEventListener("click", () => renderHistoryDetailEdit(workout));
  dom.historyDetailContent
    .querySelector("#historyDetailClose")
    ?.addEventListener("click", closeHistoryDetail);
};

const readExerciseEdits = () => {
  const exercises = [];
  dom.historyDetailContent.querySelectorAll(".history-exercise-edit").forEach((exerciseEl) => {
    const name = exerciseEl.dataset.exerciseName || "";
    const notes = exerciseEl.querySelector(".history-edit-notes")?.value || "";
    const sets = [];
    exerciseEl.querySelectorAll(".history-set-edit").forEach((setEl) => {
      const weightValue = setEl.querySelector(".history-edit-weight")?.value;
      const repsValue = setEl.querySelector(".history-edit-reps")?.value;
      const weight = Number(weightValue);
      const reps = Number(repsValue);
      sets.push({
        weight: Number.isFinite(weight) ? weight : null,
        reps: Number.isFinite(reps) ? reps : null,
      });
    });
    exercises.push({ name, notes, sets });
  });
  return exercises;
};

const renderHistoryDetailEdit = (workout) => {
  if (!dom.historyDetailModal || !dom.historyDetailContent) return;
  state.historyEditGuard = true;
  const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];
  const durationMin = Number(workout.duration) || Math.round((workout.durationSec || 0) / 60);
  const exerciseBlocks = exercises
    .map((exercise) => {
      const rawSets = exercise.sets && exercise.sets.length ? exercise.sets : [{ weight: null, reps: null }];
      const sets = rawSets
        .map(
          (set, setIndex) => `
        <div class="history-set-edit">
          <input
            class="field history-edit-weight"
            type="number"
            inputmode="decimal"
            min="0"
            step="0.5"
            value="${set.weight ?? ""}"
            aria-label="Set ${setIndex + 1} weight"
          />
          <input
            class="field history-edit-reps"
            type="number"
            inputmode="numeric"
            min="1"
            step="1"
            value="${set.reps ?? ""}"
            aria-label="Set ${setIndex + 1} reps"
          />
        </div>`
        )
        .join("");
      return `
        <div class="history-exercise history-exercise-edit" data-exercise-name="${exercise.name}">
          <strong>${exercise.name}</strong>
          <textarea class="field history-edit-notes" rows="2" placeholder="Notes">${exercise.notes || ""}</textarea>
          <div class="history-sets">${sets}</div>
        </div>
      `;
    })
    .join("");
  dom.historyDetailContent.innerHTML = `
    <div class="history-detail-header">
      <div>
        <h3>Edit ${new Date(workout.date).toLocaleDateString()}</h3>
        <div class="muted">${workout.day || "--"}  -  ${workout.split || "--"}</div>
      </div>
      <div class="history-detail-actions">
        <button class="chip" id="historyDetailCancel" type="button">Cancel</button>
        <button class="primary" id="historyDetailSave" type="button">Save</button>
      </div>
    </div>
    <div class="history-detail-meta edit-metrics-row">
      <label class="history-edit-row">
        <span>Duration (min)</span>
        <input
          class="field compact-number-input history-edit-duration"
          type="number"
          inputmode="numeric"
          min="0"
          step="1"
          value="${durationMin}"
        />
      </label>
      <label class="history-edit-row">
        <span>XP</span>
        <input
          class="field compact-number-input history-edit-xp"
          type="number"
          inputmode="numeric"
          min="0"
          step="1"
          value="${workout.xp ?? 0}"
        />
      </label>
    </div>
    <div class="history-detail-body">
      ${exerciseBlocks || '<div class="muted">No exercises recorded.</div>'}
    </div>
  `;
  dom.historyDetailModal.classList.add("open");
  dom.historyDetailContent
    .querySelector("#historyDetailCancel")
    ?.addEventListener("click", () => renderHistoryDetailView(workout));
  dom.historyDetailContent
    .querySelector("#historyDetailSave")
    ?.addEventListener("click", async () => {
      const exercisesUpdated = readExerciseEdits();
      const durationInput = dom.historyDetailContent.querySelector(".history-edit-duration");
      const xpInput = dom.historyDetailContent.querySelector(".history-edit-xp");
      const duration = Number(durationInput?.value);
      const durationSec = Math.max(1, Math.round((Number.isFinite(duration) ? duration : 1) * 60));
      const summary = calculateWorkoutSummary(exercisesUpdated);
      const durationMinutes = Math.max(1, Math.round(durationSec / 60));
      const weightForRecalc =
        parseInputNumber(workout.weightKgUsed) ?? parseInputNumber(workout.weightKg);
      const recalculatedCalories = calculateEstimatedCalories({
        weightKg: weightForRecalc,
        durationMinutes,
        met: workout.met,
      });
      const caloriesBurned = Number.isFinite(recalculatedCalories) ? recalculatedCalories : null;
      const updated = {
        ...workout,
        duration: Math.max(1, Math.round(durationSec / 60)),
        durationSec,
        durationMinutes,
        xp: Math.max(0, Number(xpInput?.value) || 0),
        exercisesCount: summary.exercisesCount,
        totalSets: summary.totalSets,
        totalReps: summary.totalReps,
        totalVolume: summary.totalVolume,
        totalVolumeKg: summary.totalVolume,
        caloriesBurned,
        exercises: exercisesUpdated,
      };
      try {
        await db.set(STORES.WORKOUTS, updated);
        showToast("Workout updated.");
        await refreshDashboard();
        await renderHistory();
        renderHistoryDetailView(updated);
      } catch (error) {
        console.warn("[db] history edit failed", error);
        showToast("Storage error. Restart app.");
      }
    });
};

const openHistoryDetail = (workout) => {
  renderHistoryDetailView(workout);
};

const closeHistoryDetail = () => {
  dom.historyDetailModal?.classList.remove("open");
  state.historyEditGuard = false;
};

const editWorkoutEntry = async (workout) => {
  renderHistoryDetailEdit(workout);
};

const deleteWorkoutEntry = async (workout) => {
  if (!confirm("Delete this workout?")) return;
  try {
    await db.delete(STORES.WORKOUTS, workout.id);
    showToast("Workout deleted.");
    await refreshDashboard();
    await renderHistory();
  } catch (error) {
    handleStorageError(error);
  }
};

const getHistoryRange = () => {
  const mode = state.historyPeriodMode || "week";
  return getPeriodRange(mode, state.historyAnchorDate || new Date());
};

const updateHistoryCompare = (workouts) => {
  if (!dom.historyCompare) return;
  const mode = state.historyPeriodMode || "week";
  const settingsWeight = state.calorieInputs?.weightKg;
  const selectedRange = getHistoryRange();
  const presentRange = getPeriodRange(mode, new Date());
  const selected = workouts.filter((workout) => {
    const date = getWorkoutLocalDate(workout);
    return date && date >= selectedRange.startDate && date < selectedRange.endDateExclusive;
  });
  const present = workouts.filter((workout) => {
    const date = getWorkoutLocalDate(workout);
    return date && date >= presentRange.startDate && date < presentRange.endDateExclusive;
  });
  const selectedMetrics = computeMetrics(selected, { weightKg: settingsWeight });
  const presentMetrics = computeMetrics(present, { weightKg: settingsWeight });
  const delta = {
    workoutCount: selectedMetrics.workoutCount - presentMetrics.workoutCount,
    totalVolumeKg: selectedMetrics.totalVolumeKg - presentMetrics.totalVolumeKg,
    totalCaloriesKcal: selectedMetrics.totalCaloriesKcal - presentMetrics.totalCaloriesKcal,
    totalDurationMin: selectedMetrics.totalDurationMin - presentMetrics.totalDurationMin,
  };
  const isCurrentPeriod =
    selectedRange.startDate.getTime() === presentRange.startDate.getTime();
  const label = mode === "week" && !isCurrentPeriod
    ? `Week of ${selectedRange.startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
    : selectedRange.label;
  const presentLabel = mode === "week" ? "This week" : mode === "month" ? "This month" : "This year";
  const formatDelta = (value) => `${value >= 0 ? "+" : ""}${Math.round(value)}`;
  dom.historyCompare.textContent = `${label}: ${selectedMetrics.workoutCount} workouts \u2022 ${Math.round(
    selectedMetrics.totalVolumeKg
  )} kg-reps \u2022 ${Math.round(selectedMetrics.totalCaloriesKcal)} kcal \u2022 ${Math.round(
    selectedMetrics.totalDurationMin
  )} min | ${presentLabel}: ${presentMetrics.workoutCount} workouts \u2022 ${Math.round(
    presentMetrics.totalVolumeKg
  )} kg-reps \u2022 ${Math.round(presentMetrics.totalCaloriesKcal)} kcal \u2022 ${Math.round(
    presentMetrics.totalDurationMin
  )} min | \u0394 ${formatDelta(delta.workoutCount)} workouts \u2022 ${formatDelta(
    delta.totalVolumeKg
  )} kg-reps \u2022 ${formatDelta(delta.totalCaloriesKcal)} kcal \u2022 ${formatDelta(
    delta.totalDurationMin
  )} min`;
};

const updateHistoryPeriodUI = () => {
  const mode = state.historyPeriodMode || "week";
  const range = getHistoryRange();
  const present = getPeriodRange(mode, new Date());
  const isWeek = mode === "week";
  const isCurrentPeriod = range.startDate.getTime() === present.startDate.getTime();
  const label = isWeek && !isCurrentPeriod
    ? `Week of ${range.startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
    : range.label;
  if (dom.historyPeriodLabel) dom.historyPeriodLabel.textContent = label;
  [dom.historyPeriodWeek, dom.historyPeriodMonth, dom.historyPeriodYear].forEach((btn) => {
    if (!btn) return;
    const active = btn.dataset.period === mode;
    btn.classList.toggle("active", active);
  });
  if (dom.historyNextBtn) {
    const nextRange = getPeriodRange(mode, shiftAnchor(mode, state.historyAnchorDate, 1));
    dom.historyNextBtn.disabled = nextRange.startDate > present.startDate;
  }
};

const getYesterdayKey = () => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toDateString();
};

const buildHistorySummaryText = (workout) => {
  const dateText = new Date(workout.date).toLocaleDateString();
  const durationMinutes = workout.durationMinutes ?? workout.duration ?? 0;
  const volume = Math.round(sanitizeVolumeKg(workout.totalVolumeKg ?? workout.totalVolume ?? 0));
  const caloriesValue = getWorkoutCalories(workout, { weightKg: state.calorieInputs?.weightKg });
  const calories = Number.isFinite(caloriesValue) ? caloriesValue : "--";
  return `Date: ${dateText}\nDuration: ${durationMinutes} min\nTraining volume (kg-reps): ${volume}\nEstimated Calories Burned: ${calories}`;
};

const buildHistoryDetailedText = (workout) => {
  const details = workout.exercisesDetailed;
  if (!Array.isArray(details) || !details.length) {
    return "Detailed sets not available for this older workout.";
  }
  return details
    .map((exercise) => {
      const sets = (exercise.sets || [])
        .map((set) => {
          const weight = set.weight ?? "—";
          const reps = set.reps ?? "—";
          return `${weight}x${reps}`;
        })
        .join(", ");
      return `${exercise.name}: ${sets || "—"}`;
    })
    .join("\n");
};

// DEV NOTES: Detailed history rendering uses exercisesDetailed when available.
const renderHistoryExercisesDetailed = (workout) => {
  const details = workout.exercisesDetailed;
  if (!Array.isArray(details) || !details.length) {
    return '<div class="muted">Detailed sets not available for this older workout.</div>';
  }
  return details
    .map((exercise) => {
      const rows = (exercise.sets || [])
        .map((set) => {
          const weight = set.weight ?? "—";
          const reps = set.reps ?? "—";
          return `
            <div class="set-table-row">
              <span>${set.setIndex}</span>
              <span>${weight}</span>
              <span>${reps}</span>
            </div>
          `;
        })
        .join("");
      return `
        <div class="history-detail-exercise">
          <strong>${exercise.name}</strong>
          <div class="set-table">
            <div class="set-table-row set-table-head">
              <span>Set</span>
              <span>Weight</span>
              <span>Reps</span>
            </div>
            ${rows || '<div class="muted">No sets recorded.</div>'}
          </div>
        </div>
      `;
    })
    .join("");
};

// DEV NOTES: Open in Lift loads a history workout into Lift (separate from History Edit).
const startWorkoutEdit = async (workout) => {
  const settings = await db.get(STORES.SETTINGS, "settings");
  const confirmEdit = confirm("Open in Lift? This can replace the current workout draft.");
  if (!confirmEdit) return;
  const hasDraft = state.workoutStart || settings?.currentWorkoutDraft;
  if (hasDraft) {
    showToast("Opening in Lift will replace the current draft.");
  }
  state.editingWorkoutId = workout.id;
  state.editingWorkout = workout;
  state.split = workout.split || state.split;
  state.day = workout.day || state.day;
  setEditModeLabel(true);
  await setView("lift");
  await renderWorkoutDay();
};

// DEV NOTES: History rendering filters by period and keeps grouping rules per mode.
// DEV NOTES: History load wraps IndexedDB reads to avoid crashing on storage failures.
const renderHistory = async () => {
  let workouts = [];
  try {
    workouts = await db.getAll(STORES.WORKOUTS);
    workouts = await normalizeWorkoutsWithLocalKeys(workouts);
  } catch (error) {
    handleStorageError(error);
    dom.historyList.innerHTML = "";
    return;
  }
  updateHistoryPeriodUI();
  updateHistoryCompare(workouts);
  const mode = state.historyPeriodMode || "week";
  const range = getHistoryRange();
  const inRange = workouts.filter((workout) => {
    const date = getWorkoutLocalDate(workout);
    return date && date >= range.startDate && date < range.endDateExclusive;
  });
  const sorted = inRange
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const visible = sorted.slice(0, state.historyLimit || 30);
  dom.historyList.innerHTML = "";

  if (!visible.length) {
    dom.historyList.innerHTML = '<div class="muted">No workouts yet.</div>';
    await updateHistoryCalories(workouts);
    return;
  }

  const groups = {};
  const groupDates = new Map();
  if (mode === "week") {
    const todayKey = getTodayKey();
    const yesterdayKey = getYesterdayKey();
    groups.Today = [];
    groups.Yesterday = [];
    groups.Older = [];
    visible.forEach((workout) => {
      const dateKey = getWorkoutDateKey(workout) || new Date(workout.date).toDateString();
      if (dateKey === todayKey) {
        groups.Today.push(workout);
      } else if (dateKey === yesterdayKey) {
        groups.Yesterday.push(workout);
      } else {
        groups.Older.push(workout);
      }
    });
  } else if (mode === "year") {
    visible.forEach((workout) => {
      const date = getWorkoutLocalDate(workout) || new Date(workout.date);
      const label = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      if (!groups[label]) groups[label] = [];
      groups[label].push(workout);
      if (!groupDates.has(label)) groupDates.set(label, new Date(date.getFullYear(), date.getMonth(), 1));
    });
  } else {
    visible.forEach((workout) => {
      const date = getWorkoutLocalDate(workout) || new Date(workout.date);
      const label = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (!groups[label]) groups[label] = [];
      groups[label].push(workout);
      if (!groupDates.has(label)) groupDates.set(label, date);
    });
  }

  const renderGroup = (label, items) => {
    if (!items.length) return;
    const groupEl = document.createElement("div");
    groupEl.className = "history-group";
    groupEl.innerHTML = `<div class="history-group-title">${label}</div>`;
    items.forEach((workout) => {
      const item = document.createElement("div");
      item.className = "history-item";
      const dateText = new Date(workout.date).toLocaleDateString();
      const durationMinutes = workout.durationMinutes ?? workout.duration ?? 0;
      const volume = Math.round(sanitizeVolumeKg(workout.totalVolumeKg ?? workout.totalVolume ?? 0));
      const caloriesValue = getWorkoutCalories(workout, { weightKg: state.calorieInputs?.weightKg });
      const caloriesText = Number.isFinite(caloriesValue) ? `${caloriesValue} kcal` : "--";
      const exercises = Array.isArray(workout.exercises)
        ? workout.exercises.map((exercise) => exercise?.name).filter(Boolean).join(", ")
        : "";
      item.innerHTML = `
        <div class="history-row">
          <button class="history-row-toggle" type="button" aria-expanded="false">
            <div class="history-row-main">
              <strong>${dateText}</strong>
              <span class="muted">${workout.day || "--"}  -  ${workout.split || "--"}</span>
            </div>
            <div class="history-row-metrics">
              <span>? ${durationMinutes}m</span>
              <span>?? ${caloriesText}</span>
              <span>?? ${volume} kg-reps</span>
            </div>
          </button>
          <button class="history-delete-icon-btn" type="button" aria-label="Delete workout">
            <svg viewBox="0 0 24 24" aria-hidden="true" class="history-delete-icon">
              <path
                d="M8 6V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1h4v2h-2l-1.2 12.2a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8L6 8H4V6h4zm2 0h4V5h-4v1zm0 5v7h2v-7h-2zm4 0v7h2v-7h-2z"
              />
            </svg>
          </button>
        </div>
        <div class="history-inline-details">
          <div class="history-inline-meta">
            <span>Duration: ${durationMinutes} min</span>
            <span>Sets: ${workout.totalSets ?? 0}</span>
            <span>Training volume (kg-reps): ${volume}</span>
            <span>Estimated Calories Burned: ${caloriesText}</span>
          </div>
          <div class="history-inline-exercises">${exercises || "No exercises recorded."}</div>
          <div class="history-inline-title">Workout Details</div>
          <div class="history-inline-details-list">
            ${renderHistoryExercisesDetailed(workout)}
          </div>
          <div class="history-inline-actions">
            <button class="chip history-edit" type="button">Edit</button>
            <button class="chip history-copy-detailed" type="button">Copy detailed</button>
          </div>
        </div>
      `;
      const toggle = item.querySelector(".history-row-toggle");
      toggle.addEventListener("click", () => {
        const expanded = item.classList.toggle("expanded");
        toggle.setAttribute("aria-expanded", expanded);
      });
      item.querySelector(".history-edit").addEventListener("click", (event) => {
        // DEV NOTES: History Edit is isolated; never routes to Lift.
        event.stopPropagation();
        state.historyEditGuard = true;
        void editWorkoutEntry(workout);
      });
      item.querySelector(".history-copy-detailed").addEventListener("click", (event) => {
        event.stopPropagation();
        const detailed = buildHistoryDetailedText(workout);
        void (async () => {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(detailed);
          } else {
            const helper = document.createElement("textarea");
            helper.value = detailed;
            document.body.appendChild(helper);
            helper.select();
            document.execCommand("copy");
            helper.remove();
          }
          showToast("Detailed copy saved.");
        })();
      });
      item.querySelector(".history-delete-icon-btn").addEventListener("click", (event) => {
        event.stopPropagation();
        void deleteWorkoutEntry(workout);
      });
      groupEl.appendChild(item);
    });
    dom.historyList.appendChild(groupEl);
  };

  if (mode === "week") {
    renderGroup("Today", groups.Today);
    renderGroup("Yesterday", groups.Yesterday);
    renderGroup("Older", groups.Older);
  } else {
    Array.from(groupDates.entries())
      .sort((a, b) => b[1].getTime() - a[1].getTime())
      .forEach(([label]) => renderGroup(label, groups[label]));
  }

  if (sorted.length > visible.length) {
    const loadMore = document.createElement("button");
    loadMore.className = "secondary history-load-more";
    loadMore.type = "button";
    loadMore.textContent = "Load more";
    loadMore.addEventListener("click", () => {
      state.historyLimit += 30;
      void renderHistory();
    });
    dom.historyList.appendChild(loadMore);
  }

  await updateHistoryCalories(workouts);
};

const renderTimeline = async () => {
  const items = await db.getAll(STORES.TIMELINE);
  dom.timelineGrid.innerHTML = "";
  items.slice().reverse().forEach((item) => {
    const card = document.createElement("div");
    card.className = "timeline-item";
    const url = item.photo ? URL.createObjectURL(item.photo) : "";
    card.innerHTML = `
      ${item.photo ? `<img src="${url}" alt="Workout" />` : ""}
      <strong>${new Date(item.date).toLocaleDateString()}</strong>
      <span class="muted">${item.note || ""}</span>
      <button class="chip" data-id="${item.id}">Delete</button>
    `;
    card.querySelector("button").addEventListener("click", async () => {
      await db.delete(STORES.TIMELINE, item.id);
      if (url) URL.revokeObjectURL(url);
      renderTimeline();
    });
    dom.timelineGrid.appendChild(card);
  });
};

const addTimelineEntry = async () => {
  const file = dom.timelinePhoto.files[0];
  const note = dom.timelineNote.value.trim();
  if (!file && !note) {
    showToast("Add a photo or note.");
    return;
  }
  const entry = {
    id: `t_${Date.now()}`,
    date: new Date().toISOString(),
    note,
    photo: file || null,
  };
  await db.set(STORES.TIMELINE, entry);
  dom.timelinePhoto.value = "";
  dom.timelineNote.value = "";
  showToast("Timeline updated.");
  renderTimeline();
};

const setupExerciseModal = async () => {
  const exercises = await getPlanExercises();
  const options = [...new Set([...state.recentExercises, ...defaultExerciseLibrary])];
  const filter = dom.exerciseSearch.value.toLowerCase();
  dom.exerciseOptions.innerHTML = "";
  options
    .filter((name) => name.toLowerCase().includes(filter))
    .forEach((name) => {
      const option = document.createElement("div");
      option.className = "exercise-option";
      option.textContent = name;
      option.addEventListener("click", () => {
        dom.customExercise.value = name;
      });
      dom.exerciseOptions.appendChild(option);
    });
  dom.exerciseAddBtn.onclick = async () => {
    const newExercise = dom.customExercise.value.trim();
    if (!newExercise) return;
    const updated = [...exercises, { name: newExercise, defaultSets: DEFAULT_SET_COUNT }];
    await savePlanExercises(updated);
    state.recentExercises = [newExercise, ...state.recentExercises.filter((e) => e !== newExercise)].slice(0, 6);
    const settings = await db.get(STORES.SETTINGS, "settings");
    await db.set(STORES.SETTINGS, { ...settings, key: "settings", recentExercises: state.recentExercises });
    dom.exerciseModal.classList.remove("open");
    dom.customExercise.value = "";
    dom.exerciseSearch.value = "";
    await renderWorkoutDay();
    void updateWorkoutDraft();
  };
};

const registerServiceWorker = () => {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("service-worker.js").then((registration) => {
    swRegistration = registration;
    const showUpdateModal = () => {
      dom.updateModal?.classList.add("open");
    };
    if (registration.waiting) {
      showUpdateModal();
    }
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          showUpdateModal();
        }
      });
    });
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!swUpdatePending) return;
    swUpdatePending = false;
    dom.updateModal?.classList.remove("open");
    window.location.reload();
  });
};

const syncCacheVersion = () => {
  if (dom.cacheVersion) {
    dom.cacheVersion.textContent = APP_CACHE_VERSION;
  }
  if (!navigator.serviceWorker?.controller) return;
  navigator.serviceWorker.controller.postMessage({ type: "GET_VERSION" });
};

const setupNav = () => {
  dom.navLinks.forEach((link) => {
    if (link.id === "planTodayBtn") return;
    link.addEventListener("click", () => setView(link.dataset.view));
  });
};

// DEV NOTES: Plate calculator now formats per-side output and persists bar weight.
const setupTools = () => {
  let lastPlateSummary = "";

  const getCalorieInputs = () => ({
    weightKg: dom.bmiWeight.value || dom.coachWeight.value || state.calorieInputs?.weightKg,
    heightCm: dom.bmiHeight.value || state.calorieInputs?.heightCm,
    age: dom.bmiAge.value || state.calorieInputs?.age,
    sex: dom.bmiSex?.value || state.calorieInputs?.sex || "male",
    activityFactor: Number(dom.bmiActivity?.value) || state.calorieInputs?.activityFactor || 1.55,
    goal: dom.bmiGoal.value || dom.coachGoal.value || state.calorieInputs?.goal || "Maintain",
  });

  dom.rmCalcBtn.addEventListener("click", () => {
    const weight = Number(dom.rmWeight.value);
    const reps = Number(dom.rmReps.value);
    if (!weight || !reps) {
      dom.rmResult.textContent = "Enter weight and reps.";
      return;
    }
    if (reps < 1 || reps > 12) {
      dom.rmResult.textContent = "Reps must be 1-12.";
      return;
    }
    const oneRm = weight * (1 + reps / 30);
    const low = oneRm * 0.98;
    const high = oneRm * 1.02;
    dom.rmResult.textContent = `1RM (Epley): ${oneRm.toFixed(
      1
    )} kg (range ${low.toFixed(1)}-${high.toFixed(1)} kg)`;
  });

  dom.bmiCalcBtn.addEventListener("click", () => {
    const { sex, age, heightCm, weightKg, activityFactor, goal } = getCalorieInputs();
    const { bmi, maintenanceCalories, goalCalories, goal: normalizedGoal } =
      calculateDailyCalories({ sex, age, heightCm, weightKg, activityFactor, goal });
    if (!Number.isFinite(bmi)) {
      dom.bmiResult.textContent = "Enter weight, height, and age.";
      return;
    }
    const maintenance = maintenanceCalories ?? 0;
    dom.bmiResult.textContent = `BMI: ${bmi.toFixed(
      1
    )} | Maintenance: ${maintenance} kcal | Goal (${normalizedGoal}): ${goalCalories} kcal`;
  });

  const renderPlateBreakdown = (target, barWeight) => {
    if (!target || target <= barWeight) {
      dom.plateResult.textContent = `Enter target > ${barWeight}kg.`;
      lastPlateSummary = "";
      return;
    }
    const plates = [20, 15, 10, 5, 2.5, 1.25];
    const perSideTarget = (target - barWeight) / 2;
    let remaining = perSideTarget;
    const breakdown = [];
    plates.forEach((plate) => {
      const count = Math.floor((remaining + 1e-6) / plate);
      if (count > 0) {
        breakdown.push({ plate, count });
        remaining -= count * plate;
      }
    });
    const roundedRemaining = Math.round(remaining * 100) / 100;
    const achievedPerSide = Math.round((perSideTarget - roundedRemaining) * 100) / 100;
    const achievedTotal = Math.round((barWeight + achievedPerSide * 2) * 100) / 100;
    const plateText = breakdown.length
      ? breakdown.map((item) => `${item.plate}kg × ${item.count}`).join(", ")
      : "none";
    const closest =
      roundedRemaining > 0
        ? `<br><span class="muted">Closest possible: ${achievedTotal} kg (off by ${Math.round(
            (target - achievedTotal) * 100
          ) / 100} kg)</span>`
        : "";
    dom.plateResult.innerHTML = `Per side (excluding bar): ${achievedPerSide} kg<br>Per side plates: ${plateText}<br>Total: ${achievedTotal} kg (incl. ${barWeight}kg bar)${closest}`;
    lastPlateSummary = `Per side (excluding bar): ${achievedPerSide} kg\nPer side plates: ${plateText}\nTotal: ${achievedTotal} kg (incl. ${barWeight}kg bar)`;
  };

  dom.plateCalcBtn.addEventListener("click", () => {
    const target = Number(dom.plateTarget.value);
    const barWeight = Number(dom.plateBar?.value) || 20;
    renderPlateBreakdown(target, barWeight);
  });

  dom.plateCopyBtn?.addEventListener("click", async () => {
    if (!lastPlateSummary) {
      showToast("Compute plates first.");
      return;
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(lastPlateSummary);
    } else {
      const helper = document.createElement("textarea");
      helper.value = lastPlateSummary;
      document.body.appendChild(helper);
      helper.select();
      document.execCommand("copy");
      helper.remove();
    }
    showToast("Plate setup copied.");
  });

  dom.coachBtn.addEventListener("click", () => {
    const { sex, age, heightCm, weightKg, activityFactor, goal } = getCalorieInputs();
    const { bmi, maintenanceCalories, goalCalories, goal: normalizedGoal } =
      calculateDailyCalories({ sex, age, heightCm, weightKg, activityFactor, goal });
    if (!Number.isFinite(bmi)) {
      dom.coachResult.textContent = "Enter weight, height, and age in the BMI tool.";
      return;
    }
    const diet = dom.coachDiet.value;
    const calories = goalCalories ?? 0;
    const weightValue = parseInputNumber(weightKg) || 0;
    const protein = Math.round(weightValue * 2);
    dom.coachResult.textContent = `BMI: ${bmi.toFixed(
      1
    )} | Maintenance: ${maintenanceCalories} kcal | Goal (${normalizedGoal}): ${calories} kcal  -  ${diet}  -  ${protein}g protein`;
  });

  const debouncedPersist = debounce((updates) => {
    void persistCalorieInputs(updates);
  }, 350);

  const syncWeightAndGoal = () => {
    dom.coachWeight.value = dom.bmiWeight.value;
    dom.coachGoal.value = dom.bmiGoal.value;
  };

  dom.bmiWeight.addEventListener("input", () => {
    syncWeightAndGoal();
    debouncedPersist({ weightKg: dom.bmiWeight.value });
  });
  dom.bmiHeight.addEventListener("input", () => {
    debouncedPersist({ heightCm: dom.bmiHeight.value });
  });
  dom.bmiAge.addEventListener("input", () => {
    debouncedPersist({ age: dom.bmiAge.value });
  });
  dom.bmiSex.addEventListener("change", () => {
    debouncedPersist({ sex: dom.bmiSex.value });
  });
  dom.bmiActivity.addEventListener("change", () => {
    debouncedPersist({ activityFactor: Number(dom.bmiActivity.value) || 1.55 });
  });
  dom.bmiGoal.addEventListener("change", () => {
    syncWeightAndGoal();
    debouncedPersist({ goal: dom.bmiGoal.value });
  });

  dom.plateBar?.addEventListener("change", async () => {
    const value = Number(dom.plateBar.value) || 20;
    const settings = await db.get(STORES.SETTINGS, "settings");
    await db.set(STORES.SETTINGS, { ...settings, key: "settings", plateBar: value });
  });

  dom.coachWeight.addEventListener("input", () => {
    dom.bmiWeight.value = dom.coachWeight.value;
    debouncedPersist({ weightKg: dom.coachWeight.value });
  });
  dom.coachGoal.addEventListener("change", () => {
    dom.bmiGoal.value = dom.coachGoal.value;
    debouncedPersist({ goal: dom.coachGoal.value });
  });
};

const setupSettings = () => {
  dom.profileSaveBtn.addEventListener("click", async () => {
    const profile = (await db.get(STORES.PROFILE, "profile")) || {
      key: "profile",
      totalXp: 0,
      level: 1,
    };
    await db.set(STORES.PROFILE, { ...profile, key: "profile", username: dom.profileName.value.trim() });
    showToast("Profile saved.");
  });

  dom.restSaveBtn.addEventListener("click", async () => {
    const value = Number(dom.restDuration.value);
    if (!value) return;
    state.restDuration = value;
    const settings = await db.get(STORES.SETTINGS, "settings");
    await db.set(STORES.SETTINGS, { ...settings, key: "settings", restDuration: value });
    showToast("Rest timer saved.");
  });

  document.querySelectorAll("[data-rest]").forEach((button) => {
    button.addEventListener("click", async () => {
      const value = Number(button.dataset.rest);
      state.restDuration = value;
      dom.restDuration.value = value;
      const settings = await db.get(STORES.SETTINGS, "settings");
      await db.set(STORES.SETTINGS, { ...settings, key: "settings", restDuration: value });
      showToast("Rest timer updated.");
    });
  });

  dom.weeklyGoal?.addEventListener("change", async () => {
    const value = Number(dom.weeklyGoal.value);
    if (!Number.isFinite(value) || value <= 0) return;
    const settings = await db.get(STORES.SETTINGS, "settings");
    await db.set(STORES.SETTINGS, { ...settings, key: "settings", weeklyGoal: value });
    const workouts = await db.getAll(STORES.WORKOUTS);
    await updateWeeklyStats(workouts);
  });

  dom.exportBtn.addEventListener("click", async () => {
    const payload = {
      settings: await db.get(STORES.SETTINGS, "settings"),
      profile: await db.get(STORES.PROFILE, "profile"),
      exercises: await db.getAll(STORES.EXERCISES),
      plans: await db.getAll(STORES.PLANS),
      workouts: await db.getAll(STORES.WORKOUTS),
      timeline: await Promise.all(
        (await db.getAll(STORES.TIMELINE)).map(async (entry) => ({
          ...entry,
          photo: entry.photo ? await blobToDataUrl(entry.photo) : null,
        }))
      ),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ironai-backup.json";
    link.click();
    URL.revokeObjectURL(url);
  });

  dom.importBtn.addEventListener("click", async () => {
    const file = dom.importFile.files[0];
    if (!file) return;
    const text = await file.text();
    const payload = JSON.parse(text);
    await db.set(STORES.SETTINGS, { ...payload.settings, key: "settings" });
    await db.set(STORES.PROFILE, { ...payload.profile, key: "profile" });
    for (const exercise of payload.exercises || []) {
      await db.set(STORES.EXERCISES, exercise);
    }
    for (const plan of payload.plans || []) {
      await db.set(STORES.PLANS, plan);
    }
    for (const workout of payload.workouts || []) {
      await db.set(STORES.WORKOUTS, workout);
    }
    for (const entry of payload.timeline || []) {
      const photo = entry.photo ? dataUrlToBlob(entry.photo) : null;
      await db.set(STORES.TIMELINE, { ...entry, photo });
    }
    showToast("Backup restored.");
    await bootstrap();
  });

  dom.resetBtn.addEventListener("click", async () => {
    const userConfirmedReset = confirm("Delete all local data?");
    if (!userConfirmedReset) return;
    await db.clear(STORES.SETTINGS);
    await db.clear(STORES.PROFILE);
    await db.clear(STORES.EXERCISES);
    await db.clear(STORES.PLANS);
    await db.clear(STORES.WORKOUTS, { userConfirmedReset });
    await db.clear(STORES.TIMELINE);
    showToast("Data reset.");
    await bootstrap();
  });
};

const blobToDataUrl = (blob) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });

const dataUrlToBlob = (dataUrl) => {
  const [meta, content] = dataUrl.split(",");
  const mime = meta.match(/:(.*?);/)[1];
  const binary = atob(content);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
};

const bootstrap = async () => {
  await db.init();
  await migrateWorkouts();
  const settings = (await db.get(STORES.SETTINGS, "settings")) || {
    key: "settings",
    split: "Push / Pull / Legs",
    restDuration: DEFAULT_REST,
    lastView: "dashboard",
    currentWorkout: null,
    currentWorkoutDraft: null,
    recentExercises: [],
    workoutIntensity: "3.5",
    weeklyGoal: 4,
    workoutStreak: 0,
    plateBar: 20,
    historyPeriodMode: "week",
    historyAnchorISO: null,
    editWorkoutDraft: null,
    calorieInputs: {
      sex: "male",
      age: "",
      heightCm: "",
      weightKg: "",
      activityFactor: 1.55,
      goal: "Maintain",
    },
  };
  if (!splitTemplates[settings.split]) {
    settings.split = "Push / Pull / Legs";
  }
  if (!settings.calorieInputs) {
    settings.calorieInputs = {
      sex: "male",
      age: "",
      heightCm: "",
      weightKg: "",
      activityFactor: 1.55,
      goal: "Maintain",
    };
  }
  if (!settings.calorieInputs.activityFactor) {
    settings.calorieInputs.activityFactor = 1.55;
  }
  if (!settings.workoutIntensity) {
    settings.workoutIntensity = "3.5";
  }
  if (!settings.plateBar) {
    settings.plateBar = 20;
  }
  if (!settings.historyPeriodMode) {
    settings.historyPeriodMode = "week";
  }
  if (!settings.historyAnchorISO) {
    settings.historyAnchorISO = null;
  }
  if (!settings.editWorkoutDraft) {
    settings.editWorkoutDraft = null;
  }
  if (!settings.weeklyGoal) {
    settings.weeklyGoal = 4;
  }
  if (!Number.isFinite(Number(settings.workoutStreak))) {
    settings.workoutStreak = 0;
  }
  const draft = settings.currentWorkoutDraft;
  const todayKey = getTodayKey();
  const draftDayKey = draft?.dayKey || draft?.dateKey;
  const hasDraftToday = draft && draftDayKey === todayKey;
  if (draft && !hasDraftToday) {
    settings.currentWorkoutDraft = null;
  }
  await db.set(STORES.SETTINGS, settings);
  state.split = hasDraftToday ? draft.split || settings.split : settings.split;
  state.restDuration = settings.restDuration || DEFAULT_REST;
  state.recentExercises = settings.recentExercises || [];
  state.workoutStart = null;
  state.calorieInputs = settings.calorieInputs || {};
  state.historyPeriodMode = settings.historyPeriodMode || "week";
  state.historyAnchorDate = settings.historyAnchorISO
    ? new Date(settings.historyAnchorISO)
    : new Date();
  if (Number.isNaN(state.historyAnchorDate.getTime())) {
    state.historyAnchorDate = new Date();
  }
  if (hasDraftToday && draft?.day) {
    state.day = draft.day;
  } else if (settings.currentWorkout?.day) {
    state.day = settings.currentWorkout.day;
  }
  console.log("[workout] load currentWorkout", settings.currentWorkout);
  syncCacheVersion();

  const profile = (await db.get(STORES.PROFILE, "profile")) || {
    key: "profile",
    username: "",
    totalXp: 0,
    level: 1,
  };
  await db.set(STORES.PROFILE, profile);

  dom.profileName.value = profile.username || "";
  dom.restDuration.value = state.restDuration;
  dom.splitSelect.value = state.split;
  if (dom.workoutIntensity) {
    dom.workoutIntensity.value = settings.workoutIntensity || "3.5";
  }
  if (settings.calorieInputs) {
    dom.bmiWeight.value = settings.calorieInputs.weightKg ?? "";
    dom.bmiHeight.value = settings.calorieInputs.heightCm ?? "";
    dom.bmiAge.value = settings.calorieInputs.age ?? "";
    dom.bmiSex.value = settings.calorieInputs.sex || "male";
    dom.bmiActivity.value = String(settings.calorieInputs.activityFactor ?? 1.55);
    dom.bmiGoal.value = settings.calorieInputs.goal || "Maintain";
    dom.coachWeight.value = settings.calorieInputs.weightKg ?? "";
    dom.coachGoal.value = settings.calorieInputs.goal || "Maintain";
  }
  if (dom.plateBar) {
    dom.plateBar.value = String(settings.plateBar ?? 20);
  }
  if (dom.weeklyGoal) {
    dom.weeklyGoal.value = settings.weeklyGoal ?? 4;
  }

  createDayTabs();
  await renderWorkoutDay();
  await refreshDashboard();
  await renderHistory();
  await renderTimeline();

  if (settings.lastView) {
    setView(settings.lastView);
  }

  state.awaitingResume = false;
  state.pendingElapsedMs = 0;
  updateWorkoutTimer();
  dom.resumeModal?.classList.remove("open");
  await handleDraftOnReturn();
};

dom.splitSelect.addEventListener("change", async (event) => {
  state.split = event.target.value;
  const settings = await db.get(STORES.SETTINGS, "settings");
  await db.set(STORES.SETTINGS, { ...settings, key: "settings", split: state.split });
  renderWorkoutDay();
});

dom.planTodayBtn?.addEventListener("click", async () => {
  await setView("lift");
  await renderWorkoutDay();
  const splitMeta = await getTodaySplitMeta();
  console.debug("[plan] applied", { day: state.day, split: state.split, splitName: splitMeta.title });
  await startWorkoutSession("plan_today");
});

dom.startWorkoutBtn.addEventListener("click", async () => {
  await setView("lift");
  await renderWorkoutDay();
  await startWorkoutSession("start_workout");
});

dom.finishWorkoutBtn.addEventListener("click", finishWorkout);
dom.finishSaveBtn?.addEventListener("click", savePendingWorkout);
dom.finishEditBtn?.addEventListener("click", closeFinishModal);

dom.addExerciseBtn.addEventListener("click", () => {
  dom.exerciseModal.classList.add("open");
  setupExerciseModal();
});

dom.exerciseCancelBtn.addEventListener("click", () => {
  dom.exerciseModal.classList.remove("open");
});

dom.exerciseSearch.addEventListener("input", setupExerciseModal);

dom.exerciseList.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const card = target.closest(".exercise-card");
  if (!card) return;
  if (target.classList.contains("exercise-notes")) {
    target.dataset.dirty = "true";
    scheduleDraftSave();
    return;
  }
  if (target.classList.contains("set-weight")) {
    target.dataset.dirty = "true";
    const lastWeight = Number(card.dataset.lastWeight) || 0;
    target.classList.toggle("improve", Number(target.value) > lastWeight);
    validateSetInput(
      target,
      SET_INPUT_LIMITS.weightMin,
      SET_INPUT_LIMITS.weightMax,
      "Weight"
    );
    scheduleDraftSave();
    return;
  }
  if (target.classList.contains("set-reps")) {
    target.dataset.dirty = "true";
    const lastReps = Number(card.dataset.lastReps) || 0;
    target.classList.toggle("improve", Number(target.value) > lastReps);
    validateSetInput(
      target,
      SET_INPUT_LIMITS.repsMin,
      SET_INPUT_LIMITS.repsMax,
      "Reps"
    );
    scheduleDraftSave();
  }
});

dom.weeklyPatternBtn?.addEventListener("click", () => {
  void renderWeeklyPattern();
});

dom.restMinus.addEventListener("click", () => {
  state.restRemaining = Math.max(0, state.restRemaining - 10);
  dom.restTime.textContent = state.restRemaining;
});

dom.restPlus.addEventListener("click", () => {
  state.restRemaining += 10;
  dom.restTime.textContent = state.restRemaining;
});

dom.restStop.addEventListener("click", stopRestTimer);

dom.timelineAddBtn.addEventListener("click", addTimelineEntry);

dom.workoutIntensity?.addEventListener("change", async () => {
  const settings = await db.get(STORES.SETTINGS, "settings");
  await db.set(STORES.SETTINGS, {
    ...settings,
    key: "settings",
    workoutIntensity: dom.workoutIntensity.value,
  });
});

dom.shareBtn.addEventListener("click", async () => {
  if (navigator.share) {
    await navigator.share({
      title: "IronAI Fitness",
      text: "Offline-first personal gym tracker.",
      url: location.href,
    });
  } else {
    showToast("Share not supported.");
  }
});

dom.resumeContinueBtn?.addEventListener("click", resumeWorkout);

dom.resumeDiscardBtn?.addEventListener("click", async () => {
  const confirmDiscard = confirm("Discard current workout draft?");
  if (!confirmDiscard) return;
  await resetWorkout();
});

dom.updateBtn.addEventListener("click", () => {
  if (swRegistration?.waiting) {
    swUpdatePending = true;
    swRegistration.waiting.postMessage({ type: "SKIP_WAITING" });
    return;
  }
  window.location.reload();
});

dom.historyDetailModal?.addEventListener("click", (event) => {
  if (event.target === dom.historyDetailModal) {
    closeHistoryDetail();
  }
});

const persistHistoryPeriod = async () => {
  try {
    const settings = await db.get(STORES.SETTINGS, "settings");
    await db.set(STORES.SETTINGS, {
      ...settings,
      key: "settings",
      historyPeriodMode: state.historyPeriodMode,
      historyAnchorISO: state.historyAnchorDate?.toISOString(),
    });
  } catch (error) {
    handleStorageError(error);
  }
};

const setHistoryPeriodMode = async (mode) => {
  state.historyPeriodMode = mode;
  state.historyAnchorDate = new Date();
  await persistHistoryPeriod();
  await renderHistory();
};

dom.historyPeriodWeek?.addEventListener("click", async () => {
  await setHistoryPeriodMode("week");
});
dom.historyPeriodMonth?.addEventListener("click", async () => {
  await setHistoryPeriodMode("month");
});
dom.historyPeriodYear?.addEventListener("click", async () => {
  await setHistoryPeriodMode("year");
});

dom.historyPrevBtn?.addEventListener("click", async () => {
  state.historyAnchorDate = shiftAnchor(state.historyPeriodMode, state.historyAnchorDate, -1);
  await persistHistoryPeriod();
  await renderHistory();
});

dom.historyNextBtn?.addEventListener("click", async () => {
  if (dom.historyNextBtn.disabled) return;
  state.historyAnchorDate = shiftAnchor(state.historyPeriodMode, state.historyAnchorDate, 1);
  await persistHistoryPeriod();
  await renderHistory();
});

dom.finishModal?.addEventListener("click", (event) => {
  if (event.target === dom.finishModal) {
    closeFinishModal();
  }
});

window.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    void pauseWorkoutForBackground();
    if (state.restTimerId) {
      clearInterval(state.restTimerId);
      state.restTimerId = null;
      state.restDueAt = Date.now() + state.restRemaining * 1000;
      state.restTimeoutId = setTimeout(() => {
        state.restRemaining = 0;
        dom.restTimer.classList.remove("active");
        state.restDueAt = null;
        state.restTimeoutId = null;
        playAlarm();
      }, Math.max(0, state.restRemaining * 1000));
    }
  } else {
    updateWorkoutTimer();
    void handleDraftOnReturn();
    if (state.restDueAt) {
      const remaining = Math.max(0, Math.ceil((state.restDueAt - Date.now()) / 1000));
      state.restRemaining = remaining;
      dom.restTime.textContent = state.restRemaining;
      if (remaining > 0) {
        dom.restTimer.classList.add("active");
        startRestTimer(remaining);
      } else {
        dom.restTimer.classList.remove("active");
      }
      state.restDueAt = null;
      clearTimeout(state.restTimeoutId);
      state.restTimeoutId = null;
    }
  }
});

window.addEventListener("pagehide", () => {
  void pauseWorkoutForBackground();
});

window.addEventListener("online", updateOfflineStatus);
window.addEventListener("offline", updateOfflineStatus);
navigator.serviceWorker?.addEventListener("message", (event) => {
  if (event.data?.type === "CACHE_VERSION" && dom.cacheVersion) {
    dom.cacheVersion.textContent = event.data.version;
  }
});

setupNav();
setupTools();
setupSettings();
updateOfflineStatus();
registerServiceWorker();
bootstrap();

// Manual test checklist:
// - Enter 2 sets, refresh, only those 2 remain while other sets stay blank.
// - Close/reopen, draft restores with exact values and blanks intact.
// - Finish workout, history saves and draft clears.
// - Refresh, workout history still present.
// - Click Finish Workout, review summary modal before saving.
// - Continue Editing closes modal without saving.
// - Save Workout blocks 0 completed sets unless confirmed.
// - History groups by Today/Yesterday/Older with inline expand + copy summary.
// - Load more reveals additional history entries.
// - Weekly goal shows This week X/4 and streak updates from history.
// - Plate calculator shows per-side breakdown with copy and bar toggle.
// - Weekly pattern button renders last-7-days pattern, under-training, WoW volume, and goal reminder.
// - Save workout shows kcal in history and Today burn (0/--/sum rules).
// - Refresh keeps history + draft; timer resume does not double-run.
// - History period controls filter list and compare metrics (week/month/year).
// - Set body weight -> finish workout -> calories show in modal, history, Today burn.
// - No body weight -> calories show "--" everywhere with hint.
// - Enter insane reps/weight -> validation prevents crazy totals.
// - Refresh app -> history remains, no errors.
// - Start workout draft, then History -> Edit stays in History modal and draft unchanged.
// - Save History edit updates entry + dashboard without duplicating and keeps draft intact.
// - History Edit never routes to Lift and shows toast if blocked.
// - Minimize/close with active draft stops timer + saves draft immediately.
// - Return same day shows Resume/Discard prompt and timer stays paused.
// - Resume adds away time capped at 60 minutes when timer was running.
// - Discard clears draft, resets timer, and keeps history intact.
