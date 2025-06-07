// examples/react-web/src/dune-imperium/board.js
import React from 'react';
import PropTypes from 'prop-types';
import './dune-imperium.css'; // We'll create this css file next

class DuneImperiumBoard extends React.Component {
  static propTypes = {
    G: PropTypes.any.isRequired,
    ctx: PropTypes.any.isRequired,
    moves: PropTypes.any.isRequired,
    playerID: PropTypes.string,
    isActive: PropTypes.bool,
    isMultiplayer: PropTypes.bool,
  };

  constructor(props) {
    super(props);
    // Initialize component state if needed
    this.state = {
        // Example: selectedLocation: null, selectedCard: null
    };
  }

  handleLocationClick = (locationId) => {
    if (!this.props.isActive) return;
    // Example: if a card is selected, try to play it to this location
    // this.props.moves.placeAgent(this.props.playerID, this.state.selectedCard, locationId);
    console.log(`Location ${locationId} clicked by player ${this.props.playerID}`);
    // For now, let's make a dummy move if one is available
    // In a real scenario, we'd get cardId from player's hand selection
    if (this.props.G.core && this.props.G.core.players[this.props.playerID] && this.props.G.core.players[this.props.playerID].hand.length > 0) {
        const cardId = this.props.G.core.players[this.props.playerID].hand[0].id; // DANGER: just taking first card
        // this.props.moves.placeAgent(parseInt(this.props.playerID), cardId, locationId);
    } else {
        console.log("No card in hand or player not found to make a move.");
    }
  };

  handleCardClick = (cardId) => {
    if (!this.props.isActive) return;
    console.log(`Card ${cardId} clicked by player ${this.props.playerID}`);
    // Example: this.setState({ selectedCard: cardId });
  }

  handlePurchaseClick = (cardId) => {
    if (!this.props.isActive) return;
    console.log(`Attempting to purchase ${cardId}`);
    this.props.moves.purchaseCard(parseInt(this.props.playerID), cardId);
  }

  handleRevealButtonClick = () => {
    if (!this.props.isActive) return;
    const player = this.props.G.core.players[this.props.playerID];
    if (player && player.hand.length > 0) {
        // For simplicity, revealing all cards in hand.
        // UI should allow selecting specific cards for reveal.
        const cardIdsToReveal = player.hand.map(c => c.id);
        this.props.moves.revealTurn(parseInt(this.props.playerID), cardIdsToReveal);
    } else {
        console.log("No cards in hand to reveal.");
    }
  }

  handleEndTurnActionsClick = () => {
    if (!this.props.isActive) return;
    console.log(`Player ${this.props.playerID} is ending their turn actions.`);
    this.props.moves.endTurnActions(parseInt(this.props.playerID));
  }


  render() {
    const { G, ctx, playerID, isActive } = this.props;
    const game = G.core; // Our DuneImperiumGame instance

    if (!game || !game.players || !playerID) {
      return <div>Loading or game not ready... Player ID: {playerID}</div>;
    }

    const currentPlayer = game.players[playerID]; // Data for the viewing player
    if (!currentPlayer) {
        return <div>Error: Player data not found for player ID {playerID}.</div>;
    }


    return (
      <div className="dune-imperium-board">
        <h1>Dune: Imperium - Player {playerID} ({isActive ? 'Your Turn' : 'Waiting'})</h1>
        <p>Game Phase: {game.gamePhase} | Current Turn: Player {game.players[game.currentPlayerIndex].name} | Round: {game.round}</p>

        {/* Player Information */}
        <div className="player-info">
          <h2>Your Stats ({currentPlayer.name})</h2>
          <p>Resources: Spice: {currentPlayer.resources.spice}, Solari: {currentPlayer.resources.solari}, Water: {currentPlayer.resources.water}</p>
          <p>Influence: Fremen: {currentPlayer.influence.fremen}, Bene Gesserit: {currentPlayer.influence.beneGesserit}, Spacing Guild: {currentPlayer.influence.spacingGuild}, Emperor: {currentPlayer.influence.emperor}</p>
          <p>Victory Points: {currentPlayer.victoryPoints}</p>
          <p>Agents available: {currentPlayer.agents}</p>
          <p>Troops in Garrison: {currentPlayer.garrison.count}</p>
          <p>Active Combat Units: {currentPlayer.activeCombatUnits}</p>
        </div>

        {/* Player Hand */}
        <div className="player-hand">
          <h3>Your Hand:</h3>
          {currentPlayer.hand.map(card => (
            <div key={card.id} className="card" onClick={() => this.handleCardClick(card.id)}>
              <strong>{card.name}</strong> ({card.type}) - Cost: {card.cost || 'N/A'} <br/> Effect: {card.effect}
            </div>
          ))}
        </div>

        {/* Imperium Row */}
        <div className="imperium-row">
            <h3>Imperium Row (Purchase cards here):</h3>
            {game.imperiumRow.map(card => (
                 <div key={card.id} className="card imperium-card" onClick={() => this.handlePurchaseClick(card.id)}>
                    <strong>{card.name}</strong> ({card.type}) - Cost: {card.cost} <br/> Effect: {card.effect} <br/> Persuasion: {card.persuasion}, Faction: {card.factionIcon}
                 </div>
            ))}
        </div>

        {/* Board Locations */}
        <div className="board-locations">
          <h3>Board Locations:</h3>
          {Object.entries(game.boardLocations).map(([locId, locData]) => (
            <div key={locId} className="location" onClick={() => this.handleLocationClick(locId)}>
              <strong>{locData.name}</strong> ({locData.faction || 'Neutral'}) - Agents: {locData.agents.length}/{locData.agentSlots}
              {locData.requiresWater && " (Req: Water)"} {locData.cost && `(Cost: ${locData.cost} Solari)`}
            </div>
          ))}
        </div>

        {/* Conflict Card */}
        <div className="conflict-zone">
            <h3>Current Conflict:</h3>
            {game.revealedConflict ? (
                <div className="card conflict-card">
                    <strong>{game.revealedConflict.name}</strong> (Level {game.revealedConflict.level}) <br/>
                    Rewards:
                    {game.revealedConflict.rewards.map((r, idx) => (
                        <span key={idx}> Rank {r.rank}: {JSON.stringify(r).replace(/"/g, '')}; </span>
                    ))}
                </div>
            ) : <p>No conflict active.</p>}
        </div>

        {/* Actions */}
        {isActive && (
          <div className="player-actions">
            <h3>Actions:</h3>
            {/* More specific action buttons will be needed here, e.g. selecting a card then a location */}
            <button onClick={this.handleRevealButtonClick} disabled={currentPlayer.agents > 0 || game.gamePhase !== 'playerTurn'}>Reveal Turn</button>
            <button onClick={this.handleEndTurnActionsClick}>End Turn Actions / Pass</button>
            {/* TODO: Add buttons for committing troops, playing intrigue cards etc. */}
          </div>
        )}

        {/* Game Log or History (Optional) */}
        {/* <div className="game-log">
          <h3>Game Log:</h3>
          { G.core.log.map((entry, idx) => <p key={idx}>{entry}</p>) }
        </div> */}

        {game.gamePhase === 'gameOver' && (
          <div className="game-over-message">
            <h2>Game Over!</h2>
            {/* TODO: Display winner or final scores from G.core.winner or ctx.gameover */}
            <p>{JSON.stringify(ctx.gameover)}</p>
          </div>
        )}
      </div>
    );
  }
}

export default DuneImperiumBoard;
