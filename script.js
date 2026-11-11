/* ==========================================
   EcoPulse - script.js
   ========================================== */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  /* ---------- localStorage helpers (error-safe) ---------- */
  function load(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  /* ---------- date helpers ---------- */
  function dateKey(d) {
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }
  var todayKey = dateKey(new Date());
  var yd = new Date();
  yd.setDate(yd.getDate() - 1);
  var yesterdayKey = dateKey(yd);

  /* ==========================================
     1. NAVBAR (mobile menu)
     ========================================== */
  var menuBtn = $('menuBtn');
  var navLinks = $('navLinks');
  if (menuBtn && navLinks) {
    menuBtn.addEventListener('click', function () {
      navLinks.classList.toggle('open');
    });
    navLinks.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { navLinks.classList.remove('open'); });
    });
  }

  /* ==========================================
     2. FOOTER YEAR
     ========================================== */
  if ($('year')) $('year').textContent = new Date().getFullYear();

  /* ==========================================
     3. CARBON CALCULATOR
     (approximate emission factors, awareness only)
     ========================================== */
  var AVG_MONTHLY = 400;          // approx. kg CO2 per person per month
  var CAR_KG_PER_KM = 0.12;
  var BUS_KG_PER_KM = 0.05;
  var ELEC_KG_PER_KWH = 0.82;
  var LPG_KG_PER_CYL = 42;        // ~14.2 kg cylinder
  var WASTE_BASE = 25;            // kg CO2 per month before recycling factor
  var DAYS = 30;

  var DEFAULTS = { car: 10, bus: 5, elec: 150, lpg: 0.8, diet: '110', waste: '1' };

  function num(id) {
    var v = parseFloat($(id).value);
    return isNaN(v) || v < 0 ? 0 : v;
  }

  function calculate() {
    var parts = [
      { name: 'Car / bike',   icon: '🚗', value: num('car')  * CAR_KG_PER_KM * DAYS },
      { name: 'Public transport', icon: '🚌', value: num('bus')  * BUS_KG_PER_KM * DAYS },
      { name: 'Electricity',  icon: '💡', value: num('elec') * ELEC_KG_PER_KWH },
      { name: 'LPG',          icon: '🔥', value: num('lpg')  * LPG_KG_PER_CYL },
      { name: 'Diet',         icon: '🍽️', value: parseFloat($('diet').value) || 0 },
      { name: 'Waste',        icon: '🗑️', value: WASTE_BASE * (parseFloat($('waste').value) || 1) }
    ];

    var total = parts.reduce(function (s, p) { return s + p.value; }, 0);
    total = Math.round(total);

    showResult(parts, total);
    save('ecopulse_total', total);
    updateStatsAndScore();
  }

  function showResult(parts, total) {
    $('placeholder').style.display = 'none';
    $('result').style.display = 'block';
    $('totalNum').textContent = total;

    var badge = $('badge');
    if (total <= 200) badge.textContent = 'Low footprint 🌟';
    else if (total <= AVG_MONTHLY) badge.textContent = 'Moderate footprint 🌿';
    else badge.textContent = 'High footprint ⚠️';

    // bars
    var maxVal = Math.max.apply(null, parts.map(function (p) { return p.value; })) || 1;
    var bars = $('bars');
    bars.innerHTML = '';
    parts.forEach(function (p) {
      var row = document.createElement('div');
      row.className = 'bar-row';

      var label = document.createElement('div');
      label.className = 'bar-label';
      var left = document.createElement('span');
      left.textContent = p.icon + ' ' + p.name;
      var right = document.createElement('span');
      right.textContent = Math.round(p.value) + ' kg';
      label.appendChild(left);
      label.appendChild(right);

      var bg = document.createElement('div');
      bg.className = 'bar-bg';
      var fill = document.createElement('div');
      fill.className = 'bar-fill';
      bg.appendChild(fill);

      row.appendChild(label);
      row.appendChild(bg);
      bars.appendChild(row);

      // animate
      setTimeout(function () { fill.style.width = Math.round((p.value / maxVal) * 100) + '%'; }, 50);
    });

    // compare
    var diff = total - AVG_MONTHLY;
    var pct = Math.round(Math.abs(diff) / AVG_MONTHLY * 100);
    if (diff <= 0) {
      $('compare').textContent = '✅ You are about ' + pct + '% below the approx. average of ' + AVG_MONTHLY + ' kg per month.';
    } else {
      $('compare').textContent = '⚠️ You are about ' + pct + '% above the approx. average of ' + AVG_MONTHLY + ' kg per month.';
    }

    // trees
    var trees = treesNeeded(total);
    $('treesText').textContent = '🌳 About ' + trees + ' trees are needed to offset one year of this footprint (1 tree ≈ 20 kg CO₂ per year).';
  }

  function treesNeeded(total) {
    return Math.ceil((total * 12) / 20);
  }

  function resetCalculator() {
    $('car').value = DEFAULTS.car;
    $('bus').value = DEFAULTS.bus;
    $('elec').value = DEFAULTS.elec;
    $('lpg').value = DEFAULTS.lpg;
    $('diet').value = DEFAULTS.diet;
    $('waste').value = DEFAULTS.waste;

    $('result').style.display = 'none';
    $('placeholder').style.display = 'block';
    $('bars').innerHTML = '';
    save('ecopulse_total', null);
    updateStatsAndScore();
  }

  if ($('calcBtn')) $('calcBtn').addEventListener('click', calculate);
  if ($('resetBtn')) $('resetBtn').addEventListener('click', resetCalculator);

  // initial state: result hidden
  if ($('result')) $('result').style.display = 'none';

  /* ==========================================
     4. DAILY HABITS
     ========================================== */
  var HABITS = [
    { id: 'transit', text: 'Used public transport / cycled / walked', pts: 15 },
    { id: 'lights',  text: 'Switched off lights and fans when not needed', pts: 10 },
    { id: 'water',   text: 'Saved water (short shower, closed the tap)', pts: 10 },
    { id: 'veg',     text: 'Ate a plant-based meal', pts: 15 },
    { id: 'bag',     text: 'Used a cloth bag / reusable bottle', pts: 10 },
    { id: 'waste',   text: 'Segregated wet and dry waste', pts: 10 },
    { id: 'unplug',  text: 'Unplugged idle chargers and devices', pts: 10 },
    { id: 'plant',   text: 'Planted or watered a plant', pts: 20 }
  ];
  var MAX_POINTS = HABITS.reduce(function (s, h) { return s + h.pts; }, 0);

  var HABIT_KEY = 'ecopulse_habits_' + todayKey;
  var doneIds = load(HABIT_KEY, []);

  if ($('todayDate')) {
    $('todayDate').textContent = '📅 ' + new Date().toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    });
  }

  function renderHabits() {
    var list = $('habitList');
    if (!list) return;
    list.innerHTML = '';

    HABITS.forEach(function (h) {
      var label = document.createElement('label');
      label.className = 'habit' + (doneIds.indexOf(h.id) !== -1 ? ' done' : '');

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = doneIds.indexOf(h.id) !== -1;

      var text = document.createElement('span');
      text.textContent = h.text;
      text.style.flex = '1';

      var pts = document.createElement('small');
      pts.textContent = '+' + h.pts;
      pts.style.fontWeight = '700';
      pts.style.color = 'var(--green)';

      cb.addEventListener('change', function () {
        if (cb.checked) {
          if (doneIds.indexOf(h.id) === -1) doneIds.push(h.id);
          label.classList.add('done');
        } else {
          doneIds = doneIds.filter(function (x) { return x !== h.id; });
          label.classList.remove('done');
        }
        save(HABIT_KEY, doneIds);
        onHabitsChanged();
      });

      label.appendChild(cb);
      label.appendChild(text);
      label.appendChild(pts);
      list.appendChild(label);
    });
  }

  function todayPoints() {
    return HABITS.reduce(function (s, h) {
      return s + (doneIds.indexOf(h.id) !== -1 ? h.pts : 0);
    }, 0);
  }

  /* streak: {count, last, prevCount, prevLast} */
  function getStreak() {
    return load('ecopulse_streak', { count: 0, last: '', prevCount: 0, prevLast: '' });
  }
  function shownStreak(s) {
    return (s.last === todayKey || s.last === yesterdayKey) ? s.count : 0;
  }

  function onHabitsChanged() {
    var s = getStreak();

    if (doneIds.length > 0 && s.last !== todayKey) {
      s.prevCount = s.count;
      s.prevLast = s.last;
      s.count = (s.last === yesterdayKey) ? s.count + 1 : 1;
      s.last = todayKey;
      save('ecopulse_ever', true);
    } else if (doneIds.length === 0 && s.last === todayKey) {
      s.count = s.prevCount;
      s.last = s.prevLast;
    }
    save('ecopulse_streak', s);

    updateHabitUI();
    updateStatsAndScore();
    updateBadges();
  }

  function updateHabitUI() {
    var pts = todayPoints();
    var pct = Math.round((pts / MAX_POINTS) * 100);
    var s = getStreak();

    if ($('points')) $('points').textContent = pts;
    if ($('streak')) $('streak').textContent = shownStreak(s);
    if ($('progressText')) $('progressText').textContent = pct + '%';
    if ($('progressBar')) $('progressBar').style.width = pct + '%';
  }

  /* ==========================================
     5. HERO STATS + ECO SCORE
     ========================================== */
  function updateStatsAndScore() {
    var total = load('ecopulse_total', null);
    var pts = todayPoints();
    var streak = shownStreak(getStreak());

    if ($('statTrees')) $('statTrees').textContent = total ? treesNeeded(total) : 0;
    if ($('statPoints')) $('statPoints').textContent = pts;
    if ($('statStreak')) $('statStreak').textContent = streak;

    var valueEl = $('ecoScoreValue');
    var labelEl = $('ecoScoreLabel');
    if (!valueEl || !labelEl) return;

    if (!total) {
      valueEl.textContent = '--';
      labelEl.textContent = 'Calculate your footprint to see your score';
      return;
    }

    // 70% footprint + 30% today's habits
    var footprintScore = Math.max(0, Math.min(100, 100 - total / 8));
    var habitScore = (pts / MAX_POINTS) * 100;
    var score = Math.round(footprintScore * 0.7 + habitScore * 0.3);

    valueEl.textContent = score;
    if (score >= 80) labelEl.textContent = 'Excellent! You are an Eco Hero 🌍';
    else if (score >= 60) labelEl.textContent = 'Good, you are on the right track 🌿';
    else if (score >= 40) labelEl.textContent = 'Average, there is room to improve 🌱';
    else labelEl.textContent = 'Needs work, start with small changes 💪';
  }

  /* ==========================================
     6. BADGES / REWARDS
     ========================================== */
  function updateBadges() {
    var items = document.querySelectorAll('.badge-list li');
    if (!items.length) return;

    var streak = shownStreak(getStreak());
    var ever = load('ecopulse_ever', false);
    var unlocked = [ever, streak >= 3, streak >= 7, streak >= 30];

    items.forEach(function (li, i) {
      if (unlocked[i]) li.classList.remove('locked');
      else li.classList.add('locked');
    });
  }

  /* ==========================================
     7. ECO ASSISTANT (simple keyword replies)
     ========================================== */
  var REPLIES = [
    { keys: ['energy', 'electric', 'bijli', 'power', 'light'],
      reply: 'Switch to LED bulbs, use a 5-star rated AC/fan, and unplug idle chargers. These cut your electricity use a lot. 💡' },
    { keys: ['water', 'paani', 'tap', 'shower'],
      reply: 'Fix leaking taps, turn off the tap while brushing, and take shorter showers. Collect RO reject water for plants. 💧' },
    { keys: ['waste', 'plastic', 'recycle', 'kachra'],
      reply: 'Separate wet and dry waste, carry a cloth bag, and avoid single-use plastic. Compost kitchen waste if you can. ♻️' },
    { keys: ['travel', 'car', 'transport', 'bus', 'metro', 'petrol', 'ev'],
      reply: 'Use public transport, cycle or carpool for short trips. An electric vehicle has no tailpipe emissions. 🚌' },
    { keys: ['food', 'diet', 'veg', 'meat', 'khana'],
      reply: 'Eating more plant-based meals and wasting less food lowers your footprint. Buy local and seasonal. 🥗' },
    { keys: ['lpg', 'gas', 'cook'],
      reply: 'Use a pressure cooker, keep lids on pots and soak pulses first. It saves LPG. 🔥' },
    { keys: ['tree', 'plant', 'ped'],
      reply: 'One tree absorbs roughly 20 kg of CO₂ every year. Plant native trees and look after them. 🌳' },
    { keys: ['score', 'point', 'streak', 'badge'],
      reply: 'Tick your daily habits to earn points. Keep a daily streak to unlock badges. 🏆' },
    { keys: ['hello', 'hi', 'hey', 'namaste'],
      reply: 'Hello! 🌿 Ask me about energy, water, waste, travel or food tips.' }
  ];

  function botReply(text) {
    var t = text.toLowerCase();
    for (var i = 0; i < REPLIES.length; i++) {
      for (var j = 0; j < REPLIES[i].keys.length; j++) {
        if (t.indexOf(REPLIES[i].keys[j]) !== -1) return REPLIES[i].reply;
      }
    }
    return 'I can help with energy, water, waste, travel, food and LPG tips. Try asking: "How to save water?" 🌍';
  }

  function addMsg(text, who) {
    var box = $('chatBox');
    var div = document.createElement('div');
    div.className = 'msg ' + who;
    div.textContent = text;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  function sendChat() {
    var input = $('chatInput');
    var text = input.value.trim();
    if (!text) return;
    addMsg(text, 'user');
    input.value = '';
    setTimeout(function () { addMsg(botReply(text), 'bot'); }, 400);
  }

  if ($('chatBtn')) $('chatBtn').addEventListener('click', sendChat);
  if ($('chatInput')) {
    $('chatInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); sendChat(); }
    });
  }

  /* ==========================================
     8. CONTACT FORM (demo only, nothing is sent)
     ========================================== */
  var form = $('contactForm');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      alert('Thank you! Your message has been noted. (Demo form: nothing is sent to a server yet.)');
      form.reset();
    });
  }

  /* ==========================================
     INIT
     ========================================== */
  renderHabits();
  updateHabitUI();
  updateBadges();
  updateStatsAndScore();
})();
