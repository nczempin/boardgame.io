// src/games/dune-imperium/leaders.js

export const LEADERS = {
  paulAtreides: {
    id: "paulAtreides",
    name: "Paul Atreides",
    house: "Atreides",
    complexity: 1,
    leftAbilityText: "Prescience: At the start of your turn, look at the top card of your deck. You may place it on the bottom of your deck.",
    signetAbilityText: "Draw a card.",
  },
  glossuRabban: {
    id: "glossuRabban",
    name: 'Glossu "Beast" Rabban',
    house: "Harkonnen",
    complexity: 1,
    leftAbilityText: "Start with +2 Spice and +2 Solari.",
    signetAbilityText: "If you have an alliance with any faction, recruit 2 troops to your garrison.",
    requiresAllianceForSignet: true,
  },
  memnonThorvald: {
    id: "memnonThorvald",
    name: "Earl Memnon Thorvald",
    house: "Thorvald",
    complexity: 2,
    leftAbilityText: "When you take an agent turn at High Council, you may gain 2 influence with any one faction present on the High Council space.",
    signetAbilityText: "Gain 1 Spice.",
  },
  ilbanRichese: {
    id: "ilbanRichese",
    name: "Count Ilban Richese",
    house: "Richese",
    complexity: 2,
    leftAbilityText: "When you take an agent turn at Mentat and take the Mentat token, draw 1 additional card.",
    signetAbilityText: "Gain 1 Solari if you played a card with a 'Tech' tag this agent turn.",
    signetRequiresTechCardThisTurn: true,
  },
  dukeLetoAtreides: {
    id: "dukeLetoAtreides",
    name: "Duke Leto Atreides",
    house: "Atreides",
    complexity: 2,
    leftAbilityText: "When you take an agent turn at a Landsraad board space that has a Solari cost, reduce that cost by 1 Solari (to a minimum of 0).",
    signetAbilityText: "If any opponent has more VP than you, you may pay 1 Spice to gain 1 influence with a faction of your choice.",
    signetCost: { spice: 1 },
  },
  baronVladimirHarkonnen: {
    id: "baronVladimirHarkonnen",
    name: "Baron Vladimir Harkonnen",
    house: "Harkonnen",
    complexity: 3,
    leftAbilityText: "At the start of the game, gain 1 influence with two different factions of your choice.",
    signetAbilityText: "Pay 1 Solari to draw 1 Intrigue card.",
    signetCost: { solari: 1 },
  },
  helenaRichese: {
    id: "helenaRichese",
    name: "Helena Richese",
    house: "Richese",
    complexity: 3,
    leftAbilityText: "You may take agent turns at Landsraad spaces or 'Populated' board spaces (Arrakeen, Carthag) even if they are occupied by one opponent's agent. This does not apply if occupied by your own agent or if all slots are full.",
    signetAbilityText: "Gain 2 Persuasion. This Persuasion may only be used this turn to acquire one card from the Imperium Row.",
    signetGrantsTemporaryPersuasion: 2,
  },
  arianaThorvald: {
    id: "arianaThorvald",
    name: "Countess Ariana Thorvald",
    house: "Thorvald",
    complexity: 1,
    leftAbilityText: "When you take an agent turn at a Spice harvesting board space (The Great Flat, Hagga Basin, Imperial Basin), draw 1 card but gain 1 less Spice from that space.",
    signetAbilityText: "Gain 2 Water.",
  }
};

export const getBasicLeaderIds = () => {
  return Object.keys(LEADERS);
};

export const getLeaderData = (leaderId) => {
  return LEADERS[leaderId];
};
