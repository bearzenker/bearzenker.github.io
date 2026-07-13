// Global error handler to catch and display any runtime exceptions in the game console
window.onerror = function(message, source, lineno, colno, error) {
    if (typeof logRadio === 'function') {
        logRadio('SYSTEM ERROR', `${message} (Line ${lineno}:${colno})`, 'critical');
    } else {
        console.error("Critical error before DOM ready:", message, error);
    }
    return false;
};

// Initialize Audio Controller
const audio = new AudioController();

// Global Game State
const state = {
    level: 1,
    score: 0,
    turns: 0,
    maxTurns: 60,
    turnPause: 5, // default 5 seconds per turn
    timer: 5.0,
    aircraft: [], // list of active aircraft
    approachPlanes: [], // list of planes currently on final approach
    totalSpawned: 0,
    maxAircraft: 6,
    planesLanded: 0,
    planesLost: 0,
    nearMisses: 0,
    windDirection: 90, // default blowing East (wind heading 90)
    selectedId: null,
    isPaused: false,
    speedMultiplier: 1,
    gameState: 'intro', // 'intro', 'playing', 'gameover', 'victory'
    recentChime: false,
    nearMissPairs: new Set() // Track active near misses to avoid double deductions
};

// Canvas Setup
const canvas = document.getElementById('radarCanvas');
const ctx = canvas.getContext('2d');
const BLOCK_SIZE = 10; // 1 block = 10 pixels
const GRID_SIZE = 80;  // 80x80 blocks

// Wind directions for levels
const WIND_LABELS = {
    90: 'EAST (90°)',
    270: 'WEST (270°)'
};

// Available airlines for flight numbers
const AIRLINES = ['AA', 'UA', 'DL', 'CO', 'NW', 'US', 'LH', 'BA', 'AF'];

// HTML DOM references
const dom = {
    score: document.getElementById('scoreVal'),
    level: document.getElementById('levelVal'),
    turns: document.getElementById('turnsVal'),
    timer: document.getElementById('timerVal'),
    activePlanes: document.getElementById('activePlanesVal'),
    wind: document.getElementById('windVal'),
    mute: document.getElementById('muteToggle'),
    pauseBtn: document.getElementById('pauseBtn'),
    speed1x: document.getElementById('speed1xBtn'),
    speed2x: document.getElementById('speed2xBtn'),
    flightStrips: document.getElementById('flightStripsList'),
    flightCount: document.getElementById('flightCount'),
    gameOver: document.getElementById('gameOverScreen'),
    gameOverMsg: document.getElementById('gameOverMsg'),
    finalScore: document.getElementById('finalScoreVal'),
    restartBtn: document.getElementById('restartBtn'),
    victory: document.getElementById('victoryScreen'),
    victoryScore: document.getElementById('victoryScoreVal'),
    nextLevelBtn: document.getElementById('nextLevelBtn'),
    startScreen: document.getElementById('startScreen'),
    startBtn: document.getElementById('startBtn'),
    consoleLog: document.getElementById('consoleLog'),
    consoleContainer: document.getElementById('consoleLogContainer'),
    cmdInput: document.getElementById('cmdInput'),
    consoleForm: document.getElementById('consoleForm'),
    chimeFlash: document.getElementById('chimeFlash')
};

// Helper: Generate Random Number in Range
function randRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper: Generate a unique flight number
function generateFlightNumber() {
    const code = AIRLINES[randRange(0, AIRLINES.length - 1)];
    const num = randRange(10, 9999);
    const flightId = `${code}${num}`;
    // Ensure uniqueness
    const exists = state.aircraft.some(p => p.id === flightId) || state.approachPlanes.some(p => p.id === flightId);
    if (exists) return generateFlightNumber();
    return flightId;
}

// Log message in the terminal console
function logRadio(sender, text, type = 'pilot') {
    const timeStr = `[T+${state.turns}]`;
    const msgDiv = document.createElement('div');
    msgDiv.className = `console-msg sender-${type}`;
    
    msgDiv.innerHTML = `
        <span class="time">${timeStr}</span>
        <span class="sender">${sender}:</span>
        <span class="msg-text">${text}</span>
    `;
    
    dom.consoleLog.appendChild(msgDiv);
    dom.consoleContainer.scrollTop = dom.consoleContainer.scrollHeight;
}

