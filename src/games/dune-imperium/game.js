// src/games/dune-imperium/game.js
import { LEADERS, getBasicLeaderIds } from './leaders.js';
import { getAllImperiumCards, getAllIntrigueCards } from './cards.js';
// Represents the main game state and logic for Dune: Imperium.

class DuneImperiumGame {
  constructor(playerCount) {
    this.playerCount = playerCount;
    if (playerCount > getBasicLeaderIds().length && playerCount > 1) { // Allow solo testing without enough unique leaders
        // For simplicity in this example, we'll cycle. A real game might require unique leaders or error out.
        // console.warn("Warning: Not enough unique basic leaders for all players. Leaders will be reused.");
    }
    this.players = [];
    this.boardLocations = {}; // Will be populated by initializeBoardLocations
    this.decks = {
      intrigue: [],
      conflict: [],
      imperium: [],
      revealedConflict: null,
    };
    this.gamePhase = 'setup'; // Phases: setup, playerTurn, combat, maker, recall, gameOver
    this.currentPlayerIndex = 0;
    this.round = 1;
    this.conflictParticipants = [];
    this.imperiumRow = [];
    this.allianceTokens = { // Track who holds which alliance token
        fremen: null, // playerId or null
        beneGesserit: null,
        spacingGuild: null,
        emperor: null,
    };
    this.logs = []; // For game event logging
    this.setupGame();
  }

  log(message) {
    console.log(message);
    this.logs.push(message);
    if (this.logs.length > 50) { // Keep log size manageable
        this.logs.shift();
    }
  }

  // Initializes the game state.
  setupGame() {
    this.initializePlayers();
    this.initializeBoardLocations(); // Define factions and effects here
    this.initializeDecks();
    this.dealInitialHands();
    this.revealInitialConflictCard();
    this.populateImperiumRow();
    this.gamePhase = 'playerTurn';
    this.log("Game setup complete. Starting Player 1's turn.");
  }

  initializePlayers() {
    const factions = ["spacingGuild", "beneGesserit", "fremen", "emperor"];
    for (let i = 0; i < this.playerCount; i++) {
      const player = {
        id: i,
        name: `Player ${i + 1}`,
        leader: null,
        agents: 2,
        resources: { spice: 1, solari: 0, water: 1, persuasion: 0, swords: 0 },
        hand: [],
        discardPile: [],
        deck: this.getStartingDeck(),
        playedCards: [],
        revealedCards: [],
        intrigueCards: [], // Player's hand of Intrigue cards
        playedIntrigueCards: [], // For tracking played Endgame intrigues
        influence: {},
        factionAlliances: {},
        garrison: { count: 3 },
        activeCombatUnits: 0,
        victoryPoints: 0,
        hasPassedReveal: false,
        paulSignetActive: false,
        paulTopCardInfo: null,
        skipRecallAgentId: null,
        pendingDecision: null, // For optional costs, targeting, troop deployment choices
      };
      factions.forEach(faction => {
        player.influence[faction] = 0;
        player.factionAlliances[faction] = false;
      });
      this.players.push(player);
    }
    const basicLeaderIds = getBasicLeaderIds();
    this.players.forEach((player, index) => {
        const leaderId = basicLeaderIds[index % basicLeaderIds.length]; // Cycle through leaders if more players than leaders
        player.leader = { ...LEADERS[leaderId] }; // Assign a copy of the leader object
        this.log(`Player ${player.name} is ${player.leader.name}`);
    });
  }

  getStartingDeck() {
    // Signet Ring card ID must be consistent for ability trigger
    const SIGNET_RING_ID = "start_001_signet_ring";
    const startingCards = [
      { id: SIGNET_RING_ID, name: "Signet Ring", type: "Agent", agentIcons: ["Loyalty"], effect: "Use leader Signet ability", persuasion: 0, swords: 0, guildSeal: true },
      { id: "start_002", name: "Conviction", type: "Agent", agentIcons: ["Bene Gesserit"], effect: "Gain 1 spice", persuasion: 1, swords: 0 },
      { id: "start_003", name: "Dune, The Desert Planet", type: "Agent", agentIcons: ["Fremen"], effect: "Gain 1 water", persuasion: 1, swords: 0 },
      { id: "start_004", name: "Diplomacy", type: "Agent", agentIcons: ["Emperor"], effect: "Gain 2 Solari", persuasion: 0, swords: 0 },
      { id: "start_005", name: "Seek Allies", type: "Agent", agentIcons: ["Spacing Guild"], effect: "Gain 1 influence with any faction", persuasion: 0, swords: 0 },
      { id: "start_006", name: "Reconnaissance", type: "Agent", agentIcons: ["Wealth"], effect: "Draw 1 card", persuasion: 0, swords: 0 },
      { id: "start_007", name: "Arrakis Liaison", type: "Agent", agentIcons: ["Fremen", "Military"], effect: "Deploy 1 troop", persuasion: 0, swords: 1 },
      { id: "start_008", name: "Bene Gesserit Initiate", type: "Agent", agentIcons: ["Bene Gesserit", "Any"], effect: "Trash a card from hand or discard, then draw 1", persuasion: 0, swords: 0 },
      { id: "start_009", name: "Imperial Spy", type: "Agent", agentIcons: ["Emperor", "Intrigue"], effect: "Draw 1 intrigue card", persuasion: 0, swords: 0 },
      { id: "start_010", name: "Guild Ambassador", type: "Agent", agentIcons: ["Spacing Guild", "Any"], effect: "Gain 1 Solari or 1 Spice", persuasion: 0, swords: 0 },
    ];
    const deck = JSON.parse(JSON.stringify(startingCards));
    this.shuffleDeck(deck);
    return deck;
  }

  dealInitialHands() {
    this.players.forEach(player => {
      this.drawCards(player.id, 5, 'deck'); // Draw 5 cards from personal deck
    });
  }

  // Generalized shuffle function
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  shuffleDeck(deckName) { // Now shuffles one of the main game decks
    if (this.decks[deckName]) {
        this.shuffle(this.decks[deckName]);
    } else {
        this.log(`Error: Deck ${deckName} not found for shuffling.`);
    }
  }

  // Modified to draw from player's deck or intrigue deck
  drawCards(playerId, numberOfCards, type = 'deck') {
    const player = this.getPlayer(playerId);
    if (!player) return [];

    const drawnCards = [];
    if (type === 'deck') { // Draw from player's personal deck
        for (let i = 0; i < numberOfCards; i++) {
            if (player.deck.length === 0) {
                if (player.discardPile.length === 0) {
                    this.log(`Player ${player.name} has no cards left to draw or reshuffle from personal deck.`);
                    break;
                }
                player.deck = [...player.discardPile];
                player.discardPile = [];
                this.shuffle(player.deck); // Use generalized shuffle
                this.log(`Player ${player.name} reshuffled their discard pile into their deck.`);
            }
            if (player.deck.length > 0) {
                 const card = player.deck.pop();
                 player.hand.push(card);
                 drawnCards.push(card);
            }
        }
    } else if (type === 'intrigue') { // Draw from main intrigue deck
        this.drawIntrigueCards(playerId, numberOfCards); // Uses the new helper
    }
    return drawnCards;
  }

  // Helper to draw intrigue cards specifically
  drawIntrigueCards(playerId, numberOfCards) {
    const player = this.getPlayer(playerId);
    if (!player) return;

    for (let i = 0; i < numberOfCards; i++) {
      if (this.decks.intrigue.length === 0) {
        this.log("Intrigue deck is empty.");
        // Optional: Reshuffle intrigue discard if there was one. Typically not done in D:I.
        break;
      }
      const card = this.decks.intrigue.pop();
      player.intrigueCards.push(card);
      this.log(`Player ${player.name} drew intrigue card: ${card.name}`);
    }
  }


