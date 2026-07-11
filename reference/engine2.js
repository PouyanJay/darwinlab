// EvoMind Bench — REAL neuroevolution engine (V3 → real-engine stage per spec §14.1)
// Each fish carries a genome = the weights of a tiny MLP brain. Fitness = survival time.
// Generations: rank the whole population, breed survivors (elitism + tournament + crossover + mutation).
// Nobody writes "flee the shark" — fleeing emerges because non-fleers get eaten.

export const THEMES = {
  light: {
    tankEdge: 'rgba(29,34,48,.26)',
    ray: '255,250,215', dust: 'rgba(105,118,96,.4)',
    fish: '#4f56d3', fishBelly: '#dfe1f8', fishTrail: '79,86,211',
    pred: '#e8604c', predDark: '#b8422f', predBelly: '#f6cabf',
    burst: '232,96,76', sel: '#4f56d3', selGlow: '79,86,211', threat: '#e8604c',
    gold: '#d8a13a',
    ink: '#1d2230', inkSoft: 'rgba(29,34,48,.55)', pill: 'rgba(253,253,248,.92)',
    shadow: 'rgba(30,45,35,.09)'
  },
  dark: {
    tankEdge: 'rgba(255,45,156,.42)',
    ray: '255,45,156', dust: 'rgba(255,255,255,.22)',
    fish: '#f2f2f7', fishBelly: '#a3a4bc', fishTrail: '242,242,247',
    pred: '#ff2d9c', predDark: '#a91d6d', predBelly: '#ff8cc7',
    burst: '255,45,156', sel: '#ff2d9c', selGlow: '255,45,156', threat: '#ff2d9c',
    gold: '#ffd166',
    ink: '#f5f5fa', inkSoft: 'rgba(245,245,250,.6)', pill: 'rgba(12,12,17,.88)',
    shadow: 'rgba(0,0,0,.4)'
  }
};

export const ACCENTS = ['#64748b', '#4f56d3', '#0e9488', '#d88a2c', '#e8604c', '#8a5ad8'];

export const DEFAULT_WORLDS = [
  { name: 'Blind drift', accent: '#64748b', prey: 20, preds: 2, bw: 640, bh: 400, predSpeed: 1, vision: 200, mutation: .06,
    senses: { dist: false, dir: false, closing: false, walls: false },
    caption: 'No predator input reaches these brains at all, so natural selection has nothing to work with. The population is culled to almost nothing — and never really recovers.' },
  { name: 'Distance', accent: '#4f56d3', prey: 20, preds: 2, bw: 640, bh: 400, predSpeed: 1, vision: 200, mutation: .06,
    senses: { dist: true, dir: false, closing: false, walls: false },
    caption: 'One input: how close danger is. Fish learn to bolt when threatened — but with no sense of which way, they bolt blindly, so it barely beats sensing nothing at all.' },
  { name: 'Direction', accent: '#0e9488', prey: 20, preds: 2, bw: 640, bh: 400, predSpeed: 1, vision: 200, mutation: .06,
    senses: { dist: true, dir: true, closing: false, walls: false },
    caption: 'Add which-way, and survival leaps. This is the sense that actually pays off — the single biggest jump on the whole bench.' },
  { name: 'Anticipation', accent: '#d88a2c', prey: 20, preds: 2, bw: 640, bh: 400, predSpeed: 1, vision: 200, mutation: .06,
    senses: { dist: true, dir: true, closing: true, walls: false },
    caption: 'Now pile closing-speed on top — more information for the brain. But watch: survival does not climb to match. An input the environment never rewards is just noise the search has to fight through.' },
  { name: 'Corner-wise', accent: '#e8604c', prey: 20, preds: 2, bw: 640, bh: 400, predSpeed: 1, vision: 200, mutation: .06,
    senses: { dist: true, dir: true, closing: true, walls: true },
    caption: 'All four senses switched on. Compare it to Direction: barely different. More sensors are not more intelligence — the world has to make each one earn its keep, and here most do not.' }
];

// ---- network architecture (fixed slots; disabled senses feed 0 → real ablation) ----
export const NIN = 8;   // bias, dist, dir-x, dir-y, closing, wallL, wallF, wallR
export const NHID = 6;
export const NOUT = 2;  // turn, thrust
export const GLEN = NHID * NIN + NHID + NOUT * NHID + NOUT; // 68
export const IN_LABELS = ['bias', 'distance', 'dir → x', 'dir → y', 'closing', 'wall L', 'wall F', 'wall R'];
export const IN_SENSE = [null, 'dist', 'dir', 'dir', 'closing', 'walls', 'walls', 'walls'];
export const OUT_LABELS = ['turn', 'thrust'];

const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
function randn() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); }
function lerpAngle(a, b, t) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU;
  return a + d * t;
}

export function makeGenome() { const g = new Array(GLEN); for (let i = 0; i < GLEN; i++) g[i] = randn() * 0.8; return g; }
export function cloneGenome(g) { return g.slice(); }
export function crossover(a, b) { const g = new Array(GLEN); for (let i = 0; i < GLEN; i++) g[i] = Math.random() < 0.5 ? a[i] : b[i]; return g; }
export function mutate(g, rate) {
  const s = 0.06 + rate * 1.7;
  for (let i = 0; i < GLEN; i++) {
    if (Math.random() < 0.85) g[i] += randn() * s;
    if (Math.random() < rate * 0.25) g[i] = randn() * 0.8; // rare full reset
  }
  return g;
}

// forward pass; returns {turn:-1..1, thrust:0..1, h:[...], o:[turn,thrust]}
export function forward(g, x) {
  const h = new Array(NHID);
  let p = 0;
  for (let j = 0; j < NHID; j++) {
    let s = 0;
    for (let i = 0; i < NIN; i++) s += g[p++] * x[i];
    h[j] = Math.tanh(s + g[NHID * NIN + j]);
  }
  const o = new Array(NOUT);
  let q = NHID * NIN + NHID;
  for (let k = 0; k < NOUT; k++) {
    let s = 0;
    for (let j = 0; j < NHID; j++) s += g[q++] * h[j];
    s += g[NHID * NIN + NHID + NOUT * NHID + k];
    o[k] = s;
  }
  const turn = Math.tanh(o[0]);
  const thrust = 1 / (1 + Math.exp(-o[1]));
  return { turn, thrust, h, o: [turn, thrust] };
}
export function weightIH(g, j, i) { return g[j * NIN + i]; }
export function weightHO(g, k, j) { return g[NHID * NIN + NHID + k * NHID + j]; }

