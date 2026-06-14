/* ============================================================
   Maths Stars — app shell: DOM, storage, Firebase, UI wiring.
   Pure logic lives in ./logic/*; this file owns side effects.
   ============================================================ */

import { LEVELS, makeSession } from './logic/questions.js';
import { SCHEMA_VERSION, normalizeRecords } from './logic/schema.js';
import { enc, sessionKey, familyPrefix, isLegacySessionKey, legacyPlayer } from './logic/storage-keys.js';
import { bestForLevel, fmtTime } from './logic/stats.js';
import { computeSessionStars, totalStars, currentStreak, tierFor, nextTier } from './logic/rewards.js';

/* ============================================================
   Local-store helpers + key-layout migrations
   ============================================================ */
function safeParse(s, fallback){ try{ return JSON.parse(s ?? ''); }catch(e){ return fallback; } }
function allSessionKeys(){
  const out=[];
  for(let i=0;i<localStorage.length;i++){
    const k = localStorage.key(i);
    if(k && k.startsWith('ms_sessions_')) out.push(k);
  }
  return out;
}

/* Run ONCE per device on boot. These touch the localStorage keys
   themselves — re-stamping stored arrays so on-disk data matches the
   current shape. Cloud is NOT mass-migrated here; it's normalized lazily
   on read instead, so a device on new code can't corrupt a device still
   running old cached code. (See DECISIONS.md #2.) */
const STORE_MIGRATIONS = [
  {
    to: 2,
    up(){
      for(const key of allSessionKeys()){
        localStorage.setItem(key, JSON.stringify(normalizeRecords(safeParse(localStorage.getItem(key), []))));
      }
    },
  },
  {
    to: 3,
    up(){
      // Re-stamp every stored array so records carry `family` on disk.
      // Re-keying legacy `ms_sessions_<player>` keys into the
      // `ms_sessions_<family>|<player>` namespace happens later in
      // adoptLegacyData(), once the user has named their family.
      for(const key of allSessionKeys()){
        localStorage.setItem(key, JSON.stringify(normalizeRecords(safeParse(localStorage.getItem(key), []))));
      }
    },
  },
  {
    to: 4,
    up(){
      // Re-stamp so existing local sessions carry their (context-free) stars
      // on disk. The normalize() chain adds them; see schema.js v4.
      for(const key of allSessionKeys()){
        localStorage.setItem(key, JSON.stringify(normalizeRecords(safeParse(localStorage.getItem(key), []))));
      }
    },
  },
];

function runLocalMigrations(){
  let v = parseInt(localStorage.getItem('ms_schema_version') || '1', 10);
  if(v < SCHEMA_VERSION){
    for(const m of STORE_MIGRATIONS){
      if(m.to > v){
        try{ m.up(); v = m.to; }
        catch(e){ console.warn('local migration to v'+m.to+' failed:', e); break; }
      }
    }
  }
  localStorage.setItem('ms_schema_version', String(v));
}

/* Fold any legacy per-player keys into the chosen family's namespace,
   stamping `family` onto each record. Runs when a family is first set on
   a device that has pre-family data. Idempotent: legacy keys are removed
   once adopted. */
function adoptLegacyData(family){
  for(const k of allSessionKeys()){
    if(!isLegacySessionKey(k)) continue;
    const player = legacyPlayer(k);
    const adopted = normalizeRecords(safeParse(localStorage.getItem(k), []))
      .map(r=> ({ ...r, family }));
    const newKey = sessionKey(family, player);
    const existing = normalizeRecords(safeParse(localStorage.getItem(newKey), []));
    localStorage.setItem(newKey, JSON.stringify(adopted.concat(existing).slice(0,500)));
    localStorage.removeItem(k);
  }
}

/* ---------- App state ---------- */
const state = {
  family: localStorage.getItem('ms_family') || '',
  profile: localStorage.getItem('ms_profile') || '',
  qPerSession: parseInt(localStorage.getItem('ms_qcount')||'10',10),
  level:null, questions:[], idx:0, current:'', score:0,
  startTime:0, qStartTime:0, results:[], sessionStart:0,
};

let fb = null; // {db, addDoc, getDocs, collection, query, where, orderBy}