  initializeBoardLocations() {
    // Define board locations with their effects
    // This is a simplified representation. Actual effects are complex.
    // 'effect' property could be a function or an object describing the effect.
    this.boardLocations = {
      // Fremen Locations
      arrakeen: { name: "Arrakeen", faction: "Fremen", agentSlots: 1, agents: [], effect: (pId) => { this.getPlayer(pId).resources.spice += 2; this.gainInfluence(pId, "fremen", 1); this.log(`${this.getPlayer(pId).name} gains 2 spice and 1 Fremen influence from Arrakeen.`); }},
      carthag: { name: "Carthag", faction: "Fremen", agentSlots: 1, agents: [], effect: (pId) => { this.recruitTroops(pId, 2, true); this.gainInfluence(pId, "fremen", 1);this.log(`${this.getPlayer(pId).name} deploys 2 troops to conflict and gains 1 Fremen influence from Carthag.`); }},
      sietchTabr: { name: "Sietch Tabr", faction: "Fremen", agentSlots: 1, agents: [], requiresWater: true, effect: (pId) => { this.getPlayer(pId).resources.water +=1; this.gainInfluence(pId, "fremen", 2); this.recruitTroops(pId,1,false); this.log(`${this.getPlayer(pId).name} gains 1 water, 2 Fremen influence and 1 troop to garrison from Sietch Tabr.`);}},
      // Spacing Guild Locations
      heighliner: { name: "Heighliner", faction: "Spacing Guild", agentSlots: 1, agents: [], cost: 6, // Cost in Spice for transport
        effect: (pId, cardPlayed) => {
            const player = this.getPlayer(pId);
            if (player.resources.spice < (cardPlayed.guildSeal ? 0 : 6) ) { this.log("Not enough spice for Heighliner (6 or 0 with Guild Seal)"); return false;}
            if(!cardPlayed.guildSeal) player.resources.spice -=6;
            this.recruitTroops(pId, 5, true); // 5 troops to conflict
            this.getPlayer(pId).resources.solari += 3;
            this.gainInfluence(pId, "spacingGuild", 1);
            this.log(`${player.name} uses Heighliner, pays ${cardPlayed.guildSeal ? 0 : 6} spice, deploys 5 troops, gains 3 Solari, 1 Guild influence.`);
            return true;
      }},
      // Bene Gesserit Locations
      beneGesseritInitiation: { name: "Bene Gesserit Initiation", faction: "Bene Gesserit", agentSlots: 1, agents: [], effect: (pId) => { this.drawIntrigueCards(pId, 1); this.gainInfluence(pId, "beneGesserit", 1); this.log(`${this.getPlayer(pId).name} draws 1 intrigue and gains 1 BG influence.`); }},
      // Emperor Locations
      emperorRiches: { name: "Emperor Riches", faction: "Emperor", agentSlots: 1, agents: [], effect: (pId) => { this.getPlayer(pId).resources.solari +=2; this.gainInfluence(pId, "emperor", 1); this.log(`${this.getPlayer(pId).name} gains 2 Solari and 1 Emperor influence.`); }},
      // CHOAM Locations
      choamCombine: { name: "CHOAM Combine", agentSlots: 1, agents: [], effect: (pId) => { this.getPlayer(pId).resources.spice +=3; this.log(`${this.getPlayer(pId).name} gains 3 spice from CHOAM Combine.`); }},
      // Landsraad Locations
      landsraadCouncil: { name: "Landsraad Council", agentSlots: 2, agents: [], effect: (pId) => { this.getPlayer(pId).resources.solari +=2; /* TODO: gain council seat / first player marker */ this.log(`${this.getPlayer(pId).name} gains 2 Solari and council seat.`); }},
      swordMaster: { name: "Sword Master", agentSlots: 1, cost: 8, effect: (pId) => { this.recruitTroops(pId, 3, false); /* TODO: gain Swordmaster token / ability */ this.log(`${this.getPlayer(pId).name} pays 8 Solari, gains 3 troops to garrison and Swordmaster.`); }},
    };
  }

  initializeDecks() {
    // Populate Intrigue, Conflict, Imperium decks with more detailed card objects
    this.decks.intrigue = JSON.parse(JSON.stringify(getAllIntrigueCards())); // Use new Intrigue cards
    this.decks.conflict = [
      { id: "conflict_I_001", name: "Skirmish for Spice", type: "Conflict", level: 1, rewards: [{rank: 1, spice: 2, vp: 1}, {rank: 2, spice: 1}]},
      // TODO: Add more conflict cards
    ];
    this.decks.imperium = JSON.parse(JSON.stringify(getAllImperiumCards()));

    this.shuffle(this.decks.intrigue);
    this.shuffle(this.decks.conflict);
    this.shuffle(this.decks.imperium);
    this.log("Decks initialized and shuffled.");
  }

  revealInitialConflictCard() {
    if (this.decks.conflict.length > 0) {
      this.revealedConflict = this.decks.conflict.shift();
      this.log(`Revealed Conflict Card: ${this.revealedConflict.name}`);
    }
  }

  populateImperiumRow() {
    const needed = 5 - this.imperiumRow.length;
    for (let i = 0; i < needed; i++) {
      if (this.decks.imperium.length > 0) {
        this.imperiumRow.push(this.decks.imperium.shift()); // Use shift
      } else {
        break;
      }
    }
    this.log(`Imperium Row populated. Contains ${this.imperiumRow.length} cards.`);
  }

  // --- Player Resource Management ---
  gainResources(playerId, resourcesToGain) {
    const player = this.getPlayer(playerId);
    if (!player) return;
    for (const resource in resourcesToGain) {
        if (player.resources.hasOwnProperty(resource)) {
            player.resources[resource] += resourcesToGain[resource];
            this.log(`Player ${player.name} gained ${resourcesToGain[resource]} ${resource}. Total: ${player.resources[resource]}`);
        }
    }
  }

  spendResources(playerId, resourcesToSpend) {
    const player = this.getPlayer(playerId);
    if (!player) return false;
    // Check if affordable
    for (const resource in resourcesToSpend) {
        if (player.resources[resource] < resourcesToSpend[resource]) {
            this.log(`Player ${player.name} cannot afford ${resourcesToSpend[resource]} ${resource}. Has ${player.resources[resource]}`);
            return false;
        }
    }
    // Spend
    for (const resource in resourcesToSpend) {
        player.resources[resource] -= resourcesToSpend[resource];
        this.log(`Player ${player.name} spent ${resourcesToSpend[resource]} ${resource}. Remaining: ${player.resources[resource]}`);
    }
    return true;
  }

  // --- Influence and Alliances ---
  gainInfluence(playerId, faction, amount) {
    const player = this.getPlayer(playerId);
    if (!player || !player.influence.hasOwnProperty(faction)) return;

    const oldInfluence = player.influence[faction];
    player.influence[faction] += amount;
    if (player.influence[faction] < 0) player.influence[faction] = 0; // Cannot go below 0
    this.log(`Player ${player.name} ${amount > 0 ? 'gains' : 'loses'} ${Math.abs(amount)} influence with ${faction}. New total: ${player.influence[faction]}`);

    // Check for VP awards at influence thresholds (e.g., 2 and 4)
    const vpThresholds = { 2: 1, 4: 1 }; // Influence level -> VP gain (specific to some tracks or general)
    for (const threshold in vpThresholds) {
        if (oldInfluence < threshold && player.influence[faction] >= threshold) {
            player.victoryPoints += vpThresholds[threshold];
            this.log(`Player ${player.name} gained ${vpThresholds[threshold]} VP for reaching ${threshold} influence with ${faction}. Total VP: ${player.victoryPoints}`);
            this.checkVictoryConditions(playerId);
        }
    }
    this.checkAllianceToken(faction); // Check if alliance changes hands
  }

