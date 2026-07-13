/**
 * AudioController uses the Web Audio API to synthesize retro game sound effects.
 * It is completely self-contained and does not require external audio files.
 */
class AudioController {
    constructor() {
        this.ctx = null;
        this.muted = false;
    }

    init() {
        if (this.ctx) return;
        try {
            // Create audio context (must be initialized after user interaction)
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                this.ctx = new AudioContextClass();
            }
        } catch (e) {
            console.warn("Web Audio API not supported or restricted:", e);
            this.ctx = null;
        }
    }

    resume() {
        try {
            this.init();
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        } catch (e) {
            console.warn("Failed to resume AudioContext:", e);
        }
    }

    setMuted(muted) {
        this.muted = muted;
    }

    playChime() {
        try {
            if (this.muted) return;
            this.resume();
            if (!this.ctx) return;

            const now = this.ctx.currentTime;
            
            // Note 1: C5 (523.25 Hz)
            const osc1 = this.ctx.createOscillator();
            const gain1 = this.ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(523.25, now);
            gain1.gain.setValueAtTime(0, now);
            gain1.gain.linearRampToValueAtTime(0.15, now + 0.05);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

            osc1.connect(gain1);
            gain1.connect(this.ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.35);

            // Note 2: E5 (659.25 Hz) after 100ms
            const osc2 = this.ctx.createOscillator();
            const gain2 = this.ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(659.25, now + 0.1);
            gain2.gain.setValueAtTime(0, now + 0.1);
            gain2.gain.linearRampToValueAtTime(0.15, now + 0.15);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

            osc2.connect(gain2);
            gain2.connect(this.ctx.destination);
            osc2.start(now + 0.1);
            osc2.stop(now + 0.45);
        } catch (e) {
            console.warn("Failed to play chime:", e);
        }
    }

    playBlip() {
        try {
            if (this.muted) return;
            this.resume();
            if (!this.ctx) return;

            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now); // A5 (high blip)
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.08, now + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.1);
        } catch (e) {
            console.warn("Failed to play blip:", e);
        }
    }

    playWarning() {
        try {
            if (this.muted) return;
            this.resume();
            if (!this.ctx) return;

            const now = this.ctx.currentTime;
            
            // Double low buzz
            for (let i = 0; i < 2; i++) {
                const time = now + i * 0.25;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(180, time);
                
                // Add a lowpass filter to make it buzzier but less harsh
                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(600, time);

                gain.gain.setValueAtTime(0, time);
                gain.gain.linearRampToValueAtTime(0.1, time + 0.02);
                gain.gain.linearRampToValueAtTime(0.1, time + 0.15);
                gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(time);
                osc.stop(time + 0.2);
            }
        } catch (e) {
            console.warn("Failed to play warning:", e);
        }
    }

    playCrash() {
        try {
            if (this.muted) return;
            this.resume();
            if (!this.ctx) return;

            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(300, now);
            // Exponentially slide frequency down to represent crash
            osc.frequency.exponentialRampToValueAtTime(40, now + 1.2);

            // Lowpass filter cutoff sweep
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, now);
            filter.frequency.exponentialRampToValueAtTime(80, now + 1.2);

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
            gain.gain.linearRampToValueAtTime(0.2, now + 0.5);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 1.5);
        } catch (e) {
            console.warn("Failed to play crash:", e);
        }
    }

    playSuccess() {
        try {
            if (this.muted) return;
            this.resume();
            if (!this.ctx) return;

            const now = this.ctx.currentTime;
            const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5 arpeggio
            
            notes.forEach((freq, idx) => {
                const time = now + idx * 0.1;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, time);
                gain.gain.setValueAtTime(0, time);
                gain.gain.linearRampToValueAtTime(0.12, time + 0.03);
                gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(time);
                osc.stop(time + 0.25);
            });
        } catch (e) {
            console.warn("Failed to play success sound:", e);
        }
    }
}

// Export for use in game.js
window.AudioController = AudioController;
