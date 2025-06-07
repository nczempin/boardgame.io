// src/games/dune-imperium/leaders.js

export const LEADERS = {
  paulAtreides: {
    id: "paulAtreides",
    name: "Paul Atreides",
    house: "Atreides",
    complexity: 1,
    leftAbilityText: "At start of your turn, look at the top card of your deck. You may place it on the bottom.",
    signetAbilityText: "When you win a combat where you have at least 1 troop, gain 1 troop to your garrison.",
    // Internal flags/helpers can be added here if needed for mechanics
  },
  glossuRabban: {
    id: "glossuRabban",
    name: "Glossu Rabban",
    house: "Harkonnen",
    complexity: 1,
    leftAbilityText: "Whenever an opponent gains troops (from any source other than combat rewards), gain 1 Solari.",
    signetAbilityText: "Pay 2 Solari to gain 1 troop to your garrison.",
  },
  memnonThorvald: {
    id: "memnonThorvald",
    name: "Earl Memnon Thorvald",
    house: "Thorvald", // Assuming a minor house or custom for example
    complexity: 1,
    leftAbilityText: "Whenever you commit troops to the conflict (from your garrison or directly deployed), gain 1 Solari.",
    signetAbilityText: "Gain 1 Solari and 1 troop to your garrison.",
  },
  ilbanRichese: {
    id: "ilbanRichese",
    name: "Count Ilban Richese",
    house: "Richese",
    complexity: 1,
    leftAbilityText: "Whenever you acquire a card with a 'Tech' icon, gain 1 Solari.",
    signetAbilityText: "Focus: Draw 1 card from your deck.", // Focus usually means immediate, like a cantrip
  },
  // Add more leaders here later
};

// Helper function to get a list of basic leader IDs for initial assignment
export const getBasicLeaderIds = () => {
  return [LEADERS.paulAtreides.id, LEADERS.glossuRabban.id, LEADERS.memnonThorvald.id, LEADERS.ilbanRichese.id];
};