  checkAllianceToken(faction) {
    let bestPlayer = null;
    let maxInfluence = 1; // Minimum 2 influence needed for an alliance token

    this.players.forEach(p => {
        if (p.influence[faction] > maxInfluence) {
            maxInfluence = p.influence[faction];
            bestPlayer = p;
        } else if (p.influence[faction] === maxInfluence && bestPlayer !== null) {
            bestPlayer = -1; // Contested, no one gets it or current holder keeps it if not involved
        }
    });

    const currentHolderId = this.allianceTokens[faction];

    if (bestPlayer !== null && bestPlayer !== -1) { // Single player has highest influence >= 2
        if (currentHolderId !== bestPlayer.id) {
            if (currentHolderId !== null) {
                this.getPlayer(currentHolderId).factionAlliances[faction] = false;
                this.getPlayer(currentHolderId).victoryPoints--; // Lose VP from alliance
                this.log(`Player ${this.getPlayer(currentHolderId).name} lost alliance with ${faction} and 1 VP.`);
            }
            this.allianceTokens[faction] = bestPlayer.id;
            bestPlayer.factionAlliances[faction] = true;
            bestPlayer.victoryPoints++; // Gain VP from alliance
            this.log(`Player ${bestPlayer.name} gained alliance with ${faction} and 1 VP. Total VP: ${bestPlayer.victoryPoints}`);
            this.checkVictoryConditions(bestPlayer.id);
        }
    } else if (currentHolderId !== null && (bestPlayer === -1 || (bestPlayer === null && maxInfluence < 2))) {
        // Alliance is lost by current holder due to tie or dropping below threshold
        this.getPlayer(currentHolderId).factionAlliances[faction] = false;
        this.getPlayer(currentHolderId).victoryPoints--;
        this.log(`Player ${this.getPlayer(currentHolderId).name} lost alliance with ${faction} and 1 VP due to tie or insufficient influence.`);
        this.allianceTokens[faction] = null;
    }
  }

  // --- Troop Management ---
  recruitTroops(playerId, count, toConflict = false) {
    const player = this.getPlayer(playerId);
    if (!player) return;

    const actualRecruitCount = count; // Could be modified by effects in future

    if (toConflict) {
        player.activeCombatUnits += actualRecruitCount;
        if (actualRecruitCount > 0 && !this.conflictParticipants.includes(playerId)) {
            this.conflictParticipants.push(playerId);
        }
        this.log(`Player ${player.name} deployed ${actualRecruitCount} troops directly to conflict. Total in conflict: ${player.activeCombatUnits}`);
    } else {
        player.garrison.count += actualRecruitCount;
        this.log(`Player ${player.name} recruited ${actualRecruitCount} troops to garrison. Total in garrison: ${player.garrison.count}`);
    }

    // Check for Glossu Rabban's left-side ability
    this.players.forEach(p => {
        if (p.id !== playerId && p.leader && p.leader.id === LEADERS.glossuRabban.id) {
            if (actualRecruitCount > 0) { // Only trigger if troops were actually gained
                this.gainResources(p.id, { solari: 1 });
                this.log(`Glossu Rabban (Player ${p.name}) gains 1 Solari due to Player ${playerId} gaining troops.`);
            }
        }
    });
  }

  // --- Card Effects Execution ---
  executeSignetRingAbility(playerId) {
    const player = this.getPlayer(playerId);
    if (!player || !player.leader) return false;
    this.log(`Player ${player.name} uses ${player.leader.name}'s Signet Ring ability.`);

    switch (player.leader.id) {
        case LEADERS.paulAtreides.id:
            player.paulSignetActive = true;
            this.log("Paul Atreides' Signet: Will gain 1 troop if combat is won with troops present.");
            break;
        case LEADERS.glossuRabban.id:
            if (this.spendResources(playerId, { solari: 2 })) {
                this.recruitTroops(playerId, 1, false); // to garrison
            } else {
                this.log("Glossu Rabban Signet: Not enough Solari (2) to gain a troop.");
            }
            break;
        case LEADERS.memnonThorvald.id:
            this.gainResources(playerId, { solari: 1 });
            this.recruitTroops(playerId, 1, false);
            break;
        case LEADERS.ilbanRichese.id:
            this.drawCards(playerId, 1, 'deck');
            break;
        default:
            this.log(`Unknown leader Signet ability for ${player.leader.name}`);
            return false;
    }
    return true;
  }

  executeSpaceEffects(playerId, locationId, cardPlayed) {
    const player = this.getPlayer(playerId);
    const location = this.boardLocations[locationId];
    if (!player || !location) return false;

    this.log(`Player ${player.name} executing effects for ${location.name} with card ${cardPlayed.name}.`);

    // SIGNET RING OVERRIDE: If the card is Signet Ring, its effect is special.
    if (cardPlayed.id === "start_001_signet_ring") { // Ensure this ID matches the Signet Ring card
        return this.executeSignetRingAbility(playerId);
    }

    // Standard Location's defined effect
    if (location.effect) {
        const success = location.effect(playerId, cardPlayed);
        if (success === false) return false;
    }

    // Standard Card's agent box effect
    if (cardPlayed && cardPlayed.agentEffect) {
        const effect = cardPlayed.agentEffect;
        this.log(`Card ${cardPlayed.name} agent effect attempting: ${cardPlayed.agentEffectText}`);

        if (effect.resources) this.gainResources(playerId, effect.resources);
        if (effect.draw) this.drawCards(playerId, effect.draw, 'deck');
        if (effect.recruit) this.recruitTroops(playerId, effect.recruit.count, effect.recruit.toConflict);
        if (effect.deployFromGarrison) {
            const deployable = Math.min(player.garrison.count, effect.deployFromGarrison);
            this.recruitTroops(playerId, deployable, true); // Move from garrison to conflict
            player.garrison.count -= deployable; // This is a bit redundant if recruitTroops handles it, ensure it does
            this.log(`Player ${player.name} deployed ${deployable} from garrison to conflict via ${cardPlayed.name}.`);
        }
        if (effect.gainInfluence) this.gainInfluence(playerId, effect.gainInfluence.faction, effect.gainInfluence.amount);

        if (effect.optionalCost) {
            const cost = effect.optionalCost.resources; // Assuming cost is always resources for now
            const benefit = effect.optionalCost.benefit;
            // For AI (ctx.currentPlayer might not be available here directly, assume isAI check)
            // This logic will be more robust when AI plays its turn fully.
            // For now, if it's an AI player (e.g. determined by player object property or ctx if available)
            const isAI = player.isAI; // Hypothetical property, or check ctx.playerID if this is a move context

            if (isAI) { // Simplified AI decision
                let canAffordOptionalAI = true;
                if (cost) {
                    for(const res in cost) {
                        if (player.resources[res] < cost[res]) {
                            canAffordOptionalAI = false; break;
                        }
                    }
                }
                if (canAffordOptionalAI) {
                    if (cost) this.spendResources(playerId, cost);
                    if (benefit.resources) this.gainResources(playerId, benefit.resources);
                    if (benefit.draw) this.drawCards(playerId, benefit.draw, 'deck');
                    if (benefit.recruit) this.recruitTroops(playerId, benefit.recruit.count, benefit.recruit.toConflict);
                    this.log(`AI Player ${player.name} paid optional cost for ${cardPlayed.name} and gained benefit.`);
                } else {
                    this.log(`AI Player ${player.name} could not afford or chose not to pay optional cost for ${cardPlayed.name}.`);
                }
            } else { // Human player
                player.pendingDecision = {
                    type: 'optionalCost',
                    cardId: cardPlayed.id, // Store cardId for context
                    cardName: cardPlayed.name,
                    cost: cost,
                    benefit: benefit,
                    source: 'agentEffect', // To know where this decision originated
                };
                this.log(`Player ${player.name} has a pending optional cost decision for ${cardPlayed.name}.`);
                return true; // Pause further effects until decision is made
            }
        }

        if (effect.custom) {
            this.executeCustomAgentEffect(playerId, effect.custom, cardPlayed, locationId);
        }
    }
    return true;
  }