// Trigger screen flash & audio chime
function triggerNotification() {
    audio.playChime();
    dom.chimeFlash.classList.add('flash');
    setTimeout(() => {
        dom.chimeFlash.classList.remove('flash');
    }, 500);
}

// Aircraft Class
class Aircraft {
    constructor(id, type, x, y, altitude, heading) {
        this.id = id;
        this.type = type; // 'airliner' or 'fighter'
        this.speed = type === 'fighter' ? 2 : 1; // blocks per turn
        this.x = x; // block coordinates
        this.y = y;
        this.altitude = altitude; // Angels (thousands of feet)
        this.heading = heading; // current heading in degrees (0-360)
        
        this.targetAltitude = altitude;
        this.targetHeading = heading;
        this.turnDirection = 'H'; // 'L', 'R', or 'H'
        this.destination = null; // {x, y} block coordinates if set
        
        this.trail = []; // track past positions for radar sweep visualization
    }

    updatePhysics() {
        // Store trail
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 5) this.trail.shift();

        // 1. Update Heading (Steering)
        if (this.destination) {
            // Calculate bearing to destination
            const dx = this.destination.x - this.x;
            const dy = this.destination.y - this.y;
            // Angle in degrees where 0 is North (up), 90 East, etc.
            let bearing = Math.atan2(dx, -dy) * (180 / Math.PI);
            if (bearing < 0) bearing += 360;
            
            // Round bearing to nearest 10 degrees to match standard compass
            this.targetHeading = Math.round(bearing / 10) * 10 % 360;
            this.turnDirection = 'H';
        }

        if (this.heading !== this.targetHeading) {
            let dir = this.turnDirection;
            
            // Determine shortest turn direction if H
            if (dir === 'H') {
                const diffCW = (this.targetHeading - this.heading + 360) % 360;
                const diffCCW = (this.heading - this.targetHeading + 360) % 360;
                dir = diffCW <= diffCCW ? 'R' : 'L';
            }

            if (dir === 'R') {
                const diff = (this.targetHeading - this.heading + 360) % 360;
                if (diff <= 30) {
                    this.heading = this.targetHeading;
                } else {
                    this.heading = (this.heading + 30) % 360;
                }
            } else { // 'L'
                const diff = (this.heading - this.targetHeading + 360) % 360;
                if (diff <= 30) {
                    this.heading = this.targetHeading;
                } else {
                    this.heading = (this.heading - 30 + 360) % 360;
                }
            }
        }

        // 2. Update Altitude
        if (this.altitude !== this.targetAltitude) {
            if (this.targetAltitude > this.altitude) {
                this.altitude = Math.min(this.targetAltitude, this.altitude + 2);
            } else {
                this.altitude = Math.max(this.targetAltitude, this.altitude - 2);
            }
        }

        // 3. Move Plane
        const rad = this.heading * (Math.PI / 180);
        this.x += Math.sin(rad) * this.speed;
        this.y -= Math.cos(rad) * this.speed;
    }
}

// Spawns a new plane at the screen boundary
function spawnAircraft() {
    try {
        if (state.totalSpawned >= state.maxAircraft) return;

        const id = generateFlightNumber();
        const type = Math.random() < 0.25 ? 'fighter' : 'airliner';
        
        // Choose random edge: 0=Top, 1=Right, 2=Bottom, 3=Left
        const edge = randRange(0, 3);
        let x, y;
        
        if (edge === 0) { // Top
            x = randRange(10, 70);
            y = 0;
        } else if (edge === 1) { // Right
            x = 80;
            y = randRange(10, 70);
        } else if (edge === 2) { // Bottom
            x = randRange(10, 70);
            y = 80;
        } else { // Left
            x = 0;
            y = randRange(10, 70);
        }

        const altitude = randRange(5, 20); // 5,000 to 20,000 ft
        
        // Direct heading towards the airport (40, 40)
        const dx = 40 - x;
        const dy = 40 - y;
        let heading = Math.atan2(dx, -dy) * (180 / Math.PI);
        if (heading < 0) heading += 360;
        heading = Math.round(heading / 10) * 10 % 360; // round to nearest 10 degrees

        const plane = new Aircraft(id, type, x, y, altitude, heading);
        state.aircraft.push(plane);
        state.totalSpawned++;

        logRadio(id, `Entering sector at altitude ${altitude} Angels, heading ${heading}°. Request permission to land.`, 'pilot');
        triggerNotification();
        updateFlightStrips();
    } catch (err) {
        logRadio('SYSTEM ERROR', `spawnAircraft failed: ${err.message}`, 'critical');
        console.error(err);
    }
}

