
/* ==========================================
   EcoPulse - script.js
   ========================================== */

const $ = id => document.getElementById(id);

/* ---------- MOBILE MENU ---------- */
const menuBtn = $('menuBtn');
const navLinks = $('navLinks');

if (menuBtn && navLinks) {
  menuBtn.addEventListener('click', () => navLinks.classList.toggle('open'));
  navLinks.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => navLinks.classList.remove('open'))
  );
}

/* ---------- CARBON FOOTPRINT CALCULATOR ---------- */
const FACTORS = {
  car: 0.21,         // kg CO2 per km (car/bike)
  bus: 0.08,         // kg CO2 per km (public transport)
  elec: 0.82,        // kg CO2 per kWh (approx. India grid)
  lpg: 42,           // kg CO2 per 14.2 kg cylinder
  treePerYear: 20    // kg CO2 absorbed by one tree per year
};
const INDIA_AVG = 160; // approx. kg CO2 per person per month

function num(id) {
  const v = parseFloat($(id).value);
  return isNaN(v) || v < 0 ? 0 : v;
}

function calculate() {
  const wasteMul = parseFloat($('waste').value);
  const data = [
    { name: '🚗 Personal transport', value: num('car') * 30 * FACTORS.car },
    { name: '🚌 Public transport',   value: num('bus') * 30 * FACTORS.bus },
    { name: '⚡ Electricity',         value: num('elec') * FACTORS.elec },
    { name: '🔥 LPG / cooking',      value: num('lpg') * FACTORS.lpg },
    { name: '🍽️ Diet',               value: parseFloat($('diet').value) }
  ];

  // Waste adds roughly 10% of the subtotal, adjusted by recycling habit
  const subtotal = data.reduce((s, d) => s + d.value, 0);
  data.push({ name: '🗑️ Waste', value: subtotal * 0.1 * wasteMul });

  const total = data.reduce((s, d) => s + d.value, 0);
  showResult(data, total);

  try { localStorage.setItem('ecopulse_total', total.toFixed(1)); } catch (e) {}
  updateEcoScore();
}

function showResult(data, total) {
  $('placeholder').style.display = 'none';
  $('result').style.display = 'block';
  $('totalNum').textContent = Math.round(total);

  const badge = $('badge');
  if (total < INDIA_AVG * 0.8) {
    badge.textContent = 'Eco Hero 🌟';
    badge.style.background = '#1f9d55';
  } else if (total < INDIA_AVG * 1.3) {
    badge.textContent = 'Average 🙂';
    badge.style.background = '#e08a1e';
  } else {
    badge.textContent = 'High Impact ⚠️';
    badge.style.background = '#d64545';
  }

  const max = Math.max(...data.map(d => d.value), 1);
  $('bars').innerHTML = data.map(d => `
    <div class="bar-row">
      <div class="bar-label"><span>${d.name}</span><span>${d.value.toFixed(1)} kg</span></div>
      <div class="bar-bg"><div class="bar-fill" data-w="${(d.value / max) * 100}"></div></div>
    </div>`).join('');

  requestAnimationFrame(() => {
    document.querySelectorAll('#bars .bar-fill').forEach(b => {
      b.style.width = b.dataset.w + '%';
    });
  });

  const diff = ((total - INDIA_AVG) / INDIA_AVG) * 100;
  $('compare').textContent = diff >= 0
    ? `You emit about ${Math.abs(diff).toFixed(0)}% MORE than the approx. Indian average (${INDIA_AVG} kg/month).`
    : `You emit about ${Math.abs(diff).toFixed(0)}% LESS than the approx. Indian average (${INDIA_AVG} kg/month). Great job!`;

  const trees = Math.ceil((total * 12) / FACTORS.treePerYear);
  $('treesText').textContent = `🌳 About ${trees} trees are needed to absorb your yearly emissions.`;
  $('statTrees').textContent = trees;
}

