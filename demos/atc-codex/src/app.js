(function () {
'use strict';
const { CONFIG, advanceTurn, applyCommand, createGame, distanceBlocks, stepPoint } = window.AtcGame;

const canvas = document.querySelector('#radar');
const ctx = canvas.getContext('2d');
const flightList = document.querySelector('#flightList');
const chatLog = document.querySelector('#chatLog');
const commandForm = document.querySelector('#commandForm');
const commandInput = document.querySelector('#commandInput');
const flash = document.querySelector('#flash');
const gameState = document.querySelector('#gameState');
const turnCount = document.querySelector('#turnCount');
const score = document.querySelector('#score');

const game = createGame(CONFIG);
let selected = null;
let renderedMessages = 0;
game.aircraft.forEach((plane) => game.messages.push({ turn: 0, text: `${plane.id}: permission to land` }));

function drawGrid() {
  ctx.fillStyle = '#06140f';
  ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
  ctx.strokeStyle = 'rgba(81, 255, 159, 0.12)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= CONFIG.width; i += CONFIG.blockSize) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CONFIG.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(CONFIG.width, i); ctx.stroke();
  }
}

function drawAirport() {
  const { x, y } = CONFIG.airport;
  const len = CONFIG.runwayLengthBlocks * CONFIG.blockSize;
  ctx.strokeStyle = '#d8ffe6'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(x - len / 2, y); ctx.lineTo(x + len / 2, y); ctx.stroke();
  ctx.fillStyle = '#d8ffe6'; ctx.font = '13px monospace';
  ctx.fillText('27', x - len / 2 - 22, y - 8); ctx.fillText('09', x + len / 2 + 6, y - 8);

  ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.setLineDash([4, 6]); ctx.lineWidth = 2;
  const approach = CONFIG.approachLengthBlocks * CONFIG.blockSize;
  ctx.beginPath(); ctx.moveTo(x + len / 2, y); ctx.lineTo(x + approach, y - CONFIG.approachHalfWidthBlocks * CONFIG.blockSize); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + len / 2, y); ctx.lineTo(x + approach, y + CONFIG.approachHalfWidthBlocks * CONFIG.blockSize); ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = '#62d6ff'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x - 45, y - 45); ctx.lineTo(x - 15, y - 45); ctx.stroke();
  ctx.fillText('WIND →', x - 95, y - 39);
}

function drawPlane(plane) {
  if (plane.status !== 'in sector') return;
  const isSelected = selected?.id === plane.id;
  ctx.strokeStyle = isSelected ? '#ffe66b' : '#57ff9a'; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = isSelected ? 3 : 2;
  ctx.beginPath(); ctx.arc(plane.x, plane.y, isSelected ? 6 : 4, 0, Math.PI * 2); ctx.fill();
  const tail = stepPoint(plane, plane.heading + 180, 3, CONFIG);
  ctx.beginPath(); ctx.moveTo(plane.x, plane.y); ctx.lineTo(tail.x, tail.y); ctx.stroke();
  ctx.font = '14px monospace'; ctx.fillText(plane.id, tail.x + 5, tail.y); ctx.fillText(`A${Math.round(plane.altitude)}`, tail.x + 5, tail.y + 15);
}

function render() {
  drawGrid(); drawAirport(); game.aircraft.forEach(drawPlane);
  flightList.innerHTML = '';
  game.aircraft.filter((a) => ['in sector', 'approach'].includes(a.status)).forEach((plane) => {
    const li = document.createElement('li');
    li.className = selected?.id === plane.id ? 'selected' : '';
    li.textContent = `${plane.id} ${plane.status} H${Math.round(plane.heading)} A${Math.round(plane.altitude)}`;
    flightList.append(li);
  });
  turnCount.textContent = game.turn; score.textContent = game.score;
  while (renderedMessages < game.messages.length) {
    const msg = document.createElement('p'); msg.textContent = game.messages[renderedMessages++].text; chatLog.append(msg); chatLog.scrollTop = chatLog.scrollHeight;
    flash.classList.remove('pulse'); void flash.offsetWidth; flash.classList.add('pulse'); playChime();
  }
  gameState.classList.toggle('hidden', !game.gameOver && !game.levelComplete);
  gameState.textContent = game.gameOver ? 'GAME OVER' : 'LEVEL COMPLETE';
}

function playChime() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const audio = new AudioContext(); const osc = audio.createOscillator(); const gain = audio.createGain();
  gain.gain.value = 0.03; osc.frequency.value = 880; osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(audio.currentTime + 0.08);
}

canvas.addEventListener('click', (event) => {
  const rect = canvas.getBoundingClientRect();
  const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  const hit = game.aircraft.find((plane) => plane.status === 'in sector' && distanceBlocks(plane, point, CONFIG) <= 2);
  if (hit) { selected = hit; }
  else if (selected) { selected.destination = point; selected.requestedHeading = false; game.messages.push({ turn: game.turn, text: `${selected.id} to position ${Math.round(point.x / CONFIG.blockSize)},${Math.round(point.y / CONFIG.blockSize)}` }); }
  render();
});

commandForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!applyCommand(game, commandInput.value)) game.messages.push({ turn: game.turn, text: `Unable: ${commandInput.value}` });
  commandInput.value = ''; render();
});

setInterval(() => { advanceTurn(game); render(); }, CONFIG.turnPauseMs);
render();

})();
