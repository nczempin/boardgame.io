// src/games/dune-imperium/game.js

// Represents the main game state and logic for Dune: Imperium.

class DuneImperiumGame {
  constructor(playerCount) {
    this.playerCount = playerCount;
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
        agents: 2,
        resources: { spice: 1, solari: 0, water: 1, persuasion: 0, swords: 0 }, // Add persuasion & swords for reveal phase
        hand: [],
        discardPile: [],
        deck: this.getStartingDeck(),
        playedCards: [], // Cards played for Agent turn
        revealedCards: [], // Cards played for Reveal turn effects
        intrigueCards: [], // Separate hand for intrigue cards
        influence: {}, // { fremen: 0, beneGesserit: 0, ... }
        factionAlliances: {}, // { fremen: false, ... } tracks if they have an alliance token
        garrison: { count: 3 }, // Start with some troops in garrison
        activeCombatUnits: 0,
        victoryPoints: 0,
        hasPassedReveal: false, // Flag for reveal phase completion
      };
      factions.forEach(faction => {
        player.influence[faction] = 0;
        player.factionAlliances[faction] = false;
      });
      this.players.push(player);
    }
  }

  getStartingDeck() {
    // Placeholder for starting deck cards with agentIcons
    const startingCards = [
      { id: "start_001", name: "Signet Ring", type: "Agent", agentIcons: ["Loyalty"], effect: "Use leader ability", persuasion: 0, swords: 0, guildSeal: true }, // Guild Seal for Heighliner
      { id: "start_002", name: "Conviction", type: "Agent", agentIcons: ["Bene Gesserit"], effect: "Gain 1 spice", persuasion: 1, swords: 0 },
      { id: "start_003", name: "Dune, The Desert Planet", type: "Agent", agentIcons: ["Fremen"], effect: "Gain 1 water", persuasion: 1, swords: 0 },
      { id: "start_004", name: "Diplomacy", type: "Agent", agentIcons: ["Emperor"], effect: "Gain 2 Solari", persuasion: 0, swords: 0 },
      { id: "start_005", name: "Seek Allies", type: "Agent", agentIcons: ["Spacing Guild"], effect: "Gain 1 influence with any faction", persuasion: 0, swords: 0 },
      { id: "start_006", name: "Reconnaissance", type: "Agent", agentIcons: ["Wealth"], effect: "Draw 1 card", persuasion: 0, swords: 0 }, // CHOAM/Wealth icon
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
    // Example card structure: { id, name, type, cost, agentEffect, revealEffect, factionIcon, persuasion, swords, vp }
    this.decks.intrigue = [ /* ... detailed intrigue cards ... */ ];
    this.decks.conflict = [ /* ... detailed conflict cards ... */ ];
    this.decks.imperium = [ /* ... detailed imperium cards ... */ ];

    this.shuffle(this.decks.intrigue);
    this.shuffle(this.decks.conflict);
    this.shuffle(this.decks.imperium);
    this.log("Decks initialized and shuffled.");
  }

  revealInitialConflictCard() {
    if (this.decks.conflict.length > 0) {
      this.revealedConflict = this.decks.conflict.shift(); // Use shift to take from top after shuffle
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

    if (toConflict) {
        player.activeCombatUnits += count;
        if (!this.conflictParticipants.includes(playerId)) {
            this.conflictParticipants.push(playerId);
        }
        this.log(`Player ${player.name} deployed ${count} troops directly to conflict. Total in conflict: ${player.activeCombatUnits}`);
    } else {
        player.garrison.count += count;
        this.log(`Player ${player.name} recruited ${count} troops to garrison. Total in garrison: ${player.garrison.count}`);
    }
  }

  // --- Card Effects Execution ---
  executeSpaceEffects(playerId, locationId, cardPlayed) {
    const player = this.getPlayer(playerId);
    const location = this.boardLocations[locationId];
    if (!player || !location) return false;

    this.log(`Player ${player.name} executing effects for ${location.name} with card ${cardPlayed.name}.`);

    // Location's defined effect
    if (location.effect) {
        const success = location.effect(playerId, cardPlayed); // Pass cardPlayed for context (e.g. Heighliner Guild Seal)
        if (success === false) return false; // e.g. Heighliner not enough spice
    }

    // Card's agent box effect (if applicable, needs card data structure)
    if (cardPlayed && cardPlayed.agentEffect) {
        // This needs a parser for card effects. Example:
        // if (cardPlayed.agentEffect.gainSpice) player.resources.spice += cardPlayed.agentEffect.gainSpice;
        // if (cardPlayed.agentEffect.drawCards) this.drawCards(playerId, cardPlayed.agentEffect.drawCards);
        this.log(`Card ${cardPlayed.name} agent effect: ${cardPlayed.effect}`); // Placeholder
    }
    return true;
  }

  executeCardRevealEffects(playerId, revealedCardObjects) {
    const player = this.getPlayer(playerId);
    if (!player) return;

    player.resources.persuasion = 0; // Reset for the turn
    player.resources.swords = 0;    // Reset for the turn

    this.log(`Player ${player.name} revealing cards: ${revealedCardObjects.map(c=>c.name).join(', ')}`);
    revealedCardObjects.forEach(card => {
        if (card.persuasion) player.resources.persuasion += card.persuasion;
        if (card.swords) player.resources.swords += card.swords;
        // TODO: Implement other specific reveal effects from cards (e.g., gain spice, draw card, trash)
        // Example: if(card.revealEffect && card.revealEffect.gainSpice) player.resources.spice += card.revealEffect.gainSpice;
        this.log(`Card ${card.name} provides ${card.persuasion || 0} persuasion, ${card.swords || 0} swords. Effect: ${card.effect}`);
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

    // this.endPlayerTurnActions(); // Or player can take more actions if they have agents
    return true;
  }

  // Player plays an intrigue card
  playIntrigueCard(playerId, cardId) {
    if (playerId !== this.currentPlayerIndex) {
        // Allow playing out of turn if card permits (e.g. combat intrigue)
        // For now, we assume the core game logic handles this, but a check might be good.
        // this.log("Warning: Player playing intrigue card out of turn.");
    }
    const player = this.getPlayer(playerId);
    const cardIndex = player.intrigueCards.findIndex(c => c.id === cardId);
    if (!player || cardIndex === -1) {
        this.log(`Error: Player ${player.name} does not have intrigue card ${cardId}.`);
        return false;
    }

    const card = player.intrigueCards.splice(cardIndex, 1)[0];
    this.log(`Player ${player.name} plays intrigue card: ${card.name}. Effect: ${card.effectText}`);

    // TODO: Implement detailed intrigue card effect execution logic
    // e.g., this.executeIntrigueEffect(playerId, card);
    if (card.vp) { player.victoryPoints += card.vp; this.checkVictoryConditions(playerId); }
    if (card.effectText.includes("Gain 1 Spice")) this.gainResources(playerId, {spice: 1}); // Simplified
    return true;
  }

  // Player reveals cards for persuasion, swords, etc. (Reveal Turn)
  revealTurn(playerId, cardIdsToPlay) {
    if (playerId !== this.currentPlayerIndex) {
        console.error("Not your turn!");
        return false;
    }
    const player = this.getPlayer(playerId);
    if (this.gamePhase !== 'playerTurn' || player.agents > 0 || player.hasPassedReveal) {
        this.log("Error: Cannot take reveal turn. (Not player turn, agents > 0, or already revealed).");
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
    // Player can now purchase and commit troops. Player must call endPlayerTurnActions to finalize.
    return true;
  }


  // Player purchases a card from the Imperium Row
  purchaseCard(playerId, cardId) {
    if (playerId !== this.currentPlayerIndex) {
      this.log("Error: Not your turn to purchase!");
      return false;
    }
    const player = this.getPlayer(playerId);
    if (player.agents > 0 || player.hasPassedReveal) {
        this.log("Error: Can only purchase during reveal phase after playing agents and before passing.");
        return false;
    }

    const cardIndex = this.imperiumRow.findIndex(c => c.id === cardId);
    if (cardIndex === -1) {
      this.log(`Error: Card ${cardId} not found in Imperium Row.`);
      return false;
    }
    const card = this.imperiumRow[cardIndex];
    if (!this.spendResources(playerId, { persuasion: card.cost })) {
      this.log(`Error: Player ${player.name} cannot afford ${card.name}. Needs ${card.cost} persuasion, has ${player.resources.persuasion}.`);
      return false;
    }

    player.discardPile.push(card); // Purchased card goes to discard pile
    this.imperiumRow.splice(cardIndex, 1); // Remove from Imperium Row
    this.populateImperiumRow(); // Refill Imperium Row

    this.log(`Player ${player.name} purchased ${card.name}.`);
    return true;
  }

  // Player commits troops to combat
  commitTroopsToCombat(playerId, numberOfTroops) {
    const player = this.getPlayer(playerId);
    if (!player) return false;
    if (numberOfTroops < 0 || numberOfTroops > player.garrison.count) {
        this.log(`Error: Invalid number of troops (${numberOfTroops}) for player ${player.name}. Garrison: ${player.garrison.count}`);
        return false;
    }

    player.garrison.count -= numberOfTroops;
    player.activeCombatUnits += numberOfTroops;
    if (numberOfTroops > 0 && !this.conflictParticipants.includes(playerId)) { // Only add if they commit > 0
        this.conflictParticipants.push(playerId);
    }
    this.log(`Player ${player.name} committed ${numberOfTroops} to the conflict. Total active: ${player.activeCombatUnits}`);
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
    // Players gain spice from spice-producing locations they control (e.g., Arrakeen, Carthag if occupied by their agent)
    // This is where `applyControlBonus` might come in for spice production.
    this.players.forEach(player => {
        Object.values(this.boardLocations).forEach(loc => {
            if (loc.agents.includes(player.id)) {
                // Example: Arrakeen and certain other Fremen locations might produce spice in Maker phase.
                // This needs to be explicitly defined in boardLocation data or a separate rule.
                // e.g. if(loc.producesSpiceInMakerPhase) player.resources.spice += loc.producesSpiceInMakerPhase;
            }
        });
    });

    this.proceedToRecallPhase();
  }

  proceedToRecallPhase() {
    this.gamePhase = 'recall';
    this.log("--- Recall Phase ---");
    // Retrieve all agents
    this.players.forEach(player => {
        player.agents = 2; // Reset agents for next round
        player.hasPassedReveal = false; // Reset for next round's reveal phase
        // Move played cards to discard pile
        player.discardPile.push(...player.playedCards);
        player.playedCards = [];
        player.discardPile.push(...player.revealedCards);
        player.revealedCards = [];
        // Draw back up to 5 cards
        const cardsToDraw = 5 - player.hand.length;
        if (cardsToDraw > 0) {
            this.drawCards(player.id, cardsToDraw, 'deck');
        }
    });
    // Clear agents from board locations
    Object.values(this.boardLocations).forEach(loc => loc.agents = []);

    // Apply end-of-round control bonuses (e.g. VP for controlling Arrakeen/Carthag if that's a rule)
    // this.applyControlBonus(); Example call

    // Check for game end conditions again (e.g. after VP from intrigue or conflict)
    if (this.gamePhase !== 'gameOver') {
        this.round++;
        this.log(`--- End of Round ${this.round -1}. Starting Round ${this.round} ---`);
        this.currentPlayerIndex = (this.round -1) % this.playerCount; // Simple first player rotation
        this.gamePhase = 'playerTurn';
        this.populateImperiumRow(); // Refresh if any slots are empty and deck has cards
        console.log(`Player ${this.players[this.currentPlayerIndex].name}'s turn.`);
    }
  }


  // --- Victory Points and End Game ---
  checkVictoryConditions(playerId) {
    const player = this.getPlayer(playerId);
    if (player && player.victoryPoints >= 10) { // Standard VP threshold is 10
      this.endGame(playerId);
      return true;
    }
    // Additional end game condition: Conflict deck runs out (after current conflict resolves)
    if (this.revealedConflict === null && this.decks.conflict.length === 0 && (this.gamePhase === 'combat' || this.gamePhase === 'maker')) {
        console.log("Final conflict resolved and conflict deck is empty. Game ends after this round finishes.");
        // The game should proceed through recall, then end.
        // This logic might need adjustment to ensure it triggers at the right point (e.g. after Recall).
    }

    return false;
  }

  endGame(winnerId) {
    this.gamePhase = 'gameOver';
    const winner = this.getPlayer(winnerId);
    this.log(`--- Game Over ---`);
    if (winner) {
        this.log(`Player ${winner.name} wins with ${winner.victoryPoints} Victory Points!`);
    } else {
        // Handle game end by other conditions (e.g. conflict deck empty, determine winner by tiebreakers)
        this.log("Game ended. Determine winner by tiebreakers if necessary.");
        // TODO: Implement tie-breaking logic if needed.
    }
    // TODO: Display final scores, etc.
  }

  // --- Utility functions ---
  shuffleDeck(deck) {
    this.shuffle(deck); // Use the generalized shuffle
  }

  // Helper to get player by ID
  getPlayer(playerId) {
    return this.players.find(p => p.id === playerId);
  }

  // Helper to get location by ID
  getLocation(locationId) {
    return this.boardLocations[locationId];
  }

+  // Placeholder for other helpers mentioned if they become relevant
+  applyControlBonus() { /* e.g. VP for controlling Arrakeen/Carthag at round end */ }
+  stealIntrigueFromRichPlayers(thiefPlayerId, victimChoiceCriteria) { /* Complex logic */ }
+  acquireReserveCard(playerId, cardId) { /* Logic for special acquisition */ }
+
+  // Example of a more complex card effect that might be on a card
+  // beneGesseritPower(playerId, targetPlayerId, cardToGuess) {
+  //   // BG player guesses a card in target's hand. If correct, target discards it, BG player gains resources.
+  // }
+
 }

 // Export the class for use in other modules (if using Node.js or similar)
 // module.exports = DuneImperiumGame; // Uncomment if using CommonJS modules
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
