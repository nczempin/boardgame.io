// examples/react-web/src/dune-imperium/singleplayer.js
import React from 'react';
import { Client } from 'boardgame.io/react';
import { Debug } from 'boardgame.io/debug';
import { MCTSBot } from 'boardgame.io/ai';
import DuneImperiumClientGame from './game'; // This is our game definition for boardgame.io client
import DuneImperiumBoard from './board';

// The game object for the bot needs to be the same as used by the client.
// DuneImperiumClientGame already includes the .ai configuration from DuneImperiumGame.ai
const bot = new MCTSBot({
  game: DuneImperiumClientGame, // Pass the game definition, which includes the AI enumerate function
  iterations: 100, // Number of MCTS iterations per turn - adjust for performance/strength
  playoutDepth: 50, // Max depth of playouts - adjust for performance/strength
  // Optional: objectives can be defined here if not part of the game definition itself.
  // objectives: (G, ctx, playerID) => { /* ... return objectives ... */ }
});

const DuneImperiumAppClient = Client({
  game: DuneImperiumClientGame,
  board: DuneImperiumBoard,
  debug: { impl: Debug },
  numPlayers: 2, // Let's set up for Human (P0) vs AI (P1)
  // The `ai` prop on the Client tells boardgame.io which bot to use for which player.
  ai: {
    // Player '1' will be controlled by the MCTSBot.
    // Player '0' will be human controlled as it's not specified here.
    '1': bot,
  },
});

const SingleplayerWithAI = () => (
  <div style={{ padding: '20px' }}>
    <h1>Dune: Imperium (Human vs AI)</h1>
    <p>You are Player 0.</p>
    {/*
      matchID: Identifies the game instance.
      playerID: Specifies which player this client instance represents (Player 0 for human).
    */}
    <DuneImperiumAppClient matchID="dune-imperium-ai-match" playerID="0" />
  </div>
);

export default SingleplayerWithAI;
