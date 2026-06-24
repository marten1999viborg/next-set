document.addEventListener("gesturestart", function(event){ event.preventDefault(); }, { passive: false });
document.addEventListener("gesturechange", function(event){ event.preventDefault(); }, { passive: false });
document.addEventListener("gestureend", function(event){ event.preventDefault(); }, { passive: false });
let lastTouchEnd = 0;
document.addEventListener("touchend", function(event){
  const now = Date.now();
  if (now - lastTouchEnd <= 300) event.preventDefault();
  lastTouchEnd = now;
}, { passive: false });

const STORAGE_KEY = "next-set-v1";
function uid(){
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}
function safeNumber(value, fallback = 0){
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
const sampleData = {
  activeTab: "home",
  currentWorkout: null,
  programs: [{
    id: uid(),
    name: "Push / Pull / Legs",
    days: [
      { id: uid(), name: "Push", exercises: [
        { id: uid(), name: "Bench Press", sets: 3, minReps: 6, maxReps: 8, weight: 80, increment: 2.5, notes: "Controlled eccentric" },
        { id: uid(), name: "Incline DB Press", sets: 3, minReps: 8, maxReps: 10, weight: 30, increment: 2.5, notes: "" },
        { id: uid(), name: "Lateral Raises", sets: 3, minReps: 10, maxReps: 15, weight: 12, increment: 1, notes: "" }
      ]},
      { id: uid(), name: "Pull", exercises: [
        { id: uid(), name: "Lat Pulldown", sets: 3, minReps: 8, maxReps: 10, weight: 70, increment: 2.5, notes: "" },
        { id: uid(), name: "Seated Row", sets: 3, minReps: 8, maxReps: 10, weight: 65, increment: 2.5, notes: "" }
      ]},
      { id: uid(), name: "Legs", exercises: [
        { id: uid(), name: "Squat", sets: 3, minReps: 5, maxReps: 8, weight: 100, increment: 5, notes: "" },
        { id: uid(), name: "Romanian Deadlift", sets: 3, minReps: 8, maxReps: 10, weight: 90, increment: 5, notes: "" }
      ]}
    ]
  }],
  workouts: []
};
let state = load();
function load(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : sampleData;
  } catch (error) {
    console.warn("Next Set reset local data after a load error", error);
    localStorage.removeItem(STORAGE_KEY);
    return sampleData;
  }
}
function save(){
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (error) { console.warn("Next Set could not save locally", error); }
}
function qs(id){ return document.getElementById(id); }
function volume(workout){
  if(!workout) return 0;
  return workout.exercises.flatMap(e => e.loggedSets || []).reduce((sum,s) => sum + (Number(s.weight)||0) * (Number(s.reps)||0), 0);
}
function lastWorkout(){ return state.workouts[state.workouts.length - 1]; }
function weekWorkouts(){
  const seven = Date.now() - 7*24*60*60*1000;
  return state.workouts.filter(w => new Date(w.finishedAt).getTime() >= seven);
}
function lastExerciseSets(exerciseName){
  for(let i=state.workouts.length-1;i>=0;i--){
    const ex = state.workouts[i].exercises.find(e => e.name === exerciseName);
    if(ex) return ex.loggedSets;
  }
  return null;
}
function recommendation(ex){
  const sets = lastExerciseSets(ex.name);
  if(!sets) return { weight: ex.weight, text: `${ex.weight} kg x ${ex.minReps}-${ex.maxReps}`, reason: "Start target" };
  const allTop = sets.length >= Number(ex.sets) && sets.every(s => Number(s.reps) >= Number(ex.maxReps));
  const nextWeight = allTop ? Number(ex.weight) + Number(ex.increment) : Number(sets[0]?.weight || ex.weight);
  return {
    weight: nextWeight,
    text: `${nextWeight} kg x ${ex.minReps}-${ex.maxReps}`,
    reason: allTop ? "Progress. You hit the top of the range." : "Hold. Beat last time."
  };
}
function setTab(tab){ state.activeTab = tab; save(); try {
  render();
} catch (error) {
  console.error("Next Set render error", error);
  const app = document.getElementById("app");
  if (app) {
    app.innerHTML = `<div class="card wide" style="margin-top:24px"><h1>Next Set</h1><p class="sub">Appen kunne ikke indlæse korrekt. Prøv at opdatere siden eller ryd browserdata for dette site.</p><button class="btn" onclick="localStorage.removeItem('next-set-v1'); location.reload();">Reset app</button></div>`;
  }
} }
function activeProgram(){ return state.programs[0]; }
function render(){
  const app = qs("app");
  const screen = state.currentWorkout ? workoutScreen() : ({home: homeScreen, program: programScreen, progress: progressScreen}[state.activeTab] || homeScreen)();
  app.innerHTML = `<div class="fade-in">${screen}</div>${nav()}`;
}
function nav(){
  if(state.currentWorkout) return "";
  return `<nav class="nav">
    <button class="${state.activeTab==='home'?'active':''}" onclick="setTab('home')">Home</button>
    <button class="${state.activeTab==='program'?'active':''}" onclick="setTab('program')">Program</button>
    <button class="${state.activeTab==='progress'?'active':''}" onclick="setTab('progress')">Progress</button>
  </nav>`;
}
function programExercises(){
  const p = activeProgram();
  return (p?.days || []).flatMap(day => (day.exercises || []).map(ex => ({ ...ex, dayName: day.name, dayId: day.id })));
}
function nextTrainingDay(){
  const p = activeProgram();
  const daysWithExercises = (p?.days || []).filter(day => (day.exercises || []).length > 0);
  if (!daysWithExercises.length) return null;
  return daysWithExercises[weekWorkouts().length % daysWithExercises.length];
}
function emptyProgramCard(){
  return `<div class="card wide empty-state"><div class="label">Next workout</div><h2>Build your program</h2><p class="sub">Add at least one exercise before you start logging workouts.</p><button class="btn" onclick="setTab('program')">Add exercise</button></div>`;
}

