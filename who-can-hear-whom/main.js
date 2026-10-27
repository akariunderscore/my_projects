// who can hear whom: towns, ranges, and the graph that falls out of them
// now with messages, at a deliberately terrible typing speed

const W = 800, H = 560, N = 12;
const CPS = 5;          // characters per second, on purpose
const SPEED = 170;      // px per second a ring travels
const RELAY_PAUSE = 0.7;// seconds a town waits before repeating what it heard
const DROP = '·';
const KEEP_LOGS = 3;    // how many messages the transcript remembers
const cv = document.getElementById('map');
const ctx = cv.getContext('2d');
const info = document.getElementById('info');
const circlesBtn = document.getElementById('circles');
const msgIn = document.getElementById('msg');
const logEl = document.getElementById('log');

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

function makeMap(s) {
  const rnd = prng(s);
  const ts = [];
  const pad = 40, minGap = 70;
  let tries = 0;
  while (ts.length < N && tries < 5000) {
    tries++;
    const x = pad + rnd() * (W - 2 * pad), y = pad + rnd() * (H - 2 * pad);
    if (ts.some(t => Math.hypot(t.x - x, t.y - y) < minGap)) continue;
    // squared skew: lots of small stations, a couple of big ones
    const r = 80 + 190 * rnd() ** 2;
    ts.push({ x, y, r, name: townName(rnd) });
  }
  // h[a][b]: a is inside b's circle, so a hears b
  const h = ts.map(a => ts.map(b => a !== b && Math.hypot(a.x - b.x, a.y - b.y) <= b.r));
  const st = [];
  for (let i = 0; i < 220; i++) st.push([rnd() * W, rnd() * H, rnd()]);
  return { towns: ts, hears: h, stars: st };
}

function reachIn(h, i) {
  const seen = new Set([i]), q = [i];
  while (q.length) {
    const b = q.shift();
    for (let a = 0; a < h.length; a++) if (h[a][b] && !seen.has(a)) { seen.add(a); q.push(a); }
  }
  return seen;
}

function stats(h) {
  let mutual = 0, oneway = 0, deaf = 0, mute = 0;
  for (let a = 0; a < h.length; a++) {
    let heardBy = 0, heard = 0;
    for (let b = 0; b < h.length; b++) {
      if (h[a][b]) heard++;
      if (h[b][a]) heardBy++;
      if (b > a) {
        if (h[a][b] && h[b][a]) mutual++;
        else if (h[a][b] || h[b][a]) oneway++;
      }
    }
    if (!heard) deaf++;
    if (!heardBy) mute++;
  }
  const full = h.filter((_, i) => reachIn(h, i).size === h.length).length;
  return { mutual, oneway, deaf, mute, full };
}

// the usual map: score seeds by how far they are from 'interesting' (a few one-way
// links, exactly one deaf town, nobody mute, a decent chunk that can reach everyone)
// and keep the best. no hard fallback any more, so it can't quietly give up
const HOME_SEED = (() => {
  let best = 20261015, bestScore = Infinity;
  for (let s = 20261015; s < 20261015 + 3000; s++) {
    const m = makeMap(s);
    if (m.towns.length < N) continue;
    const k = stats(m.hears);
    const score = Math.abs(k.oneway - 4) + 3 * Math.abs(k.deaf - 1) + 3 * k.mute + Math.max(0, 4 - k.full);
    if (score < bestScore) { best = s; bestScore = score; }
    if (score === 0) break;
  }
  return best;
})();

let seed = HOME_SEED, towns = [], hears = [], hover = -1, sel = -1, showCircles = true, stars = [];
let summary = '';
// message state
// owner: 'id:town' -> which town's copy that town committed to. this used to live in the
// on-screen label buffer, which draw() throws away once it fades, so a slow echo arriving
// after the fade got treated as brand new (and the original speaker would happily repeat
// a mangled copy of its own message back out). logic and display are separate now
let txs = [], events = [], bufs = [], relayed = new Set(), owner = new Map(), nextId = 1, logs = [];

function build(s) {
  seed = s;
  ({ towns, hears, stars } = makeMap(s));
  hover = -1; sel = -1;
  txs = []; events = []; relayed = new Set(); owner = new Map(); logs = [];
  bufs = towns.map(() => null);
  renderLog();
  const k = stats(hears);
  summary = `${seed === HOME_SEED ? 'the usual map' : 'seed ' + seed}: ${k.mutual} two-way links, ${k.oneway} one-way, ` +
    `${k.deaf} town${k.deaf === 1 ? '' : 's'} hearing nobody, ${k.mute} nobody hears. ` +
    `${k.full} of ${towns.length} could reach everyone by relay`;
  info.textContent = summary;
  msgIn.placeholder = 'click a town first';
}