function resetCalc() {
  $('car').value = 10;
  $('bus').value = 5;
  $('elec').value = 150;
  $('lpg').value = 0.8;
  $('diet').selectedIndex = 2;
  $('waste').selectedIndex = 1;
  $('result').style.display = 'none';
  $('placeholder').style.display = 'block';
  $('statTrees').textContent = 0;
  try { localStorage.removeItem('ecopulse_total'); } catch (e) {}
  updateEcoScore();
}

$('calcBtn').addEventListener('click', calculate);
$('resetBtn').addEventListener('click', resetCalc);

/* ---------- DAILY HABIT TRACKER ---------- */
const HABITS = [
  { id: 'bag',     name: '🛍️ Used a cloth bag / avoided plastic',       pts: 10 },
  { id: 'transit', name: '🚌 Used public transport / walked / cycled',   pts: 20 },
  { id: 'lights',  name: '💡 Turned off unused lights & fans',           pts: 10 },
  { id: 'water',   name: '💧 Saved water (short shower, no leaks)',      pts: 10 },
  { id: 'veg',     name: '🥗 Had a plant-based meal',                    pts: 15 },
  { id: 'waste',   name: '♻️ Segregated my waste',                       pts: 15 },
  { id: 'bottle',  name: '🚰 Used a reusable water bottle',              pts: 10 },
  { id: 'plant',   name: '🌱 Planted / watered a plant',                 pts: 10 }
];
const MAX_POINTS = HABITS.reduce((s, h) => s + h.pts, 0);
const HABIT_KEY = 'ecopulse_habits';

function todayKey(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d.getFullYear() + '-' +
         String(d.getMonth() + 1).padStart(2, '0') + '-' +
         String(d.getDate()).padStart(2, '0');
}

function loadStore() {
  try { return JSON.parse(localStorage.getItem(HABIT_KEY)) || {}; }
  catch (e) { return {}; }
}

function saveStore(store) {
  try { localStorage.setItem(HABIT_KEY, JSON.stringify(store)); } catch (e) {}
}

function calcStreak(store) {
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const day = store[todayKey(i)];
    if (day && day.length > 0) streak++;
    else if (i === 0) continue;   // aaj abhi kuch tick nahi kiya toh chalega
    else break;
  }
  return streak;
}

function renderHabits() {
  const store = loadStore();
  const done = store[todayKey()] || [];

  $('habitList').innerHTML = HABITS.map(h => `
    <label class="habit ${done.includes(h.id) ? 'done' : ''}">
      <input type="checkbox" data-id="${h.id}" ${done.includes(h.id) ? 'checked' : ''}>
      <span class="name">${h.name}</span>
      <span class="pts">+${h.pts}</span>
    </label>`).join('');

  const pts = HABITS.filter(h => done.includes(h.id)).reduce((s, h) => s + h.pts, 0);
  const pct = Math.round((pts / MAX_POINTS) * 100);
  const streak = calcStreak(store);

  $('points').textContent = pts;
  $('statPoints').textContent = pts;
  $('streak').textContent = streak;
  $('statStreak').textContent = streak;
  $('progressText').textContent = pct + '%';
  $('progressBar').style.width = pct + '%';

  updateEcoScore();
}

$('habitList').addEventListener('change', e => {
  if (e.target.type !== 'checkbox') return;
  const store = loadStore();
  const key = todayKey();
  let list = store[key] || [];
  const id = e.target.dataset.id;

  list = e.target.checked
    ? [...new Set([...list, id])]
    : list.filter(x => x !== id);

  store[key] = list;
  saveStore(store);
  renderHabits();
});

