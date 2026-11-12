/* ============ EcoPulse – script.js ============ */
(() => {
  'use strict';

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const num = v => { const n = parseFloat(v); return isFinite(n) && n > 0 ? n : 0; };
  const fmt = n => Math.round(n).toLocaleString('en-IN');

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  };

  const dateKey = (d = new Date()) =>
    d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

  // >>> Apni email yahan likho (contact form isi par mail bhejta hai)
  const CONTACT_EMAIL = 'youremail@example.com';

  /* ---------- data ---------- */
  const HABITS = [
    { id: 'walk',   icon: '🚶', text: 'Walked or cycled instead of using a vehicle', pts: 15 },
    { id: 'public', icon: '🚌', text: 'Used public transport or carpooled',          pts: 10 },
    { id: 'lights', icon: '💡', text: 'Switched off unused lights & fans',            pts: 5 },
    { id: 'water',  icon: '💧', text: 'Saved water (short shower, closed the tap)',   pts: 5 },
    { id: 'waste',  icon: '♻️', text: 'Segregated wet and dry waste',                 pts: 10 },
    { id: 'plant',  icon: '🥗', text: 'Had a plant-based meal',                       pts: 10 },
    { id: 'bag',    icon: '🛍️', text: 'Carried a reusable bag / bottle',              pts: 5 },
    { id: 'tree',   icon: '🌱', text: 'Planted or watered a plant',                   pts: 15 }
  ];
  const MAX_PTS = HABITS.reduce((a, h) => a + h.pts, 0);

  const FACTORS = {          // approx. India-based emission factors
    car: 0.12,               // kg CO2 per km (mix of bike/car)
    pub: 0.04,               // kg CO2 per km (bus/metro/train)
    elec: 0.82,              // kg CO2 per kWh (India grid)
    lpg: 42.5,               // kg CO2 per 14.2 kg cylinder
    diet: { veg: 36, vegdairy: 51, occ: 66, nonveg: 99 },   // per month
    waste: { most: 5, some: 12, none: 22 }                  // per month
  };
  const INDIA_AVG = 160, WORLD_AVG = 400;
  const TREE_KG_YEAR = 21;

  const CATS = [
    { key: 'transport', label: '🚗 Car / bike', color: '#ef4444' },
    { key: 'public',    label: '🚌 Public transport', color: '#f59e0b' },
    { key: 'elec',      label: '💡 Electricity', color: '#eab308' },
    { key: 'lpg',       label: '🔥 LPG', color: '#0ea5e9' },
    { key: 'diet',      label: '🍽️ Diet', color: '#16a34a' },
    { key: 'waste',     label: '🗑️ Waste', color: '#8b5cf6' }
  ];

  const TASKS = [
    'Carry a reusable bag everywhere', 'Switch off lights when leaving a room', 'Take a short 5-minute shower',
    'Walk or cycle for one trip', 'Eat one fully plant-based meal', 'Unplug idle chargers & devices',
    'Say no to single-use plastic', 'Use public transport today', 'Fix or report a leaking tap',
    'Carry your own water bottle', 'Segregate wet and dry waste', 'Set AC to 24–26°C or use a fan',
    'Plant or water a plant', 'Shop local, avoid packaged items', 'Go paperless – print nothing',
    'Air-dry your clothes', 'Carpool or share a ride', 'Turn off screens you are not using',
    'Compost your kitchen scraps', 'Take the stairs instead of the lift', 'Run washing machine only on full load',
    'Finish your plate – zero food waste', 'Buy nothing new today', 'Check & switch to LED bulbs',
    'Reuse a jar, bottle or bag', 'Spend an hour in nature', 'Tell 3 friends about EcoPulse',
    'Have a fully meat-free day', 'Donate or repurpose old clothes', 'Plan your next month\'s eco goals'
  ];

  const LEVELS = [
    { name: '🌰 Seed', min: 0 }, { name: '🌱 Sprout', min: 100 }, { name: '🌿 Sapling', min: 300 },
    { name: '🌳 Tree', min: 700 }, { name: '🌲 Forest Guardian', min: 1500 }
  ];

  const BADGES = [
    { id: 'seedling', name: 'Seedling',      test: s => s.total > 0 },
    { id: 'starter',  name: 'Green Starter', test: s => s.streak >= 3 },
    { id: 'hugger',   name: 'Tree Hugger',   test: s => s.streak >= 7 },
    { id: 'hero',     name: 'Planet Hero',   test: s => s.streak >= 30 }
  ];

  /* ---------- state ---------- */
  const state = {
    inputs: store.get('ep_inputs', null),
    calc: store.get('ep_calc', null),
    hist: store.get('ep_hist', {}),
    badges: store.get('ep_badges', []),
    challenge: store.get('ep_challenge', []),
    selDay: null
  };

  /* ---------- toast ---------- */
  let toastT;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ---------- confetti ---------- */
  function confetti() {
    const c = $('#confetti');
    if (!c || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = c.getContext('2d');
    c.width = innerWidth; c.height = innerHeight;
    const colors = ['#16a34a', '#84cc16', '#0d9488', '#f59e0b', '#0ea5e9', '#ec4899'];
    const parts = Array.from({ length: 130 }, () => ({
      x: Math.random() * c.width, y: -20 - Math.random() * c.height * 0.4,
      r: 4 + Math.random() * 6, c: colors[(Math.random() * colors.length) | 0],
      vx: -2 + Math.random() * 4, vy: 2 + Math.random() * 4, rot: Math.random() * 6
    }));
    const start = performance.now();
    (function frame(now) {
      const el = now - start;
      ctx.clearRect(0, 0, c.width, c.height);
      parts.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.rot += 0.1;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c; ctx.globalAlpha = clamp(1 - el / 3200, 0, 1);
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6); ctx.restore();
      });
      if (el < 3200) requestAnimationFrame(frame); else ctx.clearRect(0, 0, c.width, c.height);
    })(start);
  }

  /* ---------- count-up ---------- */
  function countTo(el, to) {
    const from = parseFloat(el.dataset.v || '0');
    el.dataset.v = to;
    if (from === to) { el.textContent = fmt(to); return; }
    const dur = 700, t0 = performance.now();
    (function step(t) {
      const k = clamp((t - t0) / dur, 0, 1);
      el.textContent = fmt(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }

  /* ---------- core calculations ---------- */
  function compute(i) {
    const r = {
      transport: i.car * 30 * FACTORS.car,
      public: i.pub * 30 * FACTORS.pub,
      elec: i.elec * FACTORS.elec,
      lpg: i.lpg * FACTORS.lpg,
      diet: FACTORS.diet[i.diet] || 0,
      waste: FACTORS.waste[i.waste] || 0
    };
    r.total = r.transport + r.public + r.elec + r.lpg + r.diet + r.waste;
    return r;
  }

  const todayIds = () => state.hist[dateKey()] || [];
  const ptsOf = ids => ids.reduce((a, id) => a + ((HABITS.find(h => h.id === id) || {}).pts || 0), 0);
  const totalPoints = () => Object.values(state.hist).reduce((a, ids) => a + ptsOf(ids), 0);

  function streak() {
    const d = new Date();
    if (!(state.hist[dateKey(d)] || []).length) d.setDate(d.getDate() - 1);
    let n = 0;
    while ((state.hist[dateKey(d)] || []).length) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  function habitPct() { return clamp(Math.round(ptsOf(todayIds()) / MAX_PTS * 100), 0, 100); }

  function scoreValue() {
    if (!state.calc) return null;
    const fs = clamp(100 - state.calc.total / 6, 0, 100);
    return Math.round(0.7 * fs + 0.3 * habitPct());
  }

  function earthHealth() {
    const s = scoreValue();
    return s !== null ? s : Math.round(45 + habitPct() * 0.45);
  }

  /* ---------- Earth visual ---------- */
  function renderEarth() {
    const h = earthHealth();
    const img = $('#earthImg');
    img.style.filter =
      `saturate(${(0.35 + h / 100 * 0.9).toFixed(2)}) grayscale(${((100 - h) / 230).toFixed(2)}) ` +
      `sepia(${(Math.max(0, 55 - h) / 110).toFixed(2)}) brightness(${(0.78 + h / 420).toFixed(2)})`;
    document.documentElement.style.setProperty('--earth-glow', `hsl(${Math.round(h * 1.15)},70%,50%)`);
    const label = h >= 75 ? 'Thriving 🌿' : h >= 50 ? 'Recovering 🌤️' : h >= 30 ? 'Stressed 🌫️' : 'Critical 🔥';
    $('#earthLabel').textContent = 'Earth: ' + label;
    $('#earthPct').textContent = h + '%';
  }

  /* ---------- hero stats ---------- */
  function renderStats() {
    const trees = state.calc ? Math.ceil(state.calc.total * 12 / TREE_KG_YEAR) : 0;
    countTo($('#statTrees'), trees);
    countTo($('#statPoints'), ptsOf(todayIds()));
    countTo($('#statStreak'), streak());
  }

  /* ---------- calculator result ---------- */
  function renderResult() {
    const c = state.calc;
    $('#resultEmpty').hidden = !!c;
    $('#resultBox').hidden = !c;
    if (!c) return;
    $('#resNum').textContent = fmt(c.total);

    const v = $('#resVerdict');
    if (c.total <= INDIA_AVG) { v.textContent = '🌿 Below India average'; v.className = 'pill'; }
    else if (c.total <= WORLD_AVG) { v.textContent = '🌤️ Above India average'; v.className = 'pill mid'; }
    else { v.textContent = '🔥 Above world average'; v.className = 'pill bad'; }

    const bars = $('#bars');
    bars.innerHTML = CATS.map(k => {
      const val = c[k.key];
      const pct = c.total ? Math.round(val / c.total * 100) : 0;
      return `<div class="bar-row"><div class="lab"><span>${k.label}</span><b>${fmt(val)} kg · ${pct}%</b></div>
        <div class="track"><i data-w="${pct}" style="background:${k.color}"></i></div></div>`;
    }).join('');
    requestAnimationFrame(() => requestAnimationFrame(() =>
      $$('.track i', bars).forEach(i => { i.style.width = i.dataset.w + '%'; })));

    const trees = Math.ceil(c.total * 12 / TREE_KG_YEAR);
    $('#equiv').innerHTML =
      `<div><b>${fmt(trees)}</b><span>trees needed for a year to absorb it</span></div>
       <div><b>${fmt(c.total / FACTORS.car)}</b><span>km of driving</span></div>
       <div><b>${fmt(c.total / 0.008)}</b><span>smartphone charges</span></div>`;
  }

  /* ---------- habits ---------- */
  function renderHabits() {
    const ids = todayIds();
    $('#habitList').innerHTML = HABITS.map(h =>
      `<li><button type="button" class="habit ${ids.includes(h.id) ? 'done' : ''}" data-id="${h.id}" aria-pressed="${ids.includes(h.id)}">
        <span class="ico">${h.icon}</span><span class="txt">${h.text}</span><span class="pts">+${h.pts}</span><span class="chk">✓</span></button></li>`
    ).join('');
    const p = ptsOf(ids), pct = habitPct();
    $('#habitPoints').textContent = p;
    $('#habitStreak').textContent = streak();
    $('#habitPct').textContent = pct + '%';
    $('#habitBar').style.width = pct + '%';
  }

  function toggleHabit(id) {
    const key = dateKey();
    const ids = new Set(state.hist[key] || []);
    ids.has(id) ? ids.delete(id) : ids.add(id);
    if (ids.size) state.hist[key] = Array.from(ids); else delete state.hist[key];
    store.set('ep_hist', state.hist);
    updateAll();
  }

  /* ---------- score ring ---------- */
  function renderScore() {
    const s = scoreValue();
    const ring = $('#ringFg');
    $('#scoreNum').textContent = s === null ? '--' : s;
    ring.style.strokeDashoffset = 326.7 * (1 - (s || 0) / 100);
    const T = $('#scoreTitle'), X = $('#scoreText');
    if (s === null) {
      T.textContent = 'Calculate your footprint to see your score';
      X.textContent = 'Your eco score improves when your monthly CO₂ is low and you complete more eco habits every day.';
    } else if (s >= 80) { T.textContent = 'Planet Champion! 🌍'; X.textContent = 'Your lifestyle is really green. Keep your habits going and inspire others!'; }
    else if (s >= 60) { T.textContent = 'Great going! 🌿'; X.textContent = 'You are doing well. A few more green habits and cutting car use can push you higher.'; }
    else if (s >= 40) { T.textContent = 'Good start 🌤️'; X.textContent = 'There is room to improve. Try the What-if sliders to see your biggest savings.'; }
    else { T.textContent = 'Time for small changes 🔥'; X.textContent = 'Your footprint is high, but every habit counts. Start with the 30-day challenge!'; }
  }

  /* ---------- charts ---------- */
  let donut, week;
  function chartColors() {
    const dark = document.documentElement.dataset.theme === 'dark';
    return { text: dark ? '#cfe6d8' : '#35503f', grid: dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)' };
  }

  function renderCharts() {
    const hasChart = typeof Chart !== 'undefined';
    $('#donutEmpty').style.display = state.calc ? 'none' : 'grid';
    $('#donutChart').style.display = state.calc ? 'block' : 'none';
    if (!hasChart) return;
    const col = chartColors();
    Chart.defaults.font.family = "'Outfit', sans-serif";
    Chart.defaults.color = col.text;

    if (state.calc) {
      const data = CATS.map(k => Math.round(state.calc[k.key]));
      if (donut) { donut.data.datasets[0].data = data; donut.options.plugins.legend.labels.color = col.text; donut.update(); }
      else donut = new Chart($('#donutChart'), {
        type: 'doughnut',
        data: { labels: CATS.map(k => k.label.replace(/^\S+\s/, '')), datasets: [{ data, backgroundColor: CATS.map(k => k.color), borderWidth: 0, hoverOffset: 10 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { color: col.text, boxWidth: 12 } } } }
      });
    }

    const labels = [], vals = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      labels.push(d.toLocaleDateString('en-IN', { weekday: 'short' }));
      vals.push(ptsOf(state.hist[dateKey(d)] || []));
    }
    if (week) { week.data.datasets[0].data = vals; week.options.scales.x.ticks.color = col.text; week.options.scales.y.ticks.color = col.text; week.options.scales.y.grid.color = col.grid; week.update(); }
    else week = new Chart($('#weekChart'), {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Eco points', data: vals, backgroundColor: '#16a34a', borderRadius: 10, maxBarThickness: 38 }] },
      options: {
        responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { x: { grid: { display: false }, ticks: { color: col.text } }, y: { beginAtZero: true, suggestedMax: MAX_PTS, grid: { color: col.grid }, ticks: { color: col.text } } }
      }
    });
  }

  function renderCompare() {
    const you = state.calc ? Math.round(state.calc.total) : null;
    const rows = [
      ...(you !== null ? [{ l: '🙋 You', v: you, c: 'linear-gradient(90deg,#16a34a,#0d9488)' }] : []),
      { l: '🇮🇳 India average', v: INDIA_AVG, c: '#f59e0b' },
      { l: '🌍 World average', v: WORLD_AVG, c: '#ef4444' }
    ];
    const max = Math.max(...rows.map(r => r.v), 1);
    $('#cmpBars').innerHTML = rows.map(r =>
      `<div class="bar-row"><div class="lab"><span>${r.l}</span><b>${fmt(r.v)} kg</b></div>
       <div class="track"><i style="width:${Math.round(r.v / max * 100)}%;background:${r.c}"></i></div></div>`).join('') +
      (you === null ? '<p class="muted">Calculate your footprint to add your own bar here.</p>' : '');
  }

  /* ---------- what-if ---------- */
  function renderWhatIf() {
    const carS = $('#wiCar'), elS = $('#wiElec'), vgS = $('#wiVeg');
    const carKm = state.inputs ? num(state.inputs.car) : 0;
    carS.max = state.inputs ? Math.max(5, Math.ceil(carKm)) : 30;
    const car = +carS.value, el = +elS.value, vg = +vgS.value;
    $('#wiCarV').textContent = car; $('#wiElecV').textContent = el; $('#wiVegV').textContent = vg;
    const baseKwh = state.inputs && num(state.inputs.elec) ? num(state.inputs.elec) : 150;
    const save = car * (FACTORS.car - FACTORS.pub) * 30 + baseKwh * (el / 100) * FACTORS.elec + vg * 4.3 * 1.2;
    $('#wiSave').textContent = fmt(save);
    const t = $('#wiText');
    if (save <= 0) t.textContent = 'Move a slider to begin 👆';
    else t.textContent = `That is about ${fmt(save * 12)} kg a year – like planting ${fmt(save * 12 / TREE_KG_YEAR)} trees 🌳` +
      (state.calc && state.calc.total ? ` and a ${Math.round(save / state.calc.total * 100)}% cut in your footprint.` : '.');
  }

  /* ---------- challenge ---------- */
  function renderChallenge() {
    const grid = $('#dayGrid');
    grid.innerHTML = TASKS.map((_, i) =>
      `<button type="button" class="day ${state.challenge.includes(i + 1) ? 'done' : ''} ${state.selDay === i + 1 ? 'sel' : ''}" data-d="${i + 1}" aria-label="Day ${i + 1}">${i + 1}</button>`).join('');
    const n = state.challenge.length, pct = Math.round(n / 30 * 100);
    $('#chText').textContent = `${n} / 30 days completed`;
    $('#chPct').textContent = pct + '%';
    $('#chBar').style.width = pct + '%';
    const box = $('#taskBox');
    if (state.selDay) {
      const done = state.challenge.includes(state.selDay);
      box.textContent = `Day ${state.selDay}: ${TASKS[state.selDay - 1]} ${done ? '✅' : ''}`;
    } else box.textContent = '👆 Tap a day to see the mission. Tap again to mark it complete.';
  }

  function toggleDay(d) {
    if (state.selDay !== d) { state.selDay = d; renderChallenge(); return; }   // first tap = show, second tap = toggle
    const i = state.challenge.indexOf(d);
    if (i >= 0) state.challenge.splice(i, 1);
    else {
      state.challenge.push(d);
      if (state.challenge.length === 30) { confetti(); toast('🏆 30-Day Challenge complete! You are a Planet Hero!'); }
      else toast('✅ Day ' + d + ' done! Keep going 🌱');
    }
    store.set('ep_challenge', state.challenge);
    renderChallenge();
  }

  /* ---------- rewards ---------- */
  function renderRewards() {
    const s = { total: totalPoints(), streak: streak() };
    BADGES.forEach(b => {
      const el = $(`.badge[data-id="${b.id}"]`);
      const ok = state.badges.includes(b.id);
      el.classList.toggle('unlocked', ok);
    });
    const unlocked = BADGES.filter(b => b.test(s) && !state.badges.includes(b.id));
    if (unlocked.length) {
      unlocked.forEach(b => state.badges.push(b.id));
      store.set('ep_badges', state.badges);
      BADGES.forEach(b => $(`.badge[data-id="${b.id}"]`).classList.toggle('unlocked', state.badges.includes(b.id)));
      confetti(); toast('🏅 Badge unlocked: ' + unlocked.map(b => b.name).join(', '));
    }
    const pts = s.total;
    let li = 0; LEVELS.forEach((l, i) => { if (pts >= l.min) li = i; });
    const cur = LEVELS[li], next = LEVELS[li + 1];
    $('#levelName').textContent = cur.name;
    if (next) {
      $('#levelBar').style.width = Math.round((pts - cur.min) / (next.min - cur.min) * 100) + '%';
      $('#levelText').textContent = `${pts} points · ${next.min - pts} more to ${next.name}`;
    } else { $('#levelBar').style.width = '100%'; $('#levelText').textContent = `${pts} points · Max level reached!`; }
  }

  /* ---------- master update ---------- */
  function updateAll() {
    renderStats(); renderEarth(); renderResult(); renderHabits();
    renderScore(); renderCharts(); renderCompare(); renderWhatIf(); renderRewards();
  }

  /* ---------- calculator events ---------- */
  function readInputs() {
    return { car: num($('#car').value), pub: num($('#pub').value), elec: num($('#elec').value), lpg: num($('#lpg').value), diet: $('#diet').value, waste: $('#waste').value };
  }
  function fillInputs(i) {
    if (!i) return;
    $('#car').value = i.car || ''; $('#pub').value = i.pub || ''; $('#elec').value = i.elec || ''; $('#lpg').value = i.lpg || '';
    $('#diet').value = i.diet; $('#waste').value = i.waste;
  }

  $('#calcForm').addEventListener('submit', e => {
    e.preventDefault();
    const i = readInputs();
    if (!(i.car || i.pub || i.elec || i.lpg)) { toast('Please enter at least one value 🙂'); return; }
    state.inputs = i; state.calc = compute(i);
    store.set('ep_inputs', i); store.set('ep_calc', state.calc);
    updateAll();
    if (innerWidth < 980) $('#resultCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (state.calc.total <= INDIA_AVG) { confetti(); toast('🌿 Awesome! You are below the India average.'); }
  });

  $('#resetCalc').addEventListener('click', () => {
    $('#calcForm').reset();
    $('#diet').value = 'occ'; $('#waste').value = 'some';
    state.inputs = null; state.calc = null;
    localStorage.removeItem('ep_inputs'); localStorage.removeItem('ep_calc');
    updateAll();
  });

  /* ---------- habits / challenge clicks ---------- */
  $('#habitList').addEventListener('click', e => {
    const b = e.target.closest('.habit'); if (b) toggleHabit(b.dataset.id);
  });
  $('#dayGrid').addEventListener('click', e => {
    const b = e.target.closest('.day'); if (b) toggleDay(+b.dataset.d);
  });
  ['wiCar', 'wiElec', 'wiVeg'].forEach(id => $('#' + id).addEventListener('input', renderWhatIf));

  /* ---------- eco assistant ---------- */
  const KB = [
    { k: ['hello', 'hi', 'hey', 'namaste'], r: 'Hello! 🌿 Ask me about saving energy, water, waste, travel or food.' },
    { k: ['electric', 'energy', 'light', 'bulb', 'power', 'bijli', 'ac ', 'fan'], r: '⚡ Save electricity:\n• Switch to LED bulbs (up to 80% less energy)\n• Set AC to 24–26°C\n• Unplug idle chargers\n• Choose 5-star rated appliances' },
    { k: ['water', 'paani', 'tap', 'shower'], r: '💧 Save water:\n• Fix leaking taps\n• Turn off the tap while brushing\n• Use a bucket instead of a long shower\n• Reuse RO reject water for plants' },
    { k: ['waste', 'plastic', 'recycle', 'garbage', 'kachra'], r: '♻️ Reduce waste:\n• Separate wet & dry waste\n• Carry a cloth bag and bottle\n• Compost kitchen scraps\n• Buy only what you need' },
    { k: ['travel', 'transport', 'car', 'bike', 'bus', 'metro', 'commute', 'ev'], r: '🚌 Travel green:\n• Walk or cycle for short trips\n• Use metro/bus or carpool\n• Keep tyres inflated & engine serviced\n• Consider an EV for your next vehicle' },
    { k: ['food', 'diet', 'meat', 'veg', 'eat'], r: '🥗 Food matters! Plant-based meals have a much lower footprint than meat. Even 2–3 meat-free days a week help. Also avoid wasting food.' },
    { k: ['solar', 'renewable'], r: '☀️ Rooftop solar and renewable energy can cut your electricity emissions to almost zero over time. Check government subsidy schemes in your state.' },
    { k: ['lpg', 'gas', 'cook'], r: '🔥 LPG tips: use pressure cookers, keep lids on pots, soak pulses beforehand and fix leaks. Induction cooking on a green grid is even better.' },
    { k: ['tree', 'plant'], r: '🌳 One tree absorbs roughly 20 kg of CO₂ per year. Plant native species and take care of them!' },
    { k: ['score', 'footprint', 'carbon'], r: 'Your carbon footprint is the CO₂ released by your lifestyle. Use the Calculator above and then try the What-if sliders to see how to reduce it.' },
    { k: ['thank'], r: 'You are welcome! 💚 Keep going green.' }
  ];
  function botReply(q) {
    const s = ' ' + q.toLowerCase() + ' ';
    const hit = KB.find(x => x.k.some(w => s.includes(w)));
    return hit ? hit.r : 'Hmm, I am still learning 🌱. Try asking about electricity, water, waste, travel, food, solar or trees.';
  }
  function addMsg(text, who) {
    const m = document.createElement('div');
    m.className = 'msg ' + who; m.textContent = text;
    const box = $('#chatBox'); box.appendChild(m); box.scrollTop = box.scrollHeight;
    return m;
  }
  function ask(q) {
    q = q.trim(); if (!q) return;
    addMsg(q, 'user');
    const t = addMsg('•••', 'bot'); t.classList.add('typing');
    setTimeout(() => { t.classList.remove('typing'); t.textContent = botReply(q); $('#chatBox').scrollTop = 1e6; }, 650);
  }
  addMsg('Hi! I am your Eco Assistant 🌿 Ask me how to save energy, water or reduce waste.', 'bot');
  $('#chatForm').addEventListener('submit', e => { e.preventDefault(); const i = $('#chatInput'); ask(i.value); i.value = ''; });
  $('#chips').addEventListener('click', e => { const b = e.target.closest('button'); if (b) ask(b.dataset.q); });

  /* ---------- contact ---------- */
  $('#mailLink').textContent = CONTACT_EMAIL;
  $('#mailLink').href = 'mailto:' + CONTACT_EMAIL;
  $('#contactForm').addEventListener('submit', e => {
    e.preventDefault();
    const n = $('#cName').value.trim(), em = $('#cEmail').value.trim(), m = $('#cMsg').value.trim();
    const body = encodeURIComponent(`Name: ${n}\nEmail: ${em}\n\n${m}`);
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('EcoPulse message from ' + n)}&body=${body}`;
    toast('Opening your email app… 📧');
  });

  /* ---------- share card ---------- */
  function drawShare() {
    const c = $('#shareCanvas'), x = c.getContext('2d'), W = 1080, H = 1080;
    const g = x.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#064e3b'); g.addColorStop(.55, '#0d9488'); g.addColorStop(1, '#65a30d');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.globalAlpha = .08; x.fillStyle = '#fff';
    for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(150 + i * 170, 120 + (i % 3) * 330, 140, 0, 7); x.fill(); }
    x.globalAlpha = 1;

    const earth = $('#earthImg');
    try {
      x.save(); x.beginPath(); x.arc(W / 2, 330, 190, 0, Math.PI * 2); x.clip();
      if (earth.complete && earth.naturalWidth) x.drawImage(earth, W / 2 - 190, 140, 380, 380);
      else { x.fillStyle = '#22c55e'; x.fill(); }
      x.restore();
    } catch (e) { x.restore(); }
    x.lineWidth = 10; x.strokeStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.arc(W / 2, 330, 195, 0, Math.PI * 2); x.stroke();

    x.textAlign = 'center'; x.fillStyle = '#fff';
    const f = (w, s) => { x.font = `${w} ${s}px Outfit, Arial, sans-serif`; };
    f(700, 54); x.fillText('EcoPulse 🌿', W / 2, 90);
    const s = scoreValue();
    f(800, 170); x.fillText(s === null ? '--' : String(s), W / 2 - 40, 740);
    f(500, 56); x.fillText('/ 100', W / 2 + 150, 740);
    f(600, 48); x.fillText('My Eco Score', W / 2, 580);
    f(500, 44);
    const co2 = state.calc ? fmt(state.calc.total) + ' kg CO₂ / month' : 'Footprint not calculated yet';
    x.fillText(co2, W / 2, 830);
    x.fillText(`🔥 ${streak()} day streak   ·   ⭐ ${totalPoints()} points`, W / 2, 900);
    f(400, 36); x.globalAlpha = .9;
    x.fillText('Calculate yours at ' + location.host + location.pathname.replace(/index\.html$/, ''), W / 2, 1010);
    x.globalAlpha = 1;
  }
  $('#openShare').addEventListener('click', () => { drawShare(); $('#shareModal').hidden = false; });
  $('#closeShare').addEventListener('click', () => { $('#shareModal').hidden = true; });
  $('#shareModal').addEventListener('click', e => { if (e.target.id === 'shareModal') e.currentTarget.hidden = true; });
  $('#dlBtn').addEventListener('click', () => {
    const a = document.createElement('a'); a.download = 'my-eco-score.png';
    try { a.href = $('#shareCanvas').toDataURL('image/png'); a.click(); } catch (e) { toast('Could not export the image.'); }
  });
  $('#shBtn').addEventListener('click', () => {
    $('#shareCanvas').toBlob(async blob => {
      try {
        const file = new File([blob], 'my-eco-score.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'My EcoPulse score', text: 'Check my eco score on EcoPulse 🌿' });
        } else toast('Sharing is not supported here. Use Download instead.');
      } catch (e) { /* user cancelled */ }
    });
  });

  /* ---------- theme ---------- */
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    $('#themeBtn').textContent = t === 'dark' ? '☀️' : '🌙';
    store.set('ep_theme', t);
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = t === 'dark' ? '#07130d' : '#16a34a';
  }
  applyTheme(store.get('ep_theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  $('#themeBtn').addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    if (donut) { donut.destroy(); donut = null; }
    if (week) { week.destroy(); week = null; }
    renderCharts();
  });

  /* ---------- nav, scroll, reveal ---------- */
  const navLinks = $('#navLinks');
  $('#menuBtn').addEventListener('click', () => navLinks.classList.toggle('open'));
  navLinks.addEventListener('click', e => { if (e.target.tagName === 'A') navLinks.classList.remove('open'); });

  const bar = $('#progress'), toTop = $('#toTop');
  addEventListener('scroll', () => {
    const h = document.documentElement;
    bar.style.width = (h.scrollTop / (h.scrollHeight - h.clientHeight || 1) * 100) + '%';
    toTop.classList.toggle('show', h.scrollTop > 600);
  }, { passive: true });
  toTop.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('show'); io.unobserve(en.target); }
    }), { threshold: .12 });
    $$('.reveal').forEach(el => io.observe(el));

    const links = $$('#navLinks a');
    const spy = new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting) links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id));
    }), { rootMargin: '-45% 0px -50% 0px' });
    links.forEach(a => { const s = $(a.getAttribute('href')); if (s) spy.observe(s); });
  } else $$('.reveal').forEach(el => el.classList.add('show'));

  /* ---------- broken image guard ---------- */
  $$('img').forEach(img => {
    const fail = () => img.classList.add('img-fail');
    img.addEventListener('error', fail);
    if (img.complete && img.naturalWidth === 0) fail();
  });

  /* ---------- init ---------- */
  $('#year').textContent = new Date().getFullYear();
  fillInputs(state.inputs);
  renderChallenge();
  updateAll();
  // charts load deferred; draw again once Chart.js is ready
  addEventListener('load', () => { renderCharts(); });
})();