// Render the Flight List Strips (Left Panel)
function updateFlightStrips() {
    dom.flightStrips.innerHTML = '';
    
    // Combine active and approach lists to show all sector planes
    const allPlanes = [...state.aircraft, ...state.approachPlanes];
    
    allPlanes.forEach(p => {
        const div = document.createElement('div');
        const isSelected = p.id === state.selectedId;
        const isApproach = p.destination === 'approach';
        
        div.className = `flight-strip ${isSelected ? 'selected' : ''} ${isApproach ? 'approach-state' : ''}`;
        div.dataset.id = p.id;
        
        // Add click handler to select plane from strip bay
        div.addEventListener('click', () => {
            if (isApproach) return; // Cannot control planes already on final autopilot
            selectAircraft(p.id);
        });

        const altitudeText = isApproach ? 'APPROACH' : `${p.altitude} Angels`;
        const headingText = isApproach ? '---' : `${p.heading}°`;
        const destText = isApproach ? 'RUNWAY' : (p.destination ? `(${Math.round(p.destination.x)},${Math.round(p.destination.y)})` : 'VECTOR');
        const statusTag = isApproach ? `<span class="strip-val" style="color: var(--warn-amber);">APP (${p.x})</span>` : `<span class="strip-val">${destText}</span>`;

        div.innerHTML = `
            <div class="strip-id">${p.id}</div>
            <div class="strip-type">${p.type}</div>
            <div class="strip-param">
                <span class="strip-label">ALT</span>
                <span class="strip-val">${altitudeText}</span>
            </div>
            <div class="strip-param">
                <span class="strip-label">HDG</span>
                <span class="strip-val">${headingText}</span>
            </div>
            <div class="strip-param" style="grid-column: span 2;">
                <span class="strip-label">DEST</span>
                ${statusTag}
            </div>
        `;
        dom.flightStrips.appendChild(div);
    });

    dom.flightCount.innerText = `${allPlanes.length} FLTS`;
}

// Select a specific aircraft
function selectAircraft(id) {
    audio.playBlip();
    if (state.selectedId === id) {
        state.selectedId = null;
    } else {
        state.selectedId = id;
        const plane = state.aircraft.find(p => p.id === id);
        if (plane) {
            dom.cmdInput.value = `${plane.id} `;
            dom.cmdInput.focus();
        }
    }
    updateFlightStrips();
    drawRadar();
}

