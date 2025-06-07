// examples/react-web/src/dune-imperium/game.js
import { DuneImperiumGame } from '../../../../src/games/dune-imperium/game'; // Adjust path as needed

// This client-side game object will wrap the core DuneImperiumGame logic
// for use with boardgame.io.

const DuneImperiumClient = {
  name: 'dune-imperium',

  // The setup function needs to return the initial game state.
  // We'll instantiate our DuneImperiumGame class here.
  setup: (ctx) => {
    const game = new DuneImperiumGame(ctx.numPlayers); // ctx.numPlayers will be provided by boardgame.io
    // The state `G` for boardgame.io will be the instance of our game class.
    // We might need to serialize or transform parts of it if it's too complex
    // or contains non-plain objects, but let's start with the direct instance.
    return {
        core: game, // G.core will hold our game engine instance
        // We can add other client-specific state here if needed
    };
  },

  // Define the moves that players can make.
  // These will call methods on the `G.core` (DuneImperiumGame instance).
  moves: {
    // Example: placeAgent move
    placeAgent: (G, ctx, playerId, cardId, locationId) => {
      // Ensure it's the current player making the move (boardgame.io might handle some of this)
      if (ctx.currentPlayer !== playerId.toString()) {
        console.error("It's not player " + playerId + "'s turn. Current player: " + ctx.currentPlayer);
        // Optionally, return INVALID_MOVE from boardgame.io/core if the move is illegal
        return; // Or handle error appropriately
      }
      const success = G.core.placeAgent(playerId, cardId, locationId);
      if (!success) {
        // Handle failed action e.g. by logging or returning an error state
        console.error(`Player ${playerId} failed to place agent with card ${cardId} at ${locationId}`);
        // Consider using boardgame.io's INVALID_MOVE for better feedback
      }
      // boardgame.io will automatically update G if G.core's state changed.
      // If DuneImperiumGame methods don't directly mutate but return new state,
      // you might need to do G.core = newCoreState;
    },

    revealTurn: (G, ctx, playerId, cardIdsToPlay) => {
      if (ctx.currentPlayer !== playerId.toString()) return; // Basic turn check
      G.core.revealTurn(playerId, cardIdsToPlay);
    },

    purchaseCard: (G, ctx, playerId, cardId) => {
      if (ctx.currentPlayer !== playerId.toString()) return;
      G.core.purchaseCard(playerId, cardId);
    },

    commitTroopsToCombat: (G, ctx, playerId, numberOfTroops) => {
      // This might not always be tied to currentPlayer if it's a reaction or out-of-turn action.
      // For now, assume it's part of the current player's turn actions after reveal.
      if (ctx.currentPlayer !== playerId.toString()) return;
      G.core.commitTroopsToCombat(playerId, numberOfTroops);
    },

    playIntrigueCard: (G, ctx, playerId, cardId) => {
      // Intrigue cards can often be played outside of normal turn order,
      // or by players other than the current player.
      // The core game logic (G.core.playIntrigueCard) should validate this.
      G.core.playIntrigueCard(playerId, cardId);
    },

    // This special move is called by boardgame.io automatically at the end of a player's turn actions.
    // We need to decide if we want to manually call phase transitions or if boardgame.io's turn order is enough.
    // For Dune: Imperium, a turn has multiple steps (agent, then reveal).
    // We might need a "pass" or "endRevealPhase" move.
    // Let's assume for now that after a player does their main actions, they might click an "End Turn" button
    // which could trigger a sequence of phase changes if all agents are played.
    endTurnActions: (G, ctx, playerId) => {
        if (ctx.currentPlayer !== playerId.toString()) return;
        G.core.endPlayerTurnActions();
    },

    passCombatIntrigue: (G, ctx, playerId) => {
      // This move is for when a player chooses not to play a combat intrigue card
      // during the combat phase when it's their turn to do so.
      // The core game logic (G.core) would need to track whose turn it is for combat intrigues
      // and if they have passed. For now, this client-side move exists for the AI to call.
      G.core.log(`Player ${playerId} passes playing a combat intrigue card.`);
      // TODO: Add state to G.core.players[playerId] like .hasPassedCombatIntrigue = true;
      // TODO: The core combat phase logic should then advance to the next player for combat intrigues,
      // or conclude the intrigue segment if all relevant players have passed.
    },
  },

  // Turn order logic. boardgame.io handles basic turn progression.
  // We need to define when a turn ends and potentially manage phases within a turn.
  turn: {
    // Dune: Imperium has distinct phases within a player's turn (Agent phase, Reveal phase).
    // boardgame.io's basic turn order might need to be augmented with game-specific phase management.
    // For now, let's assume a player makes one or more moves and then the turn passes.
    // The `endIf` below, along with G.core.gamePhase, will manage overall game flow.
    // onEnd: (G, ctx) => { /* This is called when a player's turn officially ends */ },
    // order: { /* custom turn order if needed */ }

    // Let the core game logic (G.core.gamePhase) dictate what can be done.
    // Moves should check G.core.gamePhase and G.core.currentPlayerIndex.
  },

  // Defines when the game ends.
  endIf: (G, ctx) => {
    if (G.core.gamePhase === 'gameOver') {
      const winner = G.core.players.find(p => p.victoryPoints >= 10); // Simplified
      if (winner) return { winner: winner.name };
      // Could also return scores for all players
      return { gameOver: true, scores: G.core.players.map(p => ({name: p.name, vp: p.victoryPoints})) };
    }
  },

  // AI configuration is now sourced from the core game class.
  ai: DuneImperiumGame.ai,
};

export default DuneImperiumClient;