  executeCustomAgentEffect(playerId, customEffectId, cardPlayed, locationId) {
    // Placeholder for custom agent effects that don't fit simple resource/draw/recruit structure
    const player = this.getPlayer(playerId);
    this.log(`Executing custom agent effect: ${customEffectId} for card ${cardPlayed.name}`);
    switch (customEffectId) {
        case "choam_directorship_agent":
            // "Gain 1 Spice for each CHOAM space you have an agent on (including this one)."
            let spiceGain = 0;
            Object.values(this.boardLocations).forEach(loc => {
                if (loc.faction === "CHOAM" && loc.agents.includes(playerId)) { // Assuming CHOAM spaces have faction:"CHOAM"
                    spiceGain++;
                }
            });
            if (this.boardLocations[locationId].faction === "CHOAM" && !Object.values(this.boardLocations).find(loc => loc.faction === "CHOAM" && loc.id === locationId && loc.agents.includes(playerId))) {
                 // This check is a bit complex; ensure the current space is counted if it's CHOAM
                 // The current location's agent list is already updated.
            }
            if (spiceGain > 0) this.gainResources(playerId, { spice: spiceGain });
            this.log(`CHOAM Directorship: Player ${player.name} gains ${spiceGain} spice.`);
            break;
        case "bene_gesserit_initiate_agent":
            // "Trash a card from your hand or discard pile. Then, draw a card."
            // Needs AI/player choice. For now, AI might trash a starting card if available.
            // Simplified: if AI, trash first available from hand (not Signet Ring). If human, log.
            if (player.hand.length > 1) { // Keep at least one card if possible
                const cardToTrash = player.hand.find(c => c.id !== "start_001_signet_ring") || player.hand[0];
                if (cardToTrash) {
                    this.trashCard(playerId, cardToTrash.id, 'hand'); // Needs trashCard implementation
                    this.drawCards(playerId, 1, 'deck');
                }
            } else {
                 this.log(`Bene Gesserit Initiate: Not enough cards to trash or no valid target for AI.`);
            }
            break;
        case "stillsuit_agent":
            // "If you deployed an agent to a desert space, gain 1 Water."
            const desertSpaces = ["arrakeen", "carthag", "sietchTabr", "imperialBasin", "haggaBasin"]; // Example IDs
            if (desertSpaces.includes(locationId)) {
                this.gainResources(playerId, { water: 1 });
            }
            break;
        case "the_voice_agent":
            // "Remove 1 troop from any player's garrison in any conflict sector OR Gain 2 Solari."
            // Complex choice. AI: default to Solari. Human: log.
            this.gainResources(playerId, { solari: 2 });
            this.log(`The Voice: Player ${player.name} chose to gain 2 Solari (default for AI).`);
            break;
        default:
            this.log(`Unknown custom agent effect ID: ${customEffectId}`);
    }
  }

  trashCard(playerId, cardId, source) { // source: 'hand' or 'discardPile'
      const player = this.getPlayer(playerId);
      let cardIndex = -1;
      let foundCard = null;

      if (source === 'hand') {
          cardIndex = player.hand.findIndex(c => c.id === cardId);
          if (cardIndex > -1) foundCard = player.hand.splice(cardIndex, 1)[0];
      } else if (source === 'discardPile') {
          cardIndex = player.discardPile.findIndex(c => c.id === cardId);
          if (cardIndex > -1) foundCard = player.discardPile.splice(cardIndex, 1)[0];
      }

      if (foundCard) {
          this.log(`Player ${player.name} trashed ${foundCard.name} from ${source}.`);
          // Add to a conceptual "trash pile" if needed for other game mechanics, otherwise it's just gone.
      } else {
          this.log(`Error: Card ${cardId} not found in ${source} for trashing for player ${player.name}.`);
      }
  }


  executeCardRevealEffects(playerId, revealedCardObjects) {
    const player = this.getPlayer(playerId);
    if (!player) return;

    player.resources.persuasion = 0;
    player.resources.swords = 0;

    this.log(`Player ${player.name} revealing cards: ${revealedCardObjects.map(c=>c.name).join(', ')}`);
    revealedCardObjects.forEach(card => {
        if (card.revealEffect) {
            const effect = card.revealEffect;
            if (effect.persuasion) player.resources.persuasion += effect.persuasion;
            if (effect.swords) player.resources.swords += effect.swords;
            if (effect.resources) this.gainResources(playerId, effect.resources);
            if (effect.draw) this.drawCards(playerId, effect.draw, 'deck');
            // TODO: Implement other specific reveal effects from cards (e.g., gain influence, trash)
            this.log(`Card ${card.name} (Reveal): provides ${effect.persuasion || 0} persuasion, ${effect.swords || 0} swords. Additional: ${JSON.stringify(effect.resources)}, Draw: ${effect.draw || 0}`);
        } else { // Fallback for older card format or cards with only direct persuasion/swords
             if (card.persuasion) player.resources.persuasion += card.persuasion;
             if (card.swords) player.resources.swords += card.swords;
             this.log(`Card ${card.name} (Legacy Reveal): provides ${card.persuasion || 0} persuasion, ${card.swords || 0} swords.`);
        }
    });
    this.log(`Player ${player.name} total for reveal: ${player.resources.persuasion} persuasion, ${player.resources.swords} swords.`);
  }


  // --- Game Phases and Turn Management --- Updated
  nextTurn() {
    // Simplified turn progression for now
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerCount;
    this.log(`Player ${this.players[this.currentPlayerIndex].name}'s turn.`);
    // More complex phase logic will be added: player turns -> combat -> maker -> recall -> next round
  }

  endPlayerTurnActions() {
    // Check if all players have used their agents or passed
    // A player's turn actions end when they explicitly pass their reveal phase or cannot make more moves.
    // This logic should be called after a player indicates they are done with reveal/purchase/commit.
    const player = this.getPlayer(this.currentPlayerIndex);
    player.hasPassedReveal = true; // Mark they are done with this part of their turn

    const allAgentsUsedOrPassed = this.players.every(p => p.agents === 0 && p.hasPassedReveal);
    if (allAgentsUsedOrPassed) {
      this.gamePhase = 'combat';
      this.resolveConflictPhase(); // Renamed for clarity
    } else {
      this.nextTurn();
    }
  }

  // --- Player Actions ---

  // Player deploys an agent to a board location
  placeAgent(playerId, cardId, locationId) {
    if (playerId !== this.currentPlayerIndex) {
      this.log("Error: Not your turn!");
      return false;
    }
    if (this.gamePhase !== 'playerTurn') {
        this.log("Error: Cannot place agent outside of player turn phase.");
        return false;
    }

    const player = this.getPlayer(playerId);
    const location = this.boardLocations[locationId];
    const card = player.hand.find(c => c.id === cardId);

    if (!player || player.agents <= 0) {
      this.log(`Error: Player ${player.name} has no agents left or does not exist.`);
      return false;
    }
    if (!location) {
      this.log(`Error: Location ${locationId} does not exist.`);
      return false;
    }
    if (!card) {
      this.log(`Error: Card ${cardId} not in player's hand.`);
      return false;
    }
    if (location.agents.length >= location.agentSlots) {
      this.log(`Error: Location ${locationId} is full.`);
      return false;
    }

    const costs = {};
    if (location.requiresWater) costs.water = 1;
    if (location.cost) costs.solari = location.cost; // Assuming 'cost' on location is Solari unless specified
    // Special cost for Heighliner is handled in its effect due to Guild Seal logic

    if (Object.keys(costs).length > 0 && !this.spendResources(playerId, costs)) {
        this.log(`Error: Player ${player.name} cannot afford costs for ${location.name}.`);
        return false;
    }

    // Validations passed, proceed with action
    this.log(`Player ${player.name} plays card ${card.name} to ${location.name}.`);

    player.agents -= 1;
    location.agents.push(playerId);
    player.playedCards.push(card);
    player.hand = player.hand.filter(c => c.id !== cardId);

    if (!this.executeSpaceEffects(playerId, locationId, card)) {
        // TODO: Revert state if space effect failed (e.g. Heighliner cost not met) - complex, needs careful thought
    }

    // After standard effects, check if this is a combat space for troop deployment decision
    const locationData = this.boardLocations[locationId];
    if (locationData.isCombatZone && !player.isAI) { // Assume combat zones are marked, e.g. carthag
        const maxDeployableTroops = (player.garrison.count || 0) + (cardPlayed.agentEffect?.recruit?.toConflict ? cardPlayed.agentEffect.recruit.count : 0);
        if (maxDeployableTroops > 0) { // Only prompt if there are troops to deploy
            player.pendingDecision = {
                type: 'deployTroops',
                locationId: locationId, // The combat space itself
                maxDeployableTroops: maxDeployableTroops,
                // Store troops recruited by the card if they must go to conflict
                cardRecruitedToConflict: (cardPlayed.agentEffect?.recruit?.toConflict ? cardPlayed.agentEffect.recruit.count : 0)
            };
            this.log(`Player ${player.name} needs to decide on troop deployment at ${locationData.name}.`);
            return true; // Pause for decision
        }
    }
    // this.endPlayerTurnActions(); // Or player can take more actions if they have agents
    return true;
  }