// Core Game Loop & Turn Management
function nextTurn() {
    if (state.gameState !== 'playing') return;

    state.turns++;
    
    // 1. Spawning schedule
    if (state.level === 1) {
        if (state.turns === 1) {
            // Already spawned first 2 planes at turn 0, nothing extra
        } else if (state.turns % 5 === 0 && state.totalSpawned < state.maxAircraft) {
            spawnAircraft();
        }
    } else {
        // Level 2 spawning
        if (state.turns % 4 === 0 && state.totalSpawned < state.maxAircraft) {
            spawnAircraft();
        }
    }

    // 2. Decrement countdown for final approach autopilot planes
    for (let i = state.approachPlanes.length - 1; i >= 0; i--) {
        const p = state.approachPlanes[i];
        p.x--; // decrement countdown stored in current position x
        
        if (p.x <= 0) {
            p.destination = 'landed';
            logRadio('TOWER', `${p.id} has landed safely. Sector score +1.`, 'tower');
            audio.playSuccess();
            state.score += 1;
            state.planesLanded++;
            state.approachPlanes.splice(i, 1);
        }
    }

    // 3. Update physics and movements for active planes
    const autopilotTransfers = []; // track planes that enter final approach on this turn
    const lostPlanes = [];

    for (let i = state.aircraft.length - 1; i >= 0; i--) {
        const p = state.aircraft[i];
        p.updatePhysics();

        // Check if reached destination
        if (p.destination) {
            const dist = Math.sqrt(Math.pow(p.x - p.destination.x, 2) + Math.pow(p.y - p.destination.y, 2));
            if (dist < 1.5) {
                p.destination = null;
                logRadio(p.id, `Reached destination. Request heading.`, 'pilot');
                triggerNotification();
            }
        }

        // Check Landing Conditions
        let isLanding = false;
        
        // Target landing heading and approach bounds based on wind
        if (state.windDirection === 90) { // Wind is East, land West (270)
            const isInsideApproach = p.x >= 41.5 && p.x <= 51.5 && p.y >= 37 && p.y <= 43;
            const correctHeading = Math.abs(p.heading - 270) <= 30 || Math.abs(p.heading - 270) >= 330;
            if (isInsideApproach && correctHeading && p.altitude <= 5) {
                isLanding = true;
            }
        } else { // Wind is West, land East (90)
            const isInsideApproach = p.x >= 28.5 && p.x <= 38.5 && p.y >= 37 && p.y <= 43;
            const correctHeading = Math.abs(p.heading - 90) <= 30;
            if (isInsideApproach && correctHeading && p.altitude <= 5) {
                isLanding = true;
            }
        }

        if (isLanding) {
            autopilotTransfers.push(p);
            state.aircraft.splice(i, 1);
            continue;
        }

        // Check if flown off screen
        if (p.x < 0 || p.x > 80 || p.y < 0 || p.y > 80) {
            lostPlanes.push(p);
            state.aircraft.splice(i, 1);
        }
    }

    // Process lost planes
    lostPlanes.forEach(p => {
        state.planesLost++;
        logRadio('SYSTEM', `Flight ${p.id} lost. Left sector boundaries.`, 'system');
        audio.playWarning();
        if (state.selectedId === p.id) state.selectedId = null;
    });

    // Process final approach transfers
    autopilotTransfers.forEach(p => {
        p.destination = 'approach';
        p.x = 5; // touchdown countdown stored in current position X
        state.approachPlanes.push(p);
        logRadio(p.id, `On final approach. Autopilot active.`, 'pilot');
        triggerNotification();
        if (state.selectedId === p.id) state.selectedId = null;
    });

    // Check for "Game Over" due to multiple entries to autopilot landing on SAME turn
    if (autopilotTransfers.length > 1) {
        triggerGameOver("Mid-air collision! Two aircraft entered final approach on the same turn.");
        return;
    }

    // 4. Collision and Separation checks
    checkSeparation();

    // 5. Check Level Completion
    checkLevelEnd();

    // Update Stats Display
    updateStatsHTML();
    updateFlightStrips();
    drawRadar();
}

// Monitor distances to check for near misses or crash collisions
function checkSeparation() {
    const active = state.aircraft;
    const currentNearMisses = new Set();

    for (let i = 0; i < active.length; i++) {
        for (let j = i + 1; j < active.length; j++) {
            const p1 = active[i];
            const p2 = active[j];

            const dist = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
            const altDiff = Math.abs(p1.altitude - p2.altitude);

            // Plane coordinates same and altitude identical
            if (dist < 0.5 && altDiff < 1) {
                triggerGameOver(`Mid-air collision between ${p1.id} and ${p2.id} at block (${Math.round(p1.x)}, ${Math.round(p1.y)})!`);
                return;
            }

            // Near miss: within 2 blocks and same altitude
            if (dist < 2.0 && altDiff < 1) {
                const pairId = [p1.id, p2.id].sort().join('-');
                currentNearMisses.add(pairId);

                // If this is a new conflict that was not happening last turn, penalize points
                if (!state.nearMissPairs.has(pairId)) {
                    state.score -= 1;
                    state.nearMisses++;
                    logRadio('SYSTEM', `WARNING: Separation conflict between ${p1.id} and ${p2.id}! (Dist: ${dist.toFixed(1)} blks at Alt: ${p1.altitude}). Score -1.`, 'system');
                    audio.playWarning();
                }
            }
        }
    }

    // Keep memory of current conflicts
    state.nearMissPairs = currentNearMisses;
}

