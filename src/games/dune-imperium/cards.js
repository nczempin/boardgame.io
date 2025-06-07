// src/games/dune-imperium/cards.js

export const IMPERIUM_CARDS = {
  // Military
  sardaukarLegion: {
    id: "imp_sardaukar_legion",
    name: "Sardaukar Legion",
    cost: 7,
    type: "Imperium",
    agentIcons: ["Military", "Emperor"],
    agentEffectText: "Deploy 3 troops to your garrison. You may deploy 2 additional troops from your garrison to the conflict.",
    revealEffectText: "",
    agentEffect: { recruit: { count: 3, toConflict: false }, deployFromGarrison: 2 },
    revealEffect: { persuasion: 0, swords: 0 },
    tags: ["Military"],
  },
  fremenWarriors: {
    id: "imp_fremen_warriors",
    name: "Fremen Warriors",
    cost: 4,
    type: "Imperium",
    agentIcons: ["Military", "Fremen"],
    agentEffectText: "Deploy 2 troops to your garrison. Gain 1 Spice.",
    revealEffectText: "",
    agentEffect: { recruit: { count: 2, toConflict: false }, resources: { spice: 1 } },
    revealEffect: { persuasion: 0, swords: 0 },
    tags: ["Military", "Fremen"],
  },
  hardyWarriors: {
    id: "imp_hardy_warriors",
    name: "Hardy Warriors",
    cost: 3,
    type: "Imperium",
    agentIcons: ["Military", "Any"], // Generic military icon
    agentEffectText: "Deploy 2 troops to your garrison.",
    revealEffectText: "Gain 2 Swords.",
    agentEffect: { recruit: { count: 2, toConflict: false } },
    revealEffect: { persuasion: 0, swords: 2 },
    tags: ["Military"],
  },

  // Economic
  choamDirectorship: {
    id: "imp_choam_directorship",
    name: "CHOAM Directorship",
    cost: 6,
    type: "Imperium",
    agentIcons: ["Wealth", "CHOAM"], // CHOAM/Wealth icon
    agentEffectText: "Gain 1 Spice for each CHOAM space you have an agent on (including this one).", // Complex, needs G access
    revealEffectText: "Gain 1 Persuasion and 3 Solari.",
    agentEffect: { custom: "choam_directorship_agent" }, // Requires custom logic
    revealEffect: { persuasion: 1, resources: { solari: 3 } },
    tags: ["Economic", "CHOAM"],
  },
  spiceHarvester: {
    id: "imp_spice_harvester",
    name: "Spice Harvester",
    cost: 3,
    type: "Imperium",
    agentIcons: ["Wealth", "CHOAM"],
    agentEffectText: "Gain 2 Spice.",
    revealEffectText: "Gain 1 Persuasion.",
    agentEffect: { resources: { spice: 2 } },
    revealEffect: { persuasion: 1 },
    tags: ["Economic", "CHOAM", "Tech"], // Example Tech tag
  },
  guildBank: {
    id: "imp_guild_bank",
    name: "Guild Bank",
    cost: 5,
    type: "Imperium",
    agentIcons: ["Spacing Guild", "Wealth"],
    agentEffectText: "Gain 3 Solari. You may pay 2 Spice to gain an additional 3 Solari.",
    revealEffectText: "",
    agentEffect: { resources: { solari: 3 }, optionalCost: { resources: {spice: 2}, benefit: { resources: {solari: 3}}} },
    revealEffect: { persuasion: 0, swords: 0 },
    tags: ["Economic", "Spacing Guild"],
  },

  // Faction
  beneGesseritInitiateCard: { // Renamed from just "Bene Gesserit Initiate" to avoid conflict with starting card
    id: "imp_bene_gesserit_initiate",
    name: "Bene Gesserit Initiate",
    cost: 2,
    type: "Imperium",
    agentIcons: ["Bene Gesserit", "Any"],
    agentEffectText: "Trash a card from your hand or discard pile. Then, draw a card.",
    revealEffectText: "Gain 1 Persuasion.",
    agentEffect: { custom: "bene_gesserit_initiate_agent" }, // Requires custom logic for trashing/drawing
    revealEffect: { persuasion: 1 },
    tags: ["Bene Gesserit"],
  },
  guildNavigator: {
    id: "imp_guild_navigator",
    name: "Guild Navigator",
    cost: 6,
    type: "Imperium",
    agentIcons: ["Spacing Guild", "Any"],
    agentEffectText: "Deploy 2 troops from your garrison to the conflict. Draw 1 card.",
    revealEffectText: "",
    agentEffect: { deployFromGarrison: 2, draw: 1 },
    revealEffect: { persuasion: 0, swords: 0 },
    tags: ["Spacing Guild"],
  },
  fremenCamp: {
    id: "imp_fremen_camp",
    name: "Fremen Camp",
    cost: 2,
    type: "Imperium",
    agentIcons: ["Fremen", "Any"],
    agentEffectText: "Gain 1 Water.",
    revealEffectText: "Gain 1 Sword.",
    agentEffect: { resources: { water: 1 } },
    revealEffect: { persuasion: 0, swords: 1 },
    tags: ["Fremen"],
  },

  // Utility
  stillsuit: {
    id: "imp_stillsuit",
    name: "Stillsuit",
    cost: 1,
    type: "Imperium",
    agentIcons: ["Any", "Tech"], // Generic icon, also Tech
    agentEffectText: "If you deployed an agent to a desert space (Arrakeen, Carthag, Sietch Tabr, Imperial Basin, Hagga Basin), gain 1 Water.",
    revealEffectText: "",
    agentEffect: { custom: "stillsuit_agent" }, // Requires custom logic checking location type
    revealEffect: { persuasion: 0, swords: 0 },
    tags: ["Tech"],
  },
  duncanIdaho: {
    id: "imp_duncan_idaho",
    name: "Duncan Idaho",
    cost: 5,
    type: "Imperium",
    agentIcons: ["Military", "Loyalty"], // Atreides-aligned typically
    agentEffectText: "You may pay 1 Water to deploy 1 troop to your garrison and draw 1 card.",
    revealEffectText: "Gain 2 Swords.",
    agentEffect: { optionalCost: { resources: {water: 1}, benefit: { recruit: { count: 1, toConflict: false}, draw: 1 }}},
    revealEffect: { persuasion: 0, swords: 2 },
    tags: ["Military"],
  },
  theVoice: {
    id: "imp_the_voice",
    name: "The Voice",
    cost: 4,
    type: "Imperium",
    agentIcons: ["Bene Gesserit", "Intrigue"],
    agentEffectText: "Remove 1 troop from any player's garrison in any conflict sector (if multiple). OR Gain 2 Solari.", // Complex targeting
    revealEffectText: "Gain 1 Persuasion.",
    agentEffect: { custom: "the_voice_agent" }, // Requires custom logic
    revealEffect: { persuasion: 1 },
    tags: ["Bene Gesserit", "Intrigue"],
  },
};