/* ---------- Screen helpers ---------- */
const screens = ['home','session','results','history'];
function show(name){
  screens.forEach(s=> document.getElementById('screen-'+s).classList.toggle('hidden', s!==name));
  window.scrollTo(0,0);
}
const $ = id => document.getElementById(id);

/* ---------- Firebase (optional) ---------- */
async function initFirebase(){
  const raw = localStorage.getItem('ms_fbconfig');
  if(!raw){ setSyncTag(false); return; }
  let cfg;
  try{ cfg = JSON.parse(raw); }catch(e){ setSyncTag(false); return; }
  if(!cfg || !cfg.apiKey || !cfg.projectId){ setSyncTag(false); return; }
  try{
    const appMod = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
    const fsMod  = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const app = appMod.initializeApp(cfg);
    const db = fsMod.getFirestore(app);
    fb = { db, ...fsMod };
    setSyncTag(true);
  }catch(e){
    console.warn('Firebase init failed:', e);
    setSyncTag(false);
  }
}
function setSyncTag(on){
  const t = $('syncTag');
  t.textContent = on ? '☁️ Synced' : 'On this device';
  t.className = 'sync-tag ' + (on?'sync-on':'sync-off');
}

/* ---------- Storage ----------
   Sessions are stored per (family, player). getSessions() returns the
   whole FAMILY's records so members can see each other's scores; callers
   filter by player where they want a single person's view. */
function localKey(){ return sessionKey(state.family, state.profile); }
function loadLocalFamilySessions(){
  const prefix = familyPrefix(state.family);
  const out=[];
  for(const k of allSessionKeys()){
    if(k.startsWith(prefix)) out.push(...normalizeRecords(safeParse(localStorage.getItem(k), [])));
  }
  return out;
}
function saveLocalSession(rec){
  const all = normalizeRecords(safeParse(localStorage.getItem(localKey()), []));
  all.unshift(rec);
  localStorage.setItem(localKey(), JSON.stringify(all.slice(0,500)));
}
async function saveSession(rec){
  saveLocalSession(rec);
  if(fb){
    try{
      await fb.addDoc(fb.collection(fb.db,'sessions'), rec);
    }catch(e){ console.warn('Cloud save failed (kept locally):', e); }
  }
}
async function getSessions(){
  if(fb){
    try{
      const q = fb.query(
        fb.collection(fb.db,'sessions'),
        fb.where('family','==', state.family||'default'),
        fb.orderBy('date','desc')
      );
      const snap = await fb.getDocs(q);
      const out=[]; snap.forEach(d=> out.push(d.data()));
      return normalizeRecords(out);
    }catch(e){ console.warn('Cloud read failed, using local:', e); }
  }
  return loadLocalFamilySessions();
}

/* ---------- Home rendering ---------- */
async function renderHome(){
  $('qVal').textContent = state.qPerSession;
  $('profileName').textContent = state.profile || 'Player';
  $('familyName').textContent = state.family || 'Family';
  const grid = $('levelGrid');
  grid.innerHTML='';
  const all = await getSessions().catch(()=>loadLocalFamilySessions());
  const mine = all.filter(s=> (s.profile||'default') === (state.profile||'default'));
  renderNightSky(mine);
  LEVELS.forEach(L=>{
    const best = bestForLevel(L.id, mine);
    const div=document.createElement('button');
    div.className='level '+L.cls;
    div.innerHTML = `
      <div class="badge">${L.icon}</div>
      <div class="title">${L.id}. ${L.title}</div>
      <div class="sub">${L.sub}</div>
      <div class="best">${best ? '★ Best '+best.correct+'/'+best.total+' · '+fmtTime(best.timeMs) : 'Not tried yet'}</div>`;
    div.onclick = ()=> startSession(L);
    grid.appendChild(div);
  });
  $('homeTip').textContent = fb ? 'Scores sync across your devices ☁️'
    : 'Tip: turn on cloud sync (👤 → Cloud sync) to share scores across devices.';
}