// ---- sensing: build the fixed input vector, honoring which senses are enabled ----
export function senseInputs(w, f) {
  const c = w.cfg, S = c.senses;
  let np = null, nd = 1e9;
  for (const p of w.preds) { const d = Math.hypot(p.x - f.x, p.y - f.y); if (d < nd) { nd = d; np = p; } }
  const inVis = np && nd < c.vision;
  const x = [1, 0, 0, 0, 0, 0, 0, 0];
  let dirDeg = 0, closing = 0;
  if (np) {
    const rx = (f.x - np.x) / (nd || 1), ry = (f.y - np.y) / (nd || 1);
    closing = -((f.vx - np.vx) * rx + (f.vy - np.vy) * ry);
    dirDeg = Math.atan2(np.y - f.y, np.x - f.x) * 180 / Math.PI;
  }
  if (S.dist && inVis) x[1] = clamp(1 - nd / c.vision, 0, 1);
  if (S.dir && inVis) { const rel = Math.atan2(np.y - f.y, np.x - f.x) - f.heading; x[2] = Math.sin(rel); x[3] = Math.cos(rel); }
  if (S.closing && inVis) x[4] = clamp(closing / 170, 0, 1);
  let wF = 1e9;
  if (S.walls) {
    const rays = [-0.5, 0, 0.5];
    for (let r = 0; r < 3; r++) {
      const a = f.heading + rays[r], cx = Math.cos(a), cy = Math.sin(a);
      let t = 1e9;
      if (cx > 0) t = Math.min(t, (c.bw - f.x) / cx); if (cx < 0) t = Math.min(t, -f.x / cx);
      if (cy > 0) t = Math.min(t, (c.bh - f.y) / cy); if (cy < 0) t = Math.min(t, -f.y / cy);
      x[5 + r] = clamp(1 - t / 170, 0, 1);
      if (r === 1) wF = t;
    }
  } else {
    const cx = Math.cos(f.heading), cy = Math.sin(f.heading);
    let t = 1e9;
    if (cx > 0) t = Math.min(t, (c.bw - f.x) / cx); if (cx < 0) t = Math.min(t, -f.x / cx);
    if (cy > 0) t = Math.min(t, (c.bh - f.y) / cy); if (cy < 0) t = Math.min(t, -f.y / cy);
    wF = t;
  }
  return { x, np, dist: np ? nd : Infinity, inVis, dirDeg, closing, wallFront: wF };
}

// ---- agents ----
export function makeFish(cfg, genome) {
  return {
    x: rnd(40, cfg.bw - 40), y: rnd(40, cfg.bh - 40),
    vx: rnd(-20, 20), vy: rnd(-20, 20), heading: rnd(0, TAU),
    trail: [], phase: rnd(0, TAU), size: rnd(.85, 1.15),
    genome: genome || makeGenome(), fitness: 0, turn: 0, thrust: 0, trailT: 0
  };
}
export function makePred(cfg) {
  return { x: rnd(60, cfg.bw - 60), y: rnd(60, cfg.bh - 60), vx: 0, vy: 0, heading: rnd(0, TAU), lunge: 0, cool: rnd(.5, 1.5), aim: 0, trail: [], trailT: 0 };
}

const GEN_DURATION = 10; // sim-seconds per generation
const MAXSPEED = 176, MAXTURN = 5.0, RESP = 4.6;

export function makeWorld(cfg, genomes) {
  const w = {
    cfg, fish: [], roster: [], preds: [], eaten: 0, bursts: [], selFish: null, hover: null, sense: null,
    dust: [], t: rnd(0, 50), transform: null, gen: 0, genT: 0, curve: [], champion: null, championFish: null, lastSurv: 1, maxGen: 0, respawnQ: [], _deployed: false, deployT: 0, decay: [], decayT: 0, extinctT: null, deployStartN: 0, halfLife: null, sinceKill: 0
  };
  spawnGeneration(w, genomes);
  for (let i = 0; i < cfg.preds; i++) w.preds.push(makePred(cfg));
  for (let i = 0; i < 24; i++) w.dust.push({ x: rnd(0, 1), y: rnd(0, 1), r: rnd(.6, 1.7), s: rnd(3, 9), p: rnd(0, 9) });
  return w;
}

function spawnGeneration(w, genomes) {
  const c = w.cfg;
  w.fish = []; w.roster = []; w.eaten = 0; w.genT = 0; w.bursts = []; w.respawnQ = [];
  for (let i = 0; i < c.prey; i++) {
    const g = genomes && genomes[i] ? cloneGenome(genomes[i]) : makeGenome();
    const f = makeFish(c, g);
    w.fish.push(f); w.roster.push(f);
  }
  w.preds = []; for (let i = 0; i < c.preds; i++) w.preds.push(makePred(c));
}

export function resetWorld(w) {
  w.gen = 0; w.curve = []; w.champion = null; w.championFish = null; w.selFish = null; w.sense = null; w.hover = null;
  spawnGeneration(w);
}

// user changed prey/pred count etc. — apply to the current generation without wiping learning
export function applyCfg(w) {
  const c = w.cfg;
  while (w.fish.length < c.prey - w.eaten && w.roster.length < c.prey) {
    const seed = w.champion ? cloneGenome(w.champion.genome) : (w.roster[0] ? cloneGenome(w.roster[0].genome) : null);
    const f = makeFish(c, seed); w.fish.push(f); w.roster.push(f);
  }
  while (w.fish.length > c.prey) { const f = w.fish.pop(); const ri = w.roster.indexOf(f); if (ri >= 0) w.roster.splice(ri, 1); if (w.selFish === f) { w.selFish = null; w.sense = null; } }
  while (w.preds.length < c.preds) w.preds.push(makePred(c));
  while (w.preds.length > c.preds) w.preds.pop();
  for (const f of w.fish) { f.x = clamp(f.x, 8, c.bw - 8); f.y = clamp(f.y, 8, c.bh - 8); }
}