// Determine if the current level's goals are completed
function checkLevelEnd() {
    // If turns exceed limit
    if (state.turns >= state.maxTurns) {
        // Any planes remaining are considered lost/unfinished, but check if victory condition met
        if (state.aircraft.length === 0 && state.approachPlanes.length === 0) {
            triggerVictory();
        } else {
            // Let remaining planes exit or land, but freeze time?
            // The prompt says "Level one will last 60 turns."
            // Once we reach 60 turns, if there are still planes, let's treat remaining planes as lost.
            const remaining = [...state.aircraft, ...state.approachPlanes];
            remaining.forEach(p => {
                state.planesLost++;
                logRadio('SYSTEM', `Flight ${p.id} failed to land within level duration. Sector cleared.`, 'system');
            });
            state.aircraft = [];
            state.approachPlanes = [];
            updateFlightStrips();
            triggerVictory();
        }
    } else if (state.totalSpawned >= state.maxAircraft && state.aircraft.length === 0 && state.approachPlanes.length === 0) {
        // If all scheduled planes landed/left before maximum turns, victory!
        triggerVictory();
    }
}

// End Game State
function triggerGameOver(msg) {
    state.gameState = 'gameover';
    audio.playCrash();
    dom.gameOverMsg.innerText = msg;
    dom.finalScore.innerText = state.score;
    dom.gameOver.classList.remove('hidden');
}

// Level Won State
function triggerVictory() {
    state.gameState = 'victory';
    audio.playSuccess();
    
    // Update victory screen detailed stats
    document.getElementById('victoryLandedVal').innerText = state.planesLanded;
    document.getElementById('victoryNearMissVal').innerText = state.nearMisses;
    document.getElementById('victoryLostVal').innerText = state.planesLost;
    dom.victoryScore.innerText = state.score;
    
    if (state.level === 1) {
        dom.nextLevelBtn.innerText = "Start Level 2";
        dom.nextLevelBtn.classList.remove('hidden');
    } else {
        dom.nextLevelBtn.innerText = "Final Victory!";
        dom.nextLevelBtn.classList.remove('hidden');
    }
    
    dom.victory.classList.remove('hidden');
}

// Initialize parameters for Level 1 or 2
function initLevel(lvl) {
    try {
        state.level = lvl;
        state.turns = 0;
        state.score = lvl === 1 ? 0 : state.score; // preserve score if moving to next level
        state.aircraft = [];
        state.approachPlanes = [];
        state.totalSpawned = 0;
        state.planesLanded = 0;
        state.planesLost = 0;
        state.nearMisses = 0;
        state.selectedId = null;
        state.nearMissPairs.clear();
        
        if (lvl === 1) {
            state.maxTurns = 60;
            state.maxAircraft = 6;
            state.windDirection = Math.random() < 0.5 ? 90 : 270; // Random East or West
        } else {
            // Level 2 config
            state.maxTurns = 80;
            state.maxAircraft = 12;
            state.windDirection = Math.random() < 0.5 ? 90 : 270;
        }

        dom.consoleLog.innerHTML = '';
        logRadio('SYSTEM', `Radar systems online. Sector Wind: ${WIND_LABELS[state.windDirection]}.`, 'system');
        
        // Spawn initial 2 planes for Level 1
        spawnAircraft();
        spawnAircraft();

        state.gameState = 'playing';
        state.timer = state.turnPause;
        
        updateStatsHTML();
        updateFlightStrips();
        drawRadar();
    } catch (err) {
        logRadio('SYSTEM ERROR', `initLevel failed: ${err.message}`, 'critical');
        console.error(err);
    }
}

function updateStatsHTML() {
    dom.score.innerText = state.score;
    dom.level.innerText = state.level;
    dom.turns.innerText = `${state.turns} / ${state.maxTurns}`;
    dom.activePlanes.innerText = `${state.aircraft.length + state.approachPlanes.length} / ${state.maxAircraft}`;
    dom.wind.innerText = state.windDirection === 90 ? 'EAST (90°)' : 'WEST (270°)';
    
    if (state.windDirection === 90) {
        dom.wind.className = "stat-value warning"; // orange hint for east wind
    } else {
        dom.wind.className = "stat-value"; // standard green for west wind
    }
}