/* ---------- Session flow ---------- */
function startSession(level){
  state.level = level;
  state.questions = makeSession(level, state.qPerSession);
  state.idx = 0; state.current=''; state.score=0; state.results=[];
  state.sessionStart = Date.now();
  show('session');
  loadQuestion();
}
function loadQuestion(){
  const q = state.questions[state.idx];
  $('questionText').textContent = q.text + ' =';
  state.current='';
  updateAnswerBox();
  $('feedback').textContent=''; $('feedback').className='feedback';
  $('answerBox').className='answer-box empty';
  $('qProgressText').textContent = (state.idx+1)+' / '+state.questions.length;
  $('liveScore').textContent = '★ '+state.score;
  $('progressBar').style.width = (state.idx/state.questions.length*100)+'%';
  state.qStartTime = Date.now();
}
function updateAnswerBox(){
  const box=$('answerBox');
  if(state.current===''){ box.textContent='?'; box.classList.add('empty'); }
  else { box.textContent=state.current; box.classList.remove('empty'); }
}
function pressKey(k){
  if(k==='del'){ state.current=state.current.slice(0,-1); updateAnswerBox(); return; }
  if(k==='enter'){ submitAnswer(); return; }
  if(state.current.length>=4) return;
  state.current += k;
  updateAnswerBox();
}
let locking=false;
function submitAnswer(){
  if(locking) return;
  if(state.current==='') return;
  const q = state.questions[state.idx];
  const given = parseInt(state.current,10);
  const correct = given===q.answer;
  const timeMs = Date.now()-state.qStartTime;
  state.results.push({ text:q.text, answer:q.answer, given, correct, timeMs });
  if(correct) state.score++;
  // feedback
  const fb1=$('feedback'), box=$('answerBox');
  if(correct){ fb1.textContent='Correct! 🌟'; fb1.className='feedback good'; box.className='answer-box good'; }
  else { fb1.textContent='Answer: '+q.answer; fb1.className='feedback bad'; box.className='answer-box bad'; }
  $('liveScore').textContent='★ '+state.score;
  locking=true;
  setTimeout(()=>{
    locking=false;
    state.idx++;
    if(state.idx>=state.questions.length){ finishSession(); }
    else loadQuestion();
  }, correct?600:1300);
}
async function finishSession(){
  $('progressBar').style.width='100%';
  const timeMs = Date.now()-state.sessionStart;
  const rec = {
    id: 'ms_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),
    schemaVersion: SCHEMA_VERSION,
    family: state.family||'default',
    profile: state.profile||'default',
    level: state.level.id,
    levelName: state.level.title+' · '+state.level.sub,
    total: state.questions.length,
    correct: state.score,
    timeMs,
    date: new Date().toISOString(),
    questions: state.results,
  };
  // Award stars using this player's prior history (for PB / speed / streak).
  const prior = (await getSessions().catch(()=>loadLocalFamilySessions()))
    .filter(s=> (s.profile||'default') === (state.profile||'default'));
  rec.stars = computeSessionStars(rec, prior);
  await saveSession(rec);
  renderResults(rec);
  show('results');
}

/* ---------- Results ---------- */
function renderResults(rec){
  const pct = Math.round(rec.correct/rec.total*100);
  $('resultScore').textContent = rec.correct+' / '+rec.total;
  $('resultLevel').textContent = rec.levelName;
  $('resultPct').textContent = pct+'%';
  $('resultTime').textContent = fmtTime(rec.timeMs);
  $('resultAvg').textContent = (rec.timeMs/rec.total/1000).toFixed(1)+'s';
  let e='💪'; if(pct===100) e='🏆'; else if(pct>=80) e='🎉'; else if(pct>=60) e='😊';
  $('resultEmoji').textContent=e;
  renderStarAward(rec.stars);
  const list=$('reviewList'); list.innerHTML='';
  rec.questions.forEach(q=>{
    const row=document.createElement('div'); row.className='qrow';
    row.innerHTML = `<span class="q">${q.text} = ${q.answer}</span>
      <span>${q.correct?'<span class="mark ok">✓</span>':'<span class="yours">you: '+q.given+'</span> <span class="mark no">✗</span>'}</span>`;
    list.appendChild(row);
  });
}

