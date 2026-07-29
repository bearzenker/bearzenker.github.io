/* Centerfield TRACON — a browser ATC approach-control simulator.
 * Plain ES5-ish JS, no dependencies. All distances in nautical miles,
 * altitudes in feet, speeds in knots, headings in degrees (360 = north).
 */
(function () {
'use strict';

// ---------------------------------------------------------------- constants

var TIME_SCALE   = 8;      // 1 real second = 8 simulated seconds
var RADAR_RANGE  = 28;     // nm radius shown on the scope
var SPAWN_RADIUS = 26.5;   // nm from field where arrivals appear
var EXIT_RADIUS  = 30;     // beyond this the aircraft has left the scope
var GS_FT_PER_NM = 318;    // 3-degree glideslope
var RWY_HALF     = 0.7;    // runway half-length, nm (~8500 ft runway)

var RUNWAYS = {
  9:  { name: 'RWY 9',  thr: { x: -RWY_HALF, y: 0 }, course: 90  },
  27: { name: 'RWY 27', thr: { x:  RWY_HALF, y: 0 }, course: 270 }
};

// Approach gate: how far out / how aligned an aircraft must be to join the ILS
var CAPTURE_MIN_NM = 1.0, CAPTURE_MAX_NM = 22, CAPTURE_XTRACK = 1.3;
var CAPTURE_ANGLE = 45, CAPTURE_MAX_ALT = 4500;

var SEP_WARN_NM = 3.0, SEP_WARN_FT = 1000;   // conflict alert
var SEP_HIT_NM  = 0.8, SEP_HIT_FT  = 400;    // collision

var PTS_LAND = 100, PTS_CRASH = -200, PTS_DIVERT = -50;

var ALT_MIN = 1000, ALT_MAX = 12000;

var TYPES = [
  { icao: 'B738', label: 'Boeing 737-800',  cat: 'jet',   max: 250, min: 160, app: 140, turn: 10, climb: 230 },
  { icao: 'A320', label: 'Airbus A320',     cat: 'jet',   max: 250, min: 160, app: 138, turn: 10, climb: 230 },
  { icao: 'E175', label: 'Embraer 175',     cat: 'jet',   max: 240, min: 150, app: 130, turn: 11, climb: 240 },
  { icao: 'DH8D', label: 'Dash 8 Q400',     cat: 'prop',  max: 210, min: 120, app: 115, turn: 13, climb: 190 },
  { icao: 'B77W', label: 'Boeing 777-300',  cat: 'heavy', max: 250, min: 170, app: 150, turn: 8,  climb: 200 },
  { icao: 'C208', label: 'Cessna Caravan',  cat: 'prop',  max: 165, min: 90,  app: 90,  turn: 15, climb: 140 }
];

var AIRLINES = ['DAL', 'UAL', 'AAL', 'SWA', 'JBU', 'ASA', 'FDX', 'UPS', 'NKS', 'FFT'];

// ---------------------------------------------------------------- utilities

function rnd(a, b) { return a + Math.random() * (b - a); }
function irnd(a, b) { return Math.floor(rnd(a, b + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function norm360(d) { d = d % 360; if (d < 0) d += 360; return d === 0 ? 360 : d; }
function rad(d) { return d * Math.PI / 180; }
function angDiff(a, b) { return ((a - b + 540) % 360) - 180; } // signed shortest a-b
function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
function bearing(fx, fy, tx, ty) { return norm360(Math.atan2(tx - fx, ty - fy) * 180 / Math.PI); }
function pad3(n) { n = Math.max(0, Math.round(n)); return (n < 10 ? '00' : n < 100 ? '0' : '') + n; }
function fmtTime(s) {
  s = Math.max(0, Math.ceil(s));
  var m = Math.floor(s / 60);
  return m + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
}

// Turn cur toward tgt at rate deg/s; dir 'left'/'right' forces direction.
function turnToward(cur, tgt, rate, dt, dir) {
  var d = angDiff(tgt, cur);
  if (dir === 'left'  && d > 0.01) d -= 360;
  if (dir === 'right' && d < -0.01) d += 360;
  var step = rate * dt;
  if (Math.abs(d) <= step) return tgt;
  return norm360(cur + (d > 0 ? step : -step));
}

// Along-track / cross-track relative to a runway's final approach course.
// a > 0 means the aircraft is on the approach side, a nm from the threshold.
function finalGeom(p, rw) {
  var u = { x: Math.sin(rad(rw.course)), y: Math.cos(rad(rw.course)) };
  var rx = p.x - rw.thr.x, ry = p.y - rw.thr.y;
  return {
    a: -(rx * u.x + ry * u.y),
    c: u.x * ry - u.y * rx
  };
}

// ---------------------------------------------------------------- audio

var audio = {
  ctx: null,
  muted: (localStorage.getItem('atc_muted') === '1'),
  lastConflictBeep: 0,
  ensure: function () {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { this.ctx = null; }
    }
    return this.ctx;
  },
  tone: function (freq, dur, vol, type) {
    if (this.muted || !this.ensure()) return;
    var c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.04, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination);
    o.start(); o.stop(c.currentTime + dur);
  },
  conflict: function (now) {
    if (now - this.lastConflictBeep > 1.4) {
      this.lastConflictBeep = now;
      this.tone(880, 0.12, 0.05);
      var self = this;
      setTimeout(function () { self.tone(880, 0.12, 0.05); }, 180);
    }
  },
  landed: function () { this.tone(520, 0.09, 0.04, 'sine'); this.tone(780, 0.15, 0.04, 'sine'); },
  crash: function () { this.tone(120, 0.7, 0.09, 'sawtooth'); },
  click: function () { this.tone(1400, 0.03, 0.02, 'sine'); }
};

// ---------------------------------------------------------------- level design

function levelConfig(n) {
  var pool;
  if (n === 1)      pool = ['B738', 'A320'];
  else if (n === 2) pool = ['B738', 'A320', 'E175', 'DH8D'];
  else              pool = ['B738', 'A320', 'E175', 'DH8D', 'B77W', 'C208'];
  return {
    level: n,
    planes: 5 + 2 * (n - 1),
    timeLimit: 330 + 50 * (n - 1),                 // real seconds
    spawnInterval: Math.max(13, 34 - 3 * (n - 1)), // real seconds between arrivals
    pool: pool,
    fuelBase: Math.max(260, 430 - 20 * n),         // real seconds of fuel
    altSpread: Math.min(5, 2 + n)                  // more stacked altitudes later
  };
}
function needToPass(cfg) { return Math.ceil(cfg.planes * 0.7); }

// ---------------------------------------------------------------- game state

var G = {
  screen: 'menu',          // 'menu' | 'game'
  paused: false,
  over: false,
  cfg: null,
  planes: [],
  explosions: [],
  spawnTimes: [],
  spawned: 0,
  t: 0,                    // elapsed real seconds this level
  timeLeft: 0,
  totalScore: 0,           // carried across consecutive levels in a run
  levelScore: 0,
  landed: 0, crashed: 0, diverted: 0,
  selected: null,
  usedCallsigns: {},
  anyConflict: false
};

var maxLevel  = parseInt(localStorage.getItem('atc_maxLevel') || '1', 10);
var highScore = parseInt(localStorage.getItem('atc_highScore') || '0', 10);

// ---------------------------------------------------------------- aircraft

var nextId = 1;

function makeCallsign(type) {
  var cs;
  do {
    if (type.icao === 'C208') {
      cs = 'N' + irnd(10, 99) + String.fromCharCode(65 + irnd(0, 25)) + String.fromCharCode(65 + irnd(0, 25));
    } else {
      cs = pick(AIRLINES) + irnd(100, 1999);
    }
  } while (G.usedCallsigns[cs]);
  G.usedCallsigns[cs] = true;
  return cs;
}

function spawnPlane() {
  var cfg = G.cfg;
  var type = pick(TYPES.filter(function (t) { return cfg.pool.indexOf(t.icao) >= 0; }));

  var brg = rnd(0, 360);
  // keep some angular spacing from the previous spawn so pairs don't pop in merged
  if (G.planes.length) {
    var last = G.planes[G.planes.length - 1];
    var lastBrg = bearing(0, 0, last.x, last.y);
    if (Math.abs(angDiff(brg, lastBrg)) < 25) brg = norm360(brg + rnd(40, 90));
  }
  var x = Math.sin(rad(brg)) * SPAWN_RADIUS;
  var y = Math.cos(rad(brg)) * SPAWN_RADIUS;
  var hdg = norm360(bearing(x, y, 0, 0) + rnd(-20, 20));
  var alt = (type.cat === 'prop' ? irnd(4, 6) : irnd(6, 5 + cfg.altSpread)) * 1000;
  var spd = type.cat === 'prop' ? irnd(Math.max(type.min, 130) / 10, type.max / 10) * 10
                                : irnd(20, type.max / 10) * 10;
  spd = clamp(spd, type.min, type.max);

  var p = {
    id: nextId++,
    cs: makeCallsign(type),
    type: type,
    x: x, y: y,
    hdg: hdg, alt: alt, spd: spd,
    tgtHdg: hdg, tgtAlt: alt, tgtSpd: spd,
    turnDir: null,
    cleared: null,        // 9 | 27 once cleared for an approach
    established: false,
    towered: false,
    warnedHigh: false,
    status: 'flying',     // flying | rollout | landed | crashed | diverted
    rolloutT: 0,
    fuel: cfg.fuelBase + rnd(0, 110),
    lowFuelCalled: false,
    conflict: false,
    trail: [],
    trailT: 0
  };
  G.planes.push(p);
  log(p.cs + ': Approach, ' + p.cs + ' with you, ' + (alt / 100) + '00 feet, inbound.', '');
  return p;
}

// ---------------------------------------------------------------- comms log

var commsEl;
function log(text, cls) {
  var d = document.createElement('div');
  d.className = 'msg' + (cls ? ' ' + cls : '');
  var mins = Math.floor(G.t / 60), secs = Math.floor(G.t % 60);
  d.innerHTML = '<span class="t">' + mins + ':' + (secs < 10 ? '0' : '') + secs + '</span>' +
                text.replace(/</g, '&lt;');
  commsEl.appendChild(d);
  while (commsEl.childNodes.length > 80) commsEl.removeChild(commsEl.firstChild);
  commsEl.scrollTop = commsEl.scrollHeight;
}

// ---------------------------------------------------------------- commands

function canCommand(p) {
  return p && p.status === 'flying' && !p.established;
}

function cmdHeading(p, hdg, dir) {
  if (!canCommand(p)) return;
  hdg = norm360(Math.round(hdg));
  p.tgtHdg = hdg;
  p.turnDir = dir || null;
  if (p.cleared) { p.cleared = null; }  // new vector cancels the clearance
  var word = dir === 'left' ? 'Left h' : dir === 'right' ? 'Right h' : 'H';
  log(p.cs + ': ' + word + 'eading ' + pad3(hdg) + '.', '');
  audio.click();
  refreshPanel();
}

function cmdAlt(p, alt) {
  if (!canCommand(p)) return;
  alt = clamp(Math.round(alt / 1000) * 1000, ALT_MIN, ALT_MAX);
  if (alt === p.tgtAlt) return;
  var verb = alt < p.alt ? 'Descending ' : 'Climbing ';
  p.tgtAlt = alt;
  log(p.cs + ': ' + verb + alt + ' feet.', '');
  audio.click();
  refreshPanel();
}

function cmdSpd(p, spd) {
  if (!canCommand(p)) return;
  spd = clamp(Math.round(spd / 10) * 10, p.type.min, p.type.max);
  if (spd === p.tgtSpd) return;
  p.tgtSpd = spd;
  log(p.cs + ': Speed ' + spd + ' knots.', '');
  audio.click();
  refreshPanel();
}

function cmdApproach(p, rwyId) {
  if (!canCommand(p)) return;
  p.cleared = rwyId;
  p.warnedHigh = false;
  log(p.cs + ': Cleared ILS runway ' + rwyId + ' approach, will report established.', '');
  audio.click();
  refreshPanel();
}

function cmdCancelApproach(p) {
  if (!p || p.status !== 'flying' || p.towered) return;
  if (!p.cleared && !p.established) return;
  p.cleared = null;
  if (p.established) {
    p.established = false;
    p.tgtAlt = clamp(Math.ceil(p.alt / 1000) * 1000 || 2000, 2000, ALT_MAX);
    p.tgtHdg = p.hdg;
    p.tgtSpd = clamp(p.spd, p.type.min, p.type.max);
  }
  log(p.cs + ': Cancelling approach clearance, maintaining present heading.', 'warn');
  audio.click();
  refreshPanel();
}

// ---------------------------------------------------------------- simulation

function updatePlane(p, dt) {
  if (p.status === 'rollout') {
    p.rolloutT += dt;
    p.spd = Math.max(30, p.spd - 60 * dt);
    var u = { x: Math.sin(rad(p.hdg)), y: Math.cos(rad(p.hdg)) };
    var mv = p.spd / 3600 * TIME_SCALE * dt;
    p.x += u.x * mv; p.y += u.y * mv;
    if (p.rolloutT > 2.2) {
      p.status = 'landed';
      G.landed++;
      G.levelScore += PTS_LAND;
      log('Tower: ' + p.cs + ' is down and clear. Nice work, approach.', 'twr');
      audio.landed();
      if (G.selected === p) select(null);
    }
    return;
  }
  if (p.status !== 'flying') return;

  // Fuel burn (real seconds)
  p.fuel -= dt;
  if (p.fuel <= 75 && !p.lowFuelCalled) {
    p.lowFuelCalled = true;
    log(p.cs + ': MAYDAY fuel — minutes of fuel remaining!', 'warn');
  }
  if (p.fuel <= 0) {
    crashPlane(p, p.cs + ' has flamed out — fuel exhaustion. Aircraft lost.');
    return;
  }

  // Approach capture
  if (p.cleared && !p.established) {
    var rw = RUNWAYS[p.cleared];
    var g = finalGeom(p, rw);
    var aligned = g.a > CAPTURE_MIN_NM && g.a < CAPTURE_MAX_NM &&
                  Math.abs(g.c) < CAPTURE_XTRACK &&
                  Math.abs(angDiff(p.hdg, rw.course)) < CAPTURE_ANGLE;
    if (aligned) {
      if (p.alt <= Math.max(CAPTURE_MAX_ALT, 0) && p.alt <= g.a * GS_FT_PER_NM + 1200) {
        p.established = true;
        p.turnDir = null;
        log(p.cs + ': Established ILS runway ' + p.cleared + '.', '');
      } else if (!p.warnedHigh) {
        p.warnedHigh = true;
        log(p.cs + ': We\'re too high for the approach, ' + p.cs + '.', 'warn');
      }
    }
  }

  // Guidance while on the ILS
  if (p.established) {
    var rw2 = RUNWAYS[p.cleared];
    var g2 = finalGeom(p, rw2);
    if (g2.a > 1.2) {
      p.tgtHdg = bearing(p.x, p.y, rw2.thr.x, rw2.thr.y);
    } else {
      p.tgtHdg = rw2.course;
    }
    p.tgtAlt = Math.max(0, Math.min(p.alt, g2.a * GS_FT_PER_NM));
    if (g2.a < 12) p.tgtSpd = p.type.app;

    if (!p.towered && g2.a <= 7) {
      p.towered = true;
      log(p.cs + ': Contact tower 118.70. — Tower: ' + p.cs + ', runway ' + p.cleared + ', cleared to land.', 'twr');
      if (G.selected === p) refreshPanel();
    }
    if (g2.a < 0.25 && p.alt < 200) {
      p.status = 'rollout';
      p.alt = 0;
      p.hdg = rw2.course; p.tgtHdg = rw2.course;
      return;
    }
  }

  // Fly the airplane
  var turnRate = p.type.turn;
  p.hdg = turnToward(p.hdg, p.tgtHdg, turnRate, dt, p.turnDir);
  if (Math.abs(angDiff(p.hdg, p.tgtHdg)) < 0.01) p.turnDir = null;

  var vs = p.type.climb * (p.established ? 1.4 : 1);   // ft per real second
  if (p.alt < p.tgtAlt) p.alt = Math.min(p.tgtAlt, p.alt + vs * dt);
  else if (p.alt > p.tgtAlt) p.alt = Math.max(p.tgtAlt, p.alt - vs * dt);

  var acc = 6; // kt per real second
  if (p.spd < p.tgtSpd) p.spd = Math.min(p.tgtSpd, p.spd + acc * dt);
  else if (p.spd > p.tgtSpd) p.spd = Math.max(p.tgtSpd, p.spd - acc * dt);

  var mv2 = p.spd / 3600 * TIME_SCALE * dt;
  p.x += Math.sin(rad(p.hdg)) * mv2;
  p.y += Math.cos(rad(p.hdg)) * mv2;

  // Radar trail
  p.trailT += dt;
  if (p.trailT > 0.7) {
    p.trailT = 0;
    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 6) p.trail.shift();
  }

  // Left the scope
  if (dist(p.x, p.y, 0, 0) > EXIT_RADIUS) {
    p.status = 'diverted';
    G.diverted++;
    G.levelScore += PTS_DIVERT;
    log(p.cs + ' has left the radar area and diverted. (' + PTS_DIVERT + ')', 'warn');
    if (G.selected === p) select(null);
  }
}

function crashPlane(p, msg) {
  p.status = 'crashed';
  G.crashed++;
  G.levelScore += PTS_CRASH;
  G.explosions.push({ x: p.x, y: p.y, age: 0 });
  log(msg + ' (' + PTS_CRASH + ')', 'bad');
  audio.crash();
  if (G.selected === p) select(null);
}

function checkSeparation() {
  var live = G.planes.filter(function (p) { return p.status === 'flying'; });
  for (var i = 0; i < live.length; i++) live[i].conflict = false;
  G.anyConflict = false;

  for (var a = 0; a < live.length; a++) {
    for (var b = a + 1; b < live.length; b++) {
      var p = live[a], q = live[b];
      var dh = dist(p.x, p.y, q.x, q.y);
      var dv = Math.abs(p.alt - q.alt);
      if (dh < SEP_HIT_NM && dv < SEP_HIT_FT) {
        var mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
        p.x = mx; p.y = my; q.x = mx; q.y = my;
        crashPlane(p, 'MIDAIR COLLISION — ' + p.cs + ' and ' + q.cs + ' have collided.');
        crashPlane(q, q.cs + ' lost in the collision.');
        return checkSeparation(); // list changed; re-run for remaining pairs
      }
      if (dh < SEP_WARN_NM && dv < SEP_WARN_FT) {
        p.conflict = q.conflict = true;
        G.anyConflict = true;
      }
    }
  }
}

function tick(dt) {
  G.t += dt;
  G.timeLeft -= dt;

  // Arrivals
  while (G.spawned < G.cfg.planes && G.t >= G.spawnTimes[G.spawned]) {
    spawnPlane();
    G.spawned++;
  }

  for (var i = 0; i < G.planes.length; i++) updatePlane(G.planes[i], dt);
  checkSeparation();
  if (G.anyConflict) audio.conflict(G.t);

  for (var e = G.explosions.length - 1; e >= 0; e--) {
    G.explosions[e].age += dt;
    if (G.explosions[e].age > 2.5) G.explosions.splice(e, 1);
  }

  // Level end conditions
  var unresolved = G.planes.filter(function (p) {
    return p.status === 'flying' || p.status === 'rollout';
  }).length;
  if (G.timeLeft <= 0) {
    endLevel('time', unresolved);
  } else if (G.spawned >= G.cfg.planes && unresolved === 0) {
    endLevel('done', 0);
  }
}

// ---------------------------------------------------------------- level flow

function startLevel(n, keepScore) {
  G.cfg = levelConfig(n);
  G.screen = 'game';
  G.paused = false;
  G.over = false;
  G.planes = [];
  G.explosions = [];
  G.spawned = 0;
  G.t = 0;
  G.timeLeft = G.cfg.timeLimit;
  G.levelScore = 0;
  if (!keepScore) G.totalScore = 0;
  G.landed = 0; G.crashed = 0; G.diverted = 0;
  G.selected = null;
  G.usedCallsigns = {};
  G.anyConflict = false;

  G.spawnTimes = [];
  var t = 2;
  for (var i = 0; i < G.cfg.planes; i++) {
    G.spawnTimes.push(t);
    t += G.cfg.spawnInterval + rnd(-4, 6);
  }

  commsEl.innerHTML = '';
  log('— LEVEL ' + n + ' — ' + G.cfg.planes + ' arrivals, ' + fmtTime(G.cfg.timeLimit) +
      ' on the clock. Land at least ' + needToPass(G.cfg) + '. Runways 9 and 27 available.', 'twr');

  ui.menu.classList.add('hidden');
  ui.levelEnd.classList.add('hidden');
  ui.pauseOv.classList.add('hidden');
  select(null);
  refreshStrips();
  refreshHud();
}

function endLevel(reason, unresolved) {
  if (G.over) return;
  G.over = true;
  var cfg = G.cfg, need = needToPass(cfg);
  var pass = G.landed >= need;
  var bonus = pass ? Math.round(Math.max(0, G.timeLeft)) : 0;
  G.levelScore += bonus;
  G.totalScore += G.levelScore;

  if (pass && cfg.level + 1 > maxLevel) {
    maxLevel = cfg.level + 1;
    localStorage.setItem('atc_maxLevel', String(maxLevel));
  }
  if (G.totalScore > highScore) {
    highScore = G.totalScore;
    localStorage.setItem('atc_highScore', String(highScore));
  }

  ui.endTitle.textContent = pass ? 'LEVEL ' + cfg.level + ' COMPLETE' : 'LEVEL ' + cfg.level + ' FAILED';
  ui.endTitle.style.color = pass ? '' : 'var(--red)';
  var rows = [];
  rows.push('Landed: <b>' + G.landed + '</b> / ' + cfg.planes + ' (needed ' + need + ') — ' +
            (pass ? '<span class="pass">PASSED</span>' : '<span class="fail">NOT ENOUGH</span>'));
  if (G.crashed)  rows.push('Crashed: <b>' + G.crashed + '</b>');
  if (G.diverted) rows.push('Diverted off-scope: <b>' + G.diverted + '</b>');
  if (reason === 'time' && unresolved) rows.push('Still airborne at time-up: <b>' + unresolved + '</b>');
  rows.push('Landings & penalties: <b>' + (G.levelScore - bonus) + '</b>');
  if (bonus) rows.push('Time bonus: <span class="bonus">+' + bonus + '</span>');
  rows.push('Level score: <b>' + G.levelScore + '</b> &nbsp; Total: <b>' + G.totalScore + '</b>');
  if (G.totalScore >= highScore && G.totalScore > 0) rows.push('<span class="bonus">NEW HIGH SCORE</span>');
  ui.endStats.innerHTML = rows.join('<br>');
  ui.btnNext.classList.toggle('hidden', !pass);
  ui.levelEnd.classList.remove('hidden');
}

function toMenu() {
  G.screen = 'menu';
  G.paused = false;
  buildMenu();
  ui.levelEnd.classList.add('hidden');
  ui.pauseOv.classList.add('hidden');
  ui.menu.classList.remove('hidden');
}

function buildMenu() {
  ui.menuHigh.textContent = highScore;
  ui.levelBtns.innerHTML = '';
  for (var n = 1; n <= maxLevel; n++) {
    (function (lvl) {
      var b = document.createElement('button');
      b.textContent = 'LEVEL ' + lvl;
      b.addEventListener('click', function () { audio.ensure(); startLevel(lvl, false); });
      ui.levelBtns.appendChild(b);
    })(n);
  }
}

// ---------------------------------------------------------------- selection & panel

function select(p) {
  G.selected = (p && p.status === 'flying') ? p : null;
  refreshPanel();
  refreshStrips();
}

function selectNext(dirStep) {
  var live = G.planes.filter(function (p) { return p.status === 'flying'; });
  if (!live.length) return select(null);
  var i = live.indexOf(G.selected);
  i = i < 0 ? 0 : (i + dirStep + live.length) % live.length;
  select(live[i]);
}

function refreshPanel() {
  var p = G.selected;
  if (!p) {
    ui.selNone.classList.remove('hidden');
    ui.selBox.classList.add('hidden');
    return;
  }
  ui.selNone.classList.add('hidden');
  ui.selBox.classList.remove('hidden');
  ui.selCS.textContent = p.cs;
  ui.selType.textContent = p.type.icao + ' · ' + p.type.label + (p.type.cat === 'heavy' ? ' (HEAVY)' : '');
  var st = 'HDG ' + pad3(p.hdg) + '  ·  ' + Math.round(p.alt) + ' ft  ·  ' + Math.round(p.spd) + ' kt';
  if (p.established) st += p.towered ? '  ·  WITH TOWER' : '  ·  ON ILS ' + p.cleared;
  else if (p.cleared) st += '  ·  CLRD ILS ' + p.cleared;
  ui.selStat.textContent = st;
  ui.altTgt.textContent = p.tgtAlt + ' ft';
  ui.spdTgt.textContent = p.tgtSpd + ' kt';
  ui.hdgInput.placeholder = pad3(p.tgtHdg);

  var locked = !canCommand(p);
  ui.selBox.querySelectorAll('button, input').forEach(function (el) {
    if (el.id === 'ilsX') el.disabled = !p.cleared && !p.established || p.towered;
    else el.disabled = locked;
  });
  ui.towerNote.classList.toggle('hidden', !p.established);
  ui.towerNote.textContent = p.towered
    ? 'Aircraft is with TOWER — control locked.'
    : 'Established on the ILS — CNL to take back control.';
}

function stripHtml(p) {
  var trend = p.alt < p.tgtAlt - 40 ? '↑' : p.alt > p.tgtAlt + 40 ? '↓' : '';
  var st;
  if (p.towered) st = '<span class="ilsTag">TOWER</span>';
  else if (p.established) st = '<span class="ilsTag">ILS ' + p.cleared + '</span>';
  else if (p.cleared) st = 'CLRD ' + p.cleared;
  else st = 'INBND';
  var fuelCls = p.fuel < 40 ? 'crit' : p.fuel < 75 ? 'warn' : 'sub';
  return '<div><div class="cs">' + p.cs + '</div><div class="sub">' + p.type.icao + '</div></div>' +
         '<div class="st">' + Math.round(p.alt) + trend + ' ft · ' + Math.round(p.spd) + ' kt<br>' +
         st + ' · <span class="' + fuelCls + '">FUEL ' + fmtTime(p.fuel) + '</span></div>';
}

function refreshStrips() {
  var live = G.planes.filter(function (p) { return p.status === 'flying' || p.status === 'rollout'; });
  ui.strips.innerHTML = '';
  live.forEach(function (p) {
    var d = document.createElement('div');
    d.className = 'strip' +
      (p === G.selected ? ' sel' : '') +
      (p.conflict ? ' conflict' : p.established ? ' ils' : p.fuel < 75 ? ' lf' : '');
    d.innerHTML = stripHtml(p);
    d.addEventListener('click', function () { select(p); });
    ui.strips.appendChild(d);
  });
}

function refreshHud() {
  ui.hudLevel.textContent = G.cfg ? G.cfg.level : '–';
  ui.hudTime.textContent = fmtTime(G.timeLeft);
  ui.hudTime.style.color = G.timeLeft < 45 ? 'var(--red)' : '';
  ui.hudScore.textContent = G.totalScore + G.levelScore;
  ui.hudLanded.textContent = G.landed + (G.cfg ? '/' + G.cfg.planes : '');
  ui.hudCrashed.textContent = G.crashed + G.diverted;
  ui.hudActive.textContent = G.planes.filter(function (p) { return p.status === 'flying'; }).length;
}

// ---------------------------------------------------------------- rendering

var canvas, ctx, view = { w: 0, h: 0, cx: 0, cy: 0, scale: 1, dpr: 1 };

function resize() {
  var r = canvas.getBoundingClientRect();
  view.dpr = window.devicePixelRatio || 1;
  view.w = r.width; view.h = r.height;
  canvas.width = Math.round(r.width * view.dpr);
  canvas.height = Math.round(r.height * view.dpr);
  view.cx = r.width / 2; view.cy = r.height / 2;
  view.scale = Math.min(r.width, r.height) / 2 / RADAR_RANGE * 0.96;
}

function sx(x) { return view.cx + x * view.scale; }
function sy(y) { return view.cy - y * view.scale; }

function draw() {
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.clearRect(0, 0, view.w, view.h);
  ctx.fillStyle = '#050b06';
  ctx.fillRect(0, 0, view.w, view.h);

  var s = view.scale;

  // Range rings
  ctx.strokeStyle = 'rgba(60,240,108,0.16)';
  ctx.fillStyle = 'rgba(60,240,108,0.35)';
  ctx.font = '10px "Courier New", monospace';
  ctx.lineWidth = 1;
  [10, 20].forEach(function (r) {
    ctx.beginPath();
    ctx.arc(view.cx, view.cy, r * s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillText(r + ' NM', view.cx + 4, view.cy - r * s + 12);
  });
  // Scope edge
  ctx.strokeStyle = 'rgba(60,240,108,0.3)';
  ctx.beginPath();
  ctx.arc(view.cx, view.cy, RADAR_RANGE * s, 0, Math.PI * 2);
  ctx.stroke();

  // Compass ticks every 30°
  ctx.fillStyle = 'rgba(60,240,108,0.5)';
  ctx.textAlign = 'center';
  for (var d = 30; d <= 360; d += 30) {
    var ux = Math.sin(rad(d)), uy = Math.cos(rad(d));
    var r1 = RADAR_RANGE * s, r2 = (RADAR_RANGE - 0.9) * s;
    ctx.strokeStyle = 'rgba(60,240,108,0.4)';
    ctx.beginPath();
    ctx.moveTo(view.cx + ux * r2, view.cy - uy * r2);
    ctx.lineTo(view.cx + ux * r1, view.cy - uy * r1);
    ctx.stroke();
    ctx.fillText(pad3(d), view.cx + ux * (r1 - 22), view.cy - uy * (r1 - 22) + 3);
  }
  ctx.textAlign = 'left';

  // Extended centerlines with 5-nm ticks
  ctx.strokeStyle = 'rgba(60,240,108,0.35)';
  ctx.setLineDash([5, 6]);
  [9, 27].forEach(function (id) {
    var rw = RUNWAYS[id];
    var ux2 = Math.sin(rad(rw.course)), uy2 = Math.cos(rad(rw.course));
    // approach side extends opposite the landing course
    var ex = rw.thr.x - ux2 * 18, ey = rw.thr.y - uy2 * 18;
    ctx.beginPath();
    ctx.moveTo(sx(rw.thr.x), sy(rw.thr.y));
    ctx.lineTo(sx(ex), sy(ey));
    ctx.stroke();
  });
  ctx.setLineDash([]);
  // Distance ticks
  ctx.strokeStyle = 'rgba(60,240,108,0.45)';
  [9, 27].forEach(function (id) {
    var rw = RUNWAYS[id];
    var ux3 = Math.sin(rad(rw.course)), uy3 = Math.cos(rad(rw.course));
    for (var nm = 5; nm <= 15; nm += 5) {
      var px = rw.thr.x - ux3 * nm, py = rw.thr.y - uy3 * nm;
      ctx.beginPath();
      ctx.moveTo(sx(px), sy(py) - 5);
      ctx.lineTo(sx(px), sy(py) + 5);
      ctx.stroke();
    }
  });

  // Runway
  ctx.strokeStyle = '#e8f5ec';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(sx(-RWY_HALF), sy(0));
  ctx.lineTo(sx(RWY_HALF), sy(0));
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.fillStyle = 'rgba(232,245,236,0.8)';
  ctx.font = '10px "Courier New", monospace';
  ctx.fillText('9', sx(-RWY_HALF) - 12, sy(0) + 4);
  ctx.fillText('27', sx(RWY_HALF) + 5, sy(0) + 4);
  ctx.fillStyle = 'rgba(60,240,108,0.6)';
  ctx.fillText('CTR INTL', sx(0) - 24, sy(0) + 18);

  // Aircraft
  G.planes.forEach(function (p) {
    if (p.status !== 'flying' && p.status !== 'rollout') return;
    var color = p.conflict ? '#ff4d4d'
              : p === G.selected ? '#ffffff'
              : p.established ? '#46c8ff'
              : '#3cf06c';

    // trail
    for (var i = 0; i < p.trail.length; i++) {
      var a = (i + 1) / (p.trail.length + 1) * 0.5;
      ctx.fillStyle = 'rgba(60,240,108,' + a.toFixed(2) + ')';
      ctx.fillRect(sx(p.trail[i].x) - 1.5, sy(p.trail[i].y) - 1.5, 3, 3);
    }

    var px = sx(p.x), py = sy(p.y);

    // velocity leader (~8 real-seconds of travel)
    var lead = p.spd / 3600 * TIME_SCALE * 8 * view.scale;
    var hx = Math.sin(rad(p.hdg)), hy = Math.cos(rad(p.hdg));
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + hx * lead, py - hy * lead);
    ctx.stroke();

    // blip
    ctx.fillStyle = color;
    ctx.fillRect(px - 3.5, py - 3.5, 7, 7);
    if (p === G.selected) {
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (p.conflict) {
      ctx.strokeStyle = 'rgba(255,77,77,' + (0.4 + 0.4 * Math.sin(G.t * 10)).toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(px, py, SEP_WARN_NM / 2 * view.scale, 0, Math.PI * 2);
      ctx.stroke();
    }

    // data block
    var trend = p.alt < p.tgtAlt - 40 ? '↑' : p.alt > p.tgtAlt + 40 ? '↓' : ' ';
    var tag = p.towered ? ' TWR' : p.established ? ' ILS' : '';
    if (p.fuel < 75) tag += ' LF';
    ctx.font = '11px "Courier New", monospace';
    ctx.fillStyle = color;
    ctx.fillText(p.cs, px + 10, py - 12);
    ctx.fillStyle = p.fuel < 75 ? '#ffb545' : color;
    ctx.fillText(pad3(p.alt / 100) + trend + Math.round(p.spd / 10) + tag, px + 10, py - 1);
  });

  // Explosions
  G.explosions.forEach(function (ex) {
    var r = 4 + ex.age * 14;
    var a = Math.max(0, 1 - ex.age / 2.5);
    ctx.strokeStyle = 'rgba(255,120,40,' + a.toFixed(2) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx(ex.x), sy(ex.y), r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(255,200,60,' + (a * 0.6).toFixed(2) + ')';
    ctx.beginPath();
    ctx.arc(sx(ex.x), sy(ex.y), r * 0.4, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ---------------------------------------------------------------- main loop

var lastFrame = performance.now();
var stripTimer = 0;

function frame(now) {
  var dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;

  if (G.screen === 'game' && !G.paused && !G.over) {
    tick(dt);
    stripTimer += dt;
    if (stripTimer > 0.3) {
      stripTimer = 0;
      refreshStrips();
      if (G.selected) refreshPanel();
    }
    refreshHud();
  }
  if (G.screen === 'game') draw();
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- input

function canvasClick(ev) {
  if (G.screen !== 'game') return;
  var r = canvas.getBoundingClientRect();
  var mx = ev.clientX - r.left, my = ev.clientY - r.top;
  var best = null, bestD = 20; // px
  G.planes.forEach(function (p) {
    if (p.status !== 'flying') return;
    var d = Math.sqrt(Math.pow(sx(p.x) - mx, 2) + Math.pow(sy(p.y) - my, 2));
    if (d < bestD) { bestD = d; best = p; }
  });
  select(best);
}

function setPaused(v) {
  if (G.screen !== 'game' || G.over) return;
  G.paused = v;
  ui.pauseOv.classList.toggle('hidden', !v);
  ui.btnPause.textContent = v ? 'RESUME' : 'PAUSE';
}

function keyHandler(ev) {
  if (G.screen !== 'game') return;
  if (document.activeElement === ui.hdgInput) {
    if (ev.key === 'Enter') { applyHdgInput(); ev.preventDefault(); }
    return;
  }
  var p = G.selected;
  switch (ev.key) {
    case 'Tab':
      selectNext(ev.shiftKey ? -1 : 1); ev.preventDefault(); break;
    case 'ArrowLeft':
      if (p) cmdHeading(p, p.tgtHdg - (ev.shiftKey ? 30 : 10), 'left');
      ev.preventDefault(); break;
    case 'ArrowRight':
      if (p) cmdHeading(p, p.tgtHdg + (ev.shiftKey ? 30 : 10), 'right');
      ev.preventDefault(); break;
    case 'ArrowUp':
      if (p) cmdAlt(p, p.tgtAlt + 1000); ev.preventDefault(); break;
    case 'ArrowDown':
      if (p) cmdAlt(p, p.tgtAlt - 1000); ev.preventDefault(); break;
    case '[':
      if (p) cmdSpd(p, p.tgtSpd - 10); break;
    case ']':
      if (p) cmdSpd(p, p.tgtSpd + 10); break;
    case '9':
      if (p) cmdApproach(p, 9); break;
    case '7':
      if (p) cmdApproach(p, 27); break;
    case 'c': case 'C':
      if (p) cmdCancelApproach(p); break;
    case 'p': case 'P':
      setPaused(!G.paused); break;
  }
}

function applyHdgInput() {
  var p = G.selected;
  var v = parseInt(ui.hdgInput.value, 10);
  ui.hdgInput.value = '';
  if (!p || isNaN(v) || v < 1 || v > 360) return;
  cmdHeading(p, v, null);
  ui.hdgInput.blur();
}

// ---------------------------------------------------------------- boot

var ui = {};

function bind() {
  ['hudLevel', 'hudTime', 'hudScore', 'hudLanded', 'hudCrashed', 'hudActive',
   'btnMute', 'btnPause', 'btnMenu', 'selNone', 'selBox', 'selCS', 'selType',
   'selStat', 'hdgInput', 'hdgSet', 'altDn', 'altUp', 'altTgt', 'spdDn', 'spdUp',
   'spdTgt', 'ils9', 'ils27', 'ilsX', 'towerNote', 'strips', 'menu', 'menuHigh',
   'levelBtns', 'levelEnd', 'endTitle', 'endStats', 'btnNext', 'btnRetry',
   'btnEndMenu', 'pauseOv', 'btnResume'].forEach(function (id) {
    ui[id] = document.getElementById(id);
  });
  commsEl = document.getElementById('comms');
  canvas = document.getElementById('radar');
  ctx = canvas.getContext('2d');

  window.addEventListener('resize', resize);
  canvas.addEventListener('mousedown', canvasClick);
  document.addEventListener('keydown', keyHandler);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) setPaused(true);
  });

  ui.btnPause.addEventListener('click', function () { setPaused(!G.paused); });
  ui.btnResume.addEventListener('click', function () { setPaused(false); });
  ui.btnMenu.addEventListener('click', toMenu);
  ui.btnEndMenu.addEventListener('click', toMenu);
  ui.btnRetry.addEventListener('click', function () { startLevel(G.cfg.level, false); });
  ui.btnNext.addEventListener('click', function () { startLevel(G.cfg.level + 1, true); });

  ui.btnMute.textContent = audio.muted ? 'SND OFF' : 'SND ON';
  ui.btnMute.addEventListener('click', function () {
    audio.muted = !audio.muted;
    localStorage.setItem('atc_muted', audio.muted ? '1' : '0');
    ui.btnMute.textContent = audio.muted ? 'SND OFF' : 'SND ON';
  });

  ui.hdgSet.addEventListener('click', applyHdgInput);
  ui.selBox.querySelectorAll('.turnBtn').forEach(function (b) {
    b.addEventListener('click', function () {
      var p = G.selected;
      if (!p) return;
      var step = parseInt(b.getAttribute('data-turn'), 10);
      cmdHeading(p, p.tgtHdg + step, step < 0 ? 'left' : 'right');
    });
  });
  ui.altDn.addEventListener('click', function () { if (G.selected) cmdAlt(G.selected, G.selected.tgtAlt - 1000); });
  ui.altUp.addEventListener('click', function () { if (G.selected) cmdAlt(G.selected, G.selected.tgtAlt + 1000); });
  ui.spdDn.addEventListener('click', function () { if (G.selected) cmdSpd(G.selected, G.selected.tgtSpd - 10); });
  ui.spdUp.addEventListener('click', function () { if (G.selected) cmdSpd(G.selected, G.selected.tgtSpd + 10); });
  ui.ils9.addEventListener('click', function () { if (G.selected) cmdApproach(G.selected, 9); });
  ui.ils27.addEventListener('click', function () { if (G.selected) cmdApproach(G.selected, 27); });
  ui.ilsX.addEventListener('click', function () { if (G.selected) cmdCancelApproach(G.selected); });

  resize();
  buildMenu();
  requestAnimationFrame(frame);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bind);
} else {
  bind();
}

// Debug/test hook (not part of the game UI)
window.__ATC = {
  get state() { return G; },
  startLevel: startLevel,
  cmdHeading: cmdHeading, cmdAlt: cmdAlt, cmdSpd: cmdSpd,
  cmdApproach: cmdApproach, select: select
};

})();