// Drawing Functions for Canvas
function drawRadar() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Radar Screen Gradient Background
    const radGrad = ctx.createRadialGradient(400, 400, 50, 400, 400, 400);
    radGrad.addColorStop(0, '#040d05');
    radGrad.addColorStop(1, '#010502');
    ctx.fillStyle = radGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid details styles
    ctx.strokeStyle = 'rgba(51, 255, 102, 0.15)';
    ctx.lineWidth = 1;

    // 2. Concentric Range Rings (10, 20, 30, 40 blocks)
    const ringRadii = [100, 200, 300, 400];
    ringRadii.forEach(r => {
        ctx.beginPath();
        ctx.arc(400, 400, r, 0, 2 * Math.PI);
        ctx.stroke();
    });

    // 3. Radial Grid Lines (every 30 degrees)
    for (let angle = 0; angle < 360; angle += 30) {
        const rad = angle * (Math.PI / 180);
        ctx.beginPath();
        ctx.moveTo(400, 400);
        ctx.lineTo(400 + Math.sin(rad) * 400, 400 - Math.cos(rad) * 400);
        ctx.stroke();
    }

    // 4. Draw Airport Runway
    // Runway centered at (40, 40), 3 blocks long (30px wide, from x=38.5 to 41.5)
    ctx.strokeStyle = '#33ff66';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(385, 400);
    ctx.lineTo(415, 400);
    ctx.stroke();

    // Runway numbers
    ctx.fillStyle = '#33ff66';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('09', 375, 400);
    ctx.fillText('27', 425, 400);

    // 5. Draw Wind Direction pointer
    // Wind Sock/Arrow near center airport
    ctx.strokeStyle = '#ffaa00';
    ctx.fillStyle = '#ffaa00';
    ctx.lineWidth = 1.5;
    
    // Draw Wind Icon Box at top right quadrant of center
    const wx = 400;
    const wy = 340;
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    
    if (state.windDirection === 90) { // Wind blowing East (arrow pointing right)
        ctx.fillText('WIND →', wx, wy);
    } else { // Wind blowing West (arrow pointing left)
        ctx.fillText('← WIND', wx, wy);
    }

    // 6. Draw V-Shaped Final Approach Funnels (dotted lines)
    ctx.strokeStyle = 'rgba(51, 255, 102, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]); // dashed lines
    
    if (state.windDirection === 90) { // Wind is East, land West on Runway 27 (funnel extends East/Right)
        // Funnel from touchdown (41.5, 40) (415, 400) to outer bounds (51.5, 37) (515, 370) and (51.5, 43) (515, 430)
        ctx.fillStyle = 'rgba(51, 255, 102, 0.03)';
        ctx.beginPath();
        ctx.moveTo(415, 400);
        ctx.lineTo(515, 370);
        ctx.lineTo(515, 430);
        ctx.closePath();
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(415, 400);
        ctx.lineTo(515, 370);
        ctx.moveTo(415, 400);
        ctx.lineTo(515, 430);
        ctx.moveTo(515, 370);
        ctx.lineTo(515, 430);
        ctx.stroke();
    } else { // Wind is West, land East on Runway 09 (funnel extends West/Left)
        // Funnel from touchdown (38.5, 40) (385, 400) to outer bounds (28.5, 37) (285, 370) and (28.5, 43) (285, 430)
        ctx.fillStyle = 'rgba(51, 255, 102, 0.03)';
        ctx.beginPath();
        ctx.moveTo(385, 400);
        ctx.lineTo(285, 370);
        ctx.lineTo(285, 430);
        ctx.closePath();
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(385, 400);
        ctx.lineTo(285, 370);
        ctx.moveTo(385, 400);
        ctx.lineTo(285, 430);
        ctx.moveTo(285, 370);
        ctx.lineTo(285, 430);
        ctx.stroke();
    }
    ctx.setLineDash([]); // restore solid lines

    // 7. Draw Aircraft
    state.aircraft.forEach(p => {
        const px = p.x * BLOCK_SIZE;
        const py = p.y * BLOCK_SIZE;
        const isSelected = p.id === state.selectedId;

        // Highlight selected plane
        if (isSelected) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00d2ff';
            ctx.strokeStyle = '#00d2ff';
            ctx.fillStyle = '#00d2ff';
        } else {
            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#33ff66';
            ctx.fillStyle = '#33ff66';
        }

        // Draw Trail history fading out
        p.trail.forEach((t, index) => {
            const opacity = (index + 1) / (p.trail.length + 1) * 0.4;
            ctx.fillStyle = isSelected ? `rgba(0, 210, 255, ${opacity})` : `rgba(51, 255, 102, ${opacity})`;
            ctx.beginPath();
            ctx.arc(t.x * BLOCK_SIZE, t.y * BLOCK_SIZE, 2, 0, 2 * Math.PI);
            ctx.fill();
        });

        // Restore active colors
        ctx.fillStyle = isSelected ? '#00d2ff' : '#33ff66';

        // Draw aircraft dot position
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, 2 * Math.PI);
        ctx.fill();

        // Draw destination marker & line if selected/set
        if (p.destination) {
            ctx.strokeStyle = isSelected ? 'rgba(0, 210, 255, 0.4)' : 'rgba(51, 255, 102, 0.3)';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(p.destination.x * BLOCK_SIZE, p.destination.y * BLOCK_SIZE);
            ctx.stroke();
            ctx.setLineDash([]);

            // draw little 'x' at destination
            const dx = p.destination.x * BLOCK_SIZE;
            const dy = p.destination.y * BLOCK_SIZE;
            ctx.beginPath();
            ctx.moveTo(dx - 4, dy - 4); ctx.lineTo(dx + 4, dy + 4);
            ctx.moveTo(dx + 4, dy - 4); ctx.lineTo(dx - 4, dy + 4);
            ctx.stroke();
        }

        // Draw vector line extending forward (representing heading & trend)
        const rad = p.heading * (Math.PI / 180);
        const vx = px + Math.sin(rad) * 25;
        const vy = py - Math.cos(rad) * 25;
        
        ctx.strokeStyle = isSelected ? '#00d2ff' : '#33ff66';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(vx, vy);
        ctx.stroke();

        // Draw Label at tip of vector line
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(p.id, vx + 4, vy - 2);
        
        ctx.font = '9px monospace';
        ctx.fillStyle = isSelected ? '#00d2ff' : '#1e8f3e'; // secondary label dimmed
        ctx.fillText(`A${p.altitude}`, vx + 4, vy + 8);
    });

    ctx.shadowBlur = 0; // reset shadow
}