/* Star-award breakdown shown on the results screen. */
const STAR_LABELS = {
  base:       'Practice done',
  accuracy:   'Accuracy',
  speed:      'Speedy 💨',
  pb:         'New personal best ✨',
  firstTry:   'First try at this level',
  difficulty: 'Tough level',
  streak:     'Streak bonus 🔥',
  milestone:  'Streak milestone! 🔥',
};
function renderStarAward(stars){
  const wrap = $('resultStars');
  if(!stars){ wrap.innerHTML=''; return; }
  const rows = Object.keys(STAR_LABELS)
    .filter(k=> stars[k] > 0)
    .map(k=> `<div class="star-row"><span>${STAR_LABELS[k]}</span><span class="star-amt">+${stars[k]} ⭐</span></div>`)
    .join('');
  wrap.innerHTML = `
    <div class="star-award">
      <div class="star-total">+${stars.total} ⭐</div>
      <div class="star-total-sub">stars earned${stars.streakLen>=2 ? ' · 🔥 '+stars.streakLen+'-day streak' : ''}</div>
      <div class="star-breakdown">${rows}</div>
    </div>`;
}

/* Deterministic [0,1) hash for a single integer — well-scrambled so star
   positions look scattered rather than forming arithmetic bands. Stable across
   renders (same star index -> same value), so stars don't jump on re-render. */
function starRand(n){
  n = (n ^ 61) ^ (n >>> 16);
  n = (n + (n << 3)) | 0;
  n = n ^ (n >>> 4);
  n = Math.imul(n, 0x27d4eb2d);
  n = n ^ (n >>> 15);
  return (n >>> 0) / 4294967296;
}

/* Night-sky meta panel on Home — fills with stars as the total grows. */
function renderNightSky(sessions){
  const sky = $('nightSky');
  if(!sky) return;
  const total = totalStars(sessions);
  const streak = currentStreak(sessions);
  const tier = tierFor(total);
  const next = nextTier(total);
  const toNext = next ? next.at - total : 0;
  // plot up to 80 five-pointed stars at deterministic positions (stable across
  // renders). viewBox is 200x70 and scaled uniformly (slice), so stars keep their
  // shape at any width; keep content inside the slice-safe band (x 10–190, y 16–54).
  // Each star is a <use> of one unit star path, twinkling on a staggered cycle.
  const shown = Math.min(total, 80);
  let stars='';
  for(let i=0;i<shown;i++){
    const x = 10 + starRand(i*2 + 1) * 180;        // scattered within the safe band
    const y = 16 + starRand(i*2 + 2) * 38;
    const s = starRand(i + 101) < 0.18 ? 2.0 : 1.25;  // ~18% larger feature stars
    const op = (0.5 + starRand(i + 202) * 0.45).toFixed(2);
    const dur = (2.4 + starRand(i + 303) * 2.2).toFixed(1);
    const delay = (starRand(i + 404) * 3).toFixed(1);
    stars += `<use href="#skStar" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s})" fill="#ffe9a8" class="sky-star" style="opacity:${op};animation-duration:${dur}s;animation-delay:${delay}s"/>`;
  }
  const progress = next ? Math.round((total - tier.at) / (next.at - tier.at) * 100) : 100;
  sky.innerHTML = `
    <div class="sky-box">
      <svg viewBox="0 0 200 70" preserveAspectRatio="xMidYMid slice" class="sky-svg">
        <defs>
          <path id="skStar" d="M0,-1 L0.235,-0.324 L0.951,-0.309 L0.380,0.124 L0.588,0.809 L0,0.4 L-0.588,0.809 L-0.380,0.124 L-0.951,-0.309 L-0.235,-0.324 Z"/>
        </defs>
        <circle cx="170" cy="24" r="7.5" fill="#fff4cf"/>
        <circle cx="164" cy="21" r="7.5" fill="#1c1740"/>
        ${stars}
      </svg>
      <div class="sky-overlay">
        <div class="sky-total">⭐ ${total}</div>
        <div class="sky-tier">${tier.name}</div>
      </div>
    </div>
    <div class="sky-meta">
      <span>${streak>0 ? '🔥 '+streak+'-day streak' : 'Practise daily to start a streak 🔥'}</span>
      <span>${next ? toNext+' ⭐ to '+next.name : 'Top tier reached! 🌌'}</span>
    </div>
    <div class="sky-progress"><div class="sky-progress-bar" style="width:${progress}%"></div></div>`;
}

