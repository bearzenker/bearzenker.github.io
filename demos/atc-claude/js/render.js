// Radar rendering. Nothing here mutates game state — it just draws.

import { CONFIG } from './config.js';
import { headingToVector } from './geom.js';

export class Radar {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.game = game;
    }

    b2p(v) { return v * CONFIG.blockPixels; }

    draw() {
        const ctx = this.ctx;
        const size = CONFIG.radarPixels;

        // Background.
        ctx.fillStyle = '#030a06';
        ctx.fillRect(0, 0, size, size);

        this._drawGrid();
        this._drawAirport();
        this._drawAircraft();
    }

    _drawGrid() {
        const ctx = this.ctx;
        const step = CONFIG.blockPixels;
        const size = CONFIG.radarPixels;
        ctx.strokeStyle = 'rgba(60, 100, 70, 0.20)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= size; x += step) {
            ctx.moveTo(x + 0.5, 0);
            ctx.lineTo(x + 0.5, size);
        }
        for (let y = 0; y <= size; y += step) {
            ctx.moveTo(0, y + 0.5);
            ctx.lineTo(size, y + 0.5);
        }
        ctx.stroke();

        // Every 10th line brighter.
        ctx.strokeStyle = 'rgba(60, 140, 90, 0.35)';
        ctx.beginPath();
        for (let x = 0; x <= size; x += step * 10) {
            ctx.moveTo(x + 0.5, 0);
            ctx.lineTo(x + 0.5, size);
        }
        for (let y = 0; y <= size; y += step * 10) {
            ctx.moveTo(0, y + 0.5);
            ctx.lineTo(size, y + 0.5);
        }
        ctx.stroke();
    }

    _drawAirport() {
        const ctx = this.ctx;
        const ap = this.game.airport;

        // Runway (solid line).
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(this.b2p(ap.thresholdX), this.b2p(ap.thresholdY));
        ctx.lineTo(this.b2p(ap.departureX), this.b2p(ap.departureY));
        ctx.stroke();

        // Runway numbers.
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        this._labelRunwayEnd(ap.thresholdX, ap.thresholdY,
            ap.cx, ap.cy, ap.landingRunwayNumber);
        this._labelRunwayEnd(ap.departureX, ap.departureY,
            ap.cx, ap.cy, ap.departureRunwayNumber);

        // Approach V (dotted).
        const rad = ap.landingHeading * Math.PI / 180;
        const axisX = -Math.sin(rad);
        const axisY = Math.cos(rad);
        const perpX = axisY;
        const perpY = -axisX;
        const len = CONFIG.airport.approachLengthBlocks;
        const halfW = CONFIG.airport.approachHalfWidthBlocks;
        const tipX = ap.thresholdX;
        const tipY = ap.thresholdY;
        const leftX = tipX + axisX * len + perpX * halfW;
        const leftY = tipY + axisY * len + perpY * halfW;
        const rightX = tipX + axisX * len - perpX * halfW;
        const rightY = tipY + axisY * len - perpY * halfW;

        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#4dd0e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.b2p(tipX), this.b2p(tipY));
        ctx.lineTo(this.b2p(leftX), this.b2p(leftY));
        ctx.moveTo(this.b2p(tipX), this.b2p(tipY));
        ctx.lineTo(this.b2p(rightX), this.b2p(rightY));
        ctx.stroke();
        ctx.setLineDash([]);

        // Wind indicator (small arrow near a corner).
        this._drawWindArrow();
    }

    _labelRunwayEnd(ex, ey, cx, cy, label) {
        // Offset the label further beyond the runway end.
        const dx = ex - cx;
        const dy = ey - cy;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const ox = ex + (dx / len) * 0.9;
        const oy = ey + (dy / len) * 0.9;
        this.ctx.fillText(label, this.b2p(ox), this.b2p(oy));
    }

    _drawWindArrow() {
        const ctx = this.ctx;
        const ap = this.game.airport;
        const px = 640, py = 40;
        const { dx, dy } = headingToVector(ap.windDirection);
        const len = 24;
        ctx.strokeStyle = '#ffb74d';
        ctx.fillStyle = '#ffb74d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px - dx * len / 2, py - dy * len / 2);
        ctx.lineTo(px + dx * len / 2, py + dy * len / 2);
        ctx.stroke();
        // Arrowhead.
        const headAngle = Math.atan2(dy, dx);
        const hx = px + dx * len / 2;
        const hy = py + dy * len / 2;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx - Math.cos(headAngle - 0.4) * 8,
                   hy - Math.sin(headAngle - 0.4) * 8);
        ctx.lineTo(hx - Math.cos(headAngle + 0.4) * 8,
                   hy - Math.sin(headAngle + 0.4) * 8);
        ctx.closePath();
        ctx.fill();
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('WIND', px, py - 20);
    }

    _drawAircraft() {
        const ctx = this.ctx;
        for (const ac of this.game.aircraft) {
            if (ac.status === 'approach' || ac.status === 'landed' ||
                ac.status === 'lost') continue;
            if (!ac.onScreen) continue;

            const px = this.b2p(ac.x);
            const py = this.b2p(ac.y);

            // Selection highlight.
            if (ac.selected) {
                ctx.strokeStyle = '#ffb74d';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(px, py, 16, 0, Math.PI * 2);
                ctx.stroke();
            }

            // Dot.
            ctx.fillStyle = '#6fe0a6';
            ctx.beginPath();
            ctx.arc(px, py, 3, 0, Math.PI * 2);
            ctx.fill();

            // Tail line pointing along heading; label at the far end.
            const { dx, dy } = headingToVector(ac.heading);
            const tailLen = 22;
            const tx = px + dx * tailLen;
            const ty = py + dy * tailLen;
            ctx.strokeStyle = '#6fe0a6';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(tx, ty);
            ctx.stroke();

            ctx.fillStyle = '#d0f0dc';
            ctx.font = '10px monospace';
            ctx.textAlign = dx < 0 ? 'right' : dx > 0 ? 'left' : 'center';
            ctx.textBaseline = dy < 0 ? 'bottom' : dy > 0 ? 'top' : 'middle';
            const nudge = 4;
            const lx = tx + Math.sign(dx) * nudge;
            const ly = ty + Math.sign(dy) * nudge;
            ctx.fillText(ac.flightNumber, lx, ly);
            const altText = Math.round(ac.altitude).toString();
            ctx.fillText(altText, lx, ly + (dy < 0 ? -11 : 11));
        }
    }
}