  // Player plays an intrigue card
  playIntrigueCard(playerId, cardId, targetData = {}) {
    const player = this.getPlayer(playerId);
    const cardIndex = player.intrigueCards.findIndex(c => c.id === cardId);

    if (!player || cardIndex === -1) {
        this.log(`Error: Player ${player.name} does not have intrigue card ${cardId}.`);
        return false;
    }
    const card = player.intrigueCards[cardIndex];

    const isAI = !!player.isAI; // Ensure isAI is a boolean

    // Targeting logic for human players
    if (card.effect && card.effect.custom &&
        (card.effect.custom === "decoy_effect" || card.effect.custom === "poison_snooper_effect") &&
        !isAI && targetData.targetPlayerId === undefined) {

        const validTargets = this.players.filter(p => p.id !== playerId).map(p => p.id);
        if (validTargets.length === 0) {
             this.log(`No valid targets for ${card.name}. Effect fizzles.`);
             player.intrigueCards.splice(cardIndex, 1); // Consume card
             // player.discardPile.push(card); // Or discard it
             return false;
        }
        player.pendingDecision = {
            type: 'selectPlayerTarget',
            cardId: card.id,
            cardName: card.name,
            validTargets: validTargets,
            customEffectId: card.effect.custom,
        };
        this.log(`Player ${player.name} needs to select a target for ${card.name}.`);
        return true;
    }

    player.intrigueCards.splice(cardIndex, 1); // Card is now being fully processed
    this.log(`Player ${player.name} plays intrigue card: ${card.name}. (${card.intrigueType})`);

    if (card.intrigueType === "Endgame") {
        player.playedIntrigueCards.push(card);
        this.log(`${card.name} is an Endgame card, its effect will be resolved at game end.`);
        return true;
    }

    const effect = card.effect;
    if (!effect) {
        this.log(`No effect defined for intrigue card ${card.name}`);
        return false;
    }

    if (effect.vp) { this.gainResources(playerId, {vp: effect.vp}); this.checkVictoryConditions(playerId); }
    if (effect.resources) this.gainResources(playerId, effect.resources);
    if (effect.draw) this.drawCards(playerId, effect.draw, 'deck');
    if (effect.gainInfluence) this.gainInfluence(playerId, effect.gainInfluence.faction, effect.gainInfluence.amount);
    if (effect.recruit) this.recruitTroops(playerId, effect.recruit.count, effect.recruit.toConflict);
    if (effect.swords) {
        if (this.gamePhase === 'combat' || this.conflictParticipants.includes(playerId)) {
            player.resources.swords += effect.swords;
            this.log(`Player ${player.name} gains ${effect.swords} swords for combat from ${card.name}.`);
        } else {
            this.log(`Warning: ${card.name} (Combat Intrigue) played outside of combat context.`);
        }
    }

    if (effect.custom) {
        this.executeCustomIntrigueEffect(playerId, card, targetData);
    }
    return true;
  }


  executeCustomIntrigueEffect(playerId, card, targetData) {
    const player = this.getPlayer(playerId);
    this.log(`Executing custom intrigue effect: ${card.effect.custom} for card ${card.name}`);

    switch (card.effect.custom) {
        case "decoy_effect":
            const targetOpponentId_decoy = targetData.targetPlayerId;
            if (targetOpponentId_decoy === undefined) {
                 this.log("Decoy: No target opponent selected. Effect fizzles."); return;
            }
            const targetOpponent_decoy = this.getPlayer(targetOpponentId_decoy);
            if (!targetOpponent_decoy) { this.log("Decoy: Invalid target opponent."); return; }

            if (targetOpponent_decoy.activeCombatUnits >= 2) {
                targetOpponent_decoy.activeCombatUnits -= 2;
                this.log(`Decoy: Player ${targetOpponent_decoy.name} removes 2 troops from conflict. Remaining: ${targetOpponent_decoy.activeCombatUnits}`);
            } else if (targetOpponent_decoy.activeCombatUnits === 1) {
                targetOpponent_decoy.activeCombatUnits -= 1;
                targetOpponent_decoy.garrison.count = Math.max(0, targetOpponent_decoy.garrison.count - 1);
                this.log(`Decoy: Player ${targetOpponent_decoy.name} removes 1 from conflict, 1 from garrison.`);
            } else if (targetOpponent_decoy.garrison.count >=2) {
                targetOpponent_decoy.garrison.count -= 2;
                this.log(`Decoy: Player ${targetOpponent_decoy.name} removes 2 troops from garrison. Remaining: ${targetOpponent_decoy.garrison.count}`);
            } else {
                targetOpponent_decoy.garrison.count = 0;
                this.log(`Decoy: Player ${targetOpponent_decoy.name} removes remaining troops from garrison.`);
            }
            break;
        case "poison_snooper_effect":
            const targetOpponentId_snooper = targetData.targetPlayerId;
            // For human, cardToDiscardId would be part of a second decision step.
            // For AI, assume it makes this choice and includes it in targetData.
            const cardToDiscardId = targetData.cardToDiscardId;

            if (targetOpponentId_snooper === undefined) {
                this.log("Poison Snooper: Target not selected. Effect fizzles."); return;
            }
            const targetOpponent_snooper = this.getPlayer(targetOpponentId_snooper);
            if (!targetOpponent_snooper) { this.log("Poison Snooper: Invalid target."); return; }

            if (!cardToDiscardId && !player.isAI) { // Human player needs to choose a card
                 player.pendingDecision = {
                    type: 'selectCardFromHand',
                    targetPlayerId: targetOpponentId_snooper,
                    sourceCardId: card.id, // The Poison Snooper card itself
                    reason: "poison_snooper_discard",
                 };
                 this.log(`Player ${player.name} needs to select a card from Player ${targetOpponent_snooper.name}'s hand to discard.`);
                 return; // Pause for decision
            }

            // If AI or human has made choice:
            if (cardToDiscardId) {
                const cardIdx = targetOpponent_snooper.hand.findIndex(c => c.id === cardToDiscardId);
                if (cardIdx > -1) {
                    const discarded = targetOpponent_snooper.hand.splice(cardIdx, 1)[0];
                    targetOpponent_snooper.discardPile.push(discarded);
                    this.log(`Poison Snooper: Player ${player.name} forces Player ${targetOpponent_snooper.name} to discard ${discarded.name}.`);
                } else {
                     this.log(`Poison Snooper: Card ${cardToDiscardId} not found in Player ${targetOpponent_snooper.name}'s hand.`);
                }
            } else {
                // AI couldn't pick a card (e.g. hand empty, or its logic failed)
                this.log(`Poison Snooper: AI for Player ${player.name} did not select a card to discard from Player ${targetOpponent_snooper.name}.`);
            }
            break;
        case "bindu_suspension_effect":
            const agentLocationId = targetData.agentLocationId;
            if (!agentLocationId || !this.boardLocations[agentLocationId] || !this.boardLocations[agentLocationId].agents.includes(playerId)) {
                // AI / Human choice needed. For human, set pendingDecision.
                if (!player.isAI) {
                    const validAgentLocations = Object.keys(this.boardLocations).filter(locId => this.boardLocations[locId].agents.includes(playerId));
                    if (validAgentLocations.length === 0) { this.log("Bindu Suspension: No agents on board to protect."); return; }
                    player.pendingDecision = {
                        type: 'selectAgentLocation',
                        cardId: card.id,
                        reason: 'bindu_suspension_select',
                        validLocations: validAgentLocations,
                    };
                    this.log(`Player ${player.name} needs to select an agent to protect with Bindu Suspension.`);
                    return; // Pause for decision
                } else { // AI makes a choice
                    const firstValidAgentLoc = Object.keys(this.boardLocations).find(locId => this.boardLocations[locId].agents.includes(playerId));
                    if (firstValidAgentLoc) {
                        player.skipRecallAgentId = firstValidAgentLoc;
                        this.log(`Bindu Suspension: Player ${player.name}'s agent at ${this.boardLocations[firstValidAgentLoc].name} will not be recalled this round (AI default).`);
                    } else {
                        this.log(`Bindu Suspension: Player ${player.name} has no agents on board to protect.`);
                    }
                    return; // AI decision made
                }
            }
            // If targetData.agentLocationId was provided (e.g. by human's selectAgentLocation move or AI)
            player.skipRecallAgentId = agentLocationId;
            this.log(`Bindu Suspension: Player ${player.name}'s agent at ${this.boardLocations[agentLocationId].name} will not be recalled this round.`);
            break;
        default:
            this.log(`Unknown custom intrigue effect ID: ${card.effect.custom}`);
    }
  }

