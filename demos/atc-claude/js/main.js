// Application entry point: wires DOM, game, renderer, and commands.

import { CONFIG } from './config.js';
import { Game } from './game.js';
import { Radar } from './render.js';
import { renderFlightList } from './flightlist.js';
import { parseCommand, applyCommand } from './commands.js';
import { say, systemMessage } from './chat.js';

const canvas = document.getElementById('radar');
const startBtn = document.getElementById('start-btn');
const cmdForm = document.getElementById('command-form');
const cmdInput = document.getElementById('command-input');
const hud = {
    level: document.getElementById('level'),
    turn: document.getElementById('turn'),
    score: document.getElementById('score'),
    count: document.getElementById('aircraft-count'),
    status: document.getElementById('status'),
};

const game = new Game();
const radar = new Radar(canvas, game);

function refreshHud() {
    hud.turn.textContent = `Turn: ${game.turn} / ${CONFIG.level.turns}`;
    hud.score.textContent = `Score: ${game.score}`;
    const active = game.aircraft.filter(a =>
        a.status !== 'landed' && a.status !== 'lost').length;
    hud.count.textContent =
        `Aircraft: ${active} on radar / ${game.spawned} of ${CONFIG.level.maxAircraft} spawned`;
    hud.status.textContent = game.state;
}

function draw() {
    radar.draw();
    renderFlightList(game.aircraft);
    refreshHud();
}

game.onChange(draw);

// Redraw ~30fps even between turns so selection/UI stays responsive.
setInterval(draw, 33);

startBtn.addEventListener('click', () => {
    game.start();
});

canvas.addEventListener('click', (e) => {
    if (game.state !== 'running') return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const bx = px / CONFIG.blockPixels;
    const by = py / CONFIG.blockPixels;
    game.handleRadarClick(bx, by);
});

cmdForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const raw = cmdInput.value;
    if (!raw.trim()) return;
    systemMessage(`> ${raw}`);
    cmdInput.value = '';
    const parsed = parseCommand(raw);
    if (parsed.error) {
        systemMessage(`! ${parsed.error}`);
        return;
    }
    const ac = game.findAircraft(parsed.flight);
    if (!ac) {
        systemMessage(`! Unknown flight ${parsed.flight}.`);
        return;
    }
    if (ac.status === 'landed' || ac.status === 'lost' ||
        ac.status === 'approach') {
        systemMessage(`! ${ac.flightNumber} cannot accept orders (${ac.status}).`);
        return;
    }
    applyCommand(ac, parsed.ops);
    // Aircraft acknowledgement in chat.
    const ackParts = parsed.ops.map(op => {
        if (op.kind === 'heading') {
            return `heading ${String(op.value).padStart(3, '0')}` +
                (op.dir === 'L' ? ' via left'
                 : op.dir === 'R' ? ' via right' : '');
        }
        return `${op.kind} to Angels ${op.value}`;
    });
    say(`${ac.flightNumber} roger, ${ackParts.join(', ')}.`, 'plane');
});

// Initial paint.
draw();
