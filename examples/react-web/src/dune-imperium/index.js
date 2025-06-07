// examples/react-web/src/dune-imperium/index.js
import Singleplayer from './singleplayer';
// Future: import Multiplayer from './multiplayer';

// This defines the routes for the Dune: Imperium game examples.
// For now, we only have a singleplayer (hotseat) mode.
const routes = [
  {
    path: '/dune-imperium/singleplayer', // URL path
    text: 'Dune: Imperium (Hotseat)',    // Text for the link in the main navigation
    component: Singleplayer,         // The React component to render
  },
  // Example for future multiplayer route:
  // {
  //   path: '/dune-imperium/multiplayer',
  //   text: 'Dune: Imperium (Multiplayer)',
  //   component: Multiplayer,
  // },
];

export default { routes };
