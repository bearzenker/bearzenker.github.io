// Antigravity Conquest - Game Engine
// Manages the state machine, players, battle logic, and AI decision systems.

const GameEngine = {
  state: {
    players: {
      p1: { id: "p1", name: "Human Player", type: "human", personality: "human", color: "var(--p1-color)", totalArmies: 0, totalTerritories: 0, extraArmiesToDeploy: 10, isActive: true },
      p2: { id: "p2", name: "Cautious AI", type: "ai", personality: "cautious", color: "var(--p2-color)", totalArmies: 0, totalTerritories: 0, extraArmiesToDeploy: 10, isActive: true },
      p3: { id: "p3", name: "Wreckless AI", type: "ai", personality: "wreckless", color: "var(--p3-color)", totalArmies: 0, totalTerritories: 0, extraArmiesToDeploy: 10, isActive: true },
      p4: { id: "p4", name: "Strategic AI", type: "ai", personality: "strategic", color: "var(--p4-color)", totalArmies: 0, totalTerritories: 0, extraArmiesToDeploy: 10, isActive: true }
    },
    territories: {}, // Will map territory ID -> { id, owner, armies }
    currentTurnPlayer: "p1",
    phase: "setup", // "setup", "reinforce", "attack", "gameover"
    winner: null,
    armiesToDeploy: 0, // Reinforcements left to place in active turn
    setupDeployIndex: 0, // Sequential setup tracker
    setupOrder: ["p2", "p3", "p4", "p1"] // AI deploy first, Human deploys last
  },

  // Initialize the game
  initGame() {
    this.state.phase = "setup";
    this.state.winner = null;
    this.state.setupDeployIndex = 0;
    this.state.armiesToDeploy = 0;
    this.state.currentTurnPlayer = "p2"; // AI goes first in setup

    // Reset players
    for (let pid in this.state.players) {
      this.state.players[pid].extraArmiesToDeploy = 10;
      this.state.players[pid].totalArmies = 0;
      this.state.players[pid].totalTerritories = 0;
      this.state.players[pid].isActive = true;
    }

    // Reset territories
    this.state.territories = {};
    for (let tid in GameMap.territories) {
      this.state.territories[tid] = {
        id: tid,
        owner: null,
        armies: 1 // Starts with 1 army to claim it
      };
    }

    // Randomly assign territories to the 4 players
    const territoryIds = Object.keys(GameMap.territories);
    // Shuffle territoryIds
    for (let i = territoryIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [territoryIds[i], territoryIds[j]] = [territoryIds[j], territoryIds[i]];
    }

    const playerIds = ["p1", "p2", "p3", "p4"];
    territoryIds.forEach((tid, index) => {
      const ownerId = playerIds[index % playerIds.length];
      this.state.territories[tid].owner = ownerId;
    });

    this.recalculateStats();
  },

  // Recalculate players' armies and territory counts
  recalculateStats() {
    // Reset stats
    for (let pid in this.state.players) {
      this.state.players[pid].totalArmies = 0;
      this.state.players[pid].totalTerritories = 0;
    }

    // Count
    for (let tid in this.state.territories) {
      const t = this.state.territories[tid];
      if (t.owner) {
        this.state.players[t.owner].totalTerritories++;
        this.state.players[t.owner].totalArmies += t.armies;
      }
    }

    // Mark inactive players
    for (let pid in this.state.players) {
      const p = this.state.players[pid];
      if (p.totalTerritories === 0 && p.isActive) {
        p.isActive = false;
        UI.addLog(`${p.name} has been completely wiped out!`, "system");
      }
    }
  },

  // Setup phase sequential deployment
  // Deploys one army at a time in sequence.
  deploySetupArmy(playerId, territoryId) {
    const player = this.state.players[playerId];
    const terr = this.state.territories[territoryId];

    if (player.extraArmiesToDeploy <= 0) return false;
    if (terr.owner !== playerId) return false;

    terr.armies++;
    player.extraArmiesToDeploy--;
    this.recalculateStats();
    return true;
  },

  // Calculate standard turn reinforcement armies
  // Rule: total armies owned / 5 + 3
  calculateReinforcements(playerId) {
    const player = this.state.players[playerId];
    if (!player.isActive) return 0;
    
    // Divide armies by 5 and add 3
    const base = Math.floor(player.totalArmies / 5) + 3;
    
    // Standard Risk Continent Bonus (optional premium flavor, let's keep it classic but highlight standard rule)
    let continentBonus = 0;
    for (let cid in GameMap.continents) {
      const continent = GameMap.continents[cid];
      const ownsAll = continent.territories.every(tid => this.state.territories[tid].owner === playerId);
      if (ownsAll) {
        continentBonus += continent.bonus;
      }
    }
    
    return base + continentBonus;
  },

  // Start a new player's turn
  startTurn(playerId) {
    this.state.currentTurnPlayer = playerId;
    
    // Check if player is alive
    if (!this.state.players[playerId].isActive) {
      this.nextTurn();
      return;
    }

    this.state.phase = "reinforce";
    this.state.armiesToDeploy = this.calculateReinforcements(playerId);
    
    UI.addLog(`--- START OF ${this.state.players[playerId].name.toUpperCase()}'S TURN ---`, "system");
    UI.addLog(`${this.state.players[playerId].name} receives ${this.state.armiesToDeploy} reinforcements.`, this.state.players[playerId].personality);
    
    this.recalculateStats();
    UI.updateTurnBanner();
    UI.updateMap();
    UI.updateSidebar();
  },

  // Place reinforcement army during turn
  deployTurnArmy(playerId, territoryId) {
    if (this.state.phase !== "reinforce" || this.state.currentTurnPlayer !== playerId) return false;
    if (this.state.armiesToDeploy <= 0) return false;

    const terr = this.state.territories[territoryId];
    if (terr.owner !== playerId) return false;

    terr.armies++;
    this.state.armiesToDeploy--;
    this.recalculateStats();

    if (this.state.armiesToDeploy === 0) {
      this.state.phase = "attack";
      UI.addLog(`${this.state.players[playerId].name} finished deploying. Entering Attack Phase.`, this.state.players[playerId].personality);
    }
    return true;
  },

  // Resolve a single roll of combat between attacker and defender
  // Attacker rolls 1 die, Defender rolls 1 die. High roll wins. Low roll loses 1 army.
  // Defender wins ties!
  rollBattle(attackerTerrId, defenderTerrId) {
    const attackerTerr = this.state.territories[attackerTerrId];
    const defenderTerr = this.state.territories[defenderTerrId];

    if (attackerTerr.owner === defenderTerr.owner) return null;
    if (attackerTerr.armies < 2) return null;

    const attackRoll = Math.floor(Math.random() * 6) + 1;
    const defendRoll = Math.floor(Math.random() * 6) + 1;

    let attackerLost = false;
    let defenderLost = false;

    if (attackRoll > defendRoll) {
      defenderTerr.armies--;
      defenderLost = true;
    } else {
      // Defender wins ties (or defendRoll > attackRoll)
      attackerTerr.armies--;
      attackerLost = true;
    }

    this.recalculateStats();

    // Check conquer condition
    let conquered = false;
    if (defenderTerr.armies === 0) {
      conquered = true;
      // Conquer: Move all attacking armies except 1
      const movingArmies = attackerTerr.armies - 1;
      attackerTerr.armies = 1;
      defenderTerr.armies = movingArmies;
      defenderTerr.owner = attackerTerr.owner;
      this.recalculateStats();
      this.checkVictory();
    }

    return {
      attackRoll,
      defendRoll,
      attackerLost,
      defenderLost,
      conquered,
      attackerTerrId,
      defenderTerrId,
      attackerOwner: attackerTerr.owner,
      defenderOwner: defenderTerr.owner
    };
  },

  // Check if a player conquered the world
  checkVictory() {
    const playerIds = Object.keys(this.state.players);
    const activeOwners = new Set();

    for (let tid in this.state.territories) {
      if (this.state.territories[tid].owner) {
        activeOwners.add(this.state.territories[tid].owner);
      }
    }

    if (activeOwners.size === 1) {
      this.state.winner = Array.from(activeOwners)[0];
      this.state.phase = "gameover";
      UI.showGameOver(this.state.winner);
      return true;
    }
    return false;
  },

  // Transition to next player's turn
  nextTurn() {
    this.recalculateStats();
    if (this.state.phase === "gameover") return;

    const playerIds = ["p1", "p2", "p3", "p4"];
    const currentIndex = playerIds.indexOf(this.state.currentTurnPlayer);
    let nextIndex = (currentIndex + 1) % playerIds.length;

    // Skip dead players
    let attempts = 0;
    while (!this.state.players[playerIds[nextIndex]].isActive && attempts < 4) {
      nextIndex = (nextIndex + 1) % playerIds.length;
      attempts++;
    }

    const nextPlayerId = playerIds[nextIndex];
    this.startTurn(nextPlayerId);

    // If it's AI, run its turn
    if (this.state.players[nextPlayerId].type === "ai") {
      UI.disableControls();
      setTimeout(() => this.runAITurn(nextPlayerId), 1000);
    } else {
      UI.enableControls();
    }
  },

  // Transition from attack phase to movement phase
  endAttackPhase(playerId) {
    if (this.state.phase !== "attack" || this.state.currentTurnPlayer !== playerId) return;
    
    this.state.phase = "movement";
    UI.addLog(`${this.state.players[playerId].name} enters Army Movement Phase.`, this.state.players[playerId].personality);
    
    UI.updateTurnBanner();
    UI.updateMap();
    UI.updateSidebar();

    // If AI, run AI movement after a short delay
    if (this.state.players[playerId].type === "ai") {
      setTimeout(() => this.runAIMovement(playerId), 1000);
    }
  },

  // End movement phase and advance to next turn
  endMovementPhase(playerId) {
    if (this.state.phase !== "movement" || this.state.currentTurnPlayer !== playerId) return;
    
    UI.addLog(`${this.state.players[playerId].name} finished movement phase.`, this.state.players[playerId].personality);
    this.nextTurn();
  },

  // Perform AI movement sequences
  runAIMovement(playerId) {
    if (this.state.phase !== "movement" || this.state.currentTurnPlayer !== playerId) return;

    const player = this.state.players[playerId];
    const movement = this.getAIMovementChoice(playerId);

    if (movement) {
      const { sourceId, destId, armies } = movement;
      const sourceName = GameMap.territories[sourceId].name;
      const destName = GameMap.territories[destId].name;

      // Execute movement
      this.state.territories[sourceId].armies -= armies;
      this.state.territories[destId].armies += armies;
      this.recalculateStats();

      UI.addLog(`${player.name} moved ${armies} armies from ${sourceName} to ${destName}.`, player.personality);
      
      // Update UI in real-time
      UI.updateMap();
      UI.updateSidebar();
    } else {
      UI.addLog(`${player.name} chooses not to make any movements.`, player.personality);
    }

    // AI movement is done, transition to next player
    setTimeout(() => {
      this.endMovementPhase(playerId);
    }, 1200);
  },

  // Selects best source & target for AI to move armies
  getAIMovementChoice(playerId) {
    const player = this.state.players[playerId];
    
    // Get all adjacent pairs of territories owned by the player
    const pairs = [];
    for (let tid in this.state.territories) {
      const terr = this.state.territories[tid];
      if (terr.owner !== playerId || terr.armies < 2) continue;

      const mapTerr = GameMap.territories[tid];
      mapTerr.neighbors.forEach(nid => {
        const neighbor = this.state.territories[nid];
        if (neighbor.owner === playerId) {
          pairs.push({
            sourceId: tid,
            destId: nid,
            sourceArmies: terr.armies,
            destArmies: neighbor.armies
          });
        }
      });
    }

    if (pairs.length === 0) return null;

    // Score each pair
    pairs.forEach(pair => {
      pair.score = 0;
      
      const sourceBordersEnemy = GameMap.territories[pair.sourceId].neighbors.some(
        nid => this.state.territories[nid].owner !== playerId
      );
      const destBordersEnemy = GameMap.territories[pair.destId].neighbors.some(
        nid => this.state.territories[nid].owner !== playerId
      );

      if (player.personality === "cautious") {
        // Cautious AI: Move from safe interior to endangered borders
        if (!sourceBordersEnemy && destBordersEnemy) {
          pair.score += 20 + pair.sourceArmies;
        }
        else if (sourceBordersEnemy && destBordersEnemy) {
          const sourceThreat = this.getEnemyArmiesThreat(pair.sourceId, playerId);
          const destThreat = this.getEnemyArmiesThreat(pair.destId, playerId);
          if (destThreat > sourceThreat) {
            pair.score += (destThreat - sourceThreat) * 2;
          }
        }
      } 
      else if (player.personality === "wreckless") {
        // Wreckless AI: Accumulate into active doomstacks bordering enemies
        if (destBordersEnemy && pair.sourceArmies >= 2) {
          pair.score += pair.destArmies * 1.5 - pair.sourceArmies * 0.5;
        }
      } 
      else if (player.personality === "strategic") {
        // Strategic AI: Focus on continental defense
        const sourceCont = GameMap.territories[pair.sourceId].continent;
        const destCont = GameMap.territories[pair.destId].continent;
        
        const destIsContBorder = this.isContinentBorder(pair.destId, destCont);
        const sourceIsContBorder = this.isContinentBorder(pair.sourceId, sourceCont);

        if (destIsContBorder && !sourceIsContBorder) {
          pair.score += 15;
        }
        if (destBordersEnemy) {
          pair.score += 5;
        }
      }
    });

    const validMoves = pairs.filter(p => p.score > 0);
    if (validMoves.length === 0) return null;

    validMoves.sort((a, b) => b.score - a.score);
    const bestMove = validMoves[0];

    const armiesToMove = bestMove.sourceArmies - 1;
    if (armiesToMove <= 0) return null;

    return {
      sourceId: bestMove.sourceId,
      destId: bestMove.destId,
      armies: armiesToMove
    };
  },

  getEnemyArmiesThreat(terrId, playerId) {
    let threat = 0;
    GameMap.territories[terrId].neighbors.forEach(nid => {
      const neighbor = this.state.territories[nid];
      if (neighbor.owner !== playerId) {
        threat += neighbor.armies;
      }
    });
    return threat;
  },

  isContinentBorder(terrId, continentId) {
    return GameMap.territories[terrId].neighbors.some(nid => 
      GameMap.territories[nid].continent !== continentId
    );
  },

  // Get list of enemy territories adjacent to the player's territories
  getAdjacentEnemyTerritories(playerId) {
    const list = [];
    for (let tid in this.state.territories) {
      const terr = this.state.territories[tid];
      if (terr.owner !== playerId) continue;

      const mapTerr = GameMap.territories[tid];
      mapTerr.neighbors.forEach(neighborId => {
        const neighbor = this.state.territories[neighborId];
        if (neighbor.owner !== playerId) {
          list.push({
            sourceId: tid,
            targetId: neighborId,
            sourceArmies: terr.armies,
            targetArmies: neighbor.armies
          });
        }
      });
    }
    return list;
  },

  // ==========================================
  // AI DECISION PERSONALITIES
  // ==========================================

  // AI Setup deployment
  runAISetupDeployment(playerId) {
    const player = this.state.players[playerId];
    const ownedTerritories = Object.keys(this.state.territories).filter(
      tid => this.state.territories[tid].owner === playerId
    );

    if (ownedTerritories.length === 0) return;

    let targetTerritoryId = null;

    if (player.personality === "cautious") {
      // Cautious: Deploys on its borders bordering enemy territories, preferably the one with the least armies
      const borders = this.getAdjacentEnemyTerritories(playerId);
      if (borders.length > 0) {
        // Sort borders by sourceArmies ascending
        borders.sort((a, b) => a.sourceArmies - b.sourceArmies);
        targetTerritoryId = borders[0].sourceId;
      } else {
        targetTerritoryId = ownedTerritories[Math.floor(Math.random() * ownedTerritories.length)];
      }
    } 
    else if (player.personality === "wreckless") {
      // Wreckless: Find the border that is bordering the strongest enemy and dump everything there, or random border
      const borders = this.getAdjacentEnemyTerritories(playerId);
      if (borders.length > 0) {
        // Sort borders by targetArmies descending
        borders.sort((a, b) => b.targetArmies - a.targetArmies);
        targetTerritoryId = borders[0].sourceId;
      } else {
        targetTerritoryId = ownedTerritories[Math.floor(Math.random() * ownedTerritories.length)];
      }
    } 
    else if (player.personality === "strategic") {
      // Strategic: Focus on putting armies in one central territory per continent to build a stronghold
      // Group owned territories by continent
      const continentGroups = {};
      ownedTerritories.forEach(tid => {
        const c = GameMap.territories[tid].continent;
        if (!continentGroups[c]) continentGroups[c] = [];
        continentGroups[c].push(tid);
      });

      // Find the continent where we have the most presence but haven't conquered yet
      let bestContinent = null;
      let maxCount = -1;
      for (let cid in continentGroups) {
        const totalInContinent = GameMap.continents[cid].territories.length;
        const ownedInContinent = continentGroups[cid].length;
        if (ownedInContinent < totalInContinent && ownedInContinent > maxCount) {
          maxCount = ownedInContinent;
          bestContinent = cid;
        }
      }

      if (bestContinent && continentGroups[bestContinent].length > 0) {
        // Deploy on the territory inside this continent that borders the most enemies
        const continentTerrs = continentGroups[bestContinent];
        continentTerrs.sort((a, b) => {
          const aEnemies = GameMap.territories[a].neighbors.filter(nid => this.state.territories[nid].owner !== playerId).length;
          const bEnemies = GameMap.territories[b].neighbors.filter(nid => this.state.territories[nid].owner !== playerId).length;
          return bEnemies - aEnemies; // descending
        });
        targetTerritoryId = continentTerrs[0];
      } else {
        targetTerritoryId = ownedTerritories[Math.floor(Math.random() * ownedTerritories.length)];
      }
    }

    if (!targetTerritoryId) {
      targetTerritoryId = ownedTerritories[Math.floor(Math.random() * ownedTerritories.length)];
    }

    this.deploySetupArmy(playerId, targetTerritoryId);
  },

  // AI Turn Implementation
  runAITurn(playerId) {
    if (this.state.phase === "gameover" || this.state.currentTurnPlayer !== playerId) return;

    const player = this.state.players[playerId];
    UI.updateTurnBanner();

    // ----------------------------------------
    // STEP 1: DEPLOY REINFORCEMENTS
    // ----------------------------------------
    const deployPromises = [];
    const deploymentCount = this.state.armiesToDeploy;

    for (let k = 0; k < deploymentCount; k++) {
      // Pick target territory based on personality
      const targetTid = this.getAIDeployTarget(playerId);
      if (targetTid) {
        this.deployTurnArmy(playerId, targetTid);
      }
    }

    UI.updateMap();
    UI.updateSidebar();

    // ----------------------------------------
    // STEP 2: ATTACK PHASE (Turn-based action loop)
    // ----------------------------------------
    setTimeout(() => {
      this.executeAIAttackCycle(playerId);
    }, 1200);
  },

  // Get AI deployment target
  getAIDeployTarget(playerId) {
    const player = this.state.players[playerId];
    const owned = Object.keys(this.state.territories).filter(tid => this.state.territories[tid].owner === playerId);
    if (owned.length === 0) return null;

    const borders = this.getAdjacentEnemyTerritories(playerId);

    if (player.personality === "cautious") {
      // Cautious: Deploys where they are heavily outnumbered. Deploys to borders where enemy armies > owned armies.
      if (borders.length > 0) {
        // Priority to lowest absolute size, or highest enemy disadvantage
        borders.sort((a, b) => {
          const diffA = a.targetArmies - a.sourceArmies;
          const diffB = b.targetArmies - b.sourceArmies;
          return diffB - diffA; // largest disadvantage first
        });
        return borders[0].sourceId;
      }
    } 
    else if (player.personality === "wreckless") {
      // Wreckless: Find our strongest territory bordering an enemy and deploy everything there to create a massive doomstack!
      if (borders.length > 0) {
        borders.sort((a, b) => b.sourceArmies - a.sourceArmies); // strongest first
        return borders[0].sourceId;
      }
    } 
    else if (player.personality === "strategic") {
      // Strategic: Identify continents that we can capture easily.
      // Prioritize deploying on borders in continents where we own most of it to complete or defend it.
      let bestBorder = null;
      let maxContVal = -100;

      borders.forEach(b => {
        const cont = GameMap.territories[b.sourceId].continent;
        const total = GameMap.continents[cont].territories.length;
        const ownedInCont = Object.keys(this.state.territories).filter(t => 
          GameMap.territories[t].continent === cont && this.state.territories[t].owner === playerId
        ).length;

        const val = (ownedInCont / total) * 10 - b.sourceArmies + b.targetArmies;
        if (val > maxContVal) {
          maxContVal = val;
          bestBorder = b.sourceId;
        }
      });

      if (bestBorder) return bestBorder;
    }

    // Default fallback
    return owned[Math.floor(Math.random() * owned.length)];
  },

  // Perform AI attack sequences
  executeAIAttackCycle(playerId) {
    if (this.state.phase !== "attack" || this.state.currentTurnPlayer !== playerId) {
      this.endAttackPhase(playerId);
      return;
    }

    const player = this.state.players[playerId];
    const attackChoice = this.getAIAttackChoice(playerId);

    if (!attackChoice) {
      // No valid or smart attacks, end turn
      UI.addLog(`${player.name} chooses to end their attack phase.`, player.personality);
      this.endAttackPhase(playerId);
      return;
    }

    // Execute attack roll
    const { sourceId, targetId } = attackChoice;
    const sourceName = GameMap.territories[sourceId].name;
    const targetName = GameMap.territories[targetId].name;
    const targetOwnerName = this.state.players[this.state.territories[targetId].owner].name;

    UI.addLog(`${player.name} attacks ${targetName} (${targetOwnerName}) from ${sourceName}!`, player.personality);
    
    // Open battle modal to show the battle
    UI.openBattleModal(sourceId, targetId, () => {
      // Once battle completes (all rolls done, either attacker wins or defender successfully holds)
      // Recalculate and schedule next action
      setTimeout(() => {
        this.executeAIAttackCycle(playerId);
      }, 1000);
    });
  },

  // Selects best source & target for AI to attack
  getAIAttackChoice(playerId) {
    const player = this.state.players[playerId];
    const borders = this.getAdjacentEnemyTerritories(playerId);

    // Filter borders where source has at least 2 armies
    const validBorders = borders.filter(b => b.sourceArmies >= 2);
    if (validBorders.length === 0) return null;

    if (player.personality === "cautious") {
      // Cautious: Only attacks if they have an absolute crushing advantage.
      // Formula: Source Armies >= Target Armies * 2.5 + 2
      const safeBorders = validBorders.filter(b => b.sourceArmies >= (b.targetArmies * 2.5) + 2);
      if (safeBorders.length > 0) {
        // Attack the easiest target first
        safeBorders.sort((a, b) => a.targetArmies - b.targetArmies);
        return safeBorders[0];
      }
    } 
    else if (player.personality === "wreckless") {
      // Wreckless: Hyper-aggressive! Will attack if they have at least 2 armies.
      // They prioritize targets with low armies first to keep conquering, or strong ones if they want to fight!
      // Let's make them prioritize whatever territory is adjacent, preferring their strongest stack.
      validBorders.sort((a, b) => b.sourceArmies - a.sourceArmies);
      
      // Wreckless has a 90% chance of attacking if any valid border exists
      if (Math.random() < 0.95) {
        return validBorders[0];
      }
    } 
    else if (player.personality === "strategic") {
      // Strategic: Evaluates strategic borders.
      // Targets territories where they have a positive mathematical ratio, e.g. Source > Target + 1
      // Prioritizes targets that are part of continents they are trying to conquer.
      const smartBorders = validBorders.filter(b => b.sourceArmies > b.targetArmies + 1);

      if (smartBorders.length > 0) {
        // Calculate strategic weight for each border
        smartBorders.forEach(b => {
          const cont = GameMap.territories[b.targetId].continent;
          const total = GameMap.continents[cont].territories.length;
          
          // Presense of active player in that continent
          const ownedInCont = Object.keys(this.state.territories).filter(t => 
            GameMap.territories[t].continent === cont && this.state.territories[t].owner === playerId
          ).length;

          // Strategic weight: High weight if we already own a lot of this continent
          b.weight = (ownedInCont / total) * 15 - b.targetArmies;
        });

        // Sort by weight descending
        smartBorders.sort((a, b) => b.weight - a.weight);
        return smartBorders[0];
      }
    }

    return null;
  }
};