// Parse input radio command line
function parseCommand(text) {
    text = text.trim();
    if (!text) return;

    // Command patterns like "UA123 L270", "AA34 climb 12", "DL903 D5"
    // Regex matches: [Flight Number] [Space?] [Command: L, R, H, C, D] [Space?] [Value]
    const regex = /^([A-Za-z]{2}\d{2,4})\s*([LRHCDe])\s*(\d+)$/i;
    const match = text.match(regex);

    if (!match) {
        logRadio('TOWER', `Invalid command format. Syntax: [FLIGHT_ID] [L/R/H/C/D] [VALUE]`, 'tower');
        return;
    }

    const flightId = match[1].toUpperCase();
    const cmd = match[2].toUpperCase();
    const value = parseInt(match[3]);

    // Find plane
    const plane = state.aircraft.find(p => p.id === flightId);
    if (!plane) {
        logRadio('TOWER', `Flight ${flightId} not found in sector or on autopilot.`, 'tower');
        return;
    }

    if (cmd === 'L' || cmd === 'R' || cmd === 'H') {
        if (value < 0 || value > 360) {
            logRadio('TOWER', `${flightId}: Invalid compass heading. Range is 0-360.`, 'tower');
            return;
        }
        
        // Cancel destination steering if setting manual heading
        plane.destination = null;
        plane.targetHeading = value % 360;
        plane.turnDirection = cmd;
        
        const dirWord = cmd === 'L' ? 'left' : (cmd === 'R' ? 'right' : 'shortest path');
        logRadio('ATC', `${flightId}, turn ${dirWord} heading ${value}°.`, 'tower');
        
        let confirmText = `Roger, turning ${dirWord} to heading ${value}°.`;
        if (cmd === 'H') confirmText = `Roger, steering heading ${value}°.`;
        
        setTimeout(() => {
            logRadio(flightId, confirmText, 'pilot');
            audio.playBlip();
            updateFlightStrips();
        }, 300);

    } else if (cmd === 'C' || cmd === 'D') {
        if (value < 1 || value > 25) {
            logRadio('TOWER', `${flightId}: Altitude value out of sector ceiling (1-25 Angels).`, 'tower');
            return;
        }

        plane.targetAltitude = value;
        const verb = cmd === 'C' ? 'climb' : 'descend';
        logRadio('ATC', `${flightId}, ${verb} to ${value} Angels.`, 'tower');

        setTimeout(() => {
            logRadio(flightId, `Roger, leaving ${plane.altitude} for ${value} Angels.`, 'pilot');
            audio.playBlip();
            updateFlightStrips();
        }, 300);
    }
}

