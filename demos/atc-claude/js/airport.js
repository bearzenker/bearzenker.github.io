// Airport / runway model + approach detection.

import { CONFIG } from './config.js';
import { normalizeHeading, headingDelta } from './geom.js';

export class Airport {
    constructor() {
        const a = CONFIG.airport;
        this.cx = a.centerBlockX;
        this.cy = a.centerBlockY;
        this.windDirection = a.windDirection;
        // Landing heading = fly into the wind = wind + 180.
        this.landingHeading = normalizeHeading(a.windDirection + 180);

        // Runway is aligned along the landing axis and its perpendicular.
        // For MVP we support runways aligned with any compass heading; we
        // build the geometry from landing heading + length.
        const halfLen = a.runwayLengthBlocks / 2;
        const rad = this.landingHeading * Math.PI / 180;
        const dx = Math.sin(rad);
        const dy = -Math.cos(rad);
        // Threshold = end of runway that arriving planes touch down on
        // (opposite direction of travel from the plane's viewpoint).
        this.thresholdX = this.cx - dx * halfLen;
        this.thresholdY = this.cy - dy * halfLen;
        this.departureX = this.cx + dx * halfLen;
        this.departureY = this.cy + dy * halfLen;

        // Approach fix = 10 blocks upwind of the threshold (planes fly toward
        // the threshold along the landing axis, so the fix is on the
        // opposite-of-travel side, i.e. behind the threshold in landing dir).
        // If landing heading is 270 (west), fix is east of threshold.
        this.approachFixX = this.thresholdX - dx * a.approachLengthBlocks;
        this.approachFixY = this.thresholdY - dy * a.approachLengthBlocks;

        // Runway numbers (heading / 10, rounded, zero-padded).
        this.landingRunwayNumber = this._runwayNumber(this.landingHeading);
        this.departureRunwayNumber = this._runwayNumber(this.landingHeading + 180);
    }

    _runwayNumber(heading) {
        const n = Math.round(normalizeHeading(heading) / 10);
        const wrapped = n === 0 ? 36 : n;
        return wrapped.toString().padStart(2, '0');
    }

    /**
     * Check whether an aircraft is inside the approach cone and eligible to
     * land. Returns true if the plane should enter approach status now.
     */
    isInApproachVector(ac) {
        if (ac.altitude > CONFIG.landing.maxAltitude) return false;

        const a = CONFIG.airport;
        // Vector from threshold TO the aircraft.
        const vx = ac.x - this.thresholdX;
        const vy = ac.y - this.thresholdY;

        // Axis unit vector points AWAY from threshold along approach
        // (opposite of landing heading, since planes come from that side).
        const rad = this.landingHeading * Math.PI / 180;
        const axisX = -Math.sin(rad);
        const axisY = Math.cos(rad);
        // Perp axis (rotate 90 CW).
        const perpX = axisY;
        const perpY = -axisX;

        const alongAxis = vx * axisX + vy * axisY;   // 0 at threshold, +length at fix
        const acrossAxis = vx * perpX + vy * perpY;  // ±width

        if (alongAxis < 0 || alongAxis > a.approachLengthBlocks) return false;

        // V-shape: width grows linearly from 0 at threshold to
        // approachHalfWidthBlocks at the fix.
        const allowedHalf =
            (alongAxis / a.approachLengthBlocks) * a.approachHalfWidthBlocks;
        if (Math.abs(acrossAxis) > allowedHalf) return false;

        // Heading within tolerance of runway heading.
        const hd = Math.abs(headingDelta(ac.heading, this.landingHeading));
        if (hd > CONFIG.landing.headingToleranceDeg) return false;

        return true;
    }
}
