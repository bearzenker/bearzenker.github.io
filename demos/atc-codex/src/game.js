(function () {
'use strict';
const CONFIG = {
  width: 800,
  height: 800,
  blockSize: 10,
  turnPauseMs: 5000,
  levelTurns: 80,
  maxAircraft: 6,
  spawnEveryTurns: 5,
  airport: { x: 400, y: 400 },
  windFrom: 90,
  runwayHeading: 270,
  runwayLengthBlocks: 3,
  approachLengthBlocks: 10,
  approachHalfWidthBlocks: 3,
};

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const toRad = (deg) => (deg * Math.PI) / 180;
const normHeading = (deg) => ((deg % 360) + 360) % 360;
const headingDiff = (a, b) => Math.abs(((normHeading(a) - normHeading(b) + 540) % 360) - 180);
const distanceBlocks = (a, b, cfg = CONFIG) => Math.hypot(a.x - b.x, a.y - b.y) / cfg.blockSize;

function headingTo(from, to) {
  return normHeading((Math.atan2(to.x - from.x, from.y - to.y) * 180) / Math.PI);
}

function stepPoint(point, heading, speedBlocks, cfg = CONFIG) {
  const pixels = speedBlocks * cfg.blockSize;
  return { x: point.x + Math.sin(toRad(heading)) * pixels, y: point.y - Math.cos(toRad(heading)) * pixels };
}

function createAircraft(index, turn, cfg = CONFIG) {
  const side = index % 4;
  const inset = 80 + ((index * 137) % 640);
  const positions = [
    { x: inset, y: 0 },
    { x: cfg.width, y: inset },
    { x: cfg.width - inset, y: cfg.height },
    { x: 0, y: cfg.height - inset },
  ];
  const letters = LETTERS[index % 26] + LETTERS[(index * 7 + 3) % 26];
  const pos = positions[side];
  return {
    id: `${letters}${100 + index * 37}`,
    type: 'airliner',
    speed: 1,
    heading: headingTo(pos, cfg.airport),
    altitude: 5 + ((index * 3 + turn) % 16),
    x: pos.x,
    y: pos.y,
    destination: { ...cfg.airport },
    status: 'in sector',
    approachTurns: null,
    selected: false,
    requestedHeading: false,
  };
}

function createGame(cfg = CONFIG) {
  const aircraft = [createAircraft(0, 0, cfg), createAircraft(1, 0, cfg)];
  return { cfg, turn: 0, score: 0, nearMisses: 0, lost: 0, spawned: 2, gameOver: false, levelComplete: false, messages: [], aircraft };
}

function addMessage(game, text) { game.messages.push({ turn: game.turn, text }); }

function applyCommand(game, raw) {
  const [flight, command] = raw.trim().toUpperCase().split(/\s+/, 2);
  const plane = game.aircraft.find((a) => a.id === flight && a.status === 'in sector');
  if (!plane || !command) return false;
  const action = command[0];
  const value = Number(command.slice(1));
  if (!Number.isFinite(value)) return false;
  if (['L', 'R', 'H'].includes(action)) plane.targetHeading = normHeading(value);
  if (action === 'C' || action === 'D') plane.targetAltitude = Math.max(0, value);
  addMessage(game, `${plane.id} roger ${command}`);
  return true;
}

function adjustPlane(plane) {
  if (plane.targetHeading !== undefined) {
    const diff = ((plane.targetHeading - plane.heading + 540) % 360) - 180;
    plane.heading = normHeading(plane.heading + Math.sign(diff) * Math.min(30, Math.abs(diff)));
    if (headingDiff(plane.heading, plane.targetHeading) < 1) delete plane.targetHeading;
  } else if (plane.destination?.x !== undefined) {
    plane.targetHeading = headingTo(plane, plane.destination);
  }
  if (plane.targetAltitude !== undefined) {
    const diff = plane.targetAltitude - plane.altitude;
    plane.altitude += Math.sign(diff) * Math.min(2, Math.abs(diff));
    if (Math.abs(plane.altitude - plane.targetAltitude) < 0.1) delete plane.targetAltitude;
  }
}

function inFinalApproach(plane, cfg = CONFIG) {
  if (plane.altitude > 5 || headingDiff(plane.heading, cfg.runwayHeading) > 30) return false;
  const runwayRad = toRad(cfg.runwayHeading);
  const dx = plane.x - cfg.airport.x;
  const dy = plane.y - cfg.airport.y;
  const along = dx * -Math.sin(runwayRad) + dy * Math.cos(runwayRad);
  const cross = Math.abs(dx * Math.cos(runwayRad) + dy * Math.sin(runwayRad));
  return along > 0 && along <= cfg.approachLengthBlocks * cfg.blockSize && cross <= cfg.approachHalfWidthBlocks * cfg.blockSize;
}

function advanceTurn(game) {
  if (game.gameOver) return game;
  game.turn += 1;
  if (game.spawned < game.cfg.maxAircraft && game.turn % game.cfg.spawnEveryTurns === 0) {
    const plane = createAircraft(game.spawned, game.turn, game.cfg);
    game.aircraft.push(plane); game.spawned += 1; addMessage(game, `${plane.id}: permission to land`);
  }
  const newFinals = [];
  for (const plane of game.aircraft) {
    if (plane.status === 'approach') {
      plane.approachTurns -= 1;
      if (plane.approachTurns <= 0) { plane.status = 'landed'; game.score += 10; addMessage(game, `${plane.id} landed`); }
      continue;
    }
    if (plane.status !== 'in sector') continue;
    adjustPlane(plane);
    Object.assign(plane, stepPoint(plane, plane.heading, plane.speed, game.cfg));
    if (inFinalApproach(plane, game.cfg)) newFinals.push(plane);
    if (plane.destination && distanceBlocks(plane, plane.destination, game.cfg) < 1 && !plane.requestedHeading) {
      plane.requestedHeading = true; addMessage(game, `${plane.id} request heading`);
    }
    if (plane.x < 0 || plane.y < 0 || plane.x > game.cfg.width || plane.y > game.cfg.height) {
      plane.status = 'lost'; game.lost += 1; game.score -= 5; addMessage(game, `${plane.id} lost`);
    }
  }
  if (newFinals.length > 1) { game.gameOver = true; addMessage(game, 'Collision on final approach. Game over.'); }
  for (const plane of newFinals) { plane.status = 'approach'; plane.approachTurns = 5; plane.destination = 'approach'; addMessage(game, `${plane.id} on final approach`); }
  const active = game.aircraft.filter((a) => a.status === 'in sector');
  for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) {
    if (active[i].altitude === active[j].altitude && distanceBlocks(active[i], active[j], game.cfg) <= 0.2) { game.gameOver = true; addMessage(game, `${active[i].id} collided with ${active[j].id}. Game over.`); }
    else if (active[i].altitude === active[j].altitude && distanceBlocks(active[i], active[j], game.cfg) < 2) { game.nearMisses += 1; game.score -= 2; addMessage(game, `Near miss: ${active[i].id} and ${active[j].id}`); }
  }
  if (game.turn >= game.cfg.levelTurns && !game.levelComplete) { game.levelComplete = true; addMessage(game, 'Level complete'); }
  return game;
}


const AtcGame = {
  CONFIG,
  toRad,
  normHeading,
  headingDiff,
  distanceBlocks,
  headingTo,
  stepPoint,
  createAircraft,
  createGame,
  addMessage,
  applyCommand,
  inFinalApproach,
  advanceTurn,
};

if (typeof window !== 'undefined') window.AtcGame = AtcGame;
if (typeof module !== 'undefined') module.exports = AtcGame;

})();
