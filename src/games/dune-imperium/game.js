// src/games/dune-imperium/game.js
import { LEADERS, getBasicLeaderIds, getLeaderData } from './leaders.js';
import { getAllImperiumCards, getAllIntrigueCards, FOLDSPACE_CARD_DEF } from './cards.js';

class DuneImperiumGame {
  constructor(playerCount) {
    this.playerCount = playerCount;
    if (playerCount > getBasicLeaderIds().length && playerCount > 0 && Object.keys(LEADERS).length < playerCount) {
        console.warn("Warning: Not enough unique leaders for all players. Leaders might be reused.");
    }
    this.players = [];
    this.boardLocations = {};
    this.decks = {
      intrigue: [],
      conflict: [],
      imperium: [],
      revealedConflict: null,
    };
    this.gamePhase = 'setup';
    this.currentPlayerIndex = 0;
    this.round = 1;
    this.conflictParticipants = [];
    this.imperiumRow = [];
    this.allianceTokens = {
        fremen: null,
        beneGesserit: null,
        spacingGuild: null,
        emperor: null,
    };
    this.logs = [];
    this.maxRounds = 10; // Example max rounds
    this.tempRevealedHand = null; // For Poison Snooper like effects
    this.setupGame();
  }

  log(message) {
    console.log(message);
    this.logs.unshift(message); // Add to beginning for recent first
    if (this.logs.length > 50) {
        this.logs.pop();
    }
  }

  setupGame() {
    this.initializePlayers();
    this.initializeBoardLocations();
    this.initializeDecks();
    this.dealInitialHands();
    this.revealInitialConflictCard();
    this.populateImperiumRow();

    this.log("Game setup complete.");

    const firstPlayer = this.getPlayer(this.currentPlayerIndex);
    if (firstPlayer && firstPlayer.leader.id === LEADERS.baronVladimirHarkonnen.id) {
        if (firstPlayer.isAI) { // Assuming isAI flag on player object
            const factionsToInfluence = this.aiChooseBaronInitialFactions(firstPlayer.id);
            this.applyBaronInitialInfluence(firstPlayer.id, factionsToInfluence);
            this.gamePhase = 'playerTurn';
            this.log(`Starting Player ${this.getPlayer(this.currentPlayerIndex).name}'s turn.`);
            this.handlePaulPrescienceAtTurnStart(this.currentPlayerIndex);
        } else {
            firstPlayer.pendingDecision = {
                type: 'baronInitialInfluence',
                data: {
                    cardId: "baron_harkonnen_ability", // Internal ID for this decision
                    cardName: "Baron Harkonnen - Initial Influence",
                    count: 2,
                    choicesMade: [],
                    validFactions: ["fremen", "beneGesserit", "spacingGuild", "emperor"]
                }
            };
            this.log(`Player ${firstPlayer.name} (Baron Harkonnen) needs to choose 2 factions for initial influence.`);
            this.gamePhase = 'playerTurn';
        }
    } else if (firstPlayer) {
        this.gamePhase = 'playerTurn';
        this.log(`Starting Player ${firstPlayer.name}'s turn.`);
        this.handlePaulPrescienceAtTurnStart(firstPlayer.id);
    }
  }

  initializePlayers() {
    const factions = ["spacingGuild", "beneGesserit", "fremen", "emperor"];
    const leaderIds = this.shuffle([...getBasicLeaderIds()]);

    for (let i = 0; i < this.playerCount; i++) {
      const player = {
        id: i,
        name: `Player ${i + 1}`,
        leader: null,
        agents: 2,
        resources: { spice: 0, solari: 5, water: 1, persuasion: 0, swords: 0, temporaryPersuasion: 0 },
        hand: [],
        discardPile: [],
        deck: this.getStartingDeck(),
        playedCards: [],
        playedAgentCardThisTurn: null,
        revealedCards: [],
        intrigueCards: [],
        playedIntrigueCards: [],
        influence: {},
        factionAlliances: {},
        garrison: { count: 3 },
        activeCombatUnits: 0,
        victoryPoints: 1,
        hasPassedReveal: false,
        paulSignetActive: false,
        paulTopCardInfo: null,
        skipRecallAgentId: null,
        pendingDecision: null,
        isAI: false,
        helenaSignetPersuasion: 0,
        helenaSpecialPersuasionUsedThisTurn: false,
      };
      factions.forEach(faction => player.influence[faction] = 0);
      factions.forEach(faction => player.factionAlliances[faction] = false);

      const leaderId = leaderIds[i % leaderIds.length];
      player.leader = JSON.parse(JSON.stringify(LEADERS[leaderId]));
      this.log(`Player ${player.name} is ${player.leader.name}`);

      if (player.leader.id === LEADERS.glossuRabban.id) {
          player.resources.spice += 2;
          player.resources.solari += 2;
          this.log(`Glossu Rabban (Player ${player.name}) starts with +2 Spice and +2 Solari.`);
      }
      this.players.push(player);
    }
  }

  getStartingDeck() {
    const SIGNET_RING_ID = "start_001_signet_ring";
    const startingCards = [
      { id: SIGNET_RING_ID, name: "Signet Ring", type: "Agent", agentIcons: ["Loyalty"], effectText: "Use leader Signet ability.", persuasion: 0, swords: 0, guildSeal: true, vp: 1 },
      { id: "start_002", name: "Conviction", type: "Agent", agentIcons: ["Bene Gesserit"], effectText: "Gain 1 spice.", persuasion: 1, swords: 0 },
      { id: "start_003", name: "Dune, The Desert Planet", type: "Agent", agentIcons: ["Fremen"], effectText: "Gain 1 water.", persuasion: 1, swords: 0 },
      { id: "start_004", name: "Diplomacy", type: "Agent", agentIcons: ["Emperor"], effectText: "Gain 2 Solari.", persuasion: 0, swords: 0 },
      { id: "start_005", name: "Seek Allies", type: "Agent", agentIcons: ["Spacing Guild"], effectText: "Gain 1 influence with any faction.", persuasion: 0, swords: 0 },
      { id: "start_006", name: "Reconnaissance", type: "Agent", agentIcons: ["Wealth"], effectText: "Draw 1 card.", persuasion: 0, swords: 0 },
      { id: "start_007", name: "Arrakis Liaison", type: "Agent", agentIcons: ["Fremen", "Military"], effectText: "Deploy 1 troop.", persuasion: 0, swords: 1, tags: ["Fremen"] },
      { id: "start_008", name: "Bene Gesserit Initiate", type: "Agent", agentIcons: ["Bene Gesserit", "Any"], effectText: "Trash a card from hand or discard, then draw 1.", persuasion: 0, swords: 0 },
      { id: "start_009", name: "Imperial Spy", type: "Agent", agentIcons: ["Emperor", "Intrigue"], effectText: "Draw 1 intrigue card.", persuasion: 0, swords: 0 },
      { id: "start_010", name: "Guild Ambassador", type: "Agent", agentIcons: ["Spacing Guild", "Any"], effectText: "Gain 1 Solari or 1 Spice.", persuasion: 0, swords: 0 },
    ];
    const deck = JSON.parse(JSON.stringify(startingCards));
    this.shuffleDeck(deck);
    return deck;
  }

  dealInitialHands() {
    this.players.forEach(player => {
      this.drawCards(player.id, 5, 'deck');
    });
  }

  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  shuffleDeck(deckOrDeckName) {
    if (typeof deckOrDeckName === 'string') {
        if (this.decks[deckOrDeckName]) {
            this.shuffle(this.decks[deckOrDeckName]);
        } else {
            this.log(`Error: Deck ${deckOrDeckName} not found for shuffling.`);
        }
    } else if (Array.isArray(deckOrDeckName)) {
        this.shuffle(deckOrDeckName);
    } else {
        this.log(`Error: Invalid argument for shuffleDeck.`);
    }
  }

  drawCards(playerId, numberOfCards, type = 'deck') {
    const player = this.getPlayer(playerId);
    if (!player) return [];
    const drawnCards = [];
    if (type === 'deck') {
        for (let i = 0; i < numberOfCards; i++) {
            if (player.deck.length === 0) {
                if (player.discardPile.length === 0) {
                    this.log(`Player ${player.name} has no cards left to draw or reshuffle.`);
                    break;
                }
                player.deck = [...player.discardPile];
                player.discardPile = [];
                this.shuffle(player.deck);
                this.log(`Player ${player.name} reshuffled their discard pile into their deck.`);
            }
            if (player.deck.length > 0) {
                 const card = player.deck.pop();
                 player.hand.push(card);
                 drawnCards.push(card);
                 if (player.leader.id === LEADERS.paulAtreides.id && player.paulTopCardInfo && player.paulTopCardInfo.id === card.id) {
                     player.paulTopCardInfo = null;
                 }
            }
        }
    } else if (type === 'intrigue') {
        this.drawIntrigueCards(playerId, numberOfCards);
    }
    return drawnCards;
  }

  drawIntrigueCards(playerId, numberOfCards) {
    const player = this.getPlayer(playerId);
    if (!player) return;
    for (let i = 0; i < numberOfCards; i++) {
      if (this.decks.intrigue.length === 0) {
        this.log("Intrigue deck is empty.");
        break;
      }
      const card = this.decks.intrigue.pop();
      player.intrigueCards.push(card);
      this.log(`Player ${player.name} drew intrigue card: ${card.name}`);
    }
  }

  initializeBoardLocations() {
    this.boardLocations = {
      arrakeen: { name: "Arrakeen", faction: "Fremen", agentSlots: 1, agents: [], isPopulated: true, effectText: "Gain 2 Spice, +1 Fremen Influence.", effect: (pId) => { this.gainResources(pId, {spice:2}); this.gainInfluence(pId, "fremen", 1); }},
      carthag: { name: "Carthag", faction: "Fremen", agentSlots: 1, agents: [], isPopulated: true, isCombatZone: true, effectText: "+1 Fremen Influence. May deploy troops.", effect: (pId) => { this.gainInfluence(pId, "fremen", 1); }},
      sietchTabr: { name: "Sietch Tabr", faction: "Fremen", agentSlots: 1, agents: [], requiresWater: true, effectText: "Gain 1 Water, 1 Troop to garrison, +2 Fremen Influence.", effect: (pId) => { this.gainResources(pId, {water:1}); this.recruitTroops(pId,1,false); this.gainInfluence(pId, "fremen", 2); }},
      imperialBasin: { name: "Imperial Basin", faction: "Neutral", agentSlots: 1, agents: [], isDesert: true, effectText: "Gain 1 Spice.", effect: (pId) => { this.gainResources(pId, {spice:1}); }},
      haggaBasin: { name: "Hagga Basin", faction: "Neutral", agentSlots: 1, agents: [], isDesert: true, effectText: "Gain 2 Spice if you pay 1 Water.", effect: (pId) => { if(this.spendResources(pId, {water:1})) {this.gainResources(pId, {spice:2});} else { this.log("Hagga Basin: No water paid, no spice gained."); return false;}}},
      heighliner: { name: "Heighliner", faction: "Spacing Guild", agentSlots: 1, agents: [], cost: 6,
        effectText: "Pay 6 Spice (or 0 if Guild Seal): Deploy 5 troops to conflict, gain 3 Solari, +1 Guild Influence.",
        effect: (pId, cardPlayed) => {
            this.recruitTroops(pId, 5, true);
            this.gainResources(pId, {solari:3});
            this.gainInfluence(pId, "spacingGuild", 1);
            return true;
      }},
      foldspace: {
        name: "Foldspace", faction: "Spacing Guild", agentSlots: 1, agents: [], requiredIcons: ["Spacing Guild"],
        effectText: "Gain 1 Foldspace card. Gain 1 Spacing Guild influence.",
        effect: (pId) => {
            const player = this.getPlayer(pId);
            const foldspaceCardCopy = JSON.parse(JSON.stringify(FOLDSPACE_CARD_DEF));
            player.discardPile.push(foldspaceCardCopy);
            this.log(`Player ${player.name} gains a ${FOLDSPACE_CARD_DEF.name} card.`);
            this.gainInfluence(pId, "spacingGuild", 1);
        }
      },
      beneGesseritInitiation: { name: "Bene Gesserit Initiation", faction: "Bene Gesserit", agentSlots: 1, agents: [], effectText: "Draw 1 Intrigue card, +1 BG Influence.", effect: (pId) => { this.drawIntrigueCards(pId, 1); this.gainInfluence(pId, "beneGesserit", 1); }},
      emperorRiches: { name: "Emperor Riches", faction: "Emperor", agentSlots: 1, agents: [], effectText: "Gain 2 Solari, +1 Emperor Influence.", effect: (pId) => { this.gainResources(pId, {solari:2}); this.gainInfluence(pId, "emperor", 1); }},
      choamCombine: { name: "CHOAM Combine", faction: "CHOAM", agentSlots: 1, agents: [], effectText: "Gain 3 Spice.", effect: (pId) => { this.gainResources(pId, {spice:3}); }},
      landsraadCouncil: { name: "Landsraad Council", faction: "Landsraad", agentSlots: 2, agents: [], cost: 0, effectText: "Gain 2 Solari, take First Player token, +1 Landsraad Influence (placeholder).", effect: (pId) => { this.gainResources(pId, {solari:2}); this.log("Took first player token (placeholder).");  }},
      swordMaster: { name: "Sword Master", faction: "Landsraad", agentSlots: 1, cost: 8, effectText: "Pay 8 Solari: Recruit 3 troops to garrison, gain Swordmaster.", effect: (pId) => { this.recruitTroops(pId, 3, false); this.log("Gained Swordmaster (placeholder)."); }},
      mentat: { name: "Mentat", faction: "Neutral", agentSlots: 1, cost: 2, effectText: "Pay 2 Solari: Draw 1 card, take Mentat token.", effect: (pId, cardPlayed, agentDecisionData={}) => { this.drawCards(pId, 1); agentDecisionData.tookMentatToken = true; this.log(`${this.getPlayer(pId).name} uses Mentat, draws 1 card, takes Mentat token.`);}}
    };
     if(this.boardLocations.sietchTabr) this.boardLocations.sietchTabr.isDesert = true;
  }

