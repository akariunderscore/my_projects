// who can hear whom: towns, ranges, and the graph that falls out of them
// no messages yet. just the graph, to see if it's even interesting

const W = 800, H = 560, N = 12, HOME_SEED = 20261015;
const cv = document.getElementById('map');
const ctx = cv.getContext('2d');
const info = document.getElementById('info');
const circlesBtn = document.getElementById('circles');

// mulberry32, tiny and good enough for scattering towns
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ON = ['san', 'villa', 'puerto', 'colonia', 'los', 'santa', 'general', 'monte', 'nueva', 'paso', 'tres', 'laguna'];
const SYL = ['ca', 'ra', 'bel', 'mo', 'ri', 'to', 'ña', 'lo', 'ver', 'qui', 'da', 'sol', 'ma', 'ce', 'ro', 'te'];
function townName(rnd) {
  let s = '';
  const n = 2 + Math.floor(rnd() * 2);
  for (let i = 0; i < n; i++) s += SYL[Math.floor(rnd() * SYL.length)];
  return rnd() < 0.55 ? ON[Math.floor(rnd() * ON.length)] + ' ' + s : s;
}

let seed = HOME_SEED, towns = [], hears = [], hover = -1, showCircles = true, stars = [];

function build(s) {
  seed = s;
  const rnd = prng(s);
  towns = [];
  const pad = 40, minGap = 70;
  let tries = 0;
  while (towns.length < N && tries < 5000) {
    tries++;
    const x = pad + rnd() * (W - 2 * pad), y = pad + rnd() * (H - 2 * pad);
    if (towns.some(t => Math.hypot(t.x - x, t.y - y) < minGap)) continue;
    // squared skew: lots of small stations, a couple of big ones
    const r = 80 + 190 * rnd() ** 2;
    towns.push({ x, y, r, name: townName(rnd) });
  }
  // hears[a][b]: a is inside b's circle, so a hears b
  hears = towns.map(a => towns.map(b => a !== b && Math.hypot(a.x - b.x, a.y - b.y) <= b.r));
  // a bit of stable grain for the background
  stars = [];
  for (let i = 0; i < 220; i++) stars.push([rnd() * W, rnd() * H, rnd()]);
  hover = -1;
  summarise();
  draw();
}

// how far a message from i gets if everyone who hears it repeats it on
function reach(i) {
  const seen = new Set([i]), q = [i];
  while (q.length) {
    const b = q.shift();
    for (let a = 0; a < towns.length; a++) if (hears[a][b] && !seen.has(a)) { seen.add(a); q.push(a); }
  }
  return seen;
}

function summarise() {
  let mutual = 0, oneway = 0, deaf = 0, mute = 0;
  for (let a = 0; a < towns.length; a++) {
    let heardBy = 0, heard = 0;
    for (let b = 0; b < towns.length; b++) {
      if (hears[a][b]) heard++;
      if (hears[b][a]) heardBy++;
      if (b > a) {
        if (hears[a][b] && hears[b][a]) mutual++;
        else if (hears[a][b] || hears[b][a]) oneway++;
      }
    }
    if (!heard) deaf++;
    if (!heardBy) mute++;
  }
  const full = towns.filter((_, i) => reach(i).size === towns.length).length;
  summary = `${seed === HOME_SEED ? 'the usual map' : 'seed ' + seed}: ${mutual} two-way links, ${oneway} one-way, ` +
    `${deaf} town${deaf === 1 ? '' : 's'} hearing nobody, ${mute} nobody hears. ` +
    `${full} of ${towns.length} could reach everyone by relay`;
  info.textContent = summary;
}
let summary = '';

function arrow(x1, y1, x2, y2, col, dashed, w) {
  ctx.strokeStyle = col; ctx.lineWidth = w;
  ctx.setLineDash(dashed ? [5, 5] : []);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.setLineDash([]);
  if (!dashed) return;
  // arrowhead a bit short of the listener's dot
  const ang = Math.atan2(y2 - y1, x2 - x1), d = Math.hypot(x2 - x1, y2 - y1);
  const tx = x1 + Math.cos(ang) * (d - 9), ty = y1 + Math.sin(ang) * (d - 9);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx - 8 * Math.cos(ang - 0.4), ty - 8 * Math.sin(ang - 0.4));
  ctx.lineTo(tx - 8 * Math.cos(ang + 0.4), ty - 8 * Math.sin(ang + 0.4));
  ctx.closePath(); ctx.fill();
}