  // Player reveals cards for persuasion, swords, etc. (Reveal Turn)
  revealTurn(playerId, cardIdsToPlay) {
    if (playerId !== this.currentPlayerIndex) {
        this.log("Error: Not your turn!");
        return false;
    }
    const player = this.getPlayer(playerId);
    if (this.gamePhase !== 'playerTurn' || player.agents > 0 || player.hasPassedReveal) {
        this.log("Error: Cannot take reveal turn. (Not player turn, agents > 0, or already revealed).");
        return false;
    }
    if (player.pendingDecision) {
        this.log("Error: Cannot reveal, player has a pending decision.");
        return false;
    }

    const cardsToRevealObjects = [];
    for (const cardId of cardIdsToPlay) {
        const card = player.hand.find(c => c.id === cardId);
        if (card) {
            cardsToRevealObjects.push(card);
        }
    }

    this.executeCardRevealEffects(playerId, cardsToRevealObjects);
    player.revealedCards.push(...cardsToRevealObjects);
    player.hand = player.hand.filter(c => !cardIdsToPlay.includes(c.id));
    return true;
  }


  // Player purchases a card from the Imperium Row
  purchaseCard(playerId, cardId) {
    if (playerId !== this.currentPlayerIndex) {
      this.log("Error: Not your turn to purchase!");
      return false;
    }
    const player = this.getPlayer(playerId);
    if (player.agents > 0 || player.hasPassedReveal) { // Can only purchase during Reveal phase, after agents, before ending actions
        this.log("Error: Can only purchase during reveal phase after playing agents and before passing.");
        return false;
    }
    if (player.pendingDecision) {
        this.log("Error: Cannot purchase, player has a pending decision.");
        return false;
    }

    const cardIndex = this.imperiumRow.findIndex(c => c.id === cardId);
    if (cardIndex === -1) {
      this.log(`Error: Card ${cardId} not found in Imperium Row.`);
      return false;
    }
    const imperiumCard = this.imperiumRow[cardIndex]; // Renamed to avoid conflict
    if (!this.spendResources(playerId, { persuasion: imperiumCard.cost })) {
      this.log(`Error: Player ${player.name} cannot afford ${imperiumCard.name}. Needs ${imperiumCard.cost} persuasion, has ${player.resources.persuasion}.`);
      return false;
    }

    player.discardPile.push(imperiumCard);
    this.imperiumRow.splice(cardIndex, 1);
    this.populateImperiumRow();
    this.log(`Player ${player.name} purchased ${imperiumCard.name}.`);

    if (player.leader && player.leader.id === LEADERS.ilbanRichese.id && imperiumCard.tags && imperiumCard.tags.includes("Tech")) {
        this.gainResources(playerId, { solari: 1 });
        this.log(`Count Ilban Richese (Player ${player.name}) gains 1 Solari for acquiring a Tech card.`);
    }
    return true;
  }

  // Player commits troops to combat (usually called by decideTroopDeployment or card effects)
  commitTroopsToCombat(playerId, numberOfTroops) {
    const player = this.getPlayer(playerId);
    if (!player) return false;

    const troopsToCommit = Math.max(0, Math.min(numberOfTroops, player.garrison.count));

    player.garrison.count -= troopsToCommit;
    player.activeCombatUnits += troopsToCommit;
    if (troopsToCommit > 0 && !this.conflictParticipants.includes(playerId)) {
        this.conflictParticipants.push(playerId);
    }
    this.log(`Player ${player.name} committed ${troopsToCommit} from garrison to the conflict. Total active: ${player.activeCombatUnits}`);

    if (player.leader && player.leader.id === LEADERS.memnonThorvald.id && troopsToCommit > 0) {
        this.gainResources(playerId, { solari: 1 });
        this.log(`Earl Memnon Thorvald (Player ${player.name}) gains 1 Solari for committing troops.`);
    }
    return true;
  }


  // --- New Decision Moves ---
  decideOptionalCost(playerId, cardName, accept) { // cardName for logging/UI context
    const player = this.getPlayer(playerId);
    if (!player || !player.pendingDecision || player.pendingDecision.type !== 'optionalCost') {
      this.log("Error: No pending optional cost decision or wrong type.");
      return false;
    }
    if (playerId !== this.currentPlayerIndex) {
      this.log("Error: Not your turn to decide optional cost.");
      return false;
    }

    const decision = player.pendingDecision;
    this.log(`Player ${player.name} decides on optional cost for ${decision.cardName}: ${accept ? 'Accept' : 'Decline'}`);

    if (accept) {
      if (decision.cost && !this.spendResources(playerId, decision.cost)) {
        this.log(`Error: Could not afford optional cost for ${decision.cardName} upon accepting.`);
        player.pendingDecision = null; // Clear decision anyway
        return false;
      }
      // Grant benefit
      const benefit = decision.benefit;
      if (benefit.resources) this.gainResources(playerId, benefit.resources);
      if (benefit.draw) this.drawCards(playerId, benefit.draw, 'deck');
      if (benefit.recruit) this.recruitTroops(playerId, benefit.recruit.count, benefit.recruit.toConflict);
      // ... other benefit types
    }
    player.pendingDecision = null;
    // Potentially trigger next part of original action or allow player to continue turn.
    return true;
  }

  selectPlayerTarget(playerId, sourceCardId, targetPlayerId) {
    const player = this.getPlayer(playerId);
    if (!player || !player.pendingDecision || player.pendingDecision.type !== 'selectPlayerTarget' || player.pendingDecision.cardId !== sourceCardId) {
        this.log("Error: No pending player target selection or mismatched card.");
        return false;
    }
    if (!player.pendingDecision.validTargets.includes(targetPlayerId)) {
        this.log("Error: Invalid target selected.");
        return false;
    }

    const decision = player.pendingDecision;
    const card = getAllIntrigueCards().find(c => c.id === decision.cardId); // Get full card data

    this.log(`Player ${player.name} selected Player ${targetPlayerId} as target for ${decision.cardName}.`);
    player.pendingDecision = null;

    // Re-invoke the custom effect part of the intrigue card with the target
    this.executeCustomIntrigueEffect(playerId, card, { targetPlayerId: targetPlayerId });
    // If the custom effect itself needs another decision (e.g. Poison Snooper card choice), it will set pendingDecision.
    return true;
  }

  selectCardFromHand(playerId, sourceCardId, targetPlayerId, selectedCardIdToDiscard) {
    const player = this.getPlayer(playerId); // The one playing Poison Snooper
    if (!player || !player.pendingDecision ||
        player.pendingDecision.type !== 'selectCardFromHand' ||
        player.pendingDecision.sourceCardId !== sourceCardId ||
        player.pendingDecision.targetPlayerId !== targetPlayerId) {
        this.log("Error: No pending card selection from hand or mismatched decision context.");
        return false;
    }
    const targetPlayer = this.getPlayer(targetPlayerId);
    if (!targetPlayer || !targetPlayer.hand.find(c => c.id === selectedCardIdToDiscard)) {
        this.log("Error: Invalid target player or card not in target's hand for discard.");
        return false;
    }

    const decision = player.pendingDecision;
    const sourceCard = getAllIntrigueCards().find(c => c.id === decision.sourceCardId);

    this.log(`Player ${player.name} (for ${sourceCard.name}) chose card ${selectedCardIdToDiscard} from Player ${targetPlayer.name}'s hand.`);
    player.pendingDecision = null;

    // Now execute the discard part of Poison Snooper
    this.executeCustomIntrigueEffect(playerId, sourceCard, { targetPlayerId: targetPlayerId, cardToDiscardId: selectedCardIdToDiscard });
    return true;
  }