// Function to get all defined Imperium cards as an array
export const getAllImperiumCards = () => {
  return Object.values(IMPERIUM_CARDS);
};

export const INTRIGUE_CARDS = {
  // Combat
  ambush: {
    id: "intrigue_ambush",
    name: "Ambush",
    type: "Intrigue",
    intrigueType: "Combat",
    effectText: "Gain +4 Strength in the current conflict.",
    effect: { swords: 4 },
  },
  decoy: {
    id: "intrigue_decoy",
    name: "Decoy",
    type: "Intrigue",
    intrigueType: "Combat",
    effectText: "Target opponent removes 2 troops from the conflict. If they have no troops in the conflict, they remove 2 troops from their garrison instead.",
    effect: { custom: "decoy_effect" }, // Needs target selection
  },
  poisonSnooper: {
    id: "intrigue_poison_snooper",
    name: "Poison Snooper",
    type: "Intrigue",
    intrigueType: "Plot", // Can be played anytime to see hand, but effect is disruptive
    effectText: "Look at an opponent's hand. Choose 1 card for them to discard.",
    effect: { custom: "poison_snooper_effect" }, // Needs target selection & card choice
  },
  stilgar: { // Made this an intrigue for example, could be a leader or other card type
    id: "intrigue_stilgar",
    name: "Stilgar's Cunning",
    type: "Intrigue",
    intrigueType: "Combat",
    effectText: "Deploy 2 troops to your garrison. Gain +2 Strength in the current conflict.",
    effect: { recruit: { count: 2, toConflict: false }, swords: 2 },
  },

  // Plot
  guildAuthorization: {
    id: "intrigue_guild_authorization",
    name: "Guild Authorization",
    type: "Intrigue",
    intrigueType: "Plot",
    effectText: "Gain 2 Spice and 1 Influence with the Spacing Guild.",
    effect: { resources: { spice: 2 }, gainInfluence: { faction: "spacingGuild", amount: 1 } },
  },
  secretsWithinSecrets: { // Renamed "Secrets" for flavor
    id: "intrigue_secrets",
    name: "Secrets Within Secrets",
    type: "Intrigue",
    intrigueType: "Plot",
    effectText: "Draw 2 cards from your deck.",
    effect: { draw: 2 },
  },
  binduSuspension: {
    id: "intrigue_bindu_suspension",
    name: "Bindu Suspension",
    type: "Intrigue",
    intrigueType: "Plot",
    effectText: "Choose one of your Agents on the board. That Agent is not recalled during the Recall Phase this round. (It remains on its board space.)",
    effect: { custom: "bindu_suspension_effect" }, // Needs agent selection
  },
  hiddenStash: {
    id: "intrigue_hidden_stash",
    name: "Hidden Stash",
    type: "Intrigue",
    intrigueType: "Plot",
    effectText: "Gain 3 Solari.",
    effect: { resources: { solari: 3 } },
  },

  // Endgame
  cornerTheMarket: {
    id: "intrigue_corner_the_market",
    name: "Corner the Market",
    type: "Intrigue",
    intrigueType: "Endgame",
    effectText: "At game end, if you have the most Spice, gain 2 VP.",
    effect: { endgameVP: { condition: "most_spice", value: 2 } },
  },
  politicalMarriage: {
    id: "intrigue_political_marriage",
    name: "Political Marriage",
    type: "Intrigue",
    intrigueType: "Endgame",
    effectText: "At game end, if you have an Alliance with at least two Factions, gain 3 VP.",
    effect: { endgameVP: { condition: "two_alliances", value: 3 } },
  },
   wellPlannedMove: {
    id: "intrigue_well_planned_move",
    name: "A Well-Planned Move",
    type: "Intrigue",
    intrigueType: "Plot",
    effectText: "Gain 1 VP.",
    effect: { vp: 1 },
  },
};

export const getAllIntrigueCards = () => {
  return Object.values(INTRIGUE_CARDS);
};