function draw() {
  ctx.fillStyle = '#05070a'; ctx.fillRect(0, 0, W, H);
  for (const [x, y, b] of stars) {
    ctx.fillStyle = `rgba(140,160,180,${0.04 + b * 0.08})`;
    ctx.fillRect(x, y, 1, 1);
  }

  const reached = hover >= 0 ? reach(hover) : null;

  if (showCircles) {
    towns.forEach((t, i) => {
      const lit = i === hover;
      const g = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, t.r);
      g.addColorStop(0, lit ? 'rgba(233,180,76,0.16)' : 'rgba(90,130,150,0.07)');
      g.addColorStop(1, 'rgba(90,130,150,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = lit ? 'rgba(233,180,76,0.5)' : 'rgba(110,150,170,0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.stroke();
    });
  }

  // edges
  for (let a = 0; a < towns.length; a++) {
    for (let b = a + 1; b < towns.length; b++) {
      const ab = hears[a][b], ba = hears[b][a];
      if (!ab && !ba) continue;
      const A = towns[a], B = towns[b];
      const touches = hover === a || hover === b;
      const dim = hover >= 0 && !touches;
      if (ab && ba) {
        let col = dim ? 'rgba(111,138,153,0.15)' : 'rgba(111,138,153,0.7)';
        if (touches) col = '#c9d6dd';
        arrow(A.x, A.y, B.x, B.y, col, false, touches ? 2 : 1.3);
      } else {
        // speaker -> listener
        const [S, L, si, li] = ab ? [B, A, b, a] : [A, B, a, b];
        let col = dim ? 'rgba(176,138,74,0.15)' : 'rgba(176,138,74,0.75)';
        if (touches) col = si === hover ? '#e9b44c' : '#7fc4d9';
        arrow(S.x, S.y, L.x, L.y, col, true, touches ? 2 : 1.2);
      }
    }
  }

  // towns
  ctx.font = '12px ui-monospace, Menlo, Consolas, monospace';
  ctx.textBaseline = 'middle';
  towns.forEach((t, i) => {
    let fill = '#cfd8dc';
    if (hover >= 0) {
      if (i === hover) fill = '#fff';
      else if (hears[i][hover]) fill = '#e9b44c';
      else if (hears[hover][i]) fill = '#7fc4d9';
      else if (reached.has(i)) fill = '#8a7a5a';
      else fill = '#3a4248';
    }
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.arc(t.x, t.y, i === hover ? 6 : 4.5, 0, Math.PI * 2); ctx.fill();
    const left = t.x > W - 130;
    ctx.textAlign = left ? 'right' : 'left';
    ctx.fillStyle = hover >= 0 && fill === '#3a4248' ? '#3a4248' : '#8f9aa0';
    ctx.fillText(t.name, t.x + (left ? -10 : 10), t.y - 1);
  });
}

function pick(ev) {
  const r = cv.getBoundingClientRect();
  const x = (ev.clientX - r.left) * W / r.width, y = (ev.clientY - r.top) * H / r.height;
  let best = -1, bd = 22;
  towns.forEach((t, i) => { const d = Math.hypot(t.x - x, t.y - y); if (d < bd) { bd = d; best = i; } });
  return best;
}

function setHover(i) {
  if (i === hover) return;
  hover = i;
  if (i < 0) { info.textContent = summary; draw(); return; }
  const t = towns[i];
  const heardBy = towns.filter((_, a) => hears[a][i]).length;
  const heard = towns.filter((_, b) => hears[i][b]).length;
  const r = reach(i).size - 1;
  info.textContent = `${t.name}: heard directly by ${heardBy}, hears ${heard}. ` +
    `with everyone relaying, a message from here reaches ${r} of ${towns.length - 1}` +
    (heardBy === 0 ? ' (shouting into the void, sorry)' : '');
  draw();
}

cv.addEventListener('mousemove', e => setHover(pick(e)));
cv.addEventListener('mouseleave', () => setHover(-1));
cv.addEventListener('click', e => setHover(pick(e)));   // taps on phones
circlesBtn.addEventListener('click', () => {
  showCircles = !showCircles;
  circlesBtn.classList.toggle('on', showCircles);
  draw();
});
document.getElementById('reseed').addEventListener('click', () => build((Math.random() * 2 ** 32) >>> 0));
document.getElementById('home').addEventListener('click', () => build(HOME_SEED));

build(HOME_SEED);
