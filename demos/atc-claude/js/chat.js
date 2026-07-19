// Chat log + audible chime + flash indicator.

const log = document.getElementById('chat-log');
const flash = document.getElementById('chat-flash');

// WebAudio chime — synthesized so no external asset is needed.
let audioCtx = null;
function chime() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.15, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.4);
    } catch (_) { /* audio not available: silent */ }
}

function flashOn() {
    flash.classList.add('active');
    setTimeout(() => flash.classList.remove('active'), 300);
}

/**
 * @param {string} text
 * @param {'plane'|'atc'|'system'|'warn'|'danger'} kind
 */
export function say(text, kind = 'plane') {
    const line = document.createElement('div');
    line.className = `msg from-${kind === 'plane' ? 'plane' : kind === 'atc' ? 'atc' : kind}`;
    line.textContent = text;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
    chime();
    flashOn();
}

export function systemMessage(text) {
    const line = document.createElement('div');
    line.className = 'msg system';
    line.textContent = text;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
}