  selectAgentLocation(playerId, sourceCardId, locationId) {
    const player = this.getPlayer(playerId);
     if (!player || !player.pendingDecision ||
        player.pendingDecision.type !== 'selectAgentLocation' ||
        player.pendingDecision.cardId !== sourceCardId ||
        !player.pendingDecision.validLocations.includes(locationId)) {
        this.log("Error: No pending agent location selection or invalid choice.");
        return false;
    }
    const decision = player.pendingDecision;
    const sourceCard = getAllIntrigueCards().find(c => c.id === decision.cardId);

    this.log(`Player ${player.name} (for ${sourceCard.name}) selected agent at ${locationId}.`);
    player.pendingDecision = null;
    this.executeCustomIntrigueEffect(playerId, sourceCard, { agentLocationId: locationId });
    return true;
  }

  decideTroopDeployment(playerId, locationId, numberOfTroops) {
    const player = this.getPlayer(playerId);
    if (!player || !player.pendingDecision || player.pendingDecision.type !== 'deployTroops' || player.pendingDecision.locationId !== locationId) {
      this.log("Error: No pending troop deployment decision or mismatched location.");
      return false;
    }
    const decision = player.pendingDecision;
    if (numberOfTroops < 0 || numberOfTroops > decision.maxDeployableTroops) {
      this.log(`Error: Invalid number of troops to deploy (${numberOfTroops}). Max: ${decision.maxDeployableTroops}`);
      return false;
    }

    this.log(`Player ${player.name} decides to deploy ${numberOfTroops} troops to ${locationId}.`);

    // Troops recruited by the card itself (if they go to conflict) are handled by card effect.
    // This move is for troops from garrison.
    const troopsFromGarrison = numberOfTroops - (decision.cardRecruitedToConflict || 0);

    if (troopsFromGarrison > 0) {
        this.commitTroopsToCombat(playerId, troopsFromGarrison);
    }
    // Any troops recruited by the card that go directly to conflict are assumed to be handled by its agentEffect.
    // This move primarily finalizes garrison deployment.

    player.pendingDecision = null;
    return true;
  }

  awardConflictReward(playerId, reward) {
    const player = this.getPlayer(playerId);
    if (!player || !reward) return;

    this.log(`Player ${player.name} receives conflict reward: ${JSON.stringify(reward)}`);
    if (reward.vp) { player.victoryPoints += reward.vp; this.checkVictoryConditions(playerId); }
    if (reward.spice) this.gainResources(playerId, {spice: reward.spice});
    if (reward.solari) this.gainResources(playerId, {solari: reward.solari});
    if (reward.water) this.gainResources(playerId, {water: reward.water});
    if (reward.draw) this.drawCards(playerId, reward.draw, 'deck');
    if (reward.intrigue) this.drawIntrigueCards(playerId, reward.intrigue);
    if (reward.troopsToGarrison) this.recruitTroops(playerId, reward.troopsToGarrison, false);
    // TODO: Add other potential rewards like 'trash a card', 'gain influence specific faction' etc.
  }

  // --- Combat Phase ---
  resolveConflictPhase() { // Renamed from resolveConflict
    if (this.gamePhase !== 'combat') {
        this.log("Error: Not in combat phase.");
        return;
    }
    this.log("--- Resolving Conflict ---");
    if (!this.revealedConflict) {
        this.log("No conflict card active.");
        this.proceedToMakerPhase();
        return;
    }
    this.log(`Conflict: ${this.revealedConflict.name}`);

    const combatants = this.players
        .filter(p => this.conflictParticipants.includes(p.id) && (p.activeCombatUnits > 0 || p.resources.swords > 0)) // Must have units or swords
        .map(p => ({
            id: p.id,
            name: p.name,
            totalStrength: (p.activeCombatUnits * 2) + (p.resources.swords || 0) // Swords from reveal turn
            // TODO: Add intrigue card combat effects, leader abilities, swordmaster token etc.
        }))
        .sort((a, b) => b.totalStrength - a.totalStrength); // Sort by strength descending

    this.log("Combatants (Strength):");
    combatants.forEach(c => this.log(`${c.name}: ${c.totalStrength} (Units: ${this.getPlayer(c.id).activeCombatUnits}, Swords: ${this.getPlayer(c.id).resources.swords || 0})`));

    // Distribute rewards based on rank
    const rewards = this.revealedConflict.rewards;
    rewards.forEach(rewardTier => {
        const rankedPlayer = combatants[rewardTier.rank -1]; // combatants is 0-indexed array
        if (rankedPlayer) {
            this.log(`Rank ${rewardTier.rank} for Player ${rankedPlayer.name}`);
            this.awardConflictReward(rankedPlayer.id, rewardTier);
        } else {
            this.log(`No player achieved Rank ${rewardTier.rank}.`);
        }
    });

    // Clear conflict state for players
    this.players.forEach(p => {
        // Troops in conflict are typically lost unless card effects (e.g. from Heighliner) or specific conflict card rules say otherwise.
        // For simplicity, assume they are lost from activeCombatUnits. They were already removed from garrison.
        if (p.activeCombatUnits > 0) {
            this.log(`Player ${p.name} loses ${p.activeCombatUnits} troops from conflict.`);
            p.activeCombatUnits = 0;
        }
        // Swords from reveal are for this combat only. Persuasion is spent or reset.
        p.resources.swords = 0;
        p.resources.persuasion = 0; // Reset persuasion if not already spent
    });
    this.conflictParticipants = [];

    // Discard old conflict card, reveal new one
    if (this.decks.conflict.length > 0) {
        this.revealedConflict = this.decks.conflict.shift();
        this.log(`New Conflict Card: ${this.revealedConflict.name}`);
    } else {
        this.revealedConflict = null;
        this.log("No more conflict cards.");
    }

    this.proceedToMakerPhase();
  }

  proceedToMakerPhase() {
    this.gamePhase = 'maker';
    this.log("--- Maker Phase ---");
    this.players.forEach(player => {
        Object.values(this.boardLocations).forEach(loc => {
            if (loc.agents.includes(player.id)) {
                // Example: Arrakeen and certain other Fremen locations might produce spice in Maker phase.
            }
        });
    });
    this.proceedToRecallPhase();
  }

  proceedToRecallPhase() {
    this.gamePhase = 'recall';
    this.log("--- Recall Phase ---");
    this.players.forEach(player => {
        player.agents = 2;
        player.hasPassedReveal = false;
        player.discardPile.push(...player.playedCards);
        player.playedCards = [];
        player.discardPile.push(...player.revealedCards);
        player.revealedCards = [];
        const cardsToDraw = 5 - player.hand.length;
        if (cardsToDraw > 0) {
            this.drawCards(player.id, cardsToDraw, 'deck');
        }
    });

    // Clear agents from board locations, respecting Bindu Suspension
    Object.keys(this.boardLocations).forEach(locId => {
        const location = this.boardLocations[locId];
        location.agents = location.agents.filter(agentPlayerId => {
            const player = this.getPlayer(agentPlayerId);
            if (player && player.skipRecallAgentId === locId) {
                this.log(`Player ${player.name}'s agent at ${location.name} is not recalled due to Bindu Suspension.`);
                player.skipRecallAgentId = null; // Effect is for one round
                return true; // Keep this agent
            }
            return false; // Remove other agents
        });
    });

    // this.applyControlBonus();

    if (this.gamePhase !== 'gameOver') {
        this.round++;
        this.log(`--- End of Round ${this.round -1}. Starting Round ${this.round} ---`);
        this.currentPlayerIndex = (this.round -1) % this.playerCount;
        const aboutToStartPlayer = this.getPlayer(this.currentPlayerIndex);
        this.gamePhase = 'playerTurn';
        this.populateImperiumRow();
        this.log(`Player ${aboutToStartPlayer.name}'s turn (Round ${this.round}).`);
        this.nextTurn();
    }
  }