function heroProgressGraph(){
  const names = [...new Set(programExercises().map(e => e.name))];
  let history = [];
  for (const name of names) {
    const h = exerciseHistory(name);
    if (h.length > history.length) history = h;
  }
  const values = history.length >= 2
    ? history.slice(-5).map(h => h.estimatedOneRepMax)
    : [72, 75, 79, 82, 86];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const width = 190;
  const height = 150;
  const padX = 14;
  const padY = 22;
  const step = (width - padX * 2) / Math.max(1, values.length - 1);
  const points = values.map((v, i) => {
    const x = padX + i * step;
    const y = height - padY - ((v - min) / range) * (height - padY * 2);
    return { x, y, v };
  });
  const line = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${padX},${height-padY} ${line} ${width-padX},${height-padY}`;
  return `<div class="hero-graph" aria-hidden="true"><svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
    <circle class="hero-orb" cx="128" cy="62" r="60"></circle>
    <line class="hero-grid" x1="10" y1="42" x2="180" y2="42"></line>
    <line class="hero-grid" x1="10" y1="84" x2="180" y2="84"></line>
    <line class="hero-grid" x1="10" y1="126" x2="180" y2="126"></line>
    <polygon class="hero-area" points="${area}"></polygon>
    <polyline class="hero-line" points="${line}"></polyline>
    ${points.map(p => `<circle class="hero-dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5"></circle>`).join('')}
  </svg></div>`;
}

function homeScreen(){
  const lw = lastWorkout();
  const week = weekWorkouts();
  const total = week.reduce((s,w)=>s+volume(w),0);
  const nextDay = nextTrainingDay();
  const firstEx = nextDay ? nextDay.exercises[0] : null;
  const rec = firstEx ? recommendation(firstEx) : null;
  const nextWorkoutCard = nextDay
    ? `<div class="card wide list-card"><div><div class="label">Next workout</div><h2>${nextDay.name}</h2><p class="sub">${nextDay.exercises.length} exercises ready</p></div><button class="btn" onclick="openDayPicker()">Start</button></div>`
    : emptyProgramCard();
  const nextTargetCard = firstEx
    ? `<div class="card wide"><div class="label">Next target</div><div class="value">${firstEx.name}</div><p class="sub">${rec.text}. ${rec.reason}</p><div class="progress-line" style="--w:72%"><span></span></div></div>`
    : `<div class="card wide"><div class="label">Next target</div><div class="value">No exercise yet</div><p class="sub">Add exercises in Program to unlock targets and strength graphs.</p><div class="progress-line" style="--w:0%"><span></span></div></div>`;
  return `<section class="hero">
    ${heroProgressGraph()}
    <div class="hello">Hello<br>Martin</div>
    <div class="hero-pills"><span class="pill">${week.length} workouts this week</span><span class="pill">${total.toLocaleString('da-DK')} kg volume</span></div>
  </section>
  <section class="card-grid">
    ${nextWorkoutCard}
    ${nextTargetCard}
    <div class="card"><div class="label">Last session</div><div class="value">${lw ? lw.dayName : 'None'}</div><p class="sub">${lw ? volume(lw).toLocaleString('da-DK') + ' kg' : 'Start your first workout'}</p></div>
    <div class="card"><div class="label">This week</div><div class="value">${week.length}/4</div><p class="sub">Workouts completed</p></div>
  </section>`;
}
function openDayPicker(){
  const trainingDays = (activeProgram().days || []).filter(d => (d.exercises || []).length > 0);
  const days = trainingDays.length
    ? trainingDays.map(d => `<button class="card list-card" onclick="startWorkout('${d.id}')"><div><h3>${d.name}</h3><p class="sub">${d.exercises.length} exercises</p></div><span class="chev">Start</span></button>`).join('')
    : `<div class="empty">Add at least one exercise before starting a workout.</div><button class="btn" onclick="closeModal(); setTab('program')">Go to Program</button>`;
  document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="modal"><div class="modal"><div class="modal-title"><h2>Choose your day</h2><button class="btn secondary" onclick="closeModal()">Close</button></div><div class="stack">${days}</div></div></div>`);
}
function closeModal(){ const m = qs('modal'); if(m) m.remove(); }
function startWorkout(dayId){
  const day = activeProgram().days.find(d => d.id === dayId);
  if (!day || !(day.exercises || []).length) {
    closeModal();
    state.activeTab = "program";
    save();
    render();
    return;
  }
  state.currentWorkout = {
    id: uid(),
    dayId: day.id,
    dayName: day.name,
    startedAt: new Date().toISOString(),
    exercises: day.exercises.map(ex => ({ ...ex, loggedSets: Array.from({length: Number(ex.sets)}, (_,i)=>({ setNumber: i+1, weight: recommendation(ex).weight, reps: "" })) }))
  };
  closeModal(); save(); try {
  render();
} catch (error) {
  console.error("Next Set render error", error);
  const app = document.getElementById("app");
  if (app) {
    app.innerHTML = `<div class="card wide" style="margin-top:24px"><h1>Next Set</h1><p class="sub">Appen kunne ikke indlæse korrekt. Prøv at opdatere siden eller ryd browserdata for dette site.</p><button class="btn" onclick="localStorage.removeItem('next-set-v1'); location.reload();">Reset app</button></div>`;
  }
}
}
function workoutScreen(){
  const w = state.currentWorkout;
  return `<div class="screen-head"><div><p class="label">Active workout</p><h1>${w.dayName}</h1></div><button class="btn ghost" onclick="cancelWorkout()">Cancel</button></div>
  <div class="stack">${w.exercises.map((ex, ei) => exerciseLogCard(ex, ei)).join('')}
  <button class="btn" onclick="finishWorkout()">Finish Workout</button></div>`;
}
function exerciseLogCard(ex, ei){
  const last = lastExerciseSets(ex.name);
  const lastText = last ? last.map(s=>`${s.weight} x ${s.reps}`).join(', ') : 'No previous logs';
  return `<div class="card wide exercise-log"><div class="list-card"><div><h2>${ex.name}</h2><p class="sub">Last: ${lastText}</p></div><span class="badge">${ex.minReps}-${ex.maxReps}</span></div>
  ${ex.loggedSets.map((s, si)=>`<div class="set-row"><div class="set-index">${si+1}</div><input inputmode="decimal" value="${s.weight}" onchange="updateSet(${ei},${si},'weight',this.value)"/><input inputmode="numeric" placeholder="reps" value="${s.reps}" onchange="updateSet(${ei},${si},'reps',this.value)"/></div>`).join('')}</div>`;
}
function updateSet(ei, si, field, value){ state.currentWorkout.exercises[ei].loggedSets[si][field] = value; save(); }
function finishWorkout(){
  const w = state.currentWorkout;
  w.finishedAt = new Date().toISOString();
  state.workouts.push(w);
  state.currentWorkout = null;
  save(); try {
  render();
} catch (error) {
  console.error("Next Set render error", error);
  const app = document.getElementById("app");
  if (app) {
    app.innerHTML = `<div class="card wide" style="margin-top:24px"><h1>Next Set</h1><p class="sub">Appen kunne ikke indlæse korrekt. Prøv at opdatere siden eller ryd browserdata for dette site.</p><button class="btn" onclick="localStorage.removeItem('next-set-v1'); location.reload();">Reset app</button></div>`;
  }
}
}
function cancelWorkout(){ state.currentWorkout = null; save(); try {
  render();
} catch (error) {
  console.error("Next Set render error", error);
  const app = document.getElementById("app");
  if (app) {
    app.innerHTML = `<div class="card wide" style="margin-top:24px"><h1>Next Set</h1><p class="sub">Appen kunne ikke indlæse korrekt. Prøv at opdatere siden eller ryd browserdata for dette site.</p><button class="btn" onclick="localStorage.removeItem('next-set-v1'); location.reload();">Reset app</button></div>`;
  }
} }
function programScreen(){
  const p = activeProgram();
  return `<div class="screen-head"><div><p class="label">Your program</p><h1>${p.name}</h1></div><button class="btn" onclick="openDayForm()">Add day</button></div>
  <div class="stack">${p.days.map(day => `<div class="card wide"><div class="list-card"><div><h2>${day.name}</h2><p class="sub">${day.exercises.length} exercises</p></div><button class="btn secondary" onclick="openExerciseForm('${day.id}')">Add</button></div>${day.exercises.map(ex => `<div class="list-card" style="border-top:1px solid var(--line); padding-top:12px; margin-top:12px"><div><h3>${ex.name}</h3><p class="sub">${ex.sets} sets · ${ex.minReps}-${ex.maxReps} reps · ${ex.weight} kg · +${ex.increment} kg</p></div><button class="btn ghost" onclick="deleteExercise('${day.id}','${ex.id}')">×</button></div>`).join('')}</div>`).join('')}</div>`;
}
function openDayForm(){
  document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="modal"><div class="modal"><div class="modal-title"><h2>New day</h2><button class="btn secondary" onclick="closeModal()">Close</button></div><div class="stack"><input id="dayName" placeholder="Push, Pull, Legs..."/><button class="btn" onclick="addDay()">Save day</button></div></div></div>`);
}
function addDay(){
  const name = qs('dayName').value.trim(); if(!name) return;
  activeProgram().days.push({ id: uid(), name, exercises: [] }); closeModal(); save(); try {
  render();
} catch (error) {
  console.error("Next Set render error", error);
  const app = document.getElementById("app");
  if (app) {
    app.innerHTML = `<div class="card wide" style="margin-top:24px"><h1>Next Set</h1><p class="sub">Appen kunne ikke indlæse korrekt. Prøv at opdatere siden eller ryd browserdata for dette site.</p><button class="btn" onclick="localStorage.removeItem('next-set-v1'); location.reload();">Reset app</button></div>`;
  }
}
}
function openExerciseForm(dayId){
  document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="modal"><div class="modal"><div class="modal-title"><h2>New exercise</h2><button class="btn secondary" onclick="closeModal()">Close</button></div><div class="stack"><input id="exName" placeholder="Bench Press"/><div class="form-grid"><input id="sets" inputmode="numeric" placeholder="Sets" value="3"/><input id="weight" inputmode="decimal" placeholder="Weight"/></div><div class="form-grid"><input id="minReps" inputmode="numeric" placeholder="Min reps" value="6"/><input id="maxReps" inputmode="numeric" placeholder="Max reps" value="8"/></div><input id="increment" inputmode="decimal" placeholder="Increment" value="2.5"/><button class="btn" onclick="addExercise('${dayId}')">Save exercise</button></div></div></div>`);
}
function addExercise(dayId){
  const day = activeProgram().days.find(d => d.id === dayId);
  const ex = { id: uid(), name: qs('exName').value.trim(), sets: qs('sets').value || 3, minReps: qs('minReps').value || 6, maxReps: qs('maxReps').value || 8, weight: Number(qs('weight').value || 0), increment: Number(qs('increment').value || 2.5), notes: "" };
  if(!ex.name) return;
  day.exercises.push(ex); closeModal(); save(); try {
  render();
} catch (error) {
  console.error("Next Set render error", error);
  const app = document.getElementById("app");
  if (app) {
    app.innerHTML = `<div class="card wide" style="margin-top:24px"><h1>Next Set</h1><p class="sub">Appen kunne ikke indlæse korrekt. Prøv at opdatere siden eller ryd browserdata for dette site.</p><button class="btn" onclick="localStorage.removeItem('next-set-v1'); location.reload();">Reset app</button></div>`;
  }
}
}
function deleteExercise(dayId, exId){
  const day = activeProgram().days.find(d=>d.id===dayId);
  day.exercises = day.exercises.filter(e=>e.id!==exId); save(); try {
  render();
} catch (error) {
  console.error("Next Set render error", error);
  const app = document.getElementById("app");
  if (app) {
    app.innerHTML = `<div class="card wide" style="margin-top:24px"><h1>Next Set</h1><p class="sub">Appen kunne ikke indlæse korrekt. Prøv at opdatere siden eller ryd browserdata for dette site.</p><button class="btn" onclick="localStorage.removeItem('next-set-v1'); location.reload();">Reset app</button></div>`;
  }
}
}

