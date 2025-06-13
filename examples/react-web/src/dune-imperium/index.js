// examples/react-web/src/dune-imperium/index.js
import { Game } from 'boardgame.io/core';
import DuneImperiumGame from '../../../games/dune-imperium/game'; // Adjust path as necessary
import DuneImperiumBoard from './board'; // Will be created
import { DuneImperiumClient } from './game'; // Will be created

// This configures the game for the Lobby
const routes = [{
  path: '/dune-imperium',
  text: 'Dune: Imperium',
  component: DuneImperiumClient, // The client wrapper
}];

export default routes;