const reach = i => reachIn(hears, i);
const now = () => performance.now() / 1000;

// chance a character gets lost, by how far out in the speaker's circle you are.
// was 0.02 + 0.6q^2.5, which made the edge basically soup after one hop.
// now: near-perfect for the inner half, about half the letters at the very edge.
// (back of envelope: a listener dropped uniformly in the circle loses ~20% on average,
// 0.02 + 0.45 * E[q^3] with q's density 2q. lossy enough to stack over 3 hops, i think)
function dropChance(d, r) {
  const q = Math.min(1, d / r);
  return 0.02 + 0.45 * q ** 3;
}

const kept = s => [...s].filter(c => c !== DROP).length;

// the heard text, with lost letters dimmed so the survivors are what you read
function heardSpans(el, s) {
  let run = '', runDrop = null;
  const flush = () => {
    if (!run) return;
    const sp = document.createElement('span');
    if (runDrop) sp.className = 'lost';
    sp.textContent = run;
    el.appendChild(sp);
    run = '';
  };
  for (const c of s) {
    const isDrop = c === DROP;
    if (isDrop !== runDrop) { flush(); runDrop = isDrop; }
    run += c;
  }
  flush();
}

// transcript: one entry per original message. real copies get a line each, indented by hop,
// with how many letters went missing on *that* hop (not the running total).
// the parent's text is looked up by town, which is safe because owner/relayed mean each
// town gets at most one line per message, and drops only ever add, so the diff is >= 0
function renderLog() {
  logEl.textContent = '';
  if (!logs.length) {
    logEl.innerHTML = '<div class="empty">(transcript of who heard what from whom shows up here)</div>';
    return;
  }
  for (const L of logs.slice().reverse()) {
    const box = document.createElement('div');
    box.className = 'msg';
    const head = document.createElement('div');
    head.className = 'head';
    head.style.color = genCol(0, 1);
    head.textContent = `${towns[L.from].name} says: ${L.text}`;
    box.appendChild(head);

    const textOf = town => town === L.from ? L.text : (L.lines.find(x => x.to === town) || {}).heard || L.text;
    const real = L.lines.filter(ln => !ln.junk), junk = L.lines.filter(ln => ln.junk);
    for (const ln of real) {
      const d = document.createElement('div');
      d.style.paddingLeft = (ln.gen * 1.2) + 'em';
      d.style.color = genCol(ln.gen, 0.9);
      d.appendChild(document.createTextNode(`${towns[ln.by].name} › ${towns[ln.to].name}: `));
      heardSpans(d, ln.heard);
      const fresh = kept(textOf(ln.by)) - kept(ln.heard);
      const tail = document.createElement('span');
      tail.className = 'aside';
      tail.textContent = fresh === 0 ? '  (clean hop)' : `  (−${fresh} on this hop, ${kept(ln.heard)}/${L.text.length} left)`;
      d.appendChild(tail);
      box.appendChild(d);
    }
    if (junk.length) {
      const d = document.createElement('div');
      d.className = 'empty';
      d.textContent = `only noise reached ${junk.map(ln => towns[ln.to].name).join(', ')}, so it stopped there`;
      box.appendChild(d);
    }
    const missing = towns.length - 1 - L.lines.length;
    if (L.done) {
      const d = document.createElement('div');
      d.className = 'empty';
      const whole = real.filter(ln => kept(ln.heard) === L.text.length).length;
      d.textContent = `${real.length} of ${towns.length - 1} got something readable, ${whole} word-perfect` +
        (missing > 0 ? `, ${missing} never heard it at all` : '');
      box.appendChild(d);
    }
    logEl.appendChild(box);
  }
}

function transmit(from, text, id, gen) {
  const t0 = now();
  txs.push({ from, len: text.length, t0, gen });
  if (gen === 0) {
    logs.push({ id, from, text, lines: [], done: false });
    if (logs.length > KEEP_LOGS) logs.shift();
    renderLog();
  }
  // a speaker has committed to its own version, original or relayed, and never takes another
  owner.set(id + ':' + from, from);
  relayed.add(id + ':' + from);
  // the speaker's own label types out too
  bufs[from] = { id, src: from, gen, chars: [], len: text.length, last: t0 };
  for (let i = 0; i < text.length; i++) events.push({ t: t0 + i / CPS, town: from, src: from, id, gen, i, ch: text[i], len: text.length });
  const S = towns[from];
  for (let a = 0; a < towns.length; a++) {
    if (!hears[a][from]) continue;
    const d = Math.hypot(towns[a].x - S.x, towns[a].y - S.y), p = dropChance(d, S.r);
    for (let i = 0; i < text.length; i++) {
      const ch = text[i] === DROP || Math.random() < p ? DROP : text[i];
      events.push({ t: t0 + i / CPS + d / SPEED, town: a, src: from, id, gen: gen + 1, i, ch, len: text.length });
    }
  }
  events.sort((x, y) => x.t - y.t);
}