/* ---------- History ---------- */
async function renderHistory(){
  show('history');
  const sessions = await getSessions().catch(()=>loadLocalFamilySessions());
  // level filter dropdown
  const filt=$('histFilter');
  const prevL = filt.value || 'all';
  filt.innerHTML = '<option value="all">All levels</option>' +
    LEVELS.map(L=>`<option value="${L.id}">${L.id}. ${L.title} (${L.sub})</option>`).join('');
  filt.value = prevL;
  filt.onchange = ()=> drawHistory(sessions);
  // player filter dropdown (the family members who have any sessions)
  const pf=$('histPlayer');
  const prevP = pf.value || 'all';
  const players = [...new Set(sessions.map(s=> s.profile||'default'))].sort();
  pf.innerHTML = '<option value="all">Everyone</option>' +
    players.map(p=>`<option value="${p}">${p}</option>`).join('');
  pf.value = players.includes(prevP) ? prevP : 'all';
  pf.onchange = ()=> drawHistory(sessions);
  drawHistory(sessions);
}
function drawHistory(sessions){
  const f = $('histFilter').value;
  const p = $('histPlayer').value;
  let filtered = f==='all'? sessions : sessions.filter(s=> String(s.level)===String(f));
  if(p!=='all') filtered = filtered.filter(s=> (s.profile||'default')===p);
  const sum=$('histSummary'); const list=$('histList');
  if(!filtered.length){
    sum.innerHTML=''; list.innerHTML='<div class="empty-note">No sessions yet — go practise! 🌟</div>'; return;
  }
  // summary: totals + sparklines (chronological)
  const chrono = [...filtered].slice().reverse(); // oldest -> newest
  const total = filtered.length;
  const avgPct = Math.round(filtered.reduce((a,s)=>a+s.correct/s.total,0)/total*100);
  const accSeries = chrono.map(s=> s.correct/s.total*100);
  const timeSeries = chrono.map(s=> s.timeMs/s.total/1000); // avg sec per q
  sum.innerHTML = `
    <div class="hist-card">
      <div class="hist-top"><div class="hist-name">${total} session${total>1?'s':''}</div>
        <div class="hist-date">avg ${avgPct}% correct</div></div>
      <div class="hist-stats"><span>Accuracy over time</span></div>
      ${sparkline(accSeries, '#34c759', 0, 100)}
      <div class="hist-stats" style="margin-top:12px"><span>Avg seconds per question (lower = faster)</span></div>
      ${sparkline(timeSeries, '#9b6dff')}
    </div>`;
  // list
  list.innerHTML='';
  filtered.slice(0,50).forEach(s=>{
    const d=new Date(s.date);
    const card=document.createElement('div'); card.className='hist-card';
    card.innerHTML = `
      <div class="hist-top">
        <div class="hist-name">${s.levelName||('Level '+s.level)}</div>
        <div class="hist-date">${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>
      </div>
      <div class="hist-stats">
        <span>👤 <b>${s.profile||'default'}</b></span>
        <span>Score <b>${s.correct}/${s.total}</b></span>
        <span>Time <b>${fmtTime(s.timeMs)}</b></span>
        <span>⭐ <b>${(s.stars&&s.stars.total)||0}</b></span>
      </div>`;
    list.appendChild(card);
  });
}
function sparkline(vals, color, fixedMin, fixedMax){
  if(vals.length===0) return '';
  const W=300,H=54,pad=4;
  let min = fixedMin!==undefined?fixedMin:Math.min(...vals);
  let max = fixedMax!==undefined?fixedMax:Math.max(...vals);
  if(max===min){ max=min+1; }
  const n=vals.length;
  const x = i=> n===1? W/2 : pad + i*(W-2*pad)/(n-1);
  const y = v=> H-pad - (v-min)/(max-min)*(H-2*pad);
  const pts = vals.map((v,i)=>`${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const dots = vals.map((v,i)=>`<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${n<=20?3:1.5}" fill="${color}"/>`).join('');
  const area = `${pad},${H-pad} ${pts} ${(n===1?W/2:W-pad)},${H-pad}`;
  return `<svg class="spark" width="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <polygon points="${area}" fill="${color}" opacity="0.10"/>
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
  </svg>`;
}

/* ---------- Modals ---------- */
function openFamily(){ $('familyInput').value = state.family; $('familyModal').classList.remove('hidden'); }
function closeFamily(){ $('familyModal').classList.add('hidden'); }
function openProfile(){
  $('profileInput').value = state.profile;
  $('profileFamilyName').textContent = state.family || 'Family';
  $('profileModal').classList.remove('hidden');
}
function closeProfile(){ $('profileModal').classList.add('hidden'); }
function openSync(){ $('syncInput').value = localStorage.getItem('ms_fbconfig')||''; $('syncModal').classList.remove('hidden'); }
function closeSyncM(){ $('syncModal').classList.add('hidden'); }

/* ---------- Event wiring ---------- */
function wire(){
  // question count
  $('qPlus').onclick = ()=>{ state.qPerSession=Math.min(50,state.qPerSession+5); localStorage.setItem('ms_qcount',state.qPerSession); $('qVal').textContent=state.qPerSession; };
  $('qMinus').onclick = ()=>{ state.qPerSession=Math.max(5,state.qPerSession-5); localStorage.setItem('ms_qcount',state.qPerSession); $('qVal').textContent=state.qPerSession; };

  $('historyBtn').onclick = renderHistory;
  $('backFromHistory').onclick = ()=>{ show('home'); renderHome(); };

  // keypad
  document.querySelectorAll('.key').forEach(b=> b.onclick = ()=> pressKey(b.dataset.k));
  $('quitBtn').onclick = ()=>{ if(confirm('Quit this session? Progress will not be saved.')){ show('home'); renderHome(); } };

  // results buttons
  $('againBtn').onclick = ()=> startSession(state.level);
  $('homeFromResults').onclick = ()=>{ show('home'); renderHome(); };

  // family
  $('saveFamily').onclick = ()=>{
    const v=$('familyInput').value.trim();
    const isFirstTime = !state.family;
    state.family = v || 'Family';
    localStorage.setItem('ms_family', state.family);
    adoptLegacyData(state.family);   // fold any pre-family data into this family
    closeFamily();
    // First run chains into picking a player; otherwise just refresh.
    if(isFirstTime && !state.profile){ openProfile(); }
    else renderHome();
  };
  $('editFamilyBtn').onclick = ()=>{ closeProfile(); openFamily(); };

  // profile
  $('profileBtn').onclick = openProfile;
  $('saveProfile').onclick = ()=>{
    const v=$('profileInput').value.trim();
    state.profile = v || 'Player';
    localStorage.setItem('ms_profile', state.profile);
    closeProfile(); renderHome();
  };
  $('openSyncBtn').onclick = ()=>{ closeProfile(); openSync(); };

  // sync
  $('saveSync').onclick = async ()=>{
    const v=$('syncInput').value.trim();
    if(v===''){ localStorage.removeItem('ms_fbconfig'); fb=null; setSyncTag(false); closeSyncM(); renderHome(); return; }
    try{ JSON.parse(v); }catch(e){ alert('That doesn\'t look like valid JSON. Copy the whole { ... } config object.'); return; }
    localStorage.setItem('ms_fbconfig', v);
    closeSyncM();
    await initFirebase();
    renderHome();
  };
  $('closeSync').onclick = closeSyncM;

  // physical keyboard
  document.addEventListener('keydown', e=>{
    if($('screen-session').classList.contains('hidden')) return;
    if(e.key>='0'&&e.key<='9') pressKey(e.key);
    else if(e.key==='Enter') pressKey('enter');
    else if(e.key==='Backspace'){ e.preventDefault(); pressKey('del'); }
  });

  // dismiss modals on backdrop tap
  document.querySelectorAll('.modal-bg').forEach(m=> m.addEventListener('click', e=>{ if(e.target===m) m.classList.add('hidden'); }));
}

/* ---------- Boot ---------- */
async function boot(){
  wire();
  runLocalMigrations();
  // First-run flow: family name first, then player name. saveFamily()
  // chains into openProfile() when there's no player yet.
  if(!state.family){ openFamily(); }
  else if(!state.profile){ openProfile(); }
  await initFirebase();
  renderHome();
}
boot();