// Canvas Mouse Interactions (selecting plane and setting destinations)
canvas.addEventListener('click', (e) => {
    if (state.gameState !== 'playing') return;

    // Get click coordinates relative to canvas
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const bx = clickX / BLOCK_SIZE;
    const by = clickY / BLOCK_SIZE;

    // Check if clicked close to an active aircraft (within 2 blocks = 20 pixels)
    let clickedPlane = null;
    let minDist = 2.0;

    state.aircraft.forEach(p => {
        const dist = Math.sqrt(Math.pow(p.x - bx, 2) + Math.pow(p.y - by, 2));
        if (dist < minDist) {
            minDist = dist;
            clickedPlane = p;
        }
    });

    if (clickedPlane) {
        // Select plane
        selectAircraft(clickedPlane.id);
    } else if (state.selectedId) {
        // If a plane is selected and we click elsewhere, set destination coordinate
        const plane = state.aircraft.find(p => p.id === state.selectedId);
        if (plane) {
            // Limit destination within radar boundary
            const tx = Math.max(1, Math.min(79, bx));
            const ty = Math.max(1, Math.min(79, by));
            plane.destination = { x: tx, y: ty };
            
            logRadio('ATC', `${plane.id}, proceed direct to position (${Math.round(tx)}, ${Math.round(ty)}).`, 'tower');
            
            const destXStr = Math.round(tx);
            const destYStr = Math.round(ty);
            setTimeout(() => {
                logRadio(plane.id, `Proceeding to position ${destXStr},${destYStr}.`, 'pilot');
                audio.playBlip();
                updateFlightStrips();
                drawRadar();
            }, 300);
            
            // Clear selection after setting destination
            state.selectedId = null;
            updateFlightStrips();
        }
    }
});

// Setup Timer Tick
let timerInterval = null;

function runTimer() {
    try {
        if (state.isPaused || state.gameState !== 'playing') return;

        // decrement sub-seconds
        state.timer -= 0.1 * state.speedMultiplier;
        if (state.timer <= 0) {
            nextTurn();
            state.timer = state.turnPause;
        }
        
        dom.timer.innerText = `${Math.max(0, state.timer).toFixed(1)}s`;
    } catch (err) {
        logRadio('SYSTEM ERROR', `runTimer failed: ${err.message}`, 'critical');
        console.error(err);
    }
}

// Keyboard / Command Submit Listener
dom.consoleForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = dom.cmdInput.value;
    dom.cmdInput.value = '';
    parseCommand(val);
});

// Button Controls Listeners
dom.startBtn.addEventListener('click', () => {
    // Resume/initialize Web Audio context on user action
    audio.resume();
    
    dom.startScreen.classList.add('hidden');
    initLevel(1);
    
    // Start ticker (runs every 100ms)
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(runTimer, 100);
});

dom.restartBtn.addEventListener('click', () => {
    dom.gameOver.classList.add('hidden');
    initLevel(1);
});

dom.nextLevelBtn.addEventListener('click', () => {
    dom.victory.classList.add('hidden');
    if (state.level === 1) {
        initLevel(2);
    } else {
        // restart back to level 1 on final victory restart
        initLevel(1);
    }
});

dom.pauseBtn.addEventListener('click', () => {
    state.isPaused = !state.isPaused;
    dom.pauseBtn.innerText = state.isPaused ? 'RESUME' : 'PAUSE';
    dom.pauseBtn.classList.toggle('active', state.isPaused);
});

dom.speed1x.addEventListener('click', () => {
    state.speedMultiplier = 1;
    dom.speed1x.classList.add('active');
    dom.speed2x.classList.remove('active');
});

dom.speed2x.addEventListener('click', () => {
    state.speedMultiplier = 2;
    dom.speed2x.classList.add('active');
    dom.speed1x.classList.remove('active');
});

dom.mute.addEventListener('change', (e) => {
    audio.setMuted(e.target.checked);
});

// Window initial draw
window.addEventListener('load', () => {
    drawRadar();
});
