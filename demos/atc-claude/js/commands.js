// Parses controller chat commands: "<flight> <cmd>[<cmd>...]"

const CMD_RE = /^([LRH])(\d{1,3})$|^([CD])(\d{1,3})$/i;

/**
 * @returns {{flight: string, ops: Array<{kind:string,value:number,dir?:string}>}
 *           | {error: string}}
 */
export function parseCommand(input) {
    const trimmed = input.trim();
    if (!trimmed) return { error: 'Empty command.' };
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) {
        return { error: 'Usage: <flight> <command> [command...]' };
    }
    const flight = parts[0].toUpperCase();
    const ops = [];
    for (const raw of parts.slice(1)) {
        const m = raw.match(CMD_RE);
        if (!m) return { error: `Unknown command: ${raw}` };
        if (m[1]) {
            // Heading command.
            const dir = m[1].toUpperCase();
            const value = parseInt(m[2], 10);
            if (value < 0 || value > 360) {
                return { error: `Heading out of range: ${raw}` };
            }
            ops.push({ kind: 'heading', dir, value: value % 360 });
        } else {
            const kind = m[3].toUpperCase() === 'C' ? 'climb' : 'descend';
            const value = parseInt(m[4], 10);
            ops.push({ kind, value });
        }
    }
    return { flight, ops };
}

export function applyCommand(aircraft, ops) {
    for (const op of ops) {
        if (op.kind === 'heading') {
            aircraft.setHeadingCommand(op.value, op.dir);
            // A heading order cancels any prior destination.
            aircraft.destination = null;
            if (aircraft.status === 'requesting') aircraft.status = 'flying';
        } else if (op.kind === 'climb' || op.kind === 'descend') {
            aircraft.setAltitudeCommand(op.value);
        }
    }
}