function evolve(w) {
  const c = w.cfg;
  const ranked = w.roster.slice().sort((a, b) => b.fitness - a.fitness);
  // survival metric = fraction that survived the generation, lightly smoothed so the
  // real trend reads clearly through run-to-run noise
  const raw = w.fish.length / Math.max(1, c.prey);
  const prev = w.curve.length ? w.curve[w.curve.length - 1] : raw;
  const surv = prev * 0.65 + raw * 0.35;
  w.lastSurv = surv;
  w.curve.push(surv);
  if (w.curve.length > 400) w.curve.shift();
  const best = ranked[0];
  if (best && (!w.champion || best.fitness > w.champion.fitness)) {
    w.champion = { genome: cloneGenome(best.genome), fitness: best.fitness, gen: w.gen };
  }
  // build next generation genomes
  const next = [];
  if (w.champion) next.push(cloneGenome(w.champion.genome)); // preserve best-ever (watchable)
  const elite = Math.max(1, Math.round(c.prey * 0.12));
  for (let i = 0; i < elite && i < ranked.length && next.length < c.prey; i++) next.push(cloneGenome(ranked[i].genome));
  const half = Math.max(2, Math.floor(ranked.length / 2));
  const pick = () => ranked[Math.floor(Math.pow(Math.random(), 1.7) * half)];
  while (next.length < c.prey) {
    const child = crossover(pick().genome, pick().genome);
    mutate(child, c.mutation);
    next.push(child);
  }
  w.gen++;
  spawnGeneration(w, next);
}

// training is capped: once w.maxGen is reached, stop evolving and just keep running the
// trained population (inference) — respawn the same brains, no selection, no mutation
function reseedTrained(w) {
  const genomes = w.roster.slice().sort((a, b) => b.fitness - a.fitness).map(f => cloneGenome(f.genome));
  spawnGeneration(w, genomes);
}

// in deployed (trained) mode we top the tank up ONE fish at a time from the edge, so the
// simulation runs continuously with no jarring full-tank reset
function trainedGenome(w) {
  if (w.champion && Math.random() < 0.35) return cloneGenome(w.champion.genome);
  const f = w.fish[Math.floor(Math.random() * w.fish.length)];
  return cloneGenome(f ? f.genome : (w.champion ? w.champion.genome : makeGenome()));
}
function edgeSpawn(c) {
  const m = 14, s = Math.floor(Math.random() * 4);
  if (s === 0) return [rnd(m, c.bw - m), m];
  if (s === 1) return [rnd(m, c.bw - m), c.bh - m];
  if (s === 2) return [m, rnd(m, c.bh - m)];
  return [c.bw - m, rnd(m, c.bh - m)];
}