  calculateEndgameVPs() {
    this.log("--- Calculating Endgame VPs from Intrigue Cards ---");
    this.players.forEach(player => {
        player.playedIntrigueCards.forEach(card => {
            if (card.intrigueType === "Endgame" && card.effect && card.effect.endgameVP) {
                const condition = card.effect.endgameVP.condition;
                const vpValue = card.effect.endgameVP.value;
                let conditionMet = false;

                if (condition === "most_spice") {
                    let maxSpice = -1;
                    let playersWithMaxSpice = [];
                    this.players.forEach(p => {
                        if (p.resources.spice > maxSpice) {
                            maxSpice = p.resources.spice;
                            playersWithMaxSpice = [p.id];
                        } else if (p.resources.spice === maxSpice) {
                            playersWithMaxSpice.push(p.id);
                        }
                    });
                    if (playersWithMaxSpice.length === 1 && playersWithMaxSpice[0] === player.id && maxSpice > 0) {
                        conditionMet = true;
                    }
                } else if (condition === "two_alliances") {
                    let allianceCount = 0;
                    for (const faction in player.factionAlliances) {
                        if (player.factionAlliances[faction]) {
                            allianceCount++;
                        }
                    }
                    if (allianceCount >= 2) {
                        conditionMet = true;
                    }
                }
                // Add more endgame conditions here

                if (conditionMet) {
                    this.log(`Player ${player.name} gains ${vpValue} VP from Endgame card: ${card.name}.`);
                    player.victoryPoints += vpValue;
                    // No need to call checkVictoryConditions here as it's final scoring.
                }
            }
        });
    });
  }

  checkVictoryConditions(playerId) { // Should only trigger game end, not calculate endgame VPs
    const player = this.getPlayer(playerId);
    if (player && player.victoryPoints >= 10 && this.gamePhase !== 'gameOver') {
      this.endGame(playerId); // Normal victory
      return true;
    }
    // Check for end of game by conflict deck running out AFTER the current conflict and subsequent phases resolve
    if (this.round > 10 && this.revealedConflict === null && this.decks.conflict.length === 0 && this.gamePhase !== 'gameOver') {
         if (this.gamePhase === 'recall') { // Only trigger actual game end sequence after recall
            this.log("Final conflict card resolved and conflict deck empty. Game truly ends now.");
            this.endGame(null); // Pass null to indicate game ends by condition, not specific player hitting VP threshold during turn.
            return true;
         } else if (this.gamePhase !== 'setup') { // Log during combat/maker that end is imminent
             this.log("Final conflict card resolved and conflict deck empty. Game will end after this round's Recall phase.");
         }
    }
    return false;
  }

  endGame(winnerId) { // winnerId can be null if game ends by condition
    if (this.gamePhase === 'gameOver') return; // Prevent multiple endGame calls

    this.log("--- Attempting to End Game ---");
    this.calculateEndgameVPs(); // Calculate VPs from played Endgame Intrigue cards

    this.gamePhase = 'gameOver'; // Set phase before finding winner by score

    if (winnerId !== null) { // A player reached 10 VP during their turn or from an immediate effect
        const directWinner = this.getPlayer(winnerId);
         this.log(`Player ${directWinner.name} reached 10+ VP, triggering game end. Final scores after endgame intrigues:`);
    } else {
        this.log("Game ends due to condition (e.g., conflict deck empty). Final scores after endgame intrigues:");
    }

    // Determine final winner based on highest VP after endgame VPs
    let finalWinner = null;
    let maxVP = -1;
    this.players.forEach(p => {
        this.log(`Player ${p.name} final score: ${p.victoryPoints}`);
        if (p.victoryPoints > maxVP) {
            maxVP = p.victoryPoints;
            finalWinner = p;
        } else if (p.victoryPoints === maxVP) {
            // TODO: Implement tie-breaker logic (e.g. spice, solari, water, garrison troops)
            this.log(`Tie in VP between ${finalWinner.name} and ${p.name}. Tie-breaking needed.`);
            // For now, first player to reach this score in player order might win, or it's a shared victory.
            // Let's assume current finalWinner holds for simplicity if tie-breaking isn't implemented.
        }
    });

    if (finalWinner) {
        this.log(`--- Game Over ---`);
        this.log(`Player ${finalWinner.name} wins with ${finalWinner.victoryPoints} Victory Points!`);
    } else {
        this.log(`--- Game Over ---`);
        this.log("Game ended. No single winner by VP or tie-breaker rule not fully implemented.");
    }
  }

  shuffleDeck(deck) {
    this.shuffle(deck);
  }

  getPlayer(playerId) {
    return this.players.find(p => p.id === playerId);
  }

  getLocation(locationId) {
    return this.boardLocations[locationId];
  }

  applyControlBonus() { /* Placeholder */ }
  stealIntrigueFromRichPlayers(thiefPlayerId, victimChoiceCriteria) { /* Placeholder */ }
  acquireReserveCard(playerId, cardId) { /* Placeholder */ }
}

// Export the class for use in other modules (if using Node.js or similar)
// module.exports = DuneImperiumGame;
-
-// Example usage (for testing or integration)
-/*
-const game = new DuneImperiumGame(2); // Create a game for 2 players
-// console.log(game.players[0]);
-// console.log(game.players[1]);
-// console.log(game.boardLocations);
-// console.log(game.decks.imperium.slice(0,5));
-// console.log(game.imperiumRow);
-// console.log(game.revealedConflict);
-
-// Simulate some actions
-if (game.gamePhase === 'playerTurn' && game.currentPlayerIndex === 0) {
-    const player0 = game.players[0];
-    const cardToPlay = player0.hand.find(c => c.type === "Agent"); // Find first agent card
-    if (cardToPlay) {
-        // Try to play to Arrakeen (example)
-        game.placeAgent(0, cardToPlay.id, 'arrakeen');
-        console.log(player0.resources, player0.agents);
-        console.log(game.boardLocations.arrakeen.agents);
-    }
-    // Player 0 reveals turn (assuming played all agents or passed)
-    player0.agents = 0; // Simulate agents used
-    const cardsForReveal = player0.hand.slice(0, player0.hand.length); // Reveal all remaining cards
-    game.revealTurn(0, cardsForReveal.map(c=>c.id));
-    console.log(`Player 0 persuasion: ${player0.persuasionForTurn}, swords: ${player0.swordsForTurn}`);
-
-    // Player 0 purchases a card
-    if(game.imperiumRow.length > 0 && player0.persuasionForTurn >= game.imperiumRow[0].cost) {
-      game.purchaseCard(0, game.imperiumRow[0].id);
-    }
-    // Player 0 commits troops
-    player0.garrison.count = 5; // Give some troops
-    game.commitTroopsToCombat(0, 3);
-
-    game.endPlayerTurnActions(); // Move to next player or phase
-}
-
-
-if (game.gamePhase === 'playerTurn' && game.currentPlayerIndex === 1) {
-    const player1 = game.players[1];
-    const cardToPlayP1 = player1.hand.find(c => c.type === "Agent");
-    if (cardToPlayP1) {
-        game.placeAgent(1, cardToPlayP1.id, 'carthag'); // P1 plays to Carthag
-    }
-    player1.agents = 0; // Simulate agents used
-    const cardsForRevealP1 = player1.hand.slice(0, player1.hand.length);
-    game.revealTurn(1, cardsForRevealP1.map(c=>c.id));
-    player1.garrison.count = 2;
-    game.commitTroopsToCombat(1, 2);
-    game.endPlayerTurnActions(); // This should trigger combat
-}
-
-// console.log(game.players[0].victoryPoints);
-// console.log(game.players[1].victoryPoints);
-// console.log(game.round);
-// console.log(game.gamePhase);
-// console.log(game.players[0].hand);
-*/