  initializeDecks() {
    this.decks.intrigue = JSON.parse(JSON.stringify(getAllIntrigueCards()));
    this.decks.conflict = [
      { id: "conflict_I_001", name: "Skirmish for Spice", type: "Conflict", level: 1, rewards: [{rank: 1, spice: 2, vp: 1}, {rank: 2, spice: 1}]},
      { id: "conflict_II_001", name: "Battle for Arrakis", type: "Conflict", level: 2, rewards: [{rank: 1, spice: 5, vp: 2}, {rank: 2, spice: 2, vp: 1}, {rank:3, water: 1}]},
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
        this.imperiumRow.push(this.decks.imperium.shift());
      } else {
        break;
      }
    }
    this.log(`Imperium Row populated. Contains ${this.imperiumRow.length} cards.`);
  }

  gainResources(playerId, resourcesToGain) {
    const player = this.getPlayer(playerId);
    if (!player) return;
    for (const resource in resourcesToGain) {
        if (player.resources.hasOwnProperty(resource)) {
            player.resources[resource] += resourcesToGain[resource];
            this.log(`Player ${player.name} gained ${resourcesToGain[resource]} ${resource}. Total: ${player.resources[resource]}`);
        } else if (resource === 'vp') {
            player.victoryPoints += resourcesToGain[resource];
            this.log(`Player ${player.name} gained ${resourcesToGain[resource]} VP. Total: ${player.victoryPoints}`);
            this.checkVictoryConditions(playerId);
        }
    }
  }

  spendResources(playerId, resourcesToSpend) {
    const player = this.getPlayer(playerId);
    if (!player) return false;
    if (!this.canPlayerAfford(playerId, resourcesToSpend)) return false;

    for (const resource in resourcesToSpend) {
        player.resources[resource] -= resourcesToSpend[resource];
        this.log(`Player ${player.name} spent ${resourcesToSpend[resource]} ${resource}. Remaining: ${player.resources[resource]}`);
    }
    return true;
  }

  canPlayerAfford(playerId, cost) {
    const player = this.getPlayer(playerId);
    if (!player || !cost) return true;
    for (const resource in cost) {
        if (!player.resources.hasOwnProperty(resource) || player.resources[resource] < cost[resource]) {
            this.log(`Player ${player.name} cannot afford ${cost[resource]} ${resource}. Has ${player.resources[resource] || 0}`);
            return false;
        }
    }
    return true;
  }

  gainInfluence(playerId, faction, amount) {
    const player = this.getPlayer(playerId);
    if (!player || !player.influence.hasOwnProperty(faction)) return;

    const oldInfluence = player.influence[faction];
    player.influence[faction] += amount;
    if (player.influence[faction] < 0) player.influence[faction] = 0;
    const maxInfluence = 6;
    if (player.influence[faction] > maxInfluence) player.influence[faction] = maxInfluence;

    this.log(`Player ${player.name} ${amount > 0 ? 'gains' : 'loses'} ${Math.abs(amount)} influence with ${faction}. New total: ${player.influence[faction]}`);

    const vpThresholds = { 2: 1, 4: 1, 6:1 };
    for (const thresholdStr in vpThresholds) {
        const threshold = parseInt(thresholdStr);
        if (oldInfluence < threshold && player.influence[faction] >= threshold) {
            player.victoryPoints += vpThresholds[threshold];
            this.log(`Player ${player.name} gained ${vpThresholds[threshold]} VP for reaching ${threshold} influence with ${faction}. Total VP: ${player.victoryPoints}`);
            this.checkVictoryConditions(playerId);
        }
    }
    this.checkAllianceToken(faction);
  }

  checkAllianceToken(faction) {
    let bestPlayer = null;
    let maxInfluence = 1;

    this.players.forEach(p => {
        if (p.influence[faction] > maxInfluence) {
            maxInfluence = p.influence[faction];
            bestPlayer = p;
        } else if (p.influence[faction] === maxInfluence && bestPlayer !== null && p.id !== bestPlayer.id) {
            bestPlayer = -1;
        }
    });

    const currentHolderId = this.allianceTokens[faction];

    if (bestPlayer !== null && bestPlayer !== -1) {
        if (currentHolderId !== bestPlayer.id) {
            if (currentHolderId !== null) {
                const oldHolder = this.getPlayer(currentHolderId);
                if(oldHolder) {
                    oldHolder.factionAlliances[faction] = false;
                    oldHolder.victoryPoints--;
                    this.log(`Player ${oldHolder.name} lost alliance with ${faction} and 1 VP.`);
                }
            }
            this.allianceTokens[faction] = bestPlayer.id;
            bestPlayer.factionAlliances[faction] = true;
            bestPlayer.victoryPoints++;
            this.log(`Player ${bestPlayer.name} gained alliance with ${faction} and 1 VP. Total VP: ${bestPlayer.victoryPoints}`);
            this.checkVictoryConditions(bestPlayer.id);
        }
    } else if (currentHolderId !== null && (bestPlayer === -1 || (bestPlayer === null && maxInfluence < 2) || (bestPlayer && bestPlayer.id !== currentHolderId && bestPlayer.influence[faction] < maxInfluence ))) {
        const oldHolder = this.getPlayer(currentHolderId);
        if(oldHolder){
            oldHolder.factionAlliances[faction] = false;
            oldHolder.victoryPoints--;
            this.log(`Player ${oldHolder.name} lost alliance with ${faction} and 1 VP due to tie or insufficient influence.`);
            this.allianceTokens[faction] = null;
        }
    }
  }

  recruitTroops(playerId, count, toConflict = false) {
    const player = this.getPlayer(playerId);
    if (!player) return;
    const actualRecruitCount = Math.max(0, count);

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

    if (actualRecruitCount > 0) {
        this.players.forEach(p => {
            if (p.id !== playerId && p.leader && p.leader.id === LEADERS.glossuRabban.id) {
                this.gainResources(p.id, { solari: 1 });
                this.log(`Glossu Rabban (Player ${p.name}) gains 1 Solari due to Player ${playerId} gaining troops.`);
            }
        });
    }
  }

  executeSignetRingAbility(playerId) {
    const player = this.getPlayer(playerId);
    if (!player || !player.leader) return false;
    this.log(`Player ${player.name} uses ${player.leader.name}'s Signet Ring ability: "${player.leader.signetAbilityText}"`);

    const isAI = !!player.isAI;

    switch (player.leader.id) {
        case LEADERS.paulAtreides.id:
            this.drawCards(playerId, 1, 'deck');
            break;
        case LEADERS.glossuRabban.id:
            const hasAlliance = Object.values(player.factionAlliances).some(v => v === true);
            if (hasAlliance) {
                this.recruitTroops(playerId, 2, false);
            } else {
                this.log(`Glossu Rabban Signet: No alliance, no troops recruited.`);
            }
            break;
        case LEADERS.memnonThorvald.id:
            this.gainResources(playerId, { spice: 1 });
            break;
        case LEADERS.ilbanRichese.id:
            const lastCardPlayed = this.getPlayer(playerId).playedAgentCardThisTurn;
            if (lastCardPlayed && lastCardPlayed.tags && lastCardPlayed.tags.includes("Tech")) {
                 this.gainResources(playerId, { solari: 1 });
            } else {
                this.log(`Count Ilban Richese Signet: Last card played for agent turn (${lastCardPlayed?.name}) was not Tech.`);
            }
            break;
        case LEADERS.dukeLetoAtreides.id:
            const opponentsHigherVP = this.players.some(p => p.id !== playerId && p.victoryPoints > player.victoryPoints);
            if (opponentsHigherVP && player.resources.spice >= (LEADERS.dukeLetoAtreides.signetCost?.spice || 1) ) {
                if (isAI) {
                    this.spendResources(playerId, LEADERS.dukeLetoAtreides.signetCost);
                    const factions = ["fremen", "beneGesserit", "spacingGuild", "emperor"];
                    const chosenFaction = this.aiChooseFactionForInfluence(playerId, factions);
                    this.gainInfluence(playerId, chosenFaction, 1);
                    this.log(`AI Duke Leto Signet: Paid 1 Spice, gained 1 influence with ${chosenFaction}.`);
                } else {
                    player.pendingDecision = {
                        type: 'letoSignetChoice',
                        data: {
                            cardName: "Duke Leto Signet Ring",
                            cost: LEADERS.dukeLetoAtreides.signetCost,
                            validFactions: ["fremen", "beneGesserit", "spacingGuild", "emperor"],
                        }
                    };
                    this.log(`Duke Leto Signet: Player ${player.name} can pay 1 Spice for 1 influence. Pending decision.`);
                    return true;
                }
            } else {
                 this.log(`Duke Leto Signet: Conditions not met (no opponent higher VP or not enough Spice).`);
            }
            break;
        case LEADERS.baronVladimirHarkonnen.id:
            if (player.resources.solari >= (LEADERS.baronVladimirHarkonnen.signetCost?.solari || 1)) {
                if (isAI) {
                    this.spendResources(playerId, LEADERS.baronVladimirHarkonnen.signetCost);
                    this.drawIntrigueCards(playerId, 1);
                    this.log(`AI Baron Harkonnen Signet: Paid 1 Solari, drew 1 Intrigue card.`);
                } else {
                     player.pendingDecision = {
                        type: 'baronSignetChoice',
                        data: {
                             cardName: "Baron Harkonnen Signet Ring",
                             cost: LEADERS.baronVladimirHarkonnen.signetCost,
                        }
                    };
                    this.log(`Baron Harkonnen Signet: Player ${player.name} can pay 1 Solari for 1 Intrigue. Pending decision.`);
                    return true;
                }
            } else {
                this.log(`Baron Harkonnen Signet: Not enough Solari (1).`);
            }
            break;
        case LEADERS.helenaRichese.id:
            player.resources.temporaryPersuasion = (player.resources.temporaryPersuasion || 0) + LEADERS.helenaRichese.signetGrantsTemporaryPersuasion;
            player.helenaSpecialPersuasionUsedThisTurn = false;
            this.log(`Helena Richese Signet: Gained ${LEADERS.helenaRichese.signetGrantsTemporaryPersuasion} temporary Persuasion for one card this turn. Current temp Persuasion: ${player.resources.temporaryPersuasion}`);
            break;
        case LEADERS.arianaThorvald.id:
            this.gainResources(playerId, { water: 2 });
            break;
        default:
            this.log(`Unknown leader Signet ability for ${player.leader.name}. Card ID: ${player.leader.id}`);
            return false;
    }
    return true;
  }

  executeSpaceEffects(playerId, locationId, cardPlayed) {
    const player = this.getPlayer(playerId);
    const location = this.boardLocations[locationId];
    if (!player || !location) return false;

    this.log(`Player ${player.name} executing effects for ${location.name} with card ${cardPlayed.name}.`);

    if (cardPlayed.id === "start_001_signet_ring") {
        return this.executeSignetRingAbility(playerId);
    }

    if (location.effect) {
        const success = location.effect(playerId, cardPlayed, player.agentDecisionData);
        if (success === false) return false;
    }

    if (cardPlayed && cardPlayed.agentEffect) {
        const effect = cardPlayed.agentEffect;
        this.log(`Card ${cardPlayed.name} agent effect attempting: ${cardPlayed.agentEffectText}`);

        if (effect.resources) this.gainResources(playerId, effect.resources);
        if (effect.draw) this.drawCards(playerId, effect.draw, 'deck');
        if (effect.recruit && (!effect.optionalCost || effect.optionalCost.benefit?.recruit !== effect.recruit)) {
            this.recruitTroops(playerId, effect.recruit.count, effect.recruit.toConflict);
        }
        if (effect.deployFromGarrison && (!effect.optionalCost || effect.optionalCost.benefit?.deployFromGarrison !== effect.deployFromGarrison)) {
            const deployable = Math.min(player.garrison.count, effect.deployFromGarrison);
            if (deployable > 0) {
                player.garrison.count -= deployable;
                player.activeCombatUnits += deployable;
                 if (!this.conflictParticipants.includes(playerId)) this.conflictParticipants.push(playerId);
                this.log(`Player ${player.name} deployed ${deployable} from garrison to conflict via ${cardPlayed.name} (base effect).`);
            }
        }
        if (effect.gainInfluence) this.gainInfluence(playerId, effect.gainInfluence.faction, effect.gainInfluence.amount);
        if (effect.vp) this.gainResources(playerId, {vp: effect.vp}); // VP from agent effect

        if (effect.optionalCost) {
            const costDetails = effect.optionalCost.cost;
            const benefitDetails = effect.optionalCost.benefit;
            const isAI = !!player.isAI;
            const agentDecisionData = player.agentDecisionData || {};

            let decisionToAcceptOptionalCost = false;
            if (isAI) {
                if (agentDecisionData.hasOwnProperty('acceptOptionalCost')) {
                    decisionToAcceptOptionalCost = agentDecisionData.acceptOptionalCost;
                } else {
                    decisionToAcceptOptionalCost = this.canPlayerAfford(playerId, costDetails);
                }

                if (decisionToAcceptOptionalCost) {
                    if (costDetails) this.spendResources(playerId, costDetails);
                    if (benefitDetails.resources) this.gainResources(playerId, benefitDetails.resources);
                    if (benefitDetails.draw) this.drawCards(playerId, benefitDetails.draw, 'deck');
                    if (benefitDetails.recruit) this.recruitTroops(playerId, benefitDetails.recruit.count, benefitDetails.recruit.toConflict);
                    if (benefitDetails.vp) this.gainResources(playerId, {vp: benefitDetails.vp});
                    this.log(`AI Player ${player.name} paid optional cost for ${cardPlayed.name} and gained benefit.`);
                } else {
                    this.log(`AI Player ${player.name} declined or could not afford optional cost for ${cardPlayed.name}.`);
                }
            } else {
                player.pendingDecision = {
                    type: 'optionalCost',
                    data: {
                        cardId: cardPlayed.id,
                        cardName: cardPlayed.name,
                        cost: costDetails,
                        benefit: benefitDetails,
                        source: 'agentEffect',
                    }
                };
                this.log(`Player ${player.name} has a pending optional cost decision for ${cardPlayed.name}.`);
                return true;
            }
        }

        if (effect.custom) {
            const customEffectResult = this.executeCustomAgentEffect(playerId, effect.custom, cardPlayed, locationId, player.agentDecisionData);
            if (customEffectResult === true && player.pendingDecision) {
                return true;
            }
        }
    }

    const locationData = this.boardLocations[locationId];
    if (player.leader.id === LEADERS.arianaThorvald.id) {
        const harvestSpaces = ["arrakeen", "carthag", "sietchTabr", "imperialBasin", "haggaBasin"];
        if (harvestSpaces.includes(locationId) && locationData.effectText?.toLowerCase().includes("spice")) {
            this.log(`Countess Ariana at ${locationData.name}: Draws 1 card. (Spice reduction TBD - needs effect refactor)`);
            this.drawCards(playerId, 1, 'deck');
        }
    }

    if (player.leader.id === LEADERS.memnonThorvald.id && locationId === "landsraadCouncil") {
        if (!player.isAI) {
            player.pendingDecision = {
                type: 'thorvaldHighCouncilChoice',
                data: {
                    cardName: "High Council Visit (Thorvald)",
                    validFactions: ["fremen", "beneGesserit", "spacingGuild", "emperor"],
                }
            };
            this.log(`Earl Memnon Thorvald at High Council: Player ${player.name} can gain 2 influence. Pending decision.`);
            return true;
        } else {
            const factions = ["fremen", "beneGesserit", "spacingGuild", "emperor"];
            const chosenFaction = this.aiChooseFactionForInfluence(playerId, factions);
            this.gainInfluence(playerId, chosenFaction, 2);
            this.log(`AI Earl Memnon Thorvald at High Council: Gained 2 influence with ${chosenFaction}.`);
        }
    }
    const agentDecisionDataForMentat = player.agentDecisionData || {};
    if (player.leader.id === LEADERS.ilbanRichese.id && locationId === "mentat" && agentDecisionDataForMentat.tookMentatToken ) {
        this.log(`Count Ilban Richese (Mentat): Draws 1 additional card.`);
        this.drawCards(playerId, 1, 'deck');
    }

    return true;
  }

  executeCustomAgentEffect(playerId, customEffectId, cardPlayed, locationId, agentDecisionData = {}) {
    const player = this.getPlayer(playerId);
    this.log(`Executing custom agent effect: ${customEffectId} for card ${cardPlayed.name}`);
    const isAI = !!player.isAI;

    switch (customEffectId) {
        case "choam_directorship_agent":
            let spiceGain = 0;
            Object.values(this.boardLocations).forEach(loc => {
                if (loc.faction === "CHOAM" && loc.agents.includes(playerId)) {
                    spiceGain++;
                }
            });
            if (spiceGain > 0) this.gainResources(playerId, { spice: spiceGain });
            this.log(`CHOAM Directorship: Player ${player.name} gains ${spiceGain} spice.`);
            break;
        case "bene_gesserit_initiate_agent":
        case "thufir_optional_trash":
            const isBGInitiateSingle = customEffectId === "bene_gesserit_initiate_agent";
            const mustTrashSingle = isBGInitiateSingle;
            const drawsAfterTrashSingle = isBGInitiateSingle ? 1 : 0;
            const trashSourceSingle = isBGInitiateSingle ? 'handOrDiscard' : 'hand';

            if (isAI) {
                const options = (trashSourceSingle === 'handOrDiscard') ? [...player.hand, ...player.discardPile] : [...player.hand];
                let cardToTrashForAI = null;
                if (options.length > 0) {
                    cardToTrashForAI = options.find(c => c.id !== "start_001_signet_ring" && !c.tags?.includes("essential")) || options[0];
                }
                if (cardToTrashForAI) {
                     const actualSource = player.hand.some(c => c.id === cardToTrashForAI.id) ? 'hand' : 'discardPile';
                     this.trashCard(playerId, cardToTrashForAI.id, actualSource);
                } else if (mustTrashSingle) {
                    this.log(`${cardPlayed.name}: AI has no cards to trash but must.`);
                }
                if (drawsAfterTrashSingle > 0) {
                    this.drawCards(playerId, drawsAfterTrashSingle, 'deck');
                }
            } else {
                player.pendingDecision = {
                    type: 'selectCardToTrash',
                    data: {
                        cardId: cardPlayed.id,
                        cardName: cardPlayed.name,
                        source: trashSourceSingle,
                        mustTrash: mustTrashSingle,
                        drawsAfterTrash: drawsAfterTrashSingle,
                    }
                };
                this.log(`Player ${player.name} needs to choose a card to trash for ${cardPlayed.name}.`);
                return true;
            }
            break;
        case "stillsuit_agent":
            const desertSpaces = ["arrakeen", "carthag", "sietchTabr", "imperialBasin", "haggaBasin"];
            if (desertSpaces.includes(locationId)) {
                this.gainResources(playerId, { water: 1 });
            }
            break;
        case "the_voice_agent":
             if (isAI) {
                const choice = agentDecisionData.theVoiceAIChoice || 'solari';
                const targetPlayerIdForVoice = agentDecisionData.targetPlayerIds ? agentDecisionData.targetPlayerIds[0] : null;
                this.resolveTheVoiceChoiceInternal(playerId, cardPlayed.id, choice, targetPlayerIdForVoice);
             } else {
                player.pendingDecision = {
                    type: 'theVoiceChoice',
                    data: { cardId: cardPlayed.id, cardName: cardPlayed.name, validOpponents: this.players.filter(p => p.id !== playerId).map(p => p.id) }
                };
                this.log(`Player ${player.name} needs to choose The Voice effect.`);
                return true;
             }
            break;
        case "piter_discard_intrigue":
            let piterTargetPlayerId = null;
            if (isAI) {
                if (agentDecisionData.targetPlayerIds && agentDecisionData.targetPlayerIds.length > 0) {
                    piterTargetPlayerId = agentDecisionData.targetPlayerIds[0];
                } else {
                    const opponentsWithIntrigue = this.players.filter(p => p.id !== playerId && p.intrigueCards.length > 0);
                    if (opponentsWithIntrigue.length > 0) {
                        piterTargetPlayerId = opponentsWithIntrigue[Math.floor(Math.random() * opponentsWithIntrigue.length)].id;
                        this.log(`AI Piter De Vries randomly selected target ${piterTargetPlayerId} as fallback.`);
                    } else {
                        this.log("AI Piter De Vries: No valid opponents with intrigue cards. Effect fizzles.");
                        if (cardPlayed.agentEffect && cardPlayed.agentEffect.drawIntrigue) {
                           this.drawIntrigueCards(playerId, cardPlayed.agentEffect.drawIntrigue);
                        }
                        return true;
                    }
                }
            } else {
                if (agentDecisionData.targetPlayerId) {
                    piterTargetPlayerId = agentDecisionData.targetPlayerId;
                } else {
                    const validTargetPlayerIds = this.players.filter(p => p.id !== playerId && p.intrigueCards.length > 0).map(o => o.id);
                    if (validTargetPlayerIds.length === 0) {
                        this.log(`Piter De Vries: No valid opponents with intrigue cards. Targeting effect fizzles.`);
                        if (cardPlayed.agentEffect && cardPlayed.agentEffect.drawIntrigue) {
                           this.drawIntrigueCards(playerId, cardPlayed.agentEffect.drawIntrigue);
                        }
                        return true;
                    }
                    player.pendingDecision = {
                        type: 'selectPlayerTarget',
                        data: {
                            cardId: cardPlayed.id,
                            cardName: cardPlayed.name,
                            source: 'agentEffect',
                            effectDef: JSON.parse(JSON.stringify(cardPlayed.agentEffect)),
                            numTargets: 1,
                            validTargetPlayerIds: validTargetPlayerIds,
                            customEffectId: "piter_discard_intrigue",
                        }
                    };
                    this.log(`Player ${player.name} (Piter) needs to choose an opponent to force discard an intrigue card.`);
                    return true;
                }
            }

            if (piterTargetPlayerId !== null) {
                const targetOpponent = this.getPlayer(piterTargetPlayerId);
                if (targetOpponent && targetOpponent.intrigueCards.length > 0) {
                    this.discardIntrigueCard(targetOpponent.id, null, true);
                } else if (targetOpponent) {
                    this.log(`Piter De Vries: Target Player ${targetOpponent.name} has no intrigue cards to discard.`);
                } else {
                     this.log(`Piter De Vries: Invalid target opponent ID ${piterTargetPlayerId}.`);
                }
            }
            if (cardPlayed.agentEffect && cardPlayed.agentEffect.drawIntrigue) {
               this.drawIntrigueCards(playerId, cardPlayed.agentEffect.drawIntrigue);
            }
            break;
        case "beast_rabban_solari_loss":
            this.log(`Beast Rabban effect: Each opponent loses 1 Solari.`);
            this.players.forEach(opp => {
                if (opp.id !== playerId) {
                    if (opp.resources.solari > 0) {
                        opp.resources.solari -= 1;
                        this.log(`Player ${opp.name} loses 1 Solari. Remaining: ${opp.resources.solari}`);
                    } else {
                        this.log(`Player ${opp.name} has no Solari to lose.`);
                    }
                }
            });
            break;
        case "sietch_reverend_mother_trash":
            if (isAI) {
                let trashedCount = 0;
                const cardsToConsider = [...player.hand, ...player.discardPile];
                this.shuffle(cardsToConsider);
                // const cardsToTrashForAI_objects = []; // Not needed to pass to another function
                for (const cardToTrash of cardsToConsider) {
                    if (trashedCount >= 2) break;
                    if (cardToTrash.id !== "start_001_signet_ring") {
                        const sourceOfTrash = player.hand.some(c => c.id === cardToTrash.id) ? 'hand' :
                                            (player.discardPile.some(d => d.id === cardToTrash.id) ? 'discardPile' : null);
                        if (sourceOfTrash && this.trashCard(playerId, cardToTrash.id, sourceOfTrash)) { // Directly trash
                            trashedCount++;
                        }
                    }
                }
                this.log(`AI Sietch Reverend Mother: Trashed ${trashedCount} card(s).`);
            } else {
                const availableToTrash = [
                    ...player.hand.map(c => ({...c, fromZone: 'hand'})),
                    ...player.discardPile.map(c => ({...c, fromZone: 'discardPile'}))
                ];
                if (availableToTrash.length === 0) {
                    this.log("Sietch Reverend Mother: No cards available to trash.");
                    return true;
                }
                player.pendingDecision = {
                    type: 'selectCardsToTrash',
                    data: {
                        cardId: cardPlayed.id,
                        cardName: cardPlayed.name,
                        source: 'agentEffect',
                        availableCards: availableToTrash,
                        minCards: 0,
                        maxCards: 2,
                        reason: "Sietch Reverend Mother: You may trash up to 2 cards from your hand or discard pile."
                    }
                };
                this.log(`Player ${player.name} (Sietch RM) needs to select 0-2 cards to trash.`);
                return true;
            }
            break;
        default:
            this.log(`Unknown custom agent effect ID: ${customEffectId}`);
    }
    return true;
  }

  discardIntrigueCard(playerId, intrigueCardId, isRandom = false) {
      const player = this.getPlayer(playerId);
      if (!player) return false;
      let cardToDiscard;
      let cardIndex = -1;

      if (isRandom && player.intrigueCards.length > 0) {
          cardIndex = Math.floor(Math.random() * player.intrigueCards.length);
          cardToDiscard = player.intrigueCards.splice(cardIndex, 1)[0];
      } else if (!isRandom && intrigueCardId) {
          cardIndex = player.intrigueCards.findIndex(c => c.id === intrigueCardId);
          if (cardIndex > -1) {
              cardToDiscard = player.intrigueCards.splice(cardIndex, 1)[0];
          }
      } else if (player.intrigueCards.length === 0) {
          this.log(`Player ${player.name} has no intrigue cards to discard.`);
          return false;
      } else if (!intrigueCardId && !isRandom) {
          this.log(`No specific intrigue card ID provided for discard, and not set to random for player ${player.name}.`);
          return false;
      }

      if (cardToDiscard) {
          this.log(`Player ${player.name} discards intrigue card: ${cardToDiscard.name}.`);
          return true;
      }
      this.log(`Player ${player.name} could not discard intrigue card (ID: ${intrigueCardId}, Random: ${isRandom}).`);
      return false;
  }

  trashCard(playerId, cardId, source) {
      const player = this.getPlayer(playerId);
      let cardIndex = -1;
      let foundCard = null;

      if (source === 'hand') {
          cardIndex = player.hand.findIndex(c => c.id === cardId);
          if (cardIndex > -1) foundCard = player.hand.splice(cardIndex, 1)[0];
      } else if (source === 'discardPile') {
          cardIndex = player.discardPile.findIndex(c => c.id === cardId);
          if (cardIndex > -1) foundCard = player.discardPile.splice(cardIndex, 1)[0];
      } else if (source === 'handOrDiscard') {
          cardIndex = player.hand.findIndex(c => c.id === cardId);
          if (cardIndex > -1) {
              foundCard = player.hand.splice(cardIndex, 1)[0];
              source = 'hand';
          } else {
              cardIndex = player.discardPile.findIndex(c => c.id === cardId);
              if (cardIndex > -1) {
                  foundCard = player.discardPile.splice(cardIndex, 1)[0];
                  source = 'discardPile';
              }
          }
      }

      if (foundCard) {
          this.log(`Player ${player.name} trashed ${foundCard.name} from ${source}.`);
          return true;
      } else {
          this.log(`Error: Card ${cardId} not found in ${source} for trashing for player ${player.name}.`);
          return false;
      }
  }

  executeCardRevealEffects(playerId, revealedCardObjects) {
    const player = this.getPlayer(playerId);
    if (!player) return;

    player.resources.persuasion = player.resources.temporaryPersuasion || 0;
    player.resources.swords = 0;
    player.helenaSpecialPersuasionUsedThisTurn = false;

    this.log(`Player ${player.name} revealing cards: ${revealedCardObjects.map(c=>c.name).join(', ')}`);
    for (const card of revealedCardObjects) {
        if (card.revealEffect) {
            const effect = card.revealEffect;
            if (effect.persuasion) player.resources.persuasion += effect.persuasion;
            if (effect.swords) player.resources.swords += effect.swords;
            if (effect.resources) this.gainResources(playerId, effect.resources);
            if (effect.draw) this.drawCards(playerId, effect.draw, 'deck');
            if (effect.vp) { player.victoryPoints += effect.vp; this.checkVictoryConditions(playerId); }

            if (effect.optionalCost) {
                const costDetails = effect.optionalCost.cost;
                const benefitDetails = effect.optionalCost.benefit;
                const isAI = !!player.isAI;

                if (isAI) {
                    if (this.canPlayerAfford(playerId, costDetails)) {
                        this.spendResources(playerId, costDetails);
                        if (benefitDetails.resources) this.gainResources(playerId, benefitDetails.resources);
                        if (benefitDetails.draw) this.drawCards(playerId, benefitDetails.draw, 'deck');
                        if (benefitDetails.recruit) this.recruitTroops(playerId, benefitDetails.recruit.count, benefitDetails.recruit.toConflict);
                        this.log(`AI Player ${player.name} paid optional REVEAL cost for ${card.name} and gained benefit.`);
                    } else {
                        this.log(`AI Player ${player.name} declined/could not afford optional REVEAL cost for ${card.name}.`);
                    }
                } else {
                    if (player.pendingDecision) {
                        this.log(`Player ${player.name} already has a pending decision. Optional cost for ${card.name} will be skipped for now.`);
                        continue;
                    }
                    player.pendingDecision = {
                        type: 'optionalCost',
                        data: {
                            cardId: card.id,
                            cardName: card.name,
                            cost: costDetails,
                            benefit: benefitDetails,
                            source: 'revealEffect',
                        }
                    };
                    this.log(`Player ${player.name} has a pending optional REVEAL cost decision for ${card.name}.`);
                    break;
                }
            }

            if (effect.custom) {
                const decisionMade = this.executeCustomRevealEffect(playerId, card, effect.custom);
                if (decisionMade === true && player.pendingDecision) {
                    break;
                }
            }
            this.log(`Card ${card.name} (Reveal): provides ${effect.persuasion || 0}p, ${effect.swords || 0}s. Add: ${JSON.stringify(effect.resources)}, Draw: ${effect.draw || 0}, VP: ${effect.vp || 0}`);
        } else {
             if (card.persuasion) player.resources.persuasion += card.persuasion;
             if (card.swords) player.resources.swords += card.swords;
             this.log(`Card ${card.name} (Legacy Reveal): provides ${card.persuasion || 0} persuasion, ${card.swords || 0} swords.`);
        }
    }
    this.log(`Player ${player.name} total for reveal: ${player.resources.persuasion} persuasion, ${player.resources.swords} swords.`);
  }

  executeCustomRevealEffect(playerId, card, customEffectId) {
    const player = this.getPlayer(playerId);
    this.log(`Executing custom reveal effect: ${customEffectId} for card ${card.name}`);
    const isAI = !!player.isAI;

    switch (customEffectId) {
        case "fedaykin_bond":
            const otherFremenCardInPlay = player.playedCards.some(pc => pc.id !== card.id && (pc.tags?.includes("Fremen") || pc.agentIcons?.includes("Fremen")));
            const fremenInfluence = player.influence.fremen || 0;
            if (otherFremenCardInPlay || fremenInfluence >= 2) {
                player.resources.swords += 3;
                this.log("Fedaykin Bond: +3 Swords (Fremen condition met).");
            } else {
                player.resources.swords += 1;
                this.log("Fedaykin Bond: +1 Sword.");
            }
            break;
        case "sardaukar_reveal_deploy":
            if (player.garrison.count > 0) {
                if (isAI) {
                    this.commitTroopsToCombat(playerId, 1);
                    this.log("AI Sardaukar Legion: Deployed 1 troop to conflict from garrison.");
                } else {
                    player.pendingDecision = {
                        type: 'sardaukarDeployChoice',
                        data: { cardId: card.id, cardName: card.name, minDeploy: 1, maxDeploy: player.garrison.count }
                    };
                    this.log(`Sardaukar Legion: Player ${player.name} must deploy at least 1 troop. Pending decision.`);
                }
            } else {
                this.log("Sardaukar Legion: No troops in garrison to deploy.");
            }
            break;
        case "gurney_reveal_optional_recruit":
            const gurneyEffect = card.revealEffect;
            if (gurneyEffect.optionalCost) {
                 if (isAI) {
                    if (this.canPlayerAfford(playerId, gurneyEffect.optionalCost.resources)) {
                        this.spendResources(playerId, gurneyEffect.optionalCost.resources);
                        this.recruitTroops(playerId, gurneyEffect.optionalCost.benefit.recruit.count, false);
                        this.log(`AI Gurney Halleck (Reveal): Paid cost, recruited troops.`);
                    }
                 } else {
                    player.pendingDecision = {
                        type: 'optionalCost',
                        data: {
                            cardId: card.id,
                            cardName: card.name,
                            cost: gurneyEffect.optionalCost.resources,
                            benefit: gurneyEffect.optionalCost.benefit,
                            source: 'revealEffect',
                        }
                    };
                    this.log(`Gurney Halleck (Reveal): Player ${player.name} has optional cost decision. Pending.`);
                 }
            }
            break;
        default:
            this.log(`Unknown custom reveal effect ID: ${customEffectId}`);
    }
  }

  nextTurn() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerCount;
    const nextPlayer = this.getPlayer(this.currentPlayerIndex);
    this.log(`Player ${nextPlayer.name}'s turn.`);

    if (nextPlayer.leader && nextPlayer.leader.id === LEADERS.paulAtreides.id) {
        if (nextPlayer.deck.length > 0) {
            const topCard = nextPlayer.deck[nextPlayer.deck.length - 1];
            nextPlayer.paulTopCardInfo = { id: topCard.id, name: topCard.name };
            this.log(`Paul Atreides (Player ${nextPlayer.name}) peeks at top card: ${topCard.name}.`);
            if (nextPlayer.isAI) {
                if (Math.random() < 0.5) {
                    this.paulBottomDeckCard(nextPlayer.id);
                } else {
                    this.paulKeepTopCard(nextPlayer.id);
                }
            } else {
                 nextPlayer.pendingDecision = { type: 'paulPeekDecision', data: { cardName: nextPlayer.paulTopCardInfo.name }};
            }
        } else {
            nextPlayer.paulTopCardInfo = null;
        }
    } else if (nextPlayer.paulTopCardInfo) {
        nextPlayer.paulTopCardInfo = null;
    }
  }

  paulBottomDeckCard(playerId) {
    const player = this.getPlayer(playerId);
    if (player && player.leader && player.leader.id === LEADERS.paulAtreides.id && player.paulTopCardInfo && player.deck.length > 0) {
        const topCard = player.deck.pop();
        player.deck.unshift(topCard);
        this.log(`Paul Atreides (Player ${player.name}) moved ${topCard.name} to the bottom of the deck.`);
        player.paulTopCardInfo = null;
        if (player.pendingDecision && player.pendingDecision.type === 'paulPeekDecision') player.pendingDecision = null;
        return true;
    }
    return false;
  }

  paulKeepTopCard(playerId) {
      const player = this.getPlayer(playerId);
      if (player && player.leader && player.leader.id === LEADERS.paulAtreides.id && player.paulTopCardInfo) {
          this.log(`Paul Atreides (Player ${player.name}) keeps ${player.paulTopCardInfo.name} on top of the deck.`);
          player.paulTopCardInfo = null;
          if (player.pendingDecision && player.pendingDecision.type === 'paulPeekDecision') player.pendingDecision = null;
          return true;
      }
      return false;
  }

  endPlayerTurnActions() {
    const player = this.getPlayer(this.currentPlayerIndex);
    player.hasPassedReveal = true;

    if (player.leader.id === LEADERS.helenaRichese.id) {
        player.resources.temporaryPersuasion = 0;
        player.helenaSpecialPersuasionUsedThisTurn = false;
        this.log(`Helena Richese's temporary persuasion cleared.`);
    }

    const allAgentsUsedOrPassed = this.players.every(p => p.agents === 0 && p.hasPassedReveal);
    if (allAgentsUsedOrPassed) {
      this.gamePhase = 'combat';
      this.resolveConflictPhase();
    } else {
      this.nextTurn();
    }
  }

  placeAgent(playerId, cardId, locationId, agentDecisionData = {}) {
    if (playerId !== this.currentPlayerIndex) {
      this.log("Error: Not your turn!");
      return false;
    }
    if (this.gamePhase !== 'playerTurn') {
        this.log("Error: Cannot place agent outside of player turn phase.");
        return false;
    }

    const player = this.getPlayer(playerId);
    if (player.pendingDecision) {
        this.log("Error: Cannot place agent, player has a pending decision.");
        return false;
    }
    if (player.leader.id === LEADERS.paulAtreides.id && player.paulTopCardInfo) {
        this.log("Error: Paul Atreides must decide on his peeked card before placing an agent.");
        player.pendingDecision = { type: 'paulPeekDecision', data: { cardName: player.paulTopCardInfo.name }};
        return false;
    }

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

    let canPlaceDueToHelena = false;
    if (player.leader.id === LEADERS.helenaRichese.id &&
        (location.faction === "Landsraad" || location.isPopulated) &&
        location.agents.length === 1 && !location.agents.includes(playerId)) {
        canPlaceDueToHelena = true;
        this.log("Helena Richese bypasses single opponent agent.");
    }

    if (location.agents.length >= location.agentSlots && !canPlaceDueToHelena) {
      this.log(`Error: Location ${locationId} is full.`);
      return false;
    }

    const costs = this.getSpaceCost(locationId, playerId, card);

    if (Object.keys(costs).some(res => player.resources[res] < costs[res])) {
         this.log(`Error: Player ${player.name} cannot afford costs for ${location.name}. Needs ${JSON.stringify(costs)}`);
        return false;
    }
    if (!this.spendResources(playerId, costs)) {
        return false;
    }

    this.log(`Player ${player.name} plays card ${card.name} to ${location.name}.`);
    player.playedAgentCardThisTurn = card;

    player.agents -= 1;
    location.agents.push(playerId);
    player.playedCards.push(card);
    player.hand = player.hand.filter(c => c.id !== cardId);
    player.agentDecisionData = agentDecisionData;

    if (!this.executeSpaceEffects(playerId, locationId, card)) {
        // Stop if pending decision for human
    }
    player.agentDecisionData = null;

    if (player.isAI && location.isCombatZone && agentDecisionData.autoDeployTroops !== undefined) {
        const troopsToDeploy = Math.min(agentDecisionData.autoDeployTroops, player.garrison.count + (card.agentEffect?.recruit?.toConflict ? card.agentEffect.recruit.count : 0) );
        this.decideTroopDeployment(playerId, locationId, troopsToDeploy, true);
    }

    return true;
  }

  playIntrigueCard(playerId, cardId, agentOrIntrigueTargetData = {}) {
    const player = this.getPlayer(playerId);
    const cardIndex = player.intrigueCards.findIndex(c => c.id === cardId);

    if (!player || cardIndex === -1) {
        this.log(`Error: Player ${player.name} does not have intrigue card ${cardId}.`);
        return false;
    }
    const card = player.intrigueCards[cardIndex];
    const isAI = !!player.isAI;
    const effect = card.effect;

    if (effect && effect.targetsOpponent && effect.numTargets === 1 && effect.targetType === 'player' && !effect.targetChooses) { // Standard player targeting by card player
        let targetPlayerId = null;

        if (isAI) {
            if (agentOrIntrigueTargetData.targetPlayerIds && agentOrIntrigueTargetData.targetPlayerIds.length > 0) {
                targetPlayerId = agentOrIntrigueTargetData.targetPlayerIds[0];
            } else {
                const validOpponents = this.players.filter(p => p.id !== playerId).map(p => p.id);
                if (validOpponents.length > 0) {
                    targetPlayerId = validOpponents[Math.floor(Math.random() * validOpponents.length)];
                    this.log(`AI player ${player.name} randomly selected target Player ${targetPlayerId} for ${card.name}.`);
                } else {
                    this.log(`AI player ${player.name} found no valid opponents for ${card.name}. Effect may fizzle.`);
                    if (card.type === "Intrigue") player.intrigueCards.splice(cardIndex, 1);
                    return !effect.custom;
                }
            }
            agentOrIntrigueTargetData.targetPlayerId = targetPlayerId; // For custom effect

        } else { // Human player
            if (agentOrIntrigueTargetData.targetPlayerId) { // Target already resolved by selectPlayerTarget move
                targetPlayerId = agentOrIntrigueTargetData.targetPlayerId;
            } else { // Human needs to select a target
                const validTargetPlayerIds = this.players.filter(p => p.id !== playerId).map(p => p.id);
                if (validTargetPlayerIds.length === 0) {
                    this.log(`No valid targets for ${card.name}. Effect fizzles.`);
                    if (card.type === "Intrigue") player.intrigueCards.splice(cardIndex, 1);
                    return false;
                }
                player.pendingDecision = {
                    type: 'selectPlayerTarget',
                    data: {
                        cardId: card.id,
                        cardName: card.name,
                        source: 'intrigueEffect',
                        effectDef: JSON.parse(JSON.stringify(effect)),
                        numTargets: 1,
                        validTargetPlayerIds: validTargetPlayerIds,
                        customEffectId: effect.custom,
                    }
                };
                this.log(`Player ${player.name} needs to select 1 target for ${card.name}.`);
                return true;
            }
        }
    } else if (effect && effect.targetChooses && effect.targetsOpponent) {
         // Player A plays Blackmail, targets Player B. Player B gets pending decision.
         // This is handled in executeCustomIntrigueEffect for these specific cards.
    }


    if (card.type === "Intrigue") {
        const stillInHandIndex = player.intrigueCards.findIndex(c => c.id === cardId);
        if (stillInHandIndex !== -1) {
            player.intrigueCards.splice(stillInHandIndex, 1);
        }
    }
    this.log(`Player ${player.name} plays ${card.type} card: ${card.name}.`);

    if (card.intrigueType === "Endgame") {
        player.playedIntrigueCards.push(card);
        this.log(`${card.name} is an Endgame card, its effect will be resolved at game end.`);
        return true;
    }

    if (!effect) {
        this.log(`No effect defined for card ${card.name}`);
        return false;
    }

    if (effect.optionalCost) {
        const costDetails = effect.optionalCost.cost;
        const benefitDetails = effect.optionalCost.benefit;
        if (isAI) {
            let acceptAICost = agentOrIntrigueTargetData.acceptOptionalCost;
            if (acceptAICost === undefined) {
                acceptAICost = this.canPlayerAfford(playerId, costDetails);
            }

            if (acceptAICost) {
                this.spendResources(playerId, costDetails);
                if (benefitDetails.custom) {
                    // Pass all necessary data for the custom benefit, including any AI pre-choices
                    const customBenefitTargetData = { ...agentOrIntrigueTargetData, ...benefitDetails, isBenefit: true };
                    this.executeCustomIntrigueEffect(playerId, card, customBenefitTargetData);
                } else {
                    if (benefitDetails.resources) this.gainResources(playerId, benefitDetails.resources);
                    if (benefitDetails.draw) this.drawCards(playerId, benefitDetails.draw, 'deck');
                    if (benefitDetails.gainInfluence) this.gainInfluence(playerId, benefitDetails.gainInfluence.faction, benefitDetails.gainInfluence.amount);
                }
            } else {
                 this.log(`AI ${player.name} declined or could not afford optional cost for ${card.name}.`);
            }
        } else {
            player.pendingDecision = {
                type: 'optionalCost',
                data: {
                    cardId: card.id,
                    cardName: card.name,
                    cost: costDetails,
                    benefit: benefitDetails,
                    source: 'intrigueEffect'
                }
            };
            this.log(`Player ${player.name} has optional cost for ${card.name}. Pending decision.`);
            return true;
        }
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

    // Custom effects not part of optionalCost benefit are run here
    // Or if optional cost was declined by AI and there's still a main custom effect.
    const wasOptionalCostHandled = effect.optionalCost && agentOrIntrigueTargetData.acceptOptionalCost && agentOrIntrigueTargetData.isBenefit;
    if (effect.custom && !wasOptionalCostHandled) {
        this.executeCustomIntrigueEffect(playerId, card, agentOrIntrigueTargetData);
    }


    return true;
  }


  executeCustomIntrigueEffect(playerId, card, targetData) {
    const player = this.getPlayer(playerId); // Player playing the card
    const customEffectId = targetData.customEffectId || card.effect.custom;
    this.log(`Executing custom intrigue effect: ${customEffectId} for card ${card.name} played by ${player.name}`);
    const isAI = !!player.isAI;

    switch (customEffectId) {
        case "decoy_effect":
            const targetOpponentId_decoy = targetData.targetPlayerId;
            if (targetOpponentId_decoy === undefined || targetOpponentId_decoy === null) {
                 this.log("Decoy: No target opponent selected or provided. Effect fizzles."); return false;
            }
            const targetOpponent_decoy = this.getPlayer(targetOpponentId_decoy);
            if (!targetOpponent_decoy) { this.log(`Decoy: Invalid target opponent ID ${targetOpponentId_decoy}.`); return false; }

            this.log(`Decoy targets Player ${targetOpponent_decoy.name} (ID: ${targetOpponent_decoy.id}).`);
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
                const removedFromGarrison = targetOpponent_decoy.garrison.count;
                targetOpponent_decoy.garrison.count = 0;
                if (removedFromGarrison > 0) {
                    this.log(`Decoy: Player ${targetOpponent_decoy.name} removes ${removedFromGarrison} from garrison.`);
                } else {
                    this.log(`Decoy: Player ${targetOpponent_decoy.name} has no troops to remove.`);
                }
            }
            break;
        case "poison_snooper_effect":
            const targetOpponentId_snooper = targetData.targetPlayerId;
            const cardToDiscardId_snooper = targetData.cardToDiscardId;

            if (targetOpponentId_snooper === undefined || targetOpponentId_snooper === null) {
                this.log("Poison Snooper: Target player ID not provided. Effect fizzles.");
                return false;
            }
            const targetOpponent_snooper = this.getPlayer(targetOpponentId_snooper);
            if (!targetOpponent_snooper) {
                this.log(`Poison Snooper: Invalid target opponent ID ${targetOpponentId_snooper}.`);
                return false;
            }

            if (cardToDiscardId_snooper) {
                const cardIdx = targetOpponent_snooper.hand.findIndex(c => c.id === cardToDiscardId_snooper);
                if (cardIdx > -1) {
                    const discarded = targetOpponent_snooper.hand.splice(cardIdx, 1)[0];
                    targetOpponent_snooper.discardPile.push(discarded);
                    this.log(`Poison Snooper: Player ${player.name} forces Player ${targetOpponent_snooper.name} to discard ${discarded.name}.`);
                } else {
                     this.log(`Poison Snooper: Card ${cardToDiscardId_snooper} not found in Player ${targetOpponent_snooper.name}'s hand.`);
                }
            } else if (player.isAI && targetOpponent_snooper.hand.length > 0) {
                const randomCardToDiscard = targetOpponent_snooper.hand[Math.floor(Math.random() * targetOpponent_snooper.hand.length)];
                const cardIdx = targetOpponent_snooper.hand.findIndex(c => c.id === randomCardToDiscard.id);
                 if (cardIdx > -1) {
                    const discarded = targetOpponent_snooper.hand.splice(cardIdx, 1)[0];
                    targetOpponent_snooper.discardPile.push(discarded);
                    this.log(`Poison Snooper: AI Player ${player.name} forces Player ${targetOpponent_snooper.name} to discard ${discarded.name} (random fallback).`);
                }
            } else if (player.isAI && targetOpponent_snooper.hand.length === 0) {
                 this.log(`Poison Snooper: AI Player ${player.name} - Target Player ${targetOpponent_snooper.name} has no cards to discard.`);
            }
            break;
        case "bindu_suspension_effect":
            const agentLocationId = targetData.agentLocationId;
            if (!agentLocationId || !this.boardLocations[agentLocationId] || !this.boardLocations[agentLocationId].agents.includes(playerId)) {
                if (!isAI) { // Should be playerId for consistency, but player is the one playing the card
                    const validAgentLocations = Object.keys(this.boardLocations).filter(locId => this.boardLocations[locId].agents.includes(playerId));
                    if (validAgentLocations.length === 0) { this.log("Bindu Suspension: No agents on board to protect."); return true; }
                    player.pendingDecision = {
                        type: 'selectAgentLocation',
                        data: {
                            cardId: card.id,
                            cardName: card.name,
                            reason: 'bindu_suspension_select',
                            validLocations: validAgentLocations,
                            customEffectId: "bindu_suspension_effect"
                        }
                    };
                    this.log(`Player ${player.name} needs to select an agent to protect with Bindu Suspension.`);
                    return true;
                } else {
                    const firstValidAgentLoc = Object.keys(this.boardLocations).find(locId => this.boardLocations[locId].agents.includes(playerId));
                    if (firstValidAgentLoc) {
                        player.skipRecallAgentId = firstValidAgentLoc;
                        this.log(`Bindu Suspension: Player ${player.name}'s agent at ${this.boardLocations[firstValidAgentLoc].name} will not be recalled this round (AI default).`);
                    } else {
                        this.log(`Bindu Suspension: Player ${player.name} has no agents on board to protect.`);
                    }
                    return true;
                }
            }
            player.skipRecallAgentId = agentLocationId;
            this.log(`Bindu Suspension: Player ${player.name}'s agent at ${this.boardLocations[agentLocationId].name} will not be recalled this round.`);
            break;
        case "treachery_effect":
            const targetId_treachery = targetData.targetPlayerId;
            if (targetId_treachery === undefined || targetId_treachery === null) { this.log("Treachery: No target."); return false; } // Check if targetId is defined
            const targetPlayer_treachery = this.getPlayer(targetId_treachery);
            if (!targetPlayer_treachery) { this.log("Treachery: Invalid target."); return false; }
            targetPlayer_treachery.resources.swords = 0;
            this.log(`Treachery: Player ${targetPlayer_treachery.name}'s swords are now 0 for this combat.`);
            break;
        case "poison_dart_effect":
            const targetId_dart = targetData.targetPlayerId;
            if (targetId_dart === undefined || targetId_dart === null) { this.log("Poison Dart: No target."); return false; }
            const targetPlayer_dart = this.getPlayer(targetId_dart);
            if (!targetPlayer_dart) { this.log("Poison Dart: Invalid target."); return false; }
            if (targetPlayer_dart.activeCombatUnits > 0) {
                targetPlayer_dart.activeCombatUnits--;
                this.log(`Poison Dart: Player ${targetPlayer_dart.name} loses 1 troop from conflict. Remaining: ${targetPlayer_dart.activeCombatUnits}`);
            } else {
                this.log(`Poison Dart: Player ${targetPlayer_dart.name} has no troops in conflict.`);
            }
            break;
        case "bribery_influence_gain":
            if (player.isAI) { // AI's choice should be in targetData.aiFactionChoice
                const factionsForBribery = targetData.aiFactionChoice || this.aiChooseFactionForInfluence(playerId, ["fremen", "beneGesserit", "spacingGuild", "emperor"]);
                this.gainInfluence(playerId, factionsForBribery, 2);
                this.log(`AI ${player.name} (Bribery): Gained 2 influence with ${factionsForBribery}.`);
            } else { // Human player
                player.pendingDecision = {
                    type: 'selectFactionForBribery',
                    data: {
                        cardId: card.id,
                        cardName: card.name,
                        reason: 'bribery',
                        numInfluence: 2,
                        validFactions: ["fremen", "beneGesserit", "spacingGuild", "emperor"]
                    }
                };
                this.log(`Player ${player.name} (Bribery) needs to choose a faction for 2 influence.`);
            }
            break;
        case "blackmail_effect":
            const demandingPlayerId_blackmail = playerId;
            const targetId_blackmail = targetData.targetPlayerId;
            if (targetId_blackmail === undefined || targetId_blackmail === null) { this.log("Blackmail: No target selected by card player."); return false; }
            const target_blackmail = this.getPlayer(targetId_blackmail);
            if (!target_blackmail) { this.log("Blackmail: Invalid target opponent ID."); return false; }

            if (target_blackmail.isAI) {
                const aiChoice = (target_blackmail.resources.solari >= 3 && (target_blackmail.intrigueCards.length === 0 || Math.random() < 0.7)) ? 'solari' : 'intrigue';
                this.resolveBlackmailChoiceInternal(target_blackmail.id, aiChoice, demandingPlayerId_blackmail, card.id);
            } else {
                target_blackmail.pendingDecision = {
                    type: 'opponentChoice_blackmail',
                    data: {
                        cardId: card.id,
                        cardName: card.name,
                        demandingPlayerId: demandingPlayerId_blackmail,
                        demandingPlayerName: player.name,
                        options: [
                            { id: 'solari', text: `Give 3 Solari to ${player.name}` },
                            { id: 'intrigue', text: `Let ${player.name} draw 1 Intrigue Card` }
                        ],
                        canPaySolari: target_blackmail.resources.solari >=3,
                    }
                };
                this.log(`Player ${target_blackmail.name} targeted by Blackmail from ${player.name}, must make a choice.`);
            }
            break;
        case "test_of_humanity_effect":
            this.log(`Test of Humanity played by ${player.name}. Each opponent makes a choice.`);
            this.players.forEach(opponent => {
                if (opponent.id === playerId) return;

                if (opponent.isAI) {
                    let aiChoice_toh = null;
                    if (opponent.garrison.count > 0 && opponent.hand.length > 0) {
                        aiChoice_toh = Math.random() < 0.5 ? 'troop' : 'discard';
                    } else if (opponent.garrison.count > 0) {
                        aiChoice_toh = 'troop';
                    } else if (opponent.hand.length > 0) {
                        aiChoice_toh = 'discard';
                    }
                    if(aiChoice_toh) {
                        this.resolveTestOfHumanityChoiceInternal(opponent.id, aiChoice_toh, card.id);
                    } else {
                        this.log(`AI ${opponent.name} has no valid choice for Test of Humanity.`);
                    }
                } else {
                    opponent.pendingDecision = {
                        type: 'opponentChoice_test_of_humanity',
                        data: {
                            cardId: card.id,
                            cardName: card.name,
                            options: [
                                { id: 'troop', text: "Remove 1 troop from your garrison" },
                                { id: 'discard', text: "Discard 1 random card from your hand" }
                            ],
                            canLoseTroop: opponent.garrison.count > 0,
                            canDiscardCard: opponent.hand.length > 0,
                        }
                    };
                     this.log(`Player ${opponent.name} targeted by Test of Humanity, must make a choice.`);
                }
            });
            break;
        default:
            this.log(`Unknown custom intrigue effect ID: ${customEffectId}`);
    }
    return true;
  }

