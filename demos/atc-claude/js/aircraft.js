// Aircraft model + per-turn physics.

import { CONFIG } from './config.js';
import { headingToVector, headingDelta, normalizeHeading } from './geom.js';

const AIRLINE_CODES = ['AA', 'UA', 'DL', 'BA', 'LH', 'AF', 'JB', 'SW'];
let nextFlightSerial = 100;

function generateFlightNumber() {
    const code = AIRLINE_CODES[Math.floor(Math.random() * AIRLINE_CODES.length)];
    const num = nextFlightSerial++;
    return `${code}${num}`;
}

export class Aircraft {
    constructor({ x, y, heading, altitude, type = 'airliner' }) {
        this.flightNumber = generateFlightNumber();
        this.type = type;
        this.speed = CONFIG.aircraft.speed;
        this.heading = normalizeHeading(heading);
        this.targetHeading = this.heading;
        // 'H' = shortest, 'L' = counterclockwise, 'R' = clockwise.
        this.turnDirection = 'H';
        this.altitude = altitude;
        this.targetAltitude = altitude;
        this.x = x;
        this.y = y;
        // 'pos' -> {x,y}, 'landed', 'lost', or null (freeflight after ack).
        this.destination = null;
        // 'flying' | 'approach' | 'landed' | 'lost' | 'requesting'
        this.status = 'flying';
        // For approach status, counts down each turn.
        this.approachCountdown = 0;
        this.selected = false;
    }

    /** True while the aircraft occupies the radar. */
    get onScreen() {
        return this.x >= 0 && this.x <= CONFIG.blocks &&
               this.y >= 0 && this.y <= CONFIG.blocks;
    }

    setHeadingCommand(heading, direction) {
        this.targetHeading = normalizeHeading(heading);
        this.turnDirection = direction; // 'L', 'R', 'H'
    }

    setAltitudeCommand(altitude) {
        this.targetAltitude = altitude;
    }

    setDestination(x, y) {
        this.destination = { x, y };
        // Cancel any explicit heading command; movement will point at dest.
        this.turnDirection = 'H';
    }

    /** Runs once per game turn. Returns nothing; game applies side effects. */
    stepTurn() {
        if (this.status === 'approach') {
            this.approachCountdown -= 1;
            return;
        }
        if (this.status === 'landed' || this.status === 'lost') return;

        // If we have a destination, aim toward it and see whether we arrived.
        if (this.destination) {
            const dx = this.destination.x - this.x;
            const dy = this.destination.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= this.speed) {
                // Arrive: snap, then request further orders.
                this.x = this.destination.x;
                this.y = this.destination.y;
                this.destination = null;
                if (this.status !== 'requesting') {
                    this.status = 'requesting';
                    // Flag so the game loop can announce.
                    this._justArrived = true;
                }
            } else {
                // Steer toward destination each turn (shortest turn).
                const desired = Math.atan2(dx, -dy) * 180 / Math.PI;
                this.targetHeading = normalizeHeading(desired);
                this.turnDirection = 'H';
            }
        }

        // Turn toward targetHeading at turnRate.
        this._applyTurn();

        // Adjust altitude toward targetAltitude at climbRate.
        this._applyAltitude();

        // Advance position.
        const { dx, dy } = headingToVector(this.heading);
        this.x += dx * this.speed;
        this.y += dy * this.speed;
    }

    _applyTurn() {
        const shortest = headingDelta(this.heading, this.targetHeading);
        if (shortest === 0) return;
        const rate = CONFIG.aircraft.turnRate;

        let signed;
        if (this.turnDirection === 'L') {
            // Counterclockwise: heading decreases.
            signed = shortest > 0 ? shortest - 360 : shortest;
        } else if (this.turnDirection === 'R') {
            // Clockwise: heading increases.
            signed = shortest < 0 ? shortest + 360 : shortest;
        } else {
            signed = shortest;
        }

        const step = Math.max(-rate, Math.min(rate, signed));
        this.heading = normalizeHeading(this.heading + step);

        // Once we've reached the target, drop back to shortest-turn mode so
        // future corrections don't spin the plane the long way.
        if (Math.abs(headingDelta(this.heading, this.targetHeading)) < 0.5) {
            this.heading = this.targetHeading;
            this.turnDirection = 'H';
        }
    }

    _applyAltitude() {
        if (this.altitude === this.targetAltitude) return;
        const rate = CONFIG.aircraft.climbRate;
        const diff = this.targetAltitude - this.altitude;
        const step = Math.max(-rate, Math.min(rate, diff));
        this.altitude += step;
    }

    enterApproach() {
        this.status = 'approach';
        this.approachCountdown = CONFIG.landing.approachCountdown;
        this.destination = 'approach';
    }
}
