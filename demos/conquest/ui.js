// Antigravity Conquest - UI and Graphics Controller
// Manages the SVG map, HUD sidebar, interactive handlers, dice-roll modals, and audio-visual transitions.

const UI = {
  selectedTerritoryId: null,
  battleCallback: null,
  isAISequenceRunning: false,

  // Cache DOM elements
  elements: {
    body: document.body,
    turnIndicator: document.getElementById("turn-indicator"),
    turnDot: document.getElementById("turn-dot"),
    phaseHeader: document.getElementById("phase-header"),
    instructionText: document.getElementById("instruction-text"),
    btnDone: document.getElementById("btn-done"),
    playerList: document.getElementById("player-list"),
    gameLogs: document.getElementById("game-logs"),
    mapContainer: document.getElementById("map-container"),
    
    // Battle Modal
    battleModal: document.getElementById("battle-modal"),
    attackerName: document.getElementById("attacker-name"),
    attackerOwnerName: document.getElementById("attacker-owner-name"),
    attackerArmies: document.getElementById("attacker-armies"),
    attackerDie: document.getElementById("attacker-die"),
    defenderName: document.getElementById("defender-name"),
    defenderOwnerName: document.getElementById("defender-owner-name"),
    defenderArmies: document.getElementById("defender-armies"),
    defenderDie: document.getElementById("defender-die"),
    battleRollBtn: document.getElementById("btn-battle-roll"),
    battleAutoBtn: document.getElementById("btn-battle-auto"),
    battleRetreatBtn: document.getElementById("btn-battle-retreat"),
    battleResult: document.getElementById("battle-result"),
    
    // Setup Screen Overlay
    setupOverlay: document.getElementById("setup-overlay"),
    btnStartGame: document.getElementById("btn-start-game"),

    // Rules Modal
    rulesModal: document.getElementById("rules-modal"),
    btnRulesClose: document.getElementById("btn-rules-close"),
    btnShowRules: document.getElementById("btn-show-rules"),

    // Movement Modal
    movementModal: document.getElementById("movement-modal"),
    moveSourceName: document.getElementById("move-source-name"),
    moveSourceOwnerName: document.getElementById("move-source-owner-name"),
    moveSourceArmies: document.getElementById("move-source-armies"),
    moveDestName: document.getElementById("move-dest-name"),
    moveDestOwnerName: document.getElementById("move-dest-owner-name"),
    moveDestArmies: document.getElementById("move-dest-armies"),
    moveAmountSlider: document.getElementById("move-amount-slider"),
    moveAmountVal: document.getElementById("move-amount-val"),
    btnMoveMinus: document.getElementById("btn-move-minus"),
    btnMovePlus: document.getElementById("btn-move-plus"),
    btnMoveCancel: document.getElementById("btn-move-cancel"),
    btnMoveConfirm: document.getElementById("btn-move-confirm")
  },

  // Initialize event bindings and setup UI state
  init() {
    this.elements.btnStartGame.addEventListener("click", () => this.startGameSequence());
    this.elements.btnDone.addEventListener("click", () => this.handleDoneClick());
    this.elements.btnShowRules.addEventListener("click", () => this.elements.rulesModal.showModal());
    this.elements.btnRulesClose.addEventListener("click", () => this.elements.rulesModal.close());
    
    // Click outside backdrop to close rules
    this.elements.rulesModal.addEventListener("click", (e) => {
      if (e.target === this.elements.rulesModal) this.elements.rulesModal.close();
    });

    // Handle dialog closure (clicks or Escape key)
    this.elements.battleModal.addEventListener("close", () => {
      if (this.battleCallback) {
        this.battleCallback();
        this.battleCallback = null;
      }
    });

    // Slider & button controls for Movement Modal
    const slider = this.elements.moveAmountSlider;
    const valueDisp = this.elements.moveAmountVal;

    slider.addEventListener("input", () => {
      valueDisp.textContent = slider.value;
    });

    this.elements.btnMoveMinus.addEventListener("click", () => {
      let val = parseInt(slider.value, 10);
      if (val > parseInt(slider.min, 10)) {
        slider.value = val - 1;
        valueDisp.textContent = slider.value;
      }
    });

    this.elements.btnMovePlus.addEventListener("click", () => {
      let val = parseInt(slider.value, 10);
      if (val < parseInt(slider.max, 10)) {
        slider.value = val + 1;
        valueDisp.textContent = slider.value;
      }
    });

    this.elements.btnMoveCancel.addEventListener("click", () => {
      this.elements.movementModal.close();
    });

    this.elements.movementModal.addEventListener("click", (e) => {
      if (e.target === this.elements.movementModal) this.elements.movementModal.close();
    });

    this.renderMap();
    this.updateSidebar();
    this.updateTurnBanner();
    this.addLog("Ready to conquer the world! Press 'START CONQUEST' to begin.", "system");
  },

  // Start the setup phase sequences
  startGameSequence() {
    this.elements.setupOverlay.style.display = "none";
    GameEngine.initGame();
    this.addLog("GAME INITIALIZED: The world map has been randomly divided.", "system");
    
    this.updateMap();
    this.updateSidebar();
    this.updateTurnBanner();

    // Trigger AI sequential setup phase
    this.runSequentialSetupDeployments();
  },

  // Sequentially deploy AI armies during the setup phase, then hand over to human
  runSequentialSetupDeployments() {
    this.isAISequenceRunning = true;
    this.disableControls();
    
    const players = ["p2", "p3", "p4"]; // AI players
    let playerIdx = 0;
    let armiesLeft = 10;

    const deployStep = () => {
      if (playerIdx >= players.length) {
        // AI finished, now human deploys
        this.isAISequenceRunning = false;
        this.enableControls();
        this.addLog("ALL AIs DEPLOYED: Your turn to deploy! Select your territories to place your 10 armies.", "human");
        GameEngine.state.currentTurnPlayer = "p1";
        GameEngine.state.phase = "setup";
        this.updateTurnBanner();
        this.updateMap();
        this.updateSidebar();
        return;
      }

      const activePlayerId = players[playerIdx];
      GameEngine.state.currentTurnPlayer = activePlayerId;
      this.updateTurnBanner();

      // Deploy 1 army
      GameEngine.runAISetupDeployment(activePlayerId);
      this.updateMap();
      this.updateSidebar();

      armiesLeft--;
      if (armiesLeft === 0) {
        // Move to next player
        playerIdx++;
        armiesLeft = 10;
        setTimeout(deployStep, 800); // short pause between players
      } else {
        setTimeout(deployStep, 150); // fast pacing for individual armies
      }
    };

    // Begin loop after a short starting delay
    setTimeout(deployStep, 500);
  },

  // Add stylish entry to console log box
  addLog(text, type = "system") {
    const entry = document.createElement("div");
    entry.className = `log-entry ${type}`;
    
    // Add timestamp or prefix
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    entry.innerHTML = `<span style="opacity: 0.4;">[${time}]</span> ${text}`;
    
    this.elements.gameLogs.appendChild(entry);
    this.elements.gameLogs.scrollTop = this.elements.gameLogs.scrollHeight;
  },

  // Render initial SVG map structure
  renderMap() {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${GameMap.width} ${GameMap.height}`);
    svg.className.baseVal = "game-map";

    // 1. Draw Connectors (Dashed Lines)
    const drawnConnectors = new Set();
    for (let tid in GameMap.territories) {
      const terr = GameMap.territories[tid];
      terr.neighbors.forEach(nid => {
        const neighbor = GameMap.territories[nid];
        const key = [tid, nid].sort().join("-");
        if (!drawnConnectors.has(key)) {
          drawnConnectors.add(key);

          const line = document.createElementNS(svgNS, "line");
          line.setAttribute("x1", terr.x);
          line.setAttribute("y1", terr.y);
          line.setAttribute("x2", neighbor.x);
          line.setAttribute("y2", neighbor.y);
          
          const isIntercontinental = terr.continent !== neighbor.continent;
          line.className.baseVal = isIntercontinental ? "map-connector intercontinent" : "map-connector";
          line.id = `connector-${key}`;
          
          svg.appendChild(line);
        }
      });
    }

    // 2. Draw Continent Background Bounds (for visualization & theme depth)
    for (let cid in GameMap.continents) {
      const cont = GameMap.continents[cid];
      const contGroup = document.createElementNS(svgNS, "g");
      contGroup.className.baseVal = "continent-group";
      contGroup.id = `continent-${cid}`;
      svg.appendChild(contGroup);
    }

    // 3. Draw Territory Nodes (G elements)
    for (let tid in GameMap.territories) {
      const terr = GameMap.territories[tid];
      const cont = GameMap.continents[terr.continent];

      const node = document.createElementNS(svgNS, "g");
      node.className.baseVal = "territory-node";
      node.id = `node-${tid}`;
      node.addEventListener("click", () => this.handleTerritoryClick(tid));

      // SVG Base Circle
      const circle = document.createElementNS(svgNS, "circle");
      circle.className.baseVal = "territory-circle";
      circle.setAttribute("cx", terr.x);
      circle.setAttribute("cy", terr.y);
      circle.setAttribute("r", 26);
      circle.setAttribute("stroke", cont.color);
      circle.style.color = cont.color; // Used for hover effects
      node.appendChild(circle);

      // Territory Name
      const label = document.createElementNS(svgNS, "text");
      label.className.baseVal = "node-label";
      label.setAttribute("x", terr.x);
      label.setAttribute("y", terr.y - 34);
      label.textContent = terr.name;
      node.appendChild(label);

      // Territory Continent Badge
      const contLabel = document.createElementNS(svgNS, "text");
      contLabel.className.baseVal = "node-continent-label";
      contLabel.setAttribute("x", terr.x);
      contLabel.setAttribute("y", terr.y + 42);
      contLabel.textContent = terr.continent.substring(0, 3);
      node.appendChild(contLabel);

      // Army Count Badge Background
      const badgeBg = document.createElementNS(svgNS, "circle");
      badgeBg.className.baseVal = "army-badge-bg";
      badgeBg.setAttribute("cx", terr.x);
      badgeBg.setAttribute("cy", terr.y);
      badgeBg.setAttribute("r", 13);
      badgeBg.id = `badge-bg-${tid}`;
      node.appendChild(badgeBg);

      // Army Count Text
      const badgeText = document.createElementNS(svgNS, "text");
      badgeText.className.baseVal = "army-badge-text";
      badgeText.setAttribute("x", terr.x);
      badgeText.setAttribute("y", terr.y);
      badgeText.id = `badge-text-${tid}`;
      badgeText.textContent = "1";
      node.appendChild(badgeText);

      svg.appendChild(node);
    }

    this.elements.mapContainer.innerHTML = "";
    this.elements.mapContainer.appendChild(svg);
  },

  // Update visual states of all nodes on the board
  updateMap() {
    for (let tid in GameMap.territories) {
      const state = GameEngine.state.territories[tid];
      const node = document.getElementById(`node-${tid}`);
      const circle = node.querySelector(".territory-circle");
      const badgeText = document.getElementById(`badge-text-${tid}`);
      const owner = GameEngine.state.players[state.owner];

      // Update army number
      badgeText.textContent = state.armies;

      // Update circle fill to subtle player color tint (to indicate territory owner)
      const playerTints = {
        p1: "rgba(0, 210, 255, 0.12)",
        p2: "rgba(0, 255, 135, 0.12)",
        p3: "rgba(255, 0, 85, 0.12)",
        p4: "rgba(255, 179, 0, 0.12)"
      };
      circle.style.fill = playerTints[state.owner];
      circle.style.color = owner.color;

      // Update inner badge background to solid player color
      const badgeBg = document.getElementById(`badge-bg-${tid}`);
      if (badgeBg) {
        badgeBg.style.fill = owner.color;
        badgeBg.style.stroke = "#0a0b0e"; // Dark outline to pop it out
      }

      // Reset specific interaction states
      node.className.baseVal = "territory-node";
      
      // Setup / Reinforce highlighters
      if (GameEngine.state.phase === "setup" && GameEngine.state.currentTurnPlayer === "p1" && state.owner === "p1") {
        node.classList.add("deploy-target");
      }
      if (GameEngine.state.phase === "reinforce" && GameEngine.state.currentTurnPlayer === "p1" && state.owner === "p1") {
        node.classList.add("deploy-target");
      }
      // Movement source highlighters (selectable nodes with 2+ armies)
      if (GameEngine.state.phase === "movement" && GameEngine.state.currentTurnPlayer === "p1" && state.owner === "p1" && state.armies >= 2 && !this.selectedTerritoryId) {
        node.classList.add("deploy-target");
      }
    }

    // Highlight selected source node
    if (this.selectedTerritoryId) {
      const selNode = document.getElementById(`node-${this.selectedTerritoryId}`);
      selNode.classList.add("selected");

      // Highlight neighbors as attack targets in Attack Phase
      if (GameEngine.state.phase === "attack" && GameEngine.state.currentTurnPlayer === "p1") {
        const terr = GameMap.territories[this.selectedTerritoryId];
        const state = GameEngine.state.territories[this.selectedTerritoryId];
        
        terr.neighbors.forEach(nid => {
          const neighborState = GameEngine.state.territories[nid];
          // Valid attack targets are owned by enemies
          if (neighborState.owner !== "p1") {
            const targetNode = document.getElementById(`node-${nid}`);
            targetNode.classList.add("attack-target");
          }
        });
      }

      // Highlight neighbors as movement targets in Movement Phase
      if (GameEngine.state.phase === "movement" && GameEngine.state.currentTurnPlayer === "p1") {
        const terr = GameMap.territories[this.selectedTerritoryId];
        
        terr.neighbors.forEach(nid => {
          const neighborState = GameEngine.state.territories[nid];
          // Valid movement targets are owned by same player
          if (neighborState.owner === "p1") {
            const targetNode = document.getElementById(`node-${nid}`);
            targetNode.classList.add("movement-target");
          }
        });
      }
    }
  },

  // Update Player Card Stats and reinforcements display
  updateSidebar() {
    this.elements.playerList.innerHTML = "";
    
    for (let pid in GameEngine.state.players) {
      const p = GameEngine.state.players[pid];
      if (pid === "p1" || p.isActive || p.totalTerritories > 0) {
        const card = document.createElement("div");
        card.className = `player-card ${GameEngine.state.currentTurnPlayer === pid ? 'active' : ''}`;
        
        // Custom dot color
        const colorStyle = `color: ${p.color}; background-color: ${p.color};`;
        
        // Custom subtext personality
        const personalityTag = p.personality === "human" ? "Human" : `${p.personality.toUpperCase()} AI`;

        card.innerHTML = `
          <div class="player-info">
            <div class="player-color-dot" style="${colorStyle}"></div>
            <div>
              <div class="player-name">${p.name}</div>
              <div class="player-personality">${personalityTag}</div>
            </div>
          </div>
          <div class="player-stats">
            <div class="stat-item">
              <span class="stat-val" style="color: ${p.color};">${p.totalTerritories}</span>
              <span class="stat-lbl">Terrs</span>
            </div>
            <div class="stat-item">
              <span class="stat-val" style="color: ${p.color};">${p.totalArmies}</span>
              <span class="stat-lbl">Armies</span>
            </div>
          </div>
        `;
        this.elements.playerList.appendChild(card);
      }
    }
  },

  // Update headers and action instruction banners
  updateTurnBanner() {
    const player = GameEngine.state.players[GameEngine.state.currentTurnPlayer];
    
    // Header Title
    this.elements.turnIndicator.textContent = `${player.name.toUpperCase()}'S TURN`;
    this.elements.turnDot.style.backgroundColor = player.color;
    this.elements.turnDot.style.boxShadow = `0 0 10px ${player.color}`;

    // Phase and Instructions
    const phase = GameEngine.state.phase;
    if (phase === "setup") {
      this.elements.phaseHeader.textContent = "SETUP PHASE";
      if (GameEngine.state.currentTurnPlayer === "p1") {
        this.elements.instructionText.innerHTML = `<strong>Deploy your 10 armies:</strong> Click your territories to deploy extra reinforcement armies one by one.<br><br><span style="color: var(--p1-color); font-weight:600;">Deployments remaining: ${player.extraArmiesToDeploy}</span>`;
      } else {
        this.elements.instructionText.textContent = `${player.name} is deploying their 10 extra armies...`;
      }
      this.elements.btnDone.style.display = "none";
    } 
    else if (phase === "reinforce") {
      this.elements.phaseHeader.textContent = "REINFORCEMENT";
      if (GameEngine.state.currentTurnPlayer === "p1") {
        this.elements.instructionText.innerHTML = `<strong>You received reinforcements!</strong> Click your territories to deploy them.<br><br><span style="color: var(--p1-color); font-weight:600;">Deployments remaining: ${GameEngine.state.armiesToDeploy}</span>`;
      } else {
        this.elements.instructionText.textContent = `${player.name} is placing reinforcements...`;
      }
      this.elements.btnDone.style.display = "none";
    } 
    else if (phase === "attack") {
      this.elements.phaseHeader.textContent = "ATTACK PHASE";
      if (GameEngine.state.currentTurnPlayer === "p1") {
        this.elements.instructionText.innerHTML = `<strong>Select a territory to launch challenge:</strong><br>1. Click an owned territory with 2+ armies.<br>2. Click an adjacent highlighted enemy territory to challenge.`;
        this.elements.btnDone.style.display = "block";
        this.elements.btnDone.textContent = "END ATTACK PHASE";
        this.elements.btnDone.disabled = false;
      } else {
        this.elements.instructionText.textContent = `${player.name} is evaluating and attacking territories...`;
        this.elements.btnDone.style.display = "none";
      }
    } 
    else if (phase === "movement") {
      this.elements.phaseHeader.textContent = "ARMY MOVEMENT";
      if (GameEngine.state.currentTurnPlayer === "p1") {
        this.elements.instructionText.innerHTML = `<strong>Relocate armies to reinforce fronts:</strong><br>1. Click an owned territory with 2+ armies.<br>2. Click an adjacent highlighted owned territory to transfer armies.`;
        this.elements.btnDone.style.display = "block";
        this.elements.btnDone.textContent = "END MOVEMENT PHASE";
        this.elements.btnDone.disabled = false;
      } else {
        this.elements.instructionText.textContent = `${player.name} is relocating armies...`;
        this.elements.btnDone.style.display = "none";
      }
    }
    else if (phase === "gameover") {
      this.elements.phaseHeader.textContent = "CONQUEST COMPLETE";
      this.elements.instructionText.textContent = `Game Over. The World has been completely conquered!`;
      this.elements.btnDone.style.display = "none";
    }
  },

  disableControls() {
    this.elements.btnDone.disabled = true;
  },

  enableControls() {
    if ((GameEngine.state.phase === "attack" || GameEngine.state.phase === "movement") && GameEngine.state.currentTurnPlayer === "p1") {
      this.elements.btnDone.disabled = false;
    }
  },

  // Click on a map territory handler
  handleTerritoryClick(territoryId) {
    if (this.isAISequenceRunning) return;
    if (GameEngine.state.currentTurnPlayer !== "p1") return;

    const phase = GameEngine.state.phase;
    const state = GameEngine.state.territories[territoryId];

    // ----------------------------------------
    // SETUP PHASE
    // ----------------------------------------
    if (phase === "setup") {
      if (state.owner === "p1") {
        const success = GameEngine.deploySetupArmy("p1", territoryId);
        if (success) {
          this.addLog(`Human deployed 1 army to ${GameMap.territories[territoryId].name}.`, "human");
          
          // Complete setup check
          if (GameEngine.state.players.p1.extraArmiesToDeploy === 0) {
            this.addLog("SETUP PHASE COMPLETE! Turn 1 begins.", "system");
            // Setup phase completed! Start official turn 1
            GameEngine.startTurn("p1");
          }
          
          this.updateMap();
          this.updateSidebar();
          this.updateTurnBanner();
        }
      } else {
        this.addLog("Select one of your own territories to deploy extra armies.", "system");
      }
    }

    // ----------------------------------------
    // REINFORCE PHASE
    // ----------------------------------------
    else if (phase === "reinforce") {
      if (state.owner === "p1") {
        const success = GameEngine.deployTurnArmy("p1", territoryId);
        if (success) {
          this.addLog(`Human deployed 1 reinforcement to ${GameMap.territories[territoryId].name}.`, "human");
          this.updateMap();
          this.updateSidebar();
          this.updateTurnBanner();
        }
      } else {
        this.addLog("You can only place reinforcement armies on your owned territories.", "system");
      }
    }

    // ----------------------------------------
    // ATTACK PHASE
    // ----------------------------------------
    else if (phase === "attack") {
      // 1. Select source
      if (state.owner === "p1") {
        if (state.armies >= 2) {
          this.selectedTerritoryId = territoryId;
          this.updateMap();
        } else {
          this.addLog("You must select a territory with at least 2 armies to launch an attack.", "system");
        }
      } 
      // 2. Select target
      else if (this.selectedTerritoryId) {
        const sourceTerr = GameMap.territories[this.selectedTerritoryId];
        const isNeighbor = sourceTerr.neighbors.includes(territoryId);

        if (isNeighbor) {
          // Launch Battle Modal!
          const attackerId = this.selectedTerritoryId;
          const defenderId = territoryId;
          
          this.selectedTerritoryId = null; // reset
          this.updateMap();

          this.openBattleModal(attackerId, defenderId, () => {
            this.updateMap();
            this.updateSidebar();
            this.updateTurnBanner();
          });
        } else {
          // clicked non-neighbor enemy, reset selection
          this.selectedTerritoryId = null;
          this.updateMap();
        }
      }
    }

    // ----------------------------------------
    // MOVEMENT PHASE
    // ----------------------------------------
    else if (phase === "movement") {
      if (state.owner === "p1") {
        if (this.selectedTerritoryId) {
          const sourceTerr = GameMap.territories[this.selectedTerritoryId];
          const isNeighbor = sourceTerr.neighbors.includes(territoryId);
          if (isNeighbor) {
            this.openMovementModal(this.selectedTerritoryId, territoryId);
          } else {
            if (state.armies >= 2) {
              this.selectedTerritoryId = territoryId;
            } else {
              this.selectedTerritoryId = null;
              this.addLog("You must select a territory with at least 2 armies to move from.", "system");
            }
            this.updateMap();
          }
        } else {
          if (state.armies >= 2) {
            this.selectedTerritoryId = territoryId;
            this.updateMap();
          } else {
            this.addLog("You must select a territory with at least 2 armies to move from.", "system");
          }
        }
      } else {
        this.selectedTerritoryId = null;
        this.updateMap();
      }
    }
  },

  // Click End Turn Done button
  handleDoneClick() {
    if (GameEngine.state.currentTurnPlayer !== "p1") return;

    this.selectedTerritoryId = null;
    this.updateMap();

    if (GameEngine.state.phase === "attack") {
      GameEngine.endAttackPhase("p1");
    } else if (GameEngine.state.phase === "movement") {
      GameEngine.endMovementPhase("p1");
    }
  },

  // Show Game Over details
  showGameOver(winnerId) {
    const winner = GameEngine.state.players[winnerId];
    this.addLog(`🏆 BATTLE CONCLUDED! ${winner.name.toUpperCase()} HAS CONQUERED THE WORLD!`, "system");
    this.updateTurnBanner();
    this.updateSidebar();
    this.updateMap();

    // Show a premium browser-native message first, then update UI state
    setTimeout(() => {
      alert(`🏆 GAME OVER! 🏆\n\n${winner.name} successfully claimed all territories and conquered the world!`);
    }, 200);
  },

  // ==========================================
  // BATTLE MODAL AND DICE ACTION
  // ==========================================

  // Open battle dialog and initiate fight
  openBattleModal(attackerId, defenderId, callback) {
    this.battleCallback = callback;
    const attackerState = GameEngine.state.territories[attackerId];
    const defenderState = GameEngine.state.territories[defenderId];
    
    const attackerPlayer = GameEngine.state.players[attackerState.owner];
    const defenderPlayer = GameEngine.state.players[defenderState.owner];

    // Reset combat visual states
    this.elements.attackerName.textContent = GameMap.territories[attackerId].name;
    this.elements.attackerName.style.color = attackerPlayer.color;
    this.elements.attackerOwnerName.textContent = attackerPlayer.name;
    this.elements.attackerArmies.textContent = attackerState.armies;
    this.elements.attackerDie.textContent = "?";
    this.elements.attackerDie.style.color = attackerPlayer.color;
    this.elements.attackerDie.className = "die";

    this.elements.defenderName.textContent = GameMap.territories[defenderId].name;
    this.elements.defenderName.style.color = defenderPlayer.color;
    this.elements.defenderOwnerName.textContent = defenderPlayer.name;
    this.elements.defenderArmies.textContent = defenderState.armies;
    this.elements.defenderDie.textContent = "?";
    this.elements.defenderDie.style.color = defenderPlayer.color;
    this.elements.defenderDie.className = "die";

    this.elements.battleResult.textContent = "Prepare for combat! Ties go to defender.";
    this.elements.battleResult.style.color = "var(--text-secondary)";

    // Set active buttons based on human vs AI
    if (attackerPlayer.type === "human") {
      this.elements.battleRollBtn.style.display = "block";
      this.elements.battleAutoBtn.style.display = "block";
      this.elements.battleRetreatBtn.style.display = "block";
      
      // Re-enable buttons for the new battle
      this.elements.battleRollBtn.disabled = false;
      this.elements.battleAutoBtn.disabled = false;
      this.elements.battleRetreatBtn.disabled = false;
      
      // Reset button click binds
      this.elements.battleRollBtn.onclick = () => this.handleCombatRoll(attackerId, defenderId, false);
      this.elements.battleAutoBtn.onclick = () => this.handleCombatRoll(attackerId, defenderId, true);
      this.elements.battleRetreatBtn.onclick = () => this.closeBattleModal();
    } else {
      // AI battle. Rolls automatically to completion!
      this.elements.battleRollBtn.style.display = "none";
      this.elements.battleAutoBtn.style.display = "none";
      this.elements.battleRetreatBtn.style.display = "none";
      
      // Auto-run after a small delay
      setTimeout(() => this.runAICombatSequence(attackerId, defenderId), 800);
    }

    this.elements.battleModal.showModal();
  },

  // Close battle modal and run callbacks
  closeBattleModal() {
    this.elements.battleModal.close();
    this.updateMap();
    this.updateSidebar();
    if (this.battleCallback) {
      this.battleCallback();
      this.battleCallback = null;
    }
  },

  // Handle human action roll
  handleCombatRoll(attackerId, defenderId, autoResolve = false) {
    const attackerState = GameEngine.state.territories[attackerId];
    const defenderState = GameEngine.state.territories[defenderId];

    if (attackerState.armies < 2 || defenderState.armies === 0) return;

    this.elements.battleRollBtn.disabled = true;
    this.elements.battleAutoBtn.disabled = true;
    this.elements.battleRetreatBtn.disabled = true;

    // Trigger Dice Spinning Animations
    this.elements.attackerDie.classList.add("rolling");
    this.elements.defenderDie.classList.add("rolling");
    this.elements.attackerDie.textContent = "";
    this.elements.defenderDie.textContent = "";

    setTimeout(() => {
      // Resolve combat math
      const res = GameEngine.rollBattle(attackerId, defenderId);
      
      this.elements.attackerDie.classList.remove("rolling");
      this.elements.defenderDie.classList.remove("rolling");

      if (!res) {
        this.closeBattleModal();
        return;
      }

      // Update values
      this.elements.attackerDie.textContent = res.attackRoll;
      this.elements.defenderDie.textContent = res.defendRoll;
      this.elements.attackerArmies.textContent = attackerState.armies;
      this.elements.defenderArmies.textContent = defenderState.armies;
      this.updateMap();
      this.updateSidebar();

      const attPlayer = GameEngine.state.players[res.attackerOwner];
      const defPlayer = GameEngine.state.players[res.defenderOwner];

      if (res.attackerLost) {
        this.elements.attackerDie.classList.add("loser");
        this.elements.battleResult.textContent = `${attPlayer.name} lost 1 army!`;
        this.elements.battleResult.style.color = attPlayer.color;
        // Visual screen shake for player loss
        if (attPlayer.type === "human") {
          this.elements.body.classList.add("shake-screen");
          setTimeout(() => this.elements.body.classList.remove("shake-screen"), 300);
        }
      } else {
        this.elements.defenderDie.classList.add("loser");
        this.elements.battleResult.textContent = `${defPlayer.name} lost 1 army!`;
        this.elements.battleResult.style.color = defPlayer.color;
      }

      this.addLog(`Roll details - Attack: ${res.attackRoll}, Defend: ${res.defendRoll} (Tie to Defender). ${res.attackerLost ? attPlayer.name : defPlayer.name} lost 1 army.`, "combat");

      // Check battle end states
      if (res.conquered) {
        this.elements.battleResult.textContent = `💥 VICTORY! Conquered ${GameMap.territories[defenderId].name}!`;
        this.elements.battleResult.style.color = attPlayer.color;
        this.addLog(`💥 Human successfully conquered ${GameMap.territories[defenderId].name}!`, "combat");
        
        setTimeout(() => this.closeBattleModal(), 1500);
      } 
      else if (attackerState.armies < 2) {
        this.elements.battleResult.textContent = `🛡️ DEFEAT! Attack forces depleted.`;
        this.elements.battleResult.style.color = defPlayer.color;
        this.addLog(`🛡️ Attacking forces retreated from ${GameMap.territories[defenderId].name}. Lines held.`, "combat");
        
        setTimeout(() => this.closeBattleModal(), 1500);
      } 
      else {
        // Combat can continue
        this.elements.battleRollBtn.disabled = false;
        this.elements.battleAutoBtn.disabled = false;
        this.elements.battleRetreatBtn.disabled = false;

        // Auto-resolve chain roll
        if (autoResolve) {
          setTimeout(() => this.handleCombatRoll(attackerId, defenderId, true), 600);
        }
      }
    }, 450); // duration of spin
  },

  // Auto-resolve combat sequence for AIs
  runAICombatSequence(attackerId, defenderId) {
    const attackerState = GameEngine.state.territories[attackerId];
    const defenderState = GameEngine.state.territories[defenderId];

    if (attackerState.armies < 2 || defenderState.armies === 0) {
      this.closeBattleModal();
      return;
    }

    this.elements.attackerDie.classList.add("rolling");
    this.elements.defenderDie.classList.add("rolling");
    this.elements.attackerDie.textContent = "";
    this.elements.defenderDie.textContent = "";

    setTimeout(() => {
      const res = GameEngine.rollBattle(attackerId, defenderId);
      
      this.elements.attackerDie.classList.remove("rolling");
      this.elements.defenderDie.classList.remove("rolling");

      if (!res) {
        this.closeBattleModal();
        return;
      }

      this.elements.attackerDie.textContent = res.attackRoll;
      this.elements.defenderDie.textContent = res.defendRoll;
      this.elements.attackerArmies.textContent = attackerState.armies;
      this.elements.defenderArmies.textContent = defenderState.armies;
      this.updateMap();
      this.updateSidebar();

      const attPlayer = GameEngine.state.players[res.attackerOwner];
      const defPlayer = GameEngine.state.players[res.defenderOwner];

      if (res.attackerLost) {
        this.elements.attackerDie.classList.add("loser");
        this.elements.battleResult.textContent = `${attPlayer.name} lost 1 army!`;
        this.elements.battleResult.style.color = attPlayer.color;
      } else {
        this.elements.defenderDie.classList.add("loser");
        this.elements.battleResult.textContent = `${defPlayer.name} lost 1 army!`;
        this.elements.battleResult.style.color = defPlayer.color;
      }

      this.addLog(`AI Combat - Attack: ${res.attackRoll}, Defend: ${res.defendRoll}. ${res.attackerLost ? attPlayer.name : defPlayer.name} lost 1 army.`, "combat");

      if (res.conquered) {
        this.elements.battleResult.textContent = `💥 VICTORY! AI conquered ${GameMap.territories[defenderId].name}!`;
        this.elements.battleResult.style.color = attPlayer.color;
        this.addLog(`💥 ${attPlayer.name} successfully conquered ${GameMap.territories[defenderId].name}!`, "combat");
        
        setTimeout(() => this.closeBattleModal(), 1200);
      } 
      else if (attackerState.armies < 2) {
        this.elements.battleResult.textContent = `🛡️ DEFEAT! Attack forces depleted.`;
        this.elements.battleResult.style.color = defPlayer.color;
        this.addLog(`🛡️ ${attPlayer.name}'s attack forces repelled at ${GameMap.territories[defenderId].name}.`, "combat");
        
        setTimeout(() => this.closeBattleModal(), 1200);
      } 
      else {
        // AI checks if it should continue attacking based on its personality!
        const shouldContinue = this.shouldAIKeepAttacking(res.attackerOwner, attackerState.armies, defenderState.armies);
        if (shouldContinue) {
          setTimeout(() => this.runAICombatSequence(attackerId, defenderId), 700);
        } else {
          this.elements.battleResult.textContent = `🏳️ AI chooses to retreat.`;
          this.elements.battleResult.style.color = "var(--text-secondary)";
          this.addLog(`🏳️ ${attPlayer.name} decided to retreat from ${GameMap.territories[defenderId].name}.`, "combat");
          
          setTimeout(() => this.closeBattleModal(), 1200);
        }
      }
    }, 400);
  },

  // Personality checks to retreat or push battle
  shouldAIKeepAttacking(playerId, attackerArmies, defenderArmies) {
    const player = GameEngine.state.players[playerId];

    if (player.personality === "cautious") {
      // Cautious: Retreats if they lose their crushing advantage
      // Formula: Attacker Armies >= Defender Armies * 2.2 + 1
      return attackerArmies >= (defenderArmies * 2.2) + 1;
    } 
    else if (player.personality === "wreckless") {
      // Wreckless: Never retreats! Attacks until they physically cannot (attacker armies = 1)
      return attackerArmies >= 2;
    } 
    else if (player.personality === "strategic") {
      // Strategic: Retains attack if odds are mathematically favorable.
      // e.g. Attacker > Defender + 1, otherwise retreat.
      return attackerArmies > defenderArmies + 1;
    }

    return false;
  },

  // Open movement dialog and handle army relocation
  openMovementModal(sourceId, destId) {
    const sourceState = GameEngine.state.territories[sourceId];
    const destState = GameEngine.state.territories[destId];
    const sourceMeta = GameMap.territories[sourceId];
    const destMeta = GameMap.territories[destId];
    const player = GameEngine.state.players[sourceState.owner];

    // Populate modal details
    this.elements.moveSourceName.textContent = sourceMeta.name;
    this.elements.moveSourceOwnerName.textContent = player.name;
    this.elements.moveSourceArmies.textContent = sourceState.armies;

    this.elements.moveDestName.textContent = destMeta.name;
    this.elements.moveDestOwnerName.textContent = player.name;
    this.elements.moveDestArmies.textContent = destState.armies;

    // Reset selection highlights before opening
    this.selectedTerritoryId = null;
    this.updateMap();

    // Configure slider bounds: must leave at least 1 army in source
    const maxTransfer = sourceState.armies - 1;
    this.elements.moveAmountSlider.min = 1;
    this.elements.moveAmountSlider.max = maxTransfer;
    this.elements.moveAmountSlider.value = 1;
    this.elements.moveAmountVal.textContent = 1;

    // Show movement overlay dialog
    this.elements.movementModal.showModal();

    // Bind Confirm button
    this.elements.btnMoveConfirm.onclick = () => {
      const amt = parseInt(this.elements.moveAmountSlider.value, 10);
      if (isNaN(amt) || amt < 1 || amt > maxTransfer) return;

      // Relocate forces in game state
      sourceState.armies -= amt;
      destState.armies += amt;

      GameEngine.recalculateStats();

      // Log movement to dashboard
      this.addLog(`Human relocated ${amt} armies from ${sourceMeta.name} to ${destMeta.name}.`, "human");

      // Close modal and refresh interfaces
      this.elements.movementModal.close();
      this.updateMap();
      this.updateSidebar();
    };
  }
};
