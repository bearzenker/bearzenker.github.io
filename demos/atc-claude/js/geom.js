// Small geometry helpers shared across modules.

export const DEG = Math.PI / 180;

export function normalizeHeading(h) {
    let r = h % 360;
    if (r < 0) r += 360;
    return r;
}

// Signed angular difference (target - current) normalized to (-180, 180].
export function headingDelta(current, target) {
    let d = normalizeHeading(target - current);
    if (d > 180) d -= 360;
    return d;
}

// Convert compass heading (0=N, 90=E) to unit vector in screen coords
// (y increases downward).
export function headingToVector(heading) {
    const r = heading * DEG;
    return { dx: Math.sin(r), dy: -Math.cos(r) };
}

// Compass bearing FROM (fx,fy) TO (tx,ty) in screen coords.
export function bearingTo(fx, fy, tx, ty) {
    const dx = tx - fx;
    const dy = ty - fy;
    // atan2(dx, -dy) because compass 0 = north (screen -y).
    let deg = Math.atan2(dx, -dy) / DEG;
    return normalizeHeading(deg);
}

export function distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}