export function stepWorld(w, dt) {
  const c = w.cfg;
  const trained = w.maxGen && w.gen >= w.maxGen; // deployed: no more evolving, no resets
  w.t += dt; w.genT += dt;
  // deploy transition: when training ends, start the count fresh and let the trained
  // population play out under permanent elimination (no resets, no respawns)
  if (trained && !w._deployed) { w._deployed = true; w.eaten = 0; w.deployT = 0; w.decay = []; w.decayT = 0; w.extinctT = null; w.halfLife = null; w.deployStartN = w.fish.length || w.cfg.prey; }
  if (!trained) w._deployed = false;
  if (trained) {
    // real-world run: track elapsed time, sample decay, capture half-life + time-to-wipeout
    w.deployT += dt; w.decayT += dt;
    if (w.decayT >= 0.3) { w.decay.push(w.fish.length / Math.max(1, w.deployStartN)); if (w.decay.length > 400) w.decay.shift(); w.decayT = 0; }
    if (w.halfLife === null && w.fish.length <= w.deployStartN / 2) w.halfLife = w.deployT;
    if (w.fish.length === 0 && w.extinctT === null) w.extinctT = w.deployT;
  }
  // predator persistence: the longer without a kill, the faster the sharks get, so no
  // stalemate lasts forever (a lone juking fish is always eventually run down)
  const frust = 1 + Math.min(0.85, w.sinceKill * 0.04);
  const catchR = 14 + Math.min(20, Math.max(0, w.sinceKill - 8) * 2.2); // grows during a stalemate
  w.sinceKill += dt;
  // assign each shark a DISTINCT target (greedy nearest-unclaimed) so they spread out and
  // threaten the whole population — no fish is safe just by not being the single global nearest
  const claimed = new Set();
  for (const p of w.preds) {
    let best = null, bd = 1e9;
    for (const f of w.fish) { if (claimed.has(f)) continue; const d = Math.hypot(f.x - p.x, f.y - p.y); if (d < bd) { bd = d; best = f; } }
    if (!best) { for (const f of w.fish) { const d = Math.hypot(f.x - p.x, f.y - p.y); if (d < bd) { bd = d; best = f; } } }
    else claimed.add(best);
    p._tgt = best; p._td = bd;
  }
  // predators
  for (const p of w.preds) {
    p.cool = Math.max(0, p.cool - dt); p.lunge = Math.max(0, p.lunge - dt);
    const best = p._tgt, bd = p._td;
    const ps = c.predSpeed;
    if (best) {
      // lunge state machine: cruise → aim (a telegraphed wind-up the prey can feel) → lunge (fast strike)
      if (p.lunge <= 0 && p.aim > 0) { p.aim -= dt; if (p.aim <= 0) { p.lunge = .4; p.cool = 1.3; } }
      else if (p.lunge <= 0 && p.cool <= 0 && bd < 135) { p.aim = .3; }
      let dirx, diry, acc, max;
      // predictive interception — lead the target's motion; a predictable (fixed-pattern) fish
      // gets cut off, so only prey that jink relative to the shark survive
      const lead = p.lunge > 0 ? 0.34 : 0.18;
      const lx = best.x + best.vx * lead, ly = best.y + best.vy * lead, ld = Math.hypot(lx - p.x, ly - p.y) || 1;
      if (p.lunge > 0) { dirx = (lx - p.x) / ld; diry = (ly - p.y) / ld; acc = 1000 * ps; max = 430 * ps * frust; }
      else if (p.aim > 0) { dirx = (lx - p.x) / ld; diry = (ly - p.y) / ld; acc = 120 * ps; max = 40 * ps; }
      else {
        const tx = lx - p.x, ty = ly - p.y, td = Math.hypot(tx, ty) || 1;
        dirx = tx / td; diry = ty / td; acc = 280 * ps; max = 200 * ps * frust;
      }
      p.vx += dirx * acc * dt; p.vy += diry * acc * dt;
      const sp = Math.hypot(p.vx, p.vy); if (sp > max) { p.vx *= max / sp; p.vy *= max / sp; }
    } else { p.vx *= Math.pow(.2, dt); p.vy *= Math.pow(.2, dt); }
    const drag = p.lunge > 0 ? .86 : .42; p.vx *= Math.pow(drag, dt); p.vy *= Math.pow(drag, dt);
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.x < 9) { p.x = 9; p.vx = Math.abs(p.vx) * .5; } if (p.x > c.bw - 9) { p.x = c.bw - 9; p.vx = -Math.abs(p.vx) * .5; }
    if (p.y < 9) { p.y = 9; p.vy = Math.abs(p.vy) * .5; } if (p.y > c.bh - 9) { p.y = c.bh - 9; p.vy = -Math.abs(p.vy) * .5; }
    const psp = Math.hypot(p.vx, p.vy);
    if (psp > 12) p.heading = lerpAngle(p.heading, Math.atan2(p.vy, p.vx), Math.min(1, 6 * dt));
    p.trailT -= dt; if (p.trailT <= 0) { p.trail.push({ x: p.x, y: p.y }); if (p.trail.length > 14) p.trail.shift(); p.trailT = .05; }
    for (let i = w.fish.length - 1; i >= 0; i--) {
      const f = w.fish[i];
      if (Math.hypot(f.x - p.x, f.y - p.y) < catchR) {
        if (w.selFish === f) { w.selFish = null; w.sense = null; }
        if (w.hover === f) w.hover = null; if (w.championFish === f) w.championFish = null;
        w.fish.splice(i, 1);
        w.sinceKill = 0;
        w.bursts.push({ x: f.x, y: f.y, a: 0, rot: rnd(0, TAU) });
        w.eaten++; // permanent elimination in both modes
      }
    }
  }
  // prey — controlled by their brains
  for (const f of w.fish) {
    const { x } = senseInputs(w, f);
    const out = forward(f.genome, x);
    f.turn = out.turn; f.thrust = out.thrust;
    f.heading += out.turn * MAXTURN * dt;
    const target = out.thrust * MAXSPEED;
    const dvx = Math.cos(f.heading) * target, dvy = Math.sin(f.heading) * target;
    f.vx += (dvx - f.vx) * RESP * dt; f.vy += (dvy - f.vy) * RESP * dt;
    // mild separation so they don't perfectly overlap
    for (const o of w.fish) {
      if (o === f) continue;
      const dx = f.x - o.x, dy = f.y - o.y, d = Math.hypot(dx, dy);
      if (d < 15 && d > 0) { f.vx += dx / d * (15 - d) * 4 * dt * 60 * 0; f.x += dx / d * (15 - d) * .06; f.y += dy / d * (15 - d) * .06; }
    }
    // baseline wall-avoidance instinct — keeps fish off the glass so they never pin in corners
    const wm = 54;
    if (f.x < wm) f.vx += (1 - f.x / wm) * 460 * dt;
    else if (f.x > c.bw - wm) f.vx -= (1 - (c.bw - f.x) / wm) * 460 * dt;
    if (f.y < wm) f.vy += (1 - f.y / wm) * 460 * dt;
    else if (f.y > c.bh - wm) f.vy -= (1 - (c.bh - f.y) / wm) * 460 * dt;
    f.x += f.vx * dt; f.y += f.vy * dt;
    if (f.x < 7) { f.x = 7; f.vx *= -.3; } if (f.x > c.bw - 7) { f.x = c.bw - 7; f.vx *= -.3; }
    if (f.y < 7) { f.y = 7; f.vy *= -.3; } if (f.y > c.bh - 7) { f.y = c.bh - 7; f.vy *= -.3; }
    f.heading = Math.atan2(Math.sin(f.heading), Math.cos(f.heading));
    if (Math.hypot(f.vx, f.vy) > 6) f.heading = lerpAngle(f.heading, Math.atan2(f.vy, f.vx), Math.min(1, 5 * dt));
    f.fitness += dt;
    f.trailT -= dt; if (f.trailT <= 0) { f.trail.push({ x: f.x, y: f.y }); if (f.trail.length > 10) f.trail.shift(); f.trailT = .06; }
  }
  // selected fish snapshot for the inspector
  if (w.selFish) {
    const f = w.selFish, si = senseInputs(w, f), out = forward(f.genome, si.x);
    w.sense = {
      x: si.x, h: out.h, genome: f.genome,
      d: si.dist, dirDeg: si.dirDeg, closing: si.closing, wallFront: si.wallFront, inVis: si.inVis,
      nd: si.x[1], nc: si.x[4], nw: Math.max(si.x[5], si.x[6], si.x[7]),
      turn: out.turn, thrust: out.thrust, fitness: f.fitness
    };
  }
  for (const b of w.bursts) b.a += dt;
  w.bursts = w.bursts.filter(b => b.a < .65);
  // generation boundary
  if (w.genT >= GEN_DURATION || w.fish.length === 0) {
    if (trained) { w.genT = 0; } // deployed: don't evolve, don't reset — let the population play out
    else evolve(w);
  }
}

export function bestAliveFish(w) {
  let best = null, bf = -1;
  for (const f of w.fish) if (f.fitness > bf) { bf = f.fitness; best = f; }
  return best;
}