// ... (revealTurn, purchaseCard, etc.)

  resolveBlackmailChoiceInternal(targetPlayerId, chosenOption, demandingPlayerId, blackmailCardId) {
    const targetPlayer = this.getPlayer(targetPlayerId);
    const demandingPlayer = this.getPlayer(demandingPlayerId);
    if (!targetPlayer || !demandingPlayer) return false;

    if (chosenOption === 'solari') {
        if (targetPlayer.resources.solari >= 3) {
            targetPlayer.resources.solari -= 3;
            demandingPlayer.resources.solari += 3;
            this.log(`Blackmail: ${targetPlayer.name} gives 3 Solari to ${demandingPlayer.name}.`);
        } else {
            this.log(`Blackmail: ${targetPlayer.name} tried to give Solari but couldn't. ${demandingPlayer.name} draws an Intrigue card instead.`);
            this.drawIntrigueCards(demandingPlayerId, 1);
        }
    } else if (chosenOption === 'intrigue') {
        this.log(`Blackmail: ${targetPlayer.name} lets ${demandingPlayer.name} draw 1 Intrigue card.`);
        this.drawIntrigueCards(demandingPlayerId, 1);
    }
    return true;
  }

  resolveBlackmailChoice(playerId, chosenOption) {
    const player = this.getPlayer(playerId);
    if (!player || !player.pendingDecision || player.pendingDecision.type !== 'opponentChoice_blackmail') {
        this.log("Error: No pending Blackmail choice or wrong type for player " + playerId); return false;
    }
    const decisionData = player.pendingDecision.data;
    this.resolveBlackmailChoiceInternal(playerId, chosenOption, decisionData.demandingPlayerId, decisionData.cardId);
    player.pendingDecision = null;
    return true;
  }

  resolveTestOfHumanityChoiceInternal(targetPlayerId, chosenOption, cardId) {
    const targetPlayer = this.getPlayer(targetPlayerId);
    if (!targetPlayer) return false;

    if (chosenOption === 'troop') {
        if (targetPlayer.garrison.count > 0) {
            targetPlayer.garrison.count -= 1;
            this.log(`Test of Humanity: ${targetPlayer.name} removes 1 troop from garrison. Remaining: ${targetPlayer.garrison.count}`);
        } else {
            this.log(`Test of Humanity: ${targetPlayer.name} chose troop but had none.`);
        }
    } else if (chosenOption === 'discard') {
        if (targetPlayer.hand.length > 0) {
            const cardIndex = Math.floor(Math.random() * targetPlayer.hand.length);
            const discardedCard = targetPlayer.hand.splice(cardIndex, 1)[0];
            targetPlayer.discardPile.push(discardedCard);
            this.log(`Test of Humanity: ${targetPlayer.name} discards ${discardedCard.name} randomly.`);
        } else {
             this.log(`Test of Humanity: ${targetPlayer.name} chose discard but had no cards.`);
        }
    }
    return true;
  }

  resolveTestOfHumanityChoice(playerId, chosenOption) {
    const player = this.getPlayer(playerId);
     if (!player || !player.pendingDecision || player.pendingDecision.type !== 'opponentChoice_test_of_humanity') {
        this.log("Error: No pending Test of Humanity choice or wrong type for player " + playerId); return false;
    }
    const decisionData = player.pendingDecision.data;

    let actualChosenOption = chosenOption;
    if (chosenOption === 'troop' && player.garrison.count === 0) {
        if (player.hand.length > 0) { actualChosenOption = 'discard'; this.log("Test of Humanity: Forced to discard as no troops."); }
        else { this.log(`Test of Humanity: ${player.name} has no choice to make (no troops, no cards).`); player.pendingDecision = null; return true;}
    }
    if (chosenOption === 'discard' && player.hand.length === 0) {
         if (player.garrison.count > 0) { actualChosenOption = 'troop'; this.log("Test of Humanity: Forced to lose troop as no cards."); }
         else { this.log(`Test of Humanity: ${player.name} has no choice to make (no troops, no cards).`); player.pendingDecision = null; return true;}
    }

    this.resolveTestOfHumanityChoiceInternal(playerId, actualChosenOption, decisionData.cardId);
    player.pendingDecision = null;
    return true;
  }

  resolveFactionChoice(playerId, sourceCardId, reason, factionId) {
    const player = this.getPlayer(playerId);
    if (!player || !player.pendingDecision ||
        (player.pendingDecision.type !== 'selectFactionForBribery' && player.pendingDecision.type !== 'selectFaction') ||
        player.pendingDecision.data.cardId !== sourceCardId ||
        (player.pendingDecision.data.reason && player.pendingDecision.data.reason !== reason) ) {
        this.log("Error: No pending faction choice or mismatched context."); return false;
    }
    const decisionData = player.pendingDecision.data;
    if (!decisionData.validFactions || !decisionData.validFactions.includes(factionId)) {
        this.log(`Error: Invalid faction ${factionId} chosen for ${decisionData.cardName}.`); return false;
    }

    if (reason === 'bribery') {
        this.gainInfluence(playerId, factionId, decisionData.numInfluence || 2);
        this.log(`Player ${player.name} (Bribery with ${decisionData.cardName}) gained ${decisionData.numInfluence || 2} influence with ${factionId}.`);
    }

    player.pendingDecision = null;
    return true;
  }

