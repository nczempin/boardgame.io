// examples/react-web/src/dune-imperium/game.js
import { Client } from 'boardgame.io/react';
import DuneImperiumGame from '../../../games/dune-imperium/game'; // Path to the core game logic
import DuneImperiumBoard from './board'; // Path to the React board component

// DuneImperiumClient wraps the core game logic for the client-side.
// It defines how moves are called from the UI and passes them to the core game.
export class DuneImperiumClientObj {
  constructor( G, ctx, playerID, ...plugins ) {
    this.G = G; // Game state
    this.ctx = ctx; // Turn order, game phase, etc.
    this.playerID = playerID; // Current player's ID

    // Define client-side moves. These typically call methods on G.core (the DuneImperiumGame instance)
    // For now, we'll keep this minimal. As we add UI interactions, we'll add more moves here.
    this.moves = {
      placeAgent: (cardId, locationId, agentDecisionData = {}) => {
        this.G.core.placeAgent(this.playerID, cardId, locationId, agentDecisionData);
      },
      revealTurn: (cardIdsToPlay) => {
        this.G.core.revealTurn(this.playerID, cardIdsToPlay);
      },
      purchaseCard: (cardId) => {
        this.G.core.purchaseCard(this.playerID, cardId);
      },
      playIntrigueCard: (cardId, targetData = {}) => {
        this.G.core.playIntrigueCard(this.playerID, cardId, targetData);
      },
      endTurnActions: () => {
        this.G.core.endPlayerTurnActions(this.playerID); // playerID might not be needed by core logic here
      },
      endPlayerTurnActions: () => { // Alias or specific if reveal phase pass
        this.G.core.endPlayerTurnActions(this.playerID);
      },
      // --- Decision Moves ---
      decideOptionalCost: (cardId, source, accept) => {
        this.G.core.decideOptionalCost(this.playerID, cardId, source, accept);
      },
      selectPlayerTarget: (cardId, source, selectedTargetPlayerId) => {
        // The core game's selectPlayerTarget expects an array for the last argument.
        this.G.core.selectPlayerTarget(this.playerID, cardId, source, [selectedTargetPlayerId]);
      },
      selectCardFromPlayerZone: (cardId, source, fromPlayerId, fromZone, selectedCardIds) => {
        this.G.core.selectCardFromPlayerZone(this.playerID, cardId, source, fromPlayerId, fromZone, selectedCardIds);
      },
      selectAgentLocation: (cardId, locationId) => {
        this.G.core.selectAgentLocation(this.playerID, cardId, locationId);
      },
      decideTroopDeployment: (locationId, numberOfTroops) => {
        this.G.core.decideTroopDeployment(this.playerID, locationId, numberOfTroops);
      },
      baronInitialInfluence: (chosenFactions) => {
        this.G.core.baronInitialInfluence(this.playerID, chosenFactions);
      },
      decideLetoSignet: (accept, chosenFaction) => {
        this.G.core.decideLetoSignet(this.playerID, accept, chosenFaction);
      },
      decideBaronSignet: (accept) => {
        this.G.core.decideBaronSignet(this.playerID, accept);
      },
      decideThorvaldHighCouncil: (chosenFaction) => {
        this.G.core.decideThorvaldHighCouncil(this.playerID, chosenFaction);
      },
      decideSardaukarDeployment: (cardId, numToDeploy) => {
        this.G.core.decideSardaukarDeployment(this.playerID, cardId, numToDeploy);
      },
      resolveTheVoiceChoice: (cardId, choice, targetPlayerId = null) => {
        this.G.core.resolveTheVoiceChoice(this.playerID, cardId, choice, targetPlayerId);
      },
      resolveTrashCardChoice: (cardId, cardToTrashId, trashSource) => {
        this.G.core.resolveTrashCardChoice(this.playerID, cardId, cardToTrashId, trashSource);
      },
      paulBottomDeckCard: () => {
        this.G.core.paulBottomDeckCard(this.playerID);
      },
      paulKeepTopCard: () => {
        this.G.core.paulKeepTopCard(this.playerID);
      }
      // Add other moves as needed
    };
    // Initialize plugins if any - none for now
    // plugins.forEach(plugin => plugin.init(this));
  }

  // Helper to get the current player's object from G
  get player() {
    return this.G.core.players[this.playerID];
  }
}

// This is the main export for the boardgame.io Client.
export const DuneImperiumClient = Client({
  game: DuneImperiumGame, // The core game object
  board: DuneImperiumBoard, // The React component for the board
  client: DuneImperiumClientObj, // The client-side move controller
  multiplayer: { server: 'localhost:8000' }, // Example for local multiplayer
  // ai: DuneImperiumGame.ai, // If AI is defined as a static property on the game class
  debug: true,
});

export default DuneImperiumClient;
