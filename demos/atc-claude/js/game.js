// Game controller: turn loop, spawning, scoring, collisions, landings.

import { CONFIG } from './config.js';
import { Aircraft } from './aircraft.js';
import { Airport } from './airport.js';
import { say, systemMessage } from './chat.js';
import { bearingTo, distance } from './geom.js';

export class Game {
    constructor() {
        this.airport = new Airport();
        this.reset();
    }

    reset() {
        this.aircraft = [];
        this.turn = 0;
        this.score = 0;
        this.spawned = 0;
        this.state = 'idle'; // 'idle' | 'running' | 'over' | 'complete'
        this._nearMissPairs = new Set();
        this._loopTimer = null;
    }

    start() {
        if (this.state === 'running') return;
        this.reset();
        this.state = 'running';
        systemMessage(`=== Level 1 begins. ${CONFIG.level.turns} turns. ===`);
        systemMessage(
            `Runway ${this.airport.landingRunwayNumber}. ` +
            `Land heading ${String(this.airport.landingHeading).padStart(3, '0')}. ` +
            `Wind blowing ${this.airport.windDirection}°.`
        );
        // Spawn initial aircraft.
        for (let i = 0; i < CONFIG.level.initialAircraft; i++) this._spawn();
        // First turn kicks off immediately, then the loop is paced.
        this._runTurn();
        this._scheduleNext();
    }

    stop() {
        clearTimeout(this._loopTimer);
        this._loopTimer = null;
    }

    _scheduleNext() {
        if (this.state !== 'running') return;
        this._loopTimer = setTimeout(() => {
            this._runTurn();
            this._scheduleNext();
        }, CONFIG.turnPauseMs);
    }

    _runTurn() {
        if (this.state !== 'running') return;
        this.turn += 1;

        // Spawn on cadence, subject to cap.
        if (this.spawned < CONFIG.level.maxAircraft &&
            this.turn > 1 &&
            (this.turn - 1) % CONFIG.level.spawnEveryTurns === 0) {
            this._spawn();
        }

        // Move each aircraft.
        for (const ac of this.aircraft) {
            ac.stepTurn();
            if (ac._justArrived) {
                say(`${ac.flightNumber} request heading.`, 'plane');
                ac._justArrived = false;
            }
        }

        // Landing check — planes entering the approach vector this turn.
        this._checkApproaches();

        // Collision + near miss.
        this._checkProximity();

        // Off-screen / lost aircraft.
        this._checkLost();

        // End-of-approach → landed.
        for (const ac of this.aircraft) {
            if (ac.status === 'approach' && ac.approachCountdown <= 0) {
                ac.status = 'landed';
                this.score += CONFIG.scoring.landing;
                say(`${ac.flightNumber} landed safely.`, 'plane');
            }
        }

        // Level completion.
        if (this.state === 'running') {
            const activeCount = this.aircraft.filter(a =>
                a.status !== 'landed' && a.status !== 'lost').length;
            if (this.turn >= CONFIG.level.turns &&
                this.spawned >= CONFIG.level.maxAircraft &&
                activeCount === 0) {
                this.state = 'complete';
                say(`=== Level complete. Final score: ${this.score} ===`, 'atc');
                this.stop();
            } else if (this.turn >= CONFIG.level.turns * 2) {
                // Hard cap so a hung game can't run forever.
                this.state = 'complete';
                say(`=== Time expired. Final score: ${this.score} ===`, 'atc');
                this.stop();
            }
        }

        this._notify();
    }

    _spawn() {
        const b = CONFIG.blocks;
        const margin = 0.5;
        // Pick a random edge point.
        const edge = Math.floor(Math.random() * 4);
        let x, y;
        if (edge === 0)      { x = margin;    y = Math.random() * b; }
        else if (edge === 1) { x = b - margin; y = Math.random() * b; }
        else if (edge === 2) { x = Math.random() * b; y = margin; }
        else                 { x = Math.random() * b; y = b - margin; }

        const altitude = CONFIG.aircraft.minSpawnAlt +
            Math.floor(Math.random() *
                (CONFIG.aircraft.maxSpawnAlt - CONFIG.aircraft.minSpawnAlt + 1));

        const heading = bearingTo(x, y, this.airport.cx, this.airport.cy);
        const ac = new Aircraft({ x, y, heading, altitude });
        this.aircraft.push(ac);
        this.spawned += 1;
        say(`${ac.flightNumber} at Angels ${altitude}, permission to land.`, 'plane');
    }

