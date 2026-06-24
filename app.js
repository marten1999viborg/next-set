const STORAGE_KEY = "next-set-v1";
const sampleData = {
  activeTab: "home",
  currentWorkout: null,
  programs: [{
    id: crypto.randomUUID(),
    name: "Push / Pull / Legs",
    days: [
      { id: crypto.randomUUID(), name: "Push", exercises: [
        { id: crypto.randomUUID(), name: "Bench Press", sets: 3, minReps: 6, maxReps: 8, weight: 80, increment: 2.5, notes: "Controlled eccentric" },
        { id: crypto.randomUUID(), name: "Incline DB Press", sets: 3, minReps: 8, maxReps: 10, weight: 30, increment: 2.5, notes: "" },
        { id: crypto.randomUUID(), name: "Lateral Raises", sets: 3, minReps: 10, maxReps: 15, weight: 12, increment: 1, notes: "" }
      ]},
      { id: crypto.randomUUID(), name: "Pull", exercises: [
        { id: crypto.randomUUID(), name: "Lat Pulldown", sets: 3, minReps: 8, maxReps: 10, weight: 70, increment: 2.5, notes: "" },
        { id: crypto.randomUUID(), name: "Seated Row", sets: 3, minReps: 8, maxReps: 10, weight: 65, increment: 2.5, notes: "" }
      ]},
      { id: crypto.randomUUID(), name: "Legs", exercises: [
        { id: crypto.randomUUID(), name: "Squat", sets: 3, minReps: 5, maxReps: 8, weight: 100, increment: 5, notes: "" },
        { id: crypto.randomUUID(), name: "Romanian Deadlift", sets: 3, minReps: 8, maxReps: 10, weight: 90, increment: 5, notes: "" }
      ]}
    ]
  }],
  workouts: []
};
let state = load();
function load(){
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : sampleData;
}
function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
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
function setTab(tab){ state.activeTab = tab; save(); render(); }
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
function homeScreen(){
  const lw = lastWorkout();
  const week = weekWorkouts();
  const total = week.reduce((s,w)=>s+volume(w),0);
  const p = activeProgram();
  const nextDay = p.days[week.length % p.days.length];
  const firstEx = nextDay.exercises[0];
  const rec = recommendation(firstEx);
  return `<section class="hero">
    <div class="topbar"><div class="avatar"></div><div class="icon-circle">◌</div></div>
    <div class="hello">Hello<br>Martin</div>
    <div class="hero-pills"><span class="pill">${week.length} workouts this week</span><span class="pill">${total.toLocaleString('da-DK')} kg volume</span></div>
  </section>
  <section class="card-grid">
    <div class="card wide list-card">
      <div><div class="label">Next workout</div><h2>${nextDay.name}</h2><p class="sub">${nextDay.exercises.length} exercises ready</p></div>
      <button class="btn" onclick="openDayPicker()">Start</button>
    </div>
    <div class="card wide"><div class="label">Next target</div><div class="value">${firstEx.name}</div><p class="sub">${rec.text}. ${rec.reason}</p><div class="progress-line" style="--w:72%"><span></span></div></div>
    <div class="card"><div class="label">Last session</div><div class="value">${lw ? lw.dayName : 'None'}</div><p class="sub">${lw ? volume(lw).toLocaleString('da-DK') + ' kg' : 'Start your first workout'}</p></div>
    <div class="card"><div class="label">This week</div><div class="value">${week.length}/4</div><p class="sub">Workouts completed</p></div>
  </section>`;
}
function openDayPicker(){
  const days = activeProgram().days.map(d => `<button class="card list-card" onclick="startWorkout('${d.id}')"><div><h3>${d.name}</h3><p class="sub">${d.exercises.length} exercises</p></div><span class="chev">Start</span></button>`).join('');
  document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="modal"><div class="modal"><div class="modal-title"><h2>Choose your day</h2><button class="btn secondary" onclick="closeModal()">Close</button></div><div class="stack">${days}</div></div></div>`);
}
function closeModal(){ const m = qs('modal'); if(m) m.remove(); }
function startWorkout(dayId){
  const day = activeProgram().days.find(d => d.id === dayId);
  state.currentWorkout = {
    id: crypto.randomUUID(),
    dayId: day.id,
    dayName: day.name,
    startedAt: new Date().toISOString(),
    exercises: day.exercises.map(ex => ({ ...ex, loggedSets: Array.from({length: Number(ex.sets)}, (_,i)=>({ setNumber: i+1, weight: recommendation(ex).weight, reps: "" })) }))
  };
  closeModal(); save(); render();
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
  save(); render();
}
function cancelWorkout(){ state.currentWorkout = null; save(); render(); }
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
  activeProgram().days.push({ id: crypto.randomUUID(), name, exercises: [] }); closeModal(); save(); render();
}
function openExerciseForm(dayId){
  document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="modal"><div class="modal"><div class="modal-title"><h2>New exercise</h2><button class="btn secondary" onclick="closeModal()">Close</button></div><div class="stack"><input id="exName" placeholder="Bench Press"/><div class="form-grid"><input id="sets" inputmode="numeric" placeholder="Sets" value="3"/><input id="weight" inputmode="decimal" placeholder="Weight"/></div><div class="form-grid"><input id="minReps" inputmode="numeric" placeholder="Min reps" value="6"/><input id="maxReps" inputmode="numeric" placeholder="Max reps" value="8"/></div><input id="increment" inputmode="decimal" placeholder="Increment" value="2.5"/><button class="btn" onclick="addExercise('${dayId}')">Save exercise</button></div></div></div>`);
}
function addExercise(dayId){
  const day = activeProgram().days.find(d => d.id === dayId);
  const ex = { id: crypto.randomUUID(), name: qs('exName').value.trim(), sets: qs('sets').value || 3, minReps: qs('minReps').value || 6, maxReps: qs('maxReps').value || 8, weight: Number(qs('weight').value || 0), increment: Number(qs('increment').value || 2.5), notes: "" };
  if(!ex.name) return;
  day.exercises.push(ex); closeModal(); save(); render();
}
function deleteExercise(dayId, exId){
  const day = activeProgram().days.find(d=>d.id===dayId);
  day.exercises = day.exercises.filter(e=>e.id!==exId); save(); render();
}
function progressScreen(){
  const names = [...new Set(activeProgram().days.flatMap(d => d.exercises.map(e => e.name)))];
  return `<div class="screen-head"><div><p class="label">Progress</p><h1>Know what to beat</h1></div></div>
  <div class="stack">${names.length ? names.map(name => {
    const ex = activeProgram().days.flatMap(d=>d.exercises).find(e=>e.name===name);
    const last = lastExerciseSets(name);
    const rec = recommendation(ex);
    return `<div class="card wide"><div class="list-card"><div><h2>${name}</h2><p class="sub">Last: ${last ? last.map(s=>`${s.weight} x ${s.reps}`).join(', ') : 'No logs yet'}</p></div><span class="badge">Next</span></div><div class="value">${rec.text}</div><p class="sub">${rec.reason}</p></div>`;
  }).join('') : `<div class="empty">Add exercises to your program first.</div>`}</div>`;
}
render();