// ... (rest of the file, including AI logic, other decision moves etc.)
// (AI logic will be updated in the next step using the full file content from this overwrite)

DuneImperiumGame.ai = {
    enumerate: (G, ctx, playerID) => {
        const player = G.getPlayer(playerID);
        if (!player || !player.isAI) return [];

        let moves = [];
        const allImperiumCards = getAllImperiumCards();
        const allIntrigueCards = getAllIntrigueCards();


        if (player.pendingDecision) {
            switch (player.pendingDecision.type) {
                case 'baronInitialInfluence':
                    const factions = player.pendingDecision.data.validFactions;
                    const shuffledFactions = [...factions].sort(() => 0.5 - Math.random());
                    moves.push({ move: 'baronInitialInfluence', args: [shuffledFactions.slice(0, 2)], score: 10 });
                    break;
                case 'letoSignetChoice':
                    if (G.canPlayerAfford(playerID, player.pendingDecision.data.cost)) {
                        const validFactions = player.pendingDecision.data.validFactions;
                        const randomFaction = validFactions[Math.floor(Math.random() * validFactions.length)];
                        moves.push({ move: 'decideLetoSignet', args: [true, randomFaction], score: 5 });
                    } else {
                        moves.push({ move: 'decideLetoSignet', args: [false, null], score: 1 });
                    }
                    break;
                case 'baronSignetChoice':
                    if (G.canPlayerAfford(playerID, player.pendingDecision.data.cost)) {
                        moves.push({ move: 'decideBaronSignet', args: [true], score: 5 });
                    } else {
                        moves.push({ move: 'decideBaronSignet', args: [false], score: 1 });
                    }
                    break;
                case 'thorvaldHighCouncilChoice':
                    const validFactionsThorvald = player.pendingDecision.data.validFactions;
                    const randomFactionThorvald = validFactionsThorvald[Math.floor(Math.random() * validFactionsThorvald.length)];
                    moves.push({ move: 'decideThorvaldHighCouncil', args: [randomFactionThorvald], score: 5 });
                    break;
                case 'optionalCost':
                    // Check if this optional cost is for Bribery
                    if (player.pendingDecision.data.benefit?.custom === "bribery_influence_gain") {
                        const canAffordBribery = G.canPlayerAfford(playerID, player.pendingDecision.data.cost);
                        // AI heuristic for Bribery: always accept if can afford, might be refined later
                        moves.push({ move: 'decideOptionalCost', args: [player.pendingDecision.data.cardId, player.pendingDecision.data.source, canAffordBribery], score: canAffordBribery ? 6 : 0 });
                    } else {
                        const canAfford = G.canPlayerAfford(playerID, player.pendingDecision.data.cost);
                        moves.push({ move: 'decideOptionalCost', args: [player.pendingDecision.data.cardId, player.pendingDecision.data.source, canAfford], score: canAfford ? 3 : 1 });
                    }
                    break;
                case 'selectFactionForBribery': // New
                    const validFactions_bribery = player.pendingDecision.data.validFactions;
                    const randomFaction_bribery = validFactions_bribery[Math.floor(Math.random() * validFactions_bribery.length)];
                    moves.push({ move: 'resolveFactionChoice', args: [player.pendingDecision.data.cardId, player.pendingDecision.data.reason || 'bribery', randomFaction_bribery], score: 3 });
                    break;
                case 'opponentChoice_blackmail': // New - AI is the target here
                    const blackmailData = player.pendingDecision.data;
                    if (blackmailData.canPaySolari && (player.resources.solari > 5 || player.intrigueCards.length <= 1)) {
                        moves.push({ move: 'resolveBlackmailChoice', args: ['solari'], score: 2 });
                    } else {
                        moves.push({ move: 'resolveBlackmailChoice', args: ['intrigue'], score: 1 });
                    }
                    break;
                case 'opponentChoice_test_of_humanity': // New - AI is a target
                    const tohData = player.pendingDecision.data;
                    if (tohData.canLoseTroop && player.garrison.count > 0) {
                        moves.push({ move: 'resolveTestOfHumanityChoice', args: ['troop'], score: 2 });
                    } else if (tohData.canDiscardCard && player.hand.length > 0) {
                        moves.push({ move: 'resolveTestOfHumanityChoice', args: ['discard'], score: 1 });
                    } else if (tohData.canLoseTroop) { // Fallback
                         moves.push({ move: 'resolveTestOfHumanityChoice', args: ['troop'], score: 1 });
                    } else if (tohData.canDiscardCard) { // Fallback
                         moves.push({ move: 'resolveTestOfHumanityChoice', args: ['discard'], score: 1 });
                    }
                    // If neither, AI does nothing, move list remains empty for this decision (game should proceed)
                    break;
                case 'selectPlayerTarget':
                    const { cardId, source, validTargetPlayerIds } = player.pendingDecision.data;
                    if (validTargetPlayerIds && validTargetPlayerIds.length > 0) {
                        const randomTarget = validTargetPlayerIds[Math.floor(Math.random() * validTargetPlayerIds.length)];
                        moves.push({ move: 'selectPlayerTarget', args: [cardId, source, [randomTarget]], score: 1 });
                    }
                    break;
                case 'selectCardFromPlayerZone':
                     const { cardId: sourceCardIdPSC, source: sourcePSC, fromPlayerId, targetZoneCards } = player.pendingDecision.data;
                     if (targetZoneCards && targetZoneCards.length > 0) {
                         const randomCardToSelect = targetZoneCards[Math.floor(Math.random() * targetZoneCards.length)].id;
                         moves.push({move: 'selectCardFromPlayerZone', args: [sourceCardIdPSC, sourcePSC, fromPlayerId, player.pendingDecision.data.fromZone, [randomCardToSelect]], score: 1});
                     }
                    break;
                case 'sardaukarDeployChoice':
                    let deployNum = player.pendingDecision.data.minDeploy;
                    if (player.garrison.count < player.pendingDecision.data.minDeploy) {
                        deployNum = player.garrison.count;
                    }
                    deployNum = Math.min(deployNum, player.pendingDecision.data.maxDeploy);
                    moves.push({move: 'decideSardaukarDeployment', args: [player.pendingDecision.data.cardId, deployNum], score: 3});
                    break;
                case 'theVoiceChoice':
                    const voiceDecision = Math.random() < 0.5 ? 'solari' : 'removeTroop';
                    let voiceTarget = null;
                    if (voiceDecision === 'removeTroop') {
                        const opponentsWithGarrison = G.players.filter(p => p.id !== playerID && p.garrison.count > 0);
                        if (opponentsWithGarrison.length > 0) {
                            voiceTarget = opponentsWithGarrison[Math.floor(Math.random() * opponentsWithGarrison.length)].id;
                        } else {
                             moves.push({move: 'resolveTheVoiceChoice', args: [player.pendingDecision.data.cardId, 'solari', null], score: 2});
                             break;
                        }
                    }
                    moves.push({move: 'resolveTheVoiceChoice', args: [player.pendingDecision.data.cardId, voiceDecision, voiceTarget], score: 2});
                    break;
                case 'selectCardToTrash':
                    const trashDecisionData = player.pendingDecision.data;
                    const options = (trashDecisionData.source === 'handOrDiscard') ? [...player.hand, ...player.discardPile] : [...player.hand];
                    let cardToTrashId = null;
                    if (options.length > 0) {
                        const trashCandidate = options.find(c => c.id !== "start_001_signet_ring" && !c.tags?.includes("essential")) || options[0];
                        if (trashCandidate) cardToTrashId = trashCandidate.id;
                    }
                    if (cardToTrashId) {
                        moves.push({move: 'resolveTrashCardChoice', args: [trashDecisionData.cardId, cardToTrashId, trashDecisionData.source], score: 3});
                    } else if (!trashDecisionData.mustTrash) {
                        moves.push({move: 'resolveTrashCardChoice', args: [trashDecisionData.cardId, null, trashDecisionData.source], score: 1});
                    } else if (trashDecisionData.mustTrash && trashDecisionData.drawsAfterTrash > 0) {
                         moves.push({move: 'resolveTrashCardChoice', args: [trashDecisionData.cardId, null, trashDecisionData.source], score: 1});
                    }
                    break;
                case 'selectCardsToTrash':
                    const srmDecisionData = player.pendingDecision.data;
                    let cardsToTrashForSRM_AI = [];
                    let srmTrashCount = 0;
                    const srmOptions = [...player.hand.map(c => ({...c, fromZone: 'hand'})), ...player.discardPile.map(c => ({...c, fromZone: 'discardPile'}))];
                    G.shuffle(srmOptions);

                    for (const cardOption of srmOptions) {
                        if (srmTrashCount >= srmDecisionData.maxCards) break;
                        if (cardOption.id !== "start_001_signet_ring" && !cardOption.tags?.includes("essential")) {
                            cardsToTrashForSRM_AI.push({ id: cardOption.id, fromZone: cardOption.fromZone });
                            srmTrashCount++;
                        }
                    }
                    moves.push({ move: 'resolveSelectCardsToTrash', args: [srmDecisionData.cardId, cardsToTrashForSRM_AI], score: 1 + srmTrashCount });
                    break;
                case 'paulPeekDecision':
                     moves.push({ move: 'paulKeepTopCard', args: [], score: 1 });
                     moves.push({ move: 'paulBottomDeckCard', args: [], score: 1 });
                     break;
                case 'deployTroops':
                    const maxDeploy = player.pendingDecision.data.maxDeployableTroops;
                    moves.push({move: 'decideTroopDeployment', args: [player.pendingDecision.data.locationId, Math.floor(maxDeploy/2)], score:1});
                    break;
                 case 'selectAgentLocation':
                    const validLocationsForBindu = player.pendingDecision.data.validLocations;
                    if (validLocationsForBindu && validLocationsForBindu.length > 0) {
                        const randomLocation = validLocationsForBindu[Math.floor(Math.random() * validLocationsForBindu.length)];
                        moves.push({move: 'selectAgentLocation', args: [player.pendingDecision.data.cardId, randomLocation], score: 1});
                    }
                    break;
                default:
                    break;
            }
            return moves.map(m => ({ ...m, score: m.score || 0.1 }));
        }

        DuneImperiumGame.ai.enumeratePlayerActions(G, player, moves, allImperiumCards, allIntrigueCards, playerID);

        if (player.agents === 0 && !player.hasPassedReveal) {
            if (player.hand.length > 0) {
                 moves.push({ move: 'revealTurn', args: [player.hand.map(c => c.id)], score: 5 });
            } else {
                 moves.push({ move: 'revealTurn', args: [[]], score: 5 });
            }

            G.imperiumRow.forEach(card => {
                let purchaseScore = 1;
                if (card.cost <= player.resources.persuasion) {
                    if (card.tags?.includes("VP")) purchaseScore = 10;
                    else if (card.agentIcons?.includes("Military")) purchaseScore = 4;
                    else if (card.cost <=3) purchaseScore = 3;
                    else purchaseScore = 2;
                    moves.push({ move: 'purchaseCard', args: [card.id], score: purchaseScore });
                }
            });
            moves.push({ move: 'endTurnActions', args: [], score: 0.5 });
        }

        if (moves.length === 0 && player.agents === 0 && !player.hasPassedReveal) {
            moves.push({move: 'endTurnActions', args:[]});
        }

        if (moves.length === 0 && G.gamePhase === 'playerTurn' && player.agents === 0 && player.hasPassedReveal) {
             moves.push({ move: 'endPlayerTurnActions', args: [] });
        }
         if (moves.length === 0 && G.gamePhase === 'playerTurn' && player.agents > 0) {
            console.error(`AI for player ${playerID} has agents but no valid agent moves.`);
        }

        return moves.map(m => ({ ...m, score: m.score || 0.1 }));
    },

    enumeratePlayerActions: (G, player, moves, allImperiumCards, allIntrigueCards, playerID) => {
        const getValidLocationsForCard = (card, G, player) => {
            const validLocations = [];
            for (const locationId in G.boardLocations) {
                const location = G.boardLocations[locationId];

                if (player.leader.id === LEADERS.helenaRichese.id &&
                    (location.faction === "Landsraad" || location.isPopulated) &&
                    location.agents.length === 1 && !location.agents.includes(player.id)
                ) {
                     const helenaSpaceCost = G.getSpaceCost(locationId, player.id, card);
                     if (G.canPlayerAfford(player.id, helenaSpaceCost)) {
                        validLocations.push(locationId);
                        continue;
                     }
                }

                if (location.agents.length >= location.agentSlots) continue;

                const requiredIcons = location.requiredIcons || [];
                const cardAgentIcons = card.agentIcons || [];
                let matchesRequired = true;
                if (requiredIcons.length > 0) {
                    matchesRequired = requiredIcons.every(reqIcon => cardAgentIcons.includes(reqIcon) || cardAgentIcons.includes("Any"));
                }

                if (matchesRequired) {
                    const spaceCost = G.getSpaceCost(locationId, player.id, card);
                    if (G.canPlayerAfford(player.id, spaceCost)) {
                        if (location.requiresWater && player.resources.water < 1) {
                            // Skip
                        } else {
                             validLocations.push(locationId);
                        }
                    }
                }
            }
            return validLocations;
        };

        if (player.agents > 0) {
            player.hand.forEach(cardInHand => {
                const cardDef = allImperiumCards.find(c => c.id === cardInHand.id);
                if (!cardDef) return;

                const validLocations = getValidLocationsForCard(cardDef, G, player);
                validLocations.forEach(locationId => {
                    const location = G.boardLocations[locationId];
                    let baseAgentDecisionData = {};

                    if (cardDef.agentEffect?.optionalCost) {
                        if (cardDef.id === "imp_fremen_camp") {
                             baseAgentDecisionData.acceptOptionalCost = G.canPlayerAfford(player.id, cardDef.agentEffect.optionalCost.cost) && player.garrison.count < 5;
                        } else {
                            baseAgentDecisionData.acceptOptionalCost = G.canPlayerAfford(player.id, cardDef.agentEffect.optionalCost.cost);
                        }
                    }
                    if (cardDef.agentEffect?.custom === "sietch_reverend_mother_trash") {
                        // AI logic for trashing is within executeCustomAgentEffect for Sietch RM
                    }


                    if (cardDef.agentEffect?.custom === "the_voice_agent") {
                        baseAgentDecisionData.theVoiceAIChoice = Math.random() < 0.5 ? 'solari' : 'removeTroop';
                        if (baseAgentDecisionData.theVoiceAIChoice === 'removeTroop') {
                            const opponentsWithTroops = G.players.filter(p => p.id !== player.id && p.garrison.count > 0);
                            if (opponentsWithTroops.length > 0) {
                                baseAgentDecisionData.targetPlayerIds = [opponentsWithTroops[Math.floor(Math.random() * opponentsWithTroops.length)].id];
                            } else {
                                baseAgentDecisionData.theVoiceAIChoice = 'solari';
                            }
                        }
                    }
                    if (player.leader.id === LEADERS.ilbanRichese.id && locationId === "mentat") {
                        baseAgentDecisionData.tookMentatToken = true;
                    }

                    if (location.isCombatZone) {
                        let troopsToDeploy = Math.floor(player.garrison.count / 2);
                        baseAgentDecisionData.autoDeployTroops = troopsToDeploy;
                    }

                    if (cardDef.agentEffect && cardDef.agentEffect.targetsOpponent && cardDef.agentEffect.numTargets === 1 && cardDef.agentEffect.targetType === 'player' && cardDef.id === "imp_piter_de_vries") {
                        let validOpponentsForPiter = G.players.filter(p => p.id !== player.id && G.getPlayer(p.id)?.intrigueCards.length > 0);

                        if (validOpponentsForPiter.length > 0) {
                            validOpponentsForPiter.forEach(opponent => {
                                let specificAgentDecisionData = JSON.parse(JSON.stringify(baseAgentDecisionData));
                                specificAgentDecisionData.targetPlayerIds = [opponent.id];
                                moves.push({ move: 'placeAgent', args: [cardInHand.id, locationId, specificAgentDecisionData], score: 0.5 });
                            });
                        } else {
                            moves.push({ move: 'placeAgent', args: [cardInHand.id, locationId, baseAgentDecisionData] });
                        }
                    } else if (cardDef.agentEffect?.custom !== "the_voice_agent") {
                        moves.push({ move: 'placeAgent', args: [cardInHand.id, locationId, baseAgentDecisionData] });
                    } else if (cardDef.agentEffect?.custom === "the_voice_agent") { // The Voice already has targetPlayerIds in baseAgentDecisionData if needed
                         moves.push({ move: 'placeAgent', args: [cardInHand.id, locationId, baseAgentDecisionData] });
                    }
                });
            });
        }

        player.intrigueCards.forEach(intrigueCard => {
            const intrigueCardDef = allIntrigueCards.find(c => c.id === intrigueCard.id);
            if (!intrigueCardDef) return;

            if (intrigueCardDef.intrigueType === "Endgame" && G.round < 8) return;

            let baseTargetDataAI = {};

            if (intrigueCardDef.effect?.custom === "bindu_suspension_effect") {
                const deployedAgentLocations = Object.keys(G.boardLocations).filter(locId => G.boardLocations[locId].agents.includes(player.id));
                if (deployedAgentLocations.length > 0) {
                    baseTargetDataAI.agentLocationId = deployedAgentLocations[Math.floor(Math.random() * deployedAgentLocations.length)];
                } else {
                    return;
                }
            }

            // AI for new Intrigue cards
            if (intrigueCardDef.id === "intrigue_treachery" || intrigueCardDef.id === "intrigue_poison_dart" || (intrigueCardDef.id === "intrigue_blackmail" && !intrigueCardDef.effect.targetChooses)) {
                const opponents = G.players.filter(p => p.id !== player.id);
                if (opponents.length > 0) {
                    opponents.forEach(opponent => {
                        let specificTargetDataAI = JSON.parse(JSON.stringify(baseTargetDataAI));
                        specificTargetDataAI.targetPlayerIds = [opponent.id];
                        moves.push({ move: 'playIntrigueCard', args: [intrigueCard.id, specificTargetDataAI], score: 0.5 });
                    });
                } else { return; } // Skip if no targets
            } else if (intrigueCardDef.id === "intrigue_blackmail" && intrigueCardDef.effect.targetChooses) { // AI playing Blackmail
                 const opponents = G.players.filter(p => p.id !== player.id);
                 if (opponents.length > 0) {
                    opponents.forEach(opponent => {
                        let specificTargetDataAI = JSON.parse(JSON.stringify(baseTargetDataAI));
                        specificTargetDataAI.targetPlayerIds = [opponent.id];
                        // AI doesn't pre-make the *opponent's* choice here; the opponent (if AI) will handle it via their pendingDecision.
                        moves.push({ move: 'playIntrigueCard', args: [intrigueCard.id, specificTargetDataAI], score: 0.5 });
                    });
                 } else {return;}
            } else if (intrigueCardDef.id === "intrigue_bribery" && intrigueCardDef.effect.optionalCost) {
                const canAffordBribery = G.canPlayerAfford(player.id, intrigueCardDef.effect.optionalCost.cost);
                if (canAffordBribery) { // AI always pays if it can for now
                    let specificTargetDataAI = JSON.parse(JSON.stringify(baseTargetDataAI));
                    specificTargetDataAI.acceptOptionalCost = true;
                    // AI also needs to pre-choose faction for bribery_influence_gain
                    const factionsForBribery = ["fremen", "beneGesserit", "spacingGuild", "emperor"];
                    specificTargetDataAI.aiFactionChoice = factionsForBribery[Math.floor(Math.random() * factionsForBribery.length)];
                    moves.push({ move: 'playIntrigueCard', args: [intrigueCard.id, specificTargetDataAI], score: 0.6 });
                } // else AI doesn't play it if cannot afford
            } else if (intrigueCardDef.id === "intrigue_test_of_humanity") {
                 moves.push({ move: 'playIntrigueCard', args: [intrigueCard.id, baseTargetDataAI], score: 0.3 }); // No target choice for caster
            }
            else if (intrigueCardDef.effect && intrigueCardDef.effect.targetsOpponent && intrigueCardDef.effect.thenSelectCardFromTargetHand) { // e.g. Poison Snooper (existing)
                const opponents = G.players.filter(p => p.id !== player.id);
                if (opponents.length > 0) {
                    opponents.forEach(opponent => {
                        let specificTargetDataAI = JSON.parse(JSON.stringify(baseTargetDataAI));
                        specificTargetDataAI.targetPlayerIds = [opponent.id];
                        const targetPlayerObj = G.getPlayer(opponent.id);
                        if (targetPlayerObj && targetPlayerObj.hand.length > 0) {
                            specificTargetDataAI.cardToDiscardId = targetPlayerObj.hand[Math.floor(Math.random() * targetPlayerObj.hand.length)].id;
                        }
                        moves.push({ move: 'playIntrigueCard', args: [intrigueCard.id, specificTargetDataAI], score: 0.4 });
                    });
                }
            } else if (intrigueCardDef.id !== "intrigue_decoy" && intrigueCardDef.id !== "intrigue_treachery" && intrigueCardDef.id !== "intrigue_poison_dart" && intrigueCardDef.id !== "intrigue_blackmail" && intrigueCardDef.id !== "intrigue_bribery" && intrigueCardDef.id !== "intrigue_test_of_humanity") {
                // Default for non-targeting or already handled intrigues
                moves.push({ move: 'playIntrigueCard', args: [intrigueCard.id, baseTargetDataAI] });
            }
        });
    }
};
// module.exports = DuneImperiumGame;

[end of src/games/dune-imperium/game.js]