    _checkApproaches() {
        const entering = [];
        for (const ac of this.aircraft) {
            if (ac.status !== 'flying' && ac.status !== 'requesting') continue;
            if (this.airport.isInApproachVector(ac)) entering.push(ac);
        }
        if (entering.length > 1) {
            // Two on final in the same turn = collision (game over).
            this.state = 'over';
            const names = entering.map(a => a.flightNumber).join(' and ');
            say(`COLLISION on final: ${names}. Game over.`, 'danger');
            this.stop();
            return;
        }
        for (const ac of entering) {
            ac.enterApproach();
            say(`${ac.flightNumber} on final approach.`, 'plane');
        }
    }

    _checkProximity() {
        if (this.state !== 'running') return;
        const list = this.aircraft.filter(a =>
            a.status === 'flying' || a.status === 'requesting');
        const seenPairs = new Set();
        for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
                const a = list[i], b = list[j];
                const altDiff = Math.abs(a.altitude - b.altitude);
                if (altDiff >= CONFIG.proximity.altitudeSeparation) continue;
                const d = distance(a.x, a.y, b.x, b.y);
                const key = [a.flightNumber, b.flightNumber].sort().join('|');
                seenPairs.add(key);
                if (d < CONFIG.proximity.collisionBlocks) {
                    this.state = 'over';
                    say(`COLLISION: ${a.flightNumber} and ${b.flightNumber}. ` +
                        `Game over.`, 'danger');
                    this.stop();
                    return;
                }
                if (d < CONFIG.proximity.nearMissBlocks) {
                    if (!this._nearMissPairs.has(key)) {
                        this._nearMissPairs.add(key);
                        this.score += CONFIG.scoring.nearMiss;
                        say(`NEAR MISS: ${a.flightNumber} vs ${b.flightNumber}.`,
                            'warn');
                    }
                }
            }
        }
        // Clear the stale pairs so a later miss between the same planes
        // registers again.
        for (const key of Array.from(this._nearMissPairs)) {
            if (!seenPairs.has(key)) this._nearMissPairs.delete(key);
        }
    }

    _checkLost() {
        for (const ac of this.aircraft) {
            if (ac.status !== 'flying' && ac.status !== 'requesting') continue;
            if (!ac.onScreen) {
                ac.status = 'lost';
                this.score += CONFIG.scoring.lostAircraft;
                say(`${ac.flightNumber} lost off radar.`, 'warn');
            }
        }
    }

    // Handles a click on the radar. Selects the nearest aircraft within
    // range; if a plane is already selected, sets its destination.
    handleRadarClick(bx, by) {
        const selected = this.aircraft.find(a => a.selected);
        if (selected && selected.status !== 'approach' &&
            selected.status !== 'landed' && selected.status !== 'lost') {
            selected.setDestination(bx, by);
            if (selected.status === 'requesting') selected.status = 'flying';
            say(`${selected.flightNumber} to position ` +
                `${bx.toFixed(1)}, ${by.toFixed(1)}.`, 'plane');
            selected.selected = false;
            this._notify();
            return;
        }
        // Otherwise try to select.
        let best = null, bestDist = Infinity;
        for (const ac of this.aircraft) {
            if (ac.status === 'approach' || ac.status === 'landed' ||
                ac.status === 'lost') continue;
            const d = distance(ac.x, ac.y, bx, by);
            if (d < bestDist) { bestDist = d; best = ac; }
        }
        // Clear existing selection.
        for (const ac of this.aircraft) ac.selected = false;
        if (best && bestDist <= CONFIG.selectRadiusBlocks) {
            best.selected = true;
        }
        this._notify();
    }

    findAircraft(flightNumber) {
        return this.aircraft.find(a =>
            a.flightNumber.toUpperCase() === flightNumber.toUpperCase());
    }

    onChange(cb) { this._changeCb = cb; }
    _notify() { if (this._changeCb) this._changeCb(); }
}