function markDone() {
  // a message is finished once nothing about it is still queued
  let changed = false;
  for (const L of logs) {
    if (L.done) continue;
    if (!events.some(e => e.id === L.id)) { L.done = true; changed = true; }
  }
  if (changed) renderLog();
}

function step(t) {
  let any = false;
  while (events.length && events[0].t <= t) {
    any = true;
    const e = events.shift();
    if (e.town === -1) { // a queued relay
      transmit(e.src, e.text, e.id, e.gen);
      continue;
    }
    // first copy to reach a town wins, forever, regardless of what the label is doing
    const key = e.id + ':' + e.town;
    const own = owner.get(key);
    if (own === undefined) owner.set(key, e.src);
    else if (own !== e.src) continue;

    let b = bufs[e.town];
    if (!b || b.id !== e.id) {
      // label: a newer message already showing beats an older one. it's a group chat
      if (b && b.id > e.id) b = null;
      else b = bufs[e.town] = { id: e.id, src: e.src, gen: e.gen, chars: [], len: e.len, last: t, heard: [] };
    }
    // the letters themselves are kept per town per message, off-screen, so a hidden label still counts
    const hk = 'h:' + key;
    let got = owner.get(hk);
    if (!got) owner.set(hk, got = []);
    got[e.i] = e.ch;
    if (b) { b.chars[e.i] = e.ch; b.last = t; }

    // last letter in: write it down, then repeat it on, errors and all
    if (e.i === e.len - 1 && !relayed.has(key)) {
      relayed.add(key);
      const heard = Array.from({ length: e.len }, (_, i) => got[i] || DROP).join('');
      const usable = heard.split('').some(c => c !== DROP && c !== ' ');
      const L = logs.find(l => l.id === e.id);
      if (L) { L.lines.push({ by: e.src, to: e.town, heard, gen: e.gen, junk: !usable }); renderLog(); }
      if (usable) {
        events.push({ t: t + RELAY_PAUSE, town: -1, src: e.town, id: e.id, gen: e.gen, text: heard });
        events.sort((x, y) => x.t - y.t);
      }
    }
  }
  if (any) markDone();
  txs = txs.filter(x => t < x.t0 + x.len / CPS + towns[x.from].r / SPEED + 0.1);
}

function genCol(g, a) {
  // amber for the original, drifting blue with each relay
  const k = Math.min(1, g / 4);
  const r = Math.round(233 + (127 - 233) * k), gg = Math.round(180 + (196 - 180) * k), b = Math.round(76 + (217 - 76) * k);
  return `rgba(${r},${gg},${b},${a})`;
}

function arrow(x1, y1, x2, y2, col, dashed, w) {
  ctx.strokeStyle = col; ctx.lineWidth = w;
  ctx.setLineDash(dashed ? [5, 5] : []);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.setLineDash([]);
  if (!dashed) return;
  const ang = Math.atan2(y2 - y1, x2 - x1), d = Math.hypot(x2 - x1, y2 - y1);
  const tx = x1 + Math.cos(ang) * (d - 9), ty = y1 + Math.sin(ang) * (d - 9);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx - 8 * Math.cos(ang - 0.4), ty - 8 * Math.sin(ang - 0.4));
  ctx.lineTo(tx - 8 * Math.cos(ang + 0.4), ty - 8 * Math.sin(ang + 0.4));
  ctx.closePath(); ctx.fill();
}