/* ---------- ECO SCORE ---------- */
function updateEcoScore() {
  const valueEl = $('ecoScoreValue');
  const labelEl = $('ecoScoreLabel');
  if (!valueEl || !labelEl) return;

  let total = null;
  try { total = parseFloat(localStorage.getItem('ecopulse_total')); } catch (e) {}

  if (!total || isNaN(total)) {
    valueEl.textContent = '--';
    labelEl.textContent = 'Calculate your footprint to see your score';
    return;
  }

  // Footprint score: 0 kg = 100, double the average (or more) = 0
  const footprintScore = Math.max(0, Math.min(100, 100 - (total / (INDIA_AVG * 2)) * 100));

  // Habit score: aaj ke habit progress (%)
  const store = loadStore();
  const done = store[todayKey()] || [];
  const pts = HABITS.filter(h => done.includes(h.id)).reduce((s, h) => s + h.pts, 0);
  const habitScore = (pts / MAX_POINTS) * 100;

  const score = Math.round(footprintScore * 0.6 + habitScore * 0.4);
  valueEl.textContent = score;

  if (score >= 80)      labelEl.textContent = 'Excellent! You are an Eco Hero 🌟';
  else if (score >= 60) labelEl.textContent = 'Good going! Keep it up 🌿';
  else if (score >= 40) labelEl.textContent = 'Average. Small changes will help 🙂';
  else                  labelEl.textContent = 'Needs improvement. Start with daily habits 🌱';
}

/* ---------- ECO ASSISTANT (CHAT) ---------- */
const REPLIES = [
  { keys: ['electric', 'bijli', 'energy', 'power', 'led'],
    text: 'Switch to LED bulbs, use 5-star rated appliances and unplug chargers when not in use. It cuts your electricity footprint a lot. 💡' },
  { keys: ['water', 'paani', 'pani'],
    text: 'Fix leaking taps, take shorter showers and turn off the tap while brushing. Collect RO waste water for plants. 💧' },
  { keys: ['waste', 'plastic', 'recycle', 'kachra'],
    text: 'Separate wet and dry waste, carry a cloth bag and avoid single-use plastic. Compost kitchen waste if you can. ♻️' },
  { keys: ['car', 'travel', 'transport', 'petrol', 'bus', 'metro'],
    text: 'Use public transport, carpool, cycle or walk for short trips. If buying a vehicle, consider an electric one. 🚌' },
  { keys: ['food', 'diet', 'veg', 'meat', 'khana'],
    text: 'Eating more plant-based meals and wasting less food lowers your diet footprint. Buy local and seasonal. 🥗' },
  { keys: ['tree', 'plant', 'ped', 'paudha'],
    text: 'One tree absorbs roughly 20 kg of CO₂ every year. Plant native trees and take care of them. 🌳' },
  { keys: ['score', 'point', 'streak'],
    text: 'Your eco score depends on your monthly CO₂ and your daily habits. Calculate your footprint and tick habits daily to improve it. 🏆' },
  { keys: ['hi', 'hello', 'hey', 'namaste'],
    text: 'Hello! 🌿 Ask me about electricity, water, waste, travel, food or trees.' }
];

function botReply(question) {
  const q = question.toLowerCase();
  for (const r of REPLIES) {
    if (r.keys.some(k => q.includes(k))) return r.text;
  }
  return 'I can help with electricity, water, waste, travel, food and trees. Try asking something like "how to save water?" 🌍';
}

function addMessage(text, who) {
  const box = $('chatBox');
  const div = document.createElement('div');
  div.className = 'msg ' + who;
  div.textContent = text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function sendChat() {
  const input = $('chatInput');
  const text = input.value.trim();
  if (!text) return;
  addMessage(text, 'user');
  input.value = '';
  setTimeout(() => addMessage(botReply(text), 'bot'), 400);
}

$('chatBtn').addEventListener('click', sendChat);
$('chatInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') sendChat();
});

/* ---------- CONTACT FORM ---------- */
const contactForm = $('contactForm');
if (contactForm) {
  contactForm.addEventListener('submit', e => {
    e.preventDefault();
    alert('Thank you! Your message has been received. 💚');
    contactForm.reset();
  });
}

/* ---------- INIT ---------- */
$('todayDate').textContent = new Date().toLocaleDateString('en-IN', {
  weekday: 'long', day: 'numeric', month: 'long'
});
$('year').textContent = new Date().getFullYear();
renderHabits();