function exerciseHistory(name){
  return state.workouts
    .map((workout, index) => {
      const ex = (workout.exercises || []).find(e => e.name === name);
      if (!ex) return null;
      const sets = (ex.loggedSets || []).map(s => ({ weight: safeNumber(s.weight), reps: safeNumber(s.reps) })).filter(s => s.weight > 0 && s.reps > 0);
      if (!sets.length) return null;
      const bestSet = sets.reduce((best, set) => {
        const setScore = set.weight * (1 + set.reps / 30);
        const bestScore = best.weight * (1 + best.reps / 30);
        return setScore > bestScore ? set : best;
      }, sets[0]);
      const estimatedOneRepMax = Math.round(bestSet.weight * (1 + bestSet.reps / 30) * 10) / 10;
      const date = workout.finishedAt || workout.startedAt || new Date().toISOString();
      return { index: index + 1, date, label: new Date(date).toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit' }), weight: bestSet.weight, reps: bestSet.reps, estimatedOneRepMax };
    })
    .filter(Boolean)
    .slice(-8);
}
function chartForExercise(name){
  const history = exerciseHistory(name);
  if (history.length < 2) {
    return `<div class="chart-wrap"><div class="empty" style="height:100%; display:grid; place-items:center; border:0">Log mindst 2 træninger for at se graf.</div></div>`;
  }
  const values = history.map(h => h.estimatedOneRepMax);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const width = 320;
  const height = 140;
  const padX = 18;
  const padY = 18;
  const step = (width - padX * 2) / Math.max(1, history.length - 1);
  const points = history.map((h, i) => {
    const x = padX + i * step;
    const y = height - padY - ((h.estimatedOneRepMax - min) / range) * (height - padY * 2);
    return { ...h, x, y };
  });
  const line = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${padX},${height-padY} ${line} ${width-padX},${height-padY}`;
  const current = history[history.length - 1];
  const first = history[0];
  const delta = Math.round((current.estimatedOneRepMax - first.estimatedOneRepMax) * 10) / 10;
  const best = Math.max(...values);
  return `<div class="chart-wrap"><svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-label="Styrkegraf for ${name}">
    <line class="chart-grid" x1="18" y1="34" x2="302" y2="34"></line>
    <line class="chart-grid" x1="18" y1="72" x2="302" y2="72"></line>
    <line class="chart-grid" x1="18" y1="110" x2="302" y2="110"></line>
    <polygon class="chart-area" points="${area}"></polygon>
    <polyline class="chart-line" points="${line}"></polyline>
    ${points.map(p => `<circle class="chart-dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4"><title>${p.label}: ${p.estimatedOneRepMax} kg est. 1RM</title></circle>`).join('')}
  </svg></div><div class="stat-row"><div class="stat-pill"><strong>${current.estimatedOneRepMax} kg</strong><span>Est. 1RM nu</span></div><div class="stat-pill"><strong>${delta >= 0 ? '+' : ''}${delta} kg</strong><span>Udvikling</span></div><div class="stat-pill"><strong>${best} kg</strong><span>Bedste</span></div></div>`;
}
function progressScreen(){
  const names = [...new Set(programExercises().map(e => e.name))];
  return `<div class="screen-head"><div><p class="label">Progress</p><h1>Strength graphs</h1></div></div>
  <div class="stack">${names.length ? names.map(name => {
    const ex = programExercises().find(e=>e.name===name);
    const last = lastExerciseSets(name);
    const rec = recommendation(ex);
    return `<div class="card wide chart-card"><div class="list-card"><div><h2>${name}</h2><p class="sub">Last: ${last ? last.map(s=>`${s.weight} x ${s.reps}`).join(', ') : 'No logs yet'}</p></div><span class="badge">Next</span></div><div class="value">${rec.text}</div><p class="sub">${rec.reason}</p>${chartForExercise(name)}</div>`;
  }).join('') : `<div class="empty">Add exercises to your program first.</div>`}</div>`;
}
try {
  render();
} catch (error) {
  console.error("Next Set render error", error);
  const app = document.getElementById("app");
  if (app) {
    app.innerHTML = `<div class="card wide" style="margin-top:24px"><h1>Next Set</h1><p class="sub">Appen kunne ikke indlæse korrekt. Prøv at opdatere siden eller ryd browserdata for dette site.</p><button class="btn" onclick="localStorage.removeItem('next-set-v1'); location.reload();">Reset app</button></div>`;
  }
}
