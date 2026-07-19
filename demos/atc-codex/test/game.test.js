const test = require('node:test');
const assert = require('node:assert/strict');
const { CONFIG, advanceTurn, applyCommand, createGame, headingDiff, inFinalApproach } = require('../src/game.js');

test('spawns level one aircraft on the five-turn cadence until six total', () => {
  const game = createGame(CONFIG);
  for (let i = 0; i < 20; i++) advanceTurn(game);
  assert.equal(game.spawned, 6);
  assert.equal(game.aircraft.length, 6);
});

test('chat heading command turns an aircraft toward the requested heading', () => {
  const game = createGame(CONFIG);
  const plane = game.aircraft[0];
  applyCommand(game, `${plane.id} H270`);
  const before = headingDiff(plane.heading, 270);
  advanceTurn(game);
  assert.ok(headingDiff(plane.heading, 270) < before);
});

test('final approach requires runway heading and altitude at or below angels five', () => {
  const plane = { x: CONFIG.airport.x + 70, y: CONFIG.airport.y, altitude: 5, heading: 270 };
  assert.equal(inFinalApproach(plane, CONFIG), true);
  assert.equal(inFinalApproach({ ...plane, altitude: 6 }, CONFIG), false);
  assert.equal(inFinalApproach({ ...plane, heading: 180 }, CONFIG), false);
});


test('adds level complete only once after the final turn', () => {
  const game = createGame({ ...CONFIG, levelTurns: 2, maxAircraft: 2 });
  advanceTurn(game);
  advanceTurn(game);
  advanceTurn(game);
  const completions = game.messages.filter((message) => message.text === 'Level complete');
  assert.equal(game.levelComplete, true);
  assert.equal(completions.length, 1);
});