// clone current evolved state into a fresh full generation (for story scenes)
export function makeStoryWorld(src) {
  const cfg = JSON.parse(JSON.stringify(src.cfg));
  const ranked = src.roster.slice().sort((a, b) => b.fitness - a.fitness);
  const pool = [];
  if (src.champion) pool.push(src.champion.genome);
  for (const f of ranked) pool.push(f.genome);
  const genomes = [];
  for (let i = 0; i < cfg.prey; i++) genomes.push(pool.length ? pool[i % pool.length] : makeGenome());
  const w = makeWorld(cfg, genomes);
  w.gen = src.gen; w.curve = src.curve.slice(); w.champion = src.champion ? { genome: cloneGenome(src.champion.genome), fitness: src.champion.fitness, gen: src.champion.gen } : null;
  return w;
}

// ============================== rendering ==============================
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
let RM = false; try { RM = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { }

function drawFish(ctx, f, th, t, sel, hov, champ) {
  if (f.trail.length > 1) {
    ctx.strokeStyle = 'rgba(' + th.fishTrail + ',.2)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); f.trail.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
  }
  ctx.fillStyle = th.shadow;
  ctx.beginPath(); ctx.ellipse(f.x, f.y + 10, 6.5 * f.size, 2 * f.size, 0, 0, TAU); ctx.fill();
  const sp = Math.hypot(f.vx, f.vy);
  ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.heading);
  const s = f.size, flick = RM ? 0 : Math.sin(t * (6 + sp * .07) + f.phase) * .55;
  ctx.save(); ctx.translate(-6.4 * s, 0); ctx.rotate(flick);
  ctx.beginPath(); ctx.moveTo(1, 0); ctx.lineTo(-5.6 * s, -3.5 * s); ctx.lineTo(-5.6 * s, 3.5 * s); ctx.closePath();
  ctx.fillStyle = th.fish; ctx.globalAlpha = .92; ctx.fill(); ctx.globalAlpha = 1; ctx.restore();
  ctx.save(); ctx.translate(1.2 * s, 1.8 * s); ctx.rotate(.7 + flick * .4);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-1.5 * s, 3.4 * s, -3.6 * s, 4 * s); ctx.quadraticCurveTo(-2 * s, 1.4 * s, -2 * s, 0); ctx.closePath();
  ctx.fillStyle = th.fish; ctx.globalAlpha = .75; ctx.fill(); ctx.globalAlpha = 1; ctx.restore();
  ctx.beginPath(); ctx.ellipse(0, 0, 7.6 * s, 3.1 * s, 0, 0, TAU); ctx.fillStyle = th.fish; ctx.fill();
  ctx.beginPath(); ctx.ellipse(.6 * s, 1.15 * s, 5.4 * s, 1.6 * s, 0, 0, TAU); ctx.fillStyle = th.fishBelly; ctx.globalAlpha = .9; ctx.fill(); ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.moveTo(-1 * s, -2.6 * s); ctx.quadraticCurveTo(.5 * s, -4.6 * s, 2.4 * s, -2.7 * s); ctx.closePath(); ctx.fillStyle = th.fish; ctx.fill();
  ctx.fillStyle = 'rgba(8,10,18,.9)'; ctx.beginPath(); ctx.arc(4.7 * s, -.8 * s, .95 * s, 0, TAU); ctx.fill();
  ctx.restore();
  if (champ) {
    ctx.strokeStyle = th.gold; ctx.globalAlpha = .9; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(f.x, f.y, 12.5, 0, TAU); ctx.stroke();
    ctx.fillStyle = th.gold; ctx.globalAlpha = .95; ctx.font = '700 9px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('★', f.x, f.y - 15); ctx.textAlign = 'left'; ctx.globalAlpha = 1;
  }
  if (sel || hov) {
    const pulse = sel && !RM ? 1 + Math.sin(t * 4) * .12 : 1;
    ctx.strokeStyle = th.sel; ctx.globalAlpha = sel ? .95 : .4; ctx.lineWidth = sel ? 2 : 1.2;
    ctx.beginPath(); ctx.arc(f.x, f.y, 15 * pulse, 0, TAU); ctx.stroke();
    if (sel) { ctx.globalAlpha = .18; ctx.beginPath(); ctx.arc(f.x, f.y, 21 * pulse, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
}

function drawShark(ctx, p, th, t, hov) {
  if (p.trail.length > 1) {
    ctx.strokeStyle = 'rgba(' + th.burst + ',' + (p.lunge > 0 ? .4 : .18) + ')'; ctx.lineWidth = p.lunge > 0 ? 3.5 : 2.5;
    ctx.beginPath(); p.trail.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.stroke();
  }
  ctx.fillStyle = th.shadow; ctx.beginPath(); ctx.ellipse(p.x, p.y + 14, 17, 4, 0, 0, TAU); ctx.fill();
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.heading);
  const L = p.lunge > 0 ? 1.1 : 1, sway = RM ? 0 : Math.sin(t * 6.5) * (p.lunge > 0 ? .5 : .28);
  ctx.save(); ctx.translate(-19, 0); ctx.rotate(sway);
  ctx.beginPath(); ctx.moveTo(2, 0); ctx.quadraticCurveTo(-8, -3, -10.5, -12); ctx.quadraticCurveTo(-5.5, -6.5, -3, -2);
  ctx.quadraticCurveTo(-6, 2, -7, 7); ctx.quadraticCurveTo(-3.5, 3.5, 2, 1.5); ctx.closePath(); ctx.fillStyle = th.pred; ctx.fill(); ctx.restore();
  const bg = ctx.createLinearGradient(0, -8, 0, 8); bg.addColorStop(0, th.predDark); bg.addColorStop(.45, th.pred); bg.addColorStop(1, th.pred);
  ctx.beginPath(); ctx.moveTo(21 * L, 0); ctx.quadraticCurveTo(12, -7.8, -6, -5.4); ctx.quadraticCurveTo(-15, -3.6, -19.5, -.8);
  ctx.quadraticCurveTo(-15, 3.6, -6, 5.4); ctx.quadraticCurveTo(12, 7.8, 21 * L, 0); ctx.fillStyle = bg; ctx.fill();
  ctx.beginPath(); ctx.ellipse(3, 2.6, 11, 2.5, 0, 0, TAU); ctx.fillStyle = th.predBelly; ctx.globalAlpha = .75; ctx.fill(); ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.moveTo(-2.5, -4.8); ctx.quadraticCurveTo(1.5, -14, 6.5, -5.2); ctx.closePath(); ctx.fillStyle = th.predDark; ctx.fill();
  ctx.save(); ctx.translate(4, 3.4); ctx.rotate(.6 + sway * .3);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-2, 7, -7, 8.5); ctx.quadraticCurveTo(-4.5, 3, -4, 0); ctx.closePath(); ctx.fillStyle = th.predDark; ctx.globalAlpha = .85; ctx.fill(); ctx.globalAlpha = 1; ctx.restore();
  ctx.strokeStyle = th.predDark; ctx.lineWidth = .9; ctx.globalAlpha = .8;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(8.5 - i * 2.1, -.4, 3.1, -1.1, 1.1); ctx.stroke(); }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(14.5, -2.4, 1.7, 0, TAU); ctx.fill();
  ctx.fillStyle = '#14161f'; ctx.beginPath(); ctx.arc(14.9, -2.4, 1, 0, TAU); ctx.fill();
  ctx.restore();
  if (hov) { ctx.strokeStyle = th.threat; ctx.globalAlpha = .45; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(p.x, p.y, 27, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
}

function drawPerception(w, ctx, th) {
  const f = w.selFish, c = w.cfg, S = c.senses;
  let np = null, nd = 1e9;
  for (const p of w.preds) { const d = Math.hypot(p.x - f.x, p.y - f.y); if (d < nd) { nd = d; np = p; } }
  if (S.dist) {
    const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, c.vision);
    g.addColorStop(0, 'rgba(' + th.selGlow + ',.08)'); g.addColorStop(1, 'rgba(' + th.selGlow + ',0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, c.vision, 0, TAU); ctx.fill();
    ctx.setLineDash([4, 7]); ctx.strokeStyle = th.sel; ctx.globalAlpha = .38; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(f.x, f.y, c.vision, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
  if (np && S.dir) {
    const g = ctx.createLinearGradient(f.x, f.y, np.x, np.y); g.addColorStop(0, th.sel); g.addColorStop(1, th.threat);
    ctx.strokeStyle = g; ctx.globalAlpha = .75; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(np.x, np.y); ctx.stroke(); ctx.globalAlpha = 1;
  }
  if (np && S.dist) {
    const mx = (f.x + np.x) / 2, my = (f.y + np.y) / 2, txt = Math.round(nd) + ' px';
    ctx.font = '600 11px Inter, sans-serif'; const tw = ctx.measureText(txt).width;
    ctx.fillStyle = th.pill; roundRect(ctx, mx - tw / 2 - 6, my - 18, tw + 12, 16, 8); ctx.fill();
    ctx.strokeStyle = th.sel; ctx.globalAlpha = .3; ctx.lineWidth = 1; roundRect(ctx, mx - tw / 2 - 6, my - 18, tw + 12, 16, 8); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillStyle = th.ink; ctx.textAlign = 'center'; ctx.fillText(txt, mx, my - 6); ctx.textAlign = 'left';
  }
  if (np && S.closing && w.sense) {
    const k = RM ? .5 : (w.t * 1.5) % 1, px = np.x + (f.x - np.x) * k, py = np.y + (f.y - np.y) * k;
    ctx.fillStyle = th.threat; ctx.globalAlpha = .9; ctx.beginPath(); ctx.arc(px, py, 2 + w.sense.nc * 3.5, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  }
  if (S.walls) {
    ctx.strokeStyle = th.sel; ctx.globalAlpha = .3; ctx.lineWidth = 1;
    for (const off of [-.5, 0, .5]) {
      const a = f.heading + off, cx = Math.cos(a), cy = Math.sin(a); let t = 170;
      if (cx > 0) t = Math.min(t, (c.bw - f.x) / cx); if (cx < 0) t = Math.min(t, -f.x / cx);
      if (cy > 0) t = Math.min(t, (c.bh - f.y) / cy); if (cy < 0) t = Math.min(t, -f.y / cy);
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + cx * t, f.y + cy * t); ctx.stroke();
      if (t < 170) { ctx.globalAlpha = .55; ctx.beginPath(); ctx.arc(f.x + cx * t, f.y + cy * t, 2.2, 0, TAU); ctx.fillStyle = th.sel; ctx.fill(); ctx.globalAlpha = .3; }
    }
    ctx.globalAlpha = 1;
  }
}

export function drawWorld(w, ctx, W, H, opts) {
  opts = opts || {};
  const theme = opts.theme || 'light', th = THEMES[theme], c = w.cfg;
  const rich = opts.big || opts.detail !== 'performance';
  ctx.clearRect(0, 0, W, H);
  const s = Math.min(W / c.bw, H / c.bh) * (opts.big ? .92 : .95);
  const ox = (W - c.bw * s) / 2, oy = (H - c.bh * s) / 2; w.transform = { s, ox, oy };
  if (opts.big) {
    const g = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, Math.max(W, H) * .62);
    if (theme === 'light') { g.addColorStop(0, 'rgba(244,250,246,.16)'); g.addColorStop(1, 'rgba(244,250,246,0)'); }
    else { g.addColorStop(0, 'rgba(255,45,156,.06)'); g.addColorStop(1, 'rgba(255,45,156,0)'); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  ctx.save(); ctx.translate(ox, oy); ctx.scale(s, s);
  const g = ctx.createLinearGradient(0, 0, 0, c.bh);
  if (theme === 'light') { g.addColorStop(0, '#fbfefc'); g.addColorStop(.45, '#eef3ea'); g.addColorStop(1, '#dce4d6'); }
  else { g.addColorStop(0, '#0e0e15'); g.addColorStop(1, '#030304'); }
  roundRect(ctx, 0, 0, c.bw, c.bh, 14); ctx.fillStyle = g; ctx.fill();
  ctx.save(); roundRect(ctx, 0, 0, c.bw, c.bh, 14); ctx.clip();
  const sg = ctx.createLinearGradient(0, 0, 0, 30);
  if (theme === 'light') { sg.addColorStop(0, 'rgba(255,255,252,.75)'); sg.addColorStop(1, 'rgba(255,255,252,0)'); }
  else { sg.addColorStop(0, 'rgba(255,45,156,.07)'); sg.addColorStop(1, 'rgba(255,45,156,0)'); }
  ctx.fillStyle = sg; ctx.fillRect(0, 0, c.bw, 30);
  if (theme === 'light' && rich && !RM) {
    ctx.globalAlpha = .38;
    for (let i = 0; i < 3; i++) {
      const rx = c.bw * (.16 + i * .3) + Math.sin(w.t * .13 + i * 2.1) * c.bw * .06, wd = c.bw * .1;
      const gr = ctx.createLinearGradient(rx, 0, rx + c.bw * .12, c.bh); gr.addColorStop(0, 'rgba(' + th.ray + ',.5)'); gr.addColorStop(1, 'rgba(' + th.ray + ',0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(rx - wd * .3, 0); ctx.lineTo(rx + wd, 0); ctx.lineTo(rx + wd * 2.4 + c.bw * .06, c.bh); ctx.lineTo(rx + wd * .5, c.bh); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (theme === 'dark') {
    const vg = ctx.createRadialGradient(c.bw / 2, c.bh / 2, c.bh * .2, c.bw / 2, c.bh / 2, c.bw * .7);
    vg.addColorStop(0, 'rgba(255,45,156,.05)'); vg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, c.bw, c.bh);
  }
  if (rich) {
    ctx.fillStyle = th.dust;
    for (const d of w.dust) {
      const dy = ((d.y * c.bh + w.t * d.s) % c.bh + c.bh) % c.bh, dx = d.x * c.bw + Math.sin(w.t * .4 + d.p) * 6;
      ctx.globalAlpha = .25 + Math.sin(w.t * .8 + d.p) * .15; ctx.beginPath(); ctx.arc(dx, dy, d.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (w.selFish) drawPerception(w, ctx, th);
  for (const p of w.preds) drawShark(ctx, p, th, w.t, p === w.hover);
  for (const f of w.fish) drawFish(ctx, f, th, w.t, f === w.selFish, f === w.hover, f === w.championFish);
  for (const b of w.bursts) {
    const k = b.a / .65;
    ctx.strokeStyle = 'rgba(' + th.burst + ',' + (1 - k) + ')'; ctx.lineWidth = 2 * (1 - k) + .5;
    ctx.beginPath(); ctx.arc(b.x, b.y, 4 + k * 26, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(' + th.burst + ',' + (1 - k) * .75 + ')';
    for (let i = 0; i < 6; i++) { const ang = b.rot + i / 6 * TAU, r = 5 + k * 32; ctx.beginPath(); ctx.arc(b.x + Math.cos(ang) * r, b.y + Math.sin(ang) * r, 1.6 * (1 - k) + .3, 0, TAU); ctx.fill(); }
  }
  const iv = ctx.createRadialGradient(c.bw / 2, c.bh / 2, Math.min(c.bw, c.bh) * .35, c.bw / 2, c.bh / 2, Math.max(c.bw, c.bh) * .72);
  if (theme === 'light') { iv.addColorStop(0, 'rgba(30,50,40,0)'); iv.addColorStop(1, 'rgba(30,50,40,.06)'); }
  else { iv.addColorStop(0, 'rgba(0,0,0,0)'); iv.addColorStop(1, 'rgba(0,0,0,.4)'); }
  ctx.fillStyle = iv; ctx.fillRect(0, 0, c.bw, c.bh);
  if (!w.fish.length) {
    ctx.fillStyle = theme === 'light' ? 'rgba(251,254,252,.55)' : 'rgba(4,4,6,.55)'; ctx.fillRect(0, 0, c.bw, c.bh);
    ctx.fillStyle = th.ink; ctx.textAlign = 'center'; ctx.font = '600 ' + Math.round(c.bw * .03) + 'px "Bricolage Grotesque", Inter, sans-serif';
    ctx.fillText('generation wiped out', c.bw / 2, c.bh / 2); ctx.textAlign = 'left';
  }
  ctx.restore();
  ctx.strokeStyle = th.tankEdge; ctx.lineWidth = 2 / s; roundRect(ctx, 0, 0, c.bw, c.bh, 14); ctx.stroke();
  if (theme === 'light') { ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5 / s; ctx.beginPath(); ctx.moveTo(16, 1.5 / s); ctx.lineTo(c.bw - 16, 1.5 / s); ctx.stroke(); }
  ctx.restore();
}

export function pickCreature(w, x, y) {
  if (!w.transform) return null;
  const { s, ox, oy } = w.transform, wx = (x - ox) / s, wy = (y - oy) / s;
  for (const p of w.preds) if (Math.hypot(p.x - wx, p.y - wy) < 26) return { type: 'pred', obj: p };
  let best = null, bd = 1e9;
  for (const f of w.fish) { const d = Math.hypot(f.x - wx, f.y - wy); if (d < 16 && d < bd) { bd = d; best = f; } }
  return best ? { type: 'fish', obj: best } : null;
}

// ---- REAL weight-matrix brain visualization (uses the fish's actual genome + live activations) ----
export function drawBrain(ctx, W, H, S, sense, t, theme, accent) {
  const th = THEMES[theme], danger = THEMES[theme].threat;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = theme === 'light' ? 'rgba(29,34,48,.05)' : 'rgba(255,255,255,.05)';
  for (let gx = 12; gx < W; gx += 18) for (let gy = 12; gy < H; gy += 18) { ctx.beginPath(); ctx.arc(gx, gy, .8, 0, TAU); ctx.fill(); }
  const x = sense ? sense.x : new Array(NIN).fill(0);
  const h = sense ? sense.h : new Array(NHID).fill(0);
  const g = sense ? sense.genome : null;
  const turn = sense ? sense.turn : 0, thrust = sense ? sense.thrust : 0;
  const IX = 66, HX = W / 2, OX = W - 60;
  const iy = i => 20 + i * (H - 34) / (NIN - 1);
  const hy = j => 40 + j * (H - 70) / (NHID - 1);
  const oy = k => H * .38 + k * H * .26;
  const senseOn = (idx) => { const key = IN_SENSE[idx]; return key === null ? true : S[key]; };
  const edge = (x1, y1, x2, y2, wgt, act, seed) => {
    const on = Math.abs(wgt) > 0.001;
    const pos = wgt >= 0, signal = Math.abs(wgt * act);
    ctx.strokeStyle = pos ? accent : danger;
    ctx.globalAlpha = on ? Math.min(.85, .06 + signal * .9) : .04;
    ctx.lineWidth = Math.min(2.6, .3 + Math.abs(wgt) * 1.1);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    if (signal > .08 && !RM) {
      const k = (t * .5 + seed * .097) % 1;
      ctx.globalAlpha = Math.min(1, signal * 1.4); ctx.fillStyle = pos ? accent : danger;
      ctx.beginPath(); ctx.arc(x1 + (x2 - x1) * k, y1 + (y2 - y1) * k, 1.4 + Math.min(2, signal * 2), 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  };
  if (g) {
    for (let i = 0; i < NIN; i++) for (let j = 0; j < NHID; j++) edge(IX, iy(i), HX, hy(j), weightIH(g, j, i), x[i], i * NHID + j);
    for (let j = 0; j < NHID; j++) for (let k = 0; k < NOUT; k++) edge(HX, hy(j), OX, oy(k), weightHO(g, k, j), h[j], 40 + j * NOUT + k);
  }
  const node = (cx, cy, act, on, r) => {
    r = r || 6; const a = Math.abs(act);
    if (on && a > .05) {
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r + 7); rg.addColorStop(0, act < 0 ? danger : accent); rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = a * .5; ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(cx, cy, r + 7, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.fillStyle = theme === 'light' ? '#fff' : '#1a1a22'; ctx.strokeStyle = on ? (act < 0 ? danger : accent) : th.inkSoft;
    ctx.globalAlpha = on ? 1 : .4; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); ctx.stroke();
    if (on) { ctx.fillStyle = act < 0 ? danger : accent; ctx.globalAlpha = .2 + a * .8; ctx.beginPath(); ctx.arc(cx, cy, r * .5, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  };
  ctx.font = '500 9px Inter, sans-serif';
  for (let i = 0; i < NIN; i++) {
    const on = senseOn(i); node(IX, iy(i), x[i], on, 5);
    ctx.fillStyle = on ? th.ink : th.inkSoft; ctx.globalAlpha = on ? .85 : .4; ctx.textAlign = 'right';
    ctx.fillText(IN_LABELS[i] + (on ? '' : ' · off'), IX - 10, iy(i) + 3); ctx.globalAlpha = 1;
  }
  for (let j = 0; j < NHID; j++) node(HX, hy(j), h[j], true, 6);
  ctx.textAlign = 'left';
  const outs = [turn, thrust];
  for (let k = 0; k < NOUT; k++) {
    node(OX, oy(k), outs[k], true, 7);
    ctx.fillStyle = th.ink; ctx.globalAlpha = .85; ctx.fillText(OUT_LABELS[k], OX + 11, oy(k) + 3); ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'center'; ctx.fillStyle = th.inkSoft; ctx.globalAlpha = .55; ctx.font = '500 8.5px Inter, sans-serif';
  ctx.fillText('inputs', IX, H - 5); ctx.fillText('hidden', HX, H - 5); ctx.fillText('outputs', OX, H - 5);
  ctx.globalAlpha = 1; ctx.textAlign = 'left';
}

// learning curve (survival % across generations)
export function drawCurve(ctx, W, H, curve, accent, theme) {
  ctx.clearRect(0, 0, W, H);
  const th = THEMES[theme];
  ctx.strokeStyle = th.inkSoft; ctx.globalAlpha = .18; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(1, H - 1); ctx.lineTo(W - 1, H - 1); ctx.stroke(); ctx.globalAlpha = 1;
  if (!curve || curve.length === 0) return;
  const pts = curve.length > 1 ? curve : [curve[0], curve[0]];
  const LO = 0.1, HI = 0.9; // survival band — zoom the axis so the real trend is legible
  const map = v => H - 2 - clamp((v - LO) / (HI - LO), 0, 1) * (H - 4);
  ctx.beginPath();
  pts.forEach((v, i) => { const px = i / (pts.length - 1) * (W - 2) + 1, py = map(v); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
  ctx.strokeStyle = accent; ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.lineTo(W - 1, H - 1); ctx.lineTo(1, H - 1); ctx.closePath();
  ctx.globalAlpha = .13; ctx.fillStyle = accent; ctx.fill(); ctx.globalAlpha = 1;
  const last = pts[pts.length - 1], lx = W - 2, ly = map(last);
  ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(lx, ly, 2, 0, TAU); ctx.fill();
}

// real-world population decay (fraction of the deployed batch still alive, over time)
export function drawDecay(ctx, W, H, decay, theme) {
  ctx.clearRect(0, 0, W, H);
  const th = THEMES[theme];
  ctx.strokeStyle = th.inkSoft; ctx.globalAlpha = .16; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(1, H - 1); ctx.lineTo(W - 1, H - 1); ctx.stroke(); ctx.globalAlpha = 1;
  if (!decay || decay.length === 0) return;
  const pts = decay.length > 1 ? decay : [decay[0], decay[0]];
  const col = th.threat, map = v => H - 2 - clamp(v, 0, 1) * (H - 4);
  ctx.beginPath();
  pts.forEach((v, i) => { const px = i / (pts.length - 1) * (W - 2) + 1, py = map(v); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
  ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.lineTo(W - 1, H - 1); ctx.lineTo(1, H - 1); ctx.closePath();
  ctx.globalAlpha = .12; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1;
  const last = pts[pts.length - 1], lx = W - 2, ly = map(last);
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(lx, ly, 2, 0, TAU); ctx.fill();
}
