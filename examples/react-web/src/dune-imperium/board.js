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
    if (this.props.G.core && this.props.G.core.players[this.props.playerID]) {
        const selectedCard = this.state.selectedCard; // Use selected card from state
        if (selectedCard) {
            this.props.moves.placeAgent(parseInt(this.props.playerID), selectedCard, locationId);
        } else {
            console.log("No card selected to make a move.");
        }
    } else {
        console.log("Player not found or invalid game state.");
    }
  };

  handleCardClick = (cardId) => {
    if (!this.props.isActive) return;
    console.log(`Card ${cardId} clicked by player ${this.props.playerID}`);
    this.setState({ selectedCard: cardId }); // Update selected card state
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

    const viewingPlayer = game.players[playerID]; // Data for the viewing player
    if (!viewingPlayer) {
        return <div>Error: Player data not found for player ID {playerID}.</div>;
    }
    const leader = viewingPlayer.leader;


    return (
      <div className="dune-imperium-board">
        <h1>Dune: Imperium - Player {playerID} ({isActive ? 'Your Turn' : 'Waiting'})</h1>
        <p>Game Phase: {game.gamePhase} | Current Turn: Player {game.players[game.currentPlayerIndex].name} | Round: {game.round}</p>

        {/* Player Information */}
        <div className="player-info">
          <h2>Your Stats ({viewingPlayer.name})</h2>
          {leader && (
            <div className="leader-info">
              <h3>Leader: {leader.name}</h3>
              <p><em>Left Ability:</em> {leader.leftAbilityText}</p>
              <p><em>Signet Ability:</em> {leader.signetAbilityText}</p>
            </div>
          )}
          <p>Resources: Spice: {viewingPlayer.resources.spice}, Solari: {viewingPlayer.resources.solari}, Water: {viewingPlayer.resources.water}</p>
          <p>Influence: Fremen: {viewingPlayer.influence.fremen}, Bene Gesserit: {viewingPlayer.influence.beneGesserit}, Spacing Guild: {viewingPlayer.influence.spacingGuild}, Emperor: {viewingPlayer.influence.emperor}</p>
          <p>Victory Points: {viewingPlayer.victoryPoints}</p>
          <p>Agents available: {viewingPlayer.agents}</p>
          <p>Troops in Garrison: {viewingPlayer.garrison.count}</p>
          <p>Active Combat Units: {viewingPlayer.activeCombatUnits}</p>
          {viewingPlayer.paulTopCardInfo && isActive && (
            <div className="paul-peek-action">
              <p>Paul's Vision: Top card of your deck is <strong>{viewingPlayer.paulTopCardInfo.name}</strong>.</p>
              <button onClick={() => this.props.moves.paulKeepTopCard(playerID)}>Keep on Top</button>
              <button onClick={() => this.props.moves.paulBottomDeckCard(playerID)}>Place on Bottom</button>
            </div>
          )}
        </div>

        {/* Player Hand */}
        <div className="player-hand">
          <h3>Your Hand (Imperium/Starting Cards):</h3>
          {viewingPlayer.hand.map(card => (
            <div key={card.id} className="card" onClick={() => this.handleCardClick(card.id)} title={`Agent: ${card.agentEffectText || 'None'} | Reveal: ${card.revealEffectText || 'None'}`}>
              <strong>{card.name}</strong> ({card.type}) - Cost: {card.cost || 'N/A'} <br/> Icons: {card.agentIcons ? card.agentIcons.join(', ') : 'N/A'}
              <p style={{fontSize: '0.8em', margin: '2px 0'}}>A: {card.agentEffectText || 'None'}</p>
              <p style={{fontSize: '0.8em', margin: '2px 0'}}>R: {card.revealEffectText || 'None'}</p>
            </div>
          ))}
        </div>

        {/* Intrigue Cards */}
        {viewingPlayer.intrigueCards && viewingPlayer.intrigueCards.length > 0 && (
            <div className="intrigue-cards-hand">
                <h3>Your Intrigue Cards:</h3>
                {viewingPlayer.intrigueCards.map(card => (
                    <div key={card.id} className="card intrigue-card" title={card.effectText}>
                        <strong>{card.name}</strong> ({card.intrigueType})
                        <p style={{fontSize: '0.8em', margin: '2px 0'}}>{card.effectText}</p>
                        {isActive && <button onClick={() => this.props.moves.playIntrigueCard(parseInt(playerID), card.id)}>Play Intrigue</button>}
                    </div>
                ))}
            </div>
        )}

        {/* Imperium Row */}
        <div className="imperium-row">
            <h3>Imperium Row (Purchase cards here):</h3>
            {game.imperiumRow.map(card => (
                 <div key={card.id} className="card imperium-card" onClick={() => this.handlePurchaseClick(card.id)} title={`Agent: ${card.agentEffectText || 'None'} | Reveal: ${card.revealEffectText || 'None'}`}>
                    <strong>{card.name}</strong> ({card.type}) - Cost: {card.cost} <br/> Persuasion: {card.revealEffect ? card.revealEffect.persuasion || 0 : (card.persuasion || 0)}, Swords: {card.revealEffect ? card.revealEffect.swords || 0 : (card.swords || 0)}
                    <p style={{fontSize: '0.8em', margin: '2px 0'}}>A: {card.agentEffectText || 'None'}</p>
                    <p style={{fontSize: '0.8em', margin: '2px 0'}}>R: {card.revealEffectText || 'None'}</p>
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

        {/* Actions & Pending Decisions */}
        {isActive && (
          <div className="player-actions">
            <h3>Actions:</h3>
            {viewingPlayer.pendingDecision ? (
              this.renderPendingDecision()
            ) : (
              <>
                {/* Standard action buttons only if no pending decision */}
                <button
                    onClick={this.handleRevealButtonClick}
                    disabled={viewingPlayer.agents > 0 || game.gamePhase !== 'playerTurn' || viewingPlayer.hasPassedReveal}
                >
                    Reveal Turn
                </button>
                <button
                    onClick={this.handleEndTurnActionsClick}
                    disabled={game.gamePhase !== 'playerTurn'}
                >
                    End Turn Actions / Pass
                </button>
                {/* TODO: Add buttons for committing troops (now part of deploy decision), playing intrigue cards (some are auto, some need target) */}
              </>
            )}
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