function draw(t) {
  ctx.fillStyle = '#05070a'; ctx.fillRect(0, 0, W, H);
  for (const [x, y, b] of stars) {
    ctx.fillStyle = `rgba(140,160,180,${0.04 + b * 0.08})`;
    ctx.fillRect(x, y, 1, 1);
  }
  const focus = hover >= 0 ? hover : sel;
  const reached = focus >= 0 ? reach(focus) : null;

  if (showCircles) {
    towns.forEach((t, i) => {
      const lit = i === focus;
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

  // ripples: one ring per character, out to the edge of the speaker's range
  for (const x of txs) {
    const S = towns[x.from];
    for (let i = 0; i < x.len; i++) {
      const rad = (t - x.t0 - i / CPS) * SPEED;
      if (rad <= 0 || rad > S.r) continue;
      ctx.strokeStyle = genCol(x.gen, 0.55 * (1 - rad / S.r));
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(S.x, S.y, rad, 0, Math.PI * 2); ctx.stroke();
    }
  }

  for (let a = 0; a < towns.length; a++) {
    for (let b = a + 1; b < towns.length; b++) {
      const ab = hears[a][b], ba = hears[b][a];
      if (!ab && !ba) continue;
      const A = towns[a], B = towns[b];
      const touches = focus === a || focus === b;
      const dim = focus >= 0 && !touches;
      if (ab && ba) {
        let col = dim ? 'rgba(111,138,153,0.15)' : 'rgba(111,138,153,0.55)';
        if (touches) col = '#c9d6dd';
        arrow(A.x, A.y, B.x, B.y, col, false, touches ? 2 : 1.2);
      } else {
        const [S, L, si] = ab ? [B, A, b] : [A, B, a];
        let col = dim ? 'rgba(176,138,74,0.15)' : 'rgba(176,138,74,0.65)';
        if (touches) col = si === focus ? '#e9b44c' : '#7fc4d9';
        arrow(S.x, S.y, L.x, L.y, col, true, touches ? 2 : 1.2);
      }
    }
  }

  ctx.font = '12px ui-monospace, Menlo, Consolas, monospace';
  ctx.textBaseline = 'middle';
  towns.forEach((tw, i) => {
    let fill = '#cfd8dc';
    if (focus >= 0) {
      if (i === focus) fill = '#fff';
      else if (hears[i][focus]) fill = '#e9b44c';
      else if (hears[focus][i]) fill = '#7fc4d9';
      else if (reached.has(i)) fill = '#8a7a5a';
      else fill = '#3a4248';
    }
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.arc(tw.x, tw.y, i === focus ? 6 : 4.5, 0, Math.PI * 2); ctx.fill();
    if (i === sel) {
      ctx.strokeStyle = '#e9b44c'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(tw.x, tw.y, 10, 0, Math.PI * 2); ctx.stroke();
    }
    const left = tw.x > W - 170;
    ctx.textAlign = left ? 'right' : 'left';
    const lx = tw.x + (left ? -12 : 12);
    ctx.fillStyle = focus >= 0 && fill === '#3a4248' ? '#3a4248' : '#8f9aa0';
    ctx.fillText(tw.name, lx, tw.y - 1);
    // what this town last heard (or said), fading once it goes quiet. purely cosmetic now
    const b = bufs[i];
    if (b) {
      const age = t - b.last, a = age < 6 ? 1 : Math.max(0, 1 - (age - 6) / 4);
      if (a <= 0) { bufs[i] = null; return; }
      let s = '';
      for (let k = 0; k < b.chars.length; k++) s += b.chars[k] ?? ' ';
      ctx.fillStyle = genCol(b.gen, 0.9 * a);
      ctx.fillText((b.src === i && b.gen > 0 ? '» ' : '') + s, lx, tw.y + 14);
    }
  });
}

function loop() {
  const t = now();
  step(t);
  draw(t);
  requestAnimationFrame(loop);
}

function pick(ev) {
  const r = cv.getBoundingClientRect();
  const x = (ev.clientX - r.left) * W / r.width, y = (ev.clientY - r.top) * H / r.height;
  let best = -1, bd = 22;
  towns.forEach((t, i) => { const d = Math.hypot(t.x - x, t.y - y); if (d < bd) { bd = d; best = i; } });
  return best;
}

function describe(i) {
  if (i < 0) { info.textContent = summary; return; }
  const t = towns[i];
  const heardBy = towns.filter((_, a) => hears[a][i]).length;
  const heard = towns.filter((_, b) => hears[i][b]).length;
  const r = reach(i).size - 1;
  info.textContent = `${t.name}: heard directly by ${heardBy}, hears ${heard}. ` +
    `with everyone relaying, a message from here reaches ${r} of ${towns.length - 1}` +
    (heardBy === 0 ? ' (shouting into the void, sorry)' : '') +
    (heard === 0 ? ' (hears nobody, can still talk)' : '');
}

function setHover(i) {
  if (i === hover) return;
  hover = i;
  describe(i >= 0 ? i : sel);
}

cv.addEventListener('mousemove', e => setHover(pick(e)));
cv.addEventListener('mouseleave', () => setHover(-1));
cv.addEventListener('click', e => {
  const i = pick(e);
  sel = i;
  hover = i;
  describe(i);
  if (i >= 0) {
    msgIn.placeholder = `say something from ${towns[i].name}`;
    msgIn.focus();
  } else msgIn.placeholder = 'click a town first';
});
msgIn.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const text = msgIn.value.trim().replaceAll(DROP, '.').slice(0, 40);
  if (sel < 0 || !text) return;
  transmit(sel, text, nextId++, 0);
  msgIn.value = '';
});
circlesBtn.addEventListener('click', () => {
  showCircles = !showCircles;
  circlesBtn.classList.toggle('on', showCircles);
});
document.getElementById('reseed').addEventListener('click', () => build((Math.random() * 2 ** 32) >>> 0));
document.getElementById('home').addEventListener('click', () => build(HOME_SEED));

build(HOME_SEED);
requestAnimationFrame(loop);
