// examples/react-web/src/dune-imperium/board.js
import React from 'react';
import PropTypes from 'prop-types';
import './board.css'; // We'll create this later if needed

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
    this.state = {
      selectedCardId: null,
      selectedLocationId: null,
      cardsSelectedForTrash: [], // For multi-card trash decisions
    };
  }

  // Toggle card selection for multi-card trash
  toggleCardForTrash = (cardToToggle) => {
    this.setState(prevState => {
      const decisionData = this.props.G.core.players[this.props.playerID]?.pendingDecision?.data;
      const maxCards = decisionData?.maxCards || 0;
      let newSelection = [...prevState.cardsSelectedForTrash];

      const existingIndex = newSelection.findIndex(c => c.id === cardToToggle.id && c.fromZone === cardToToggle.fromZone);

      if (existingIndex > -1) {
        newSelection.splice(existingIndex, 1); // Deselect
      } else {
        if (newSelection.length < maxCards) {
          newSelection.push(cardToToggle); // Select if under max
        } else if (maxCards === 1 && newSelection.length === 1) {
          // If max is 1, replace current selection
          newSelection = [cardToToggle];
        }
        // If maxCards > 1 and already at max, do nothing (or provide feedback)
      }
      return { cardsSelectedForTrash: newSelection };
    });
  }

  handleConfirmTrash = () => {
    const { G, playerID, moves } = this.props;
    const decision = G.core.players[playerID]?.pendingDecision;
    if (decision && (decision.type === 'selectCardsToTrash' || decision.type === 'selectCardToTrash')) {
      const { cardId, source } = decision.data; // cardId is the card *causing* the trash (e.g. Sietch RM or BG Initiate)

      if (decision.type === 'selectCardsToTrash') {
         moves.resolveSelectCardsToTrash(cardId, this.state.cardsSelectedForTrash);
      } else { // selectCardToTrash (single)
        const cardToTrash = this.state.cardsSelectedForTrash[0]; // Should only be one
        if (cardToTrash) {
            moves.resolveTrashCardChoice(cardId, cardToTrash.id, cardToTrash.fromZone);
        } else if (decision.data.mustTrash === false) { // Allowed to trash zero
            moves.resolveTrashCardChoice(cardId, null, decision.data.source); // Pass null if not trashing
        } else {
            console.error("Must select a card to trash for this decision."); // Or provide UI feedback
            return;
        }
      }
      this.setState({ cardsSelectedForTrash: [] }); // Clear selection
    }
  }


  handleCardClick = (cardId) => {
    if (this.props.isActive) {
      this.setState({ selectedCardId: cardId });
      // Potentially call a move or prepare for another action
      console.log(`Card clicked: ${cardId}`);
    }
  }

  handleLocationClick = (locationId) => {
    if (this.props.isActive && this.state.selectedCardId) {
      // Example: Place agent move
      // this.props.moves.placeAgent(this.state.selectedCardId, locationId);
      // this.setState({ selectedCardId: null, selectedLocationId: null });
      console.log(`Location clicked: ${locationId} with card ${this.state.selectedCardId}`);
      // This is just a placeholder, actual move call will depend on game phase and action
       this.props.moves.placeAgent(this.state.selectedCardId, locationId, {});
       this.setState({ selectedCardId: null, selectedLocationId: null });


    } else if (this.props.isActive) {
        this.setState({ selectedLocationId: locationId });
        console.log(`Location selected: ${locationId}. Waiting for card or action.`);
    }
  }

  handlePlayIntrigueCard = (cardId, targetData = {}) => {
    if (this.props.isActive) {
      this.props.moves.playIntrigueCard(cardId, targetData);
      console.log(`Played intrigue card: ${cardId}`);
    }
  }

  handleBuyCard = (cardId) => {
    if(this.props.isActive) {
      this.props.moves.purchaseCard(cardId);
    }
  }

  handleRevealTurn = () => {
    if(this.props.isActive) {
      // For simplicity, reveal all cards in hand.
      // A real UI would allow selecting which cards to reveal if that's a game rule.
      const handCardIds = this.props.G.core.players[this.props.playerID].hand.map(c => c.id);
      this.props.moves.revealTurn(handCardIds);
    }
  }

  handleEndTurnActions = () => {
     if(this.props.isActive) {
      this.props.moves.endTurnActions();
    }
  }


  renderPendingDecision() {
    const { G, ctx, playerID, moves, isActive } = this.props;
    const player = G.core.players[playerID];

    if (!isActive || !player || !player.pendingDecision) {
      return null;
    }

    const { type, data } = player.pendingDecision;
    // Example: G.core.players[this.props.playerID].pendingDecision
    //          = { type: 'selectPlayerTarget', data: { cardId: 'intrigue_decoy', cardName: 'Decoy', source: 'intrigueEffect', validTargetPlayerIds: ['1']}}

    switch (type) {
      case 'baronInitialInfluence':
        // Render UI for Baron Harkonnen's initial influence choice
        // Example: Faction buttons
        return (
          <div className="pending-decision">
            <h4>{data.cardName}</h4>
            <p>Choose 2 different factions for +1 influence each:</p>
            {/* Add faction selection UI and a submit button that calls moves.baronInitialInfluence */}
          </div>
        );
      case 'letoSignetChoice':
      case 'baronSignetChoice':
      case 'thorvaldHighCouncilChoice':
        // These are other examples and would need their specific UI
        return (
            <div className="pending-decision">
                <h4>Leader Ability: {data.cardName}</h4>
                {/* Add UI for these choices */}
                 <button onClick={() => console.log("TODO: Implement leader decision UI")}>Resolve Leader Choice (Placeholder)</button>
            </div>
        );
      case 'optionalCost':
        return (
          <div className="pending-decision optional-cost-decision">
            <h4>Optional Cost for {data.cardName}</h4>
            <p>Cost: {JSON.stringify(data.cost)}</p>
            <p>Benefit: {JSON.stringify(data.benefit)}</p>
            <button onClick={() => moves.decideOptionalCost(data.cardId, data.source, true)}>Accept</button>
            <button onClick={() => moves.decideOptionalCost(data.cardId, data.source, false)}>Decline</button>
          </div>
        );
      // Add more cases for other decision types as they are implemented
      // e.g., selectCardToTrash, sardaukarDeployChoice, theVoiceChoice etc.

      // *** THIS IS WHERE THE NEW UI LOGIC WILL GO ***
      case 'selectPlayerTarget':
        return (
          <div className="pending-decision player-target-decision">
            <h4>Choose Target for {data.cardName}</h4>
            <p>Select an opponent:</p>
            {data.validTargetPlayerIds.map(opponentId => {
              const opponent = G.core.players[opponentId]; // Get opponent's data if needed for display
              return (
                <button
                  key={opponentId}
                  onClick={() => moves.selectPlayerTarget(data.cardId, data.source, opponentId)}
                >
                  Player {parseInt(opponentId) + 1} ({opponent?.leader?.name || 'Unknown Leader'})
                </button>
              );
            })}
          </div>
        );

      case 'selectCardFromPlayerZone':
        // Expected data: { cardId (original card, e.g. Snooper), cardName, source,
        //                   fromPlayerId, fromPlayerName, fromZone,
        //                   targetZoneCards, maxCards, originalEffectDef, customEffectId }
        return (
          <div className="pending-decision select-card-from-zone-decision">
            <h4>{data.cardName}: Player {data.fromPlayerName} reveals their {data.fromZone}.</h4>
            <p>Choose {data.maxCards} card(s) to discard:</p>
            <div className="cards-grid revealed-target-cards">
              {data.targetZoneCards.map(card => (
                <div
                  key={card.id}
                  className={`card revealed-card ${this.state.cardsSelectedForTrash.some(c => c.id === card.id) ? 'selected-for-action' : ''}`}
                  onClick={() => {
                    // For single card selection (maxCards=1), directly call the move.
                    // For multi-card, this might just toggle selection state.
                    if (data.maxCards === 1) {
                      moves.selectCardFromPlayerZone(data.cardId, data.source, data.fromPlayerId, data.fromZone, [card.id]);
                    } else {
                      // Implement multi-select toggle if needed here or rely on a confirm button
                      console.warn("Multi-card selection UI not fully implemented for selectCardFromPlayerZone yet beyond single click.");
                      moves.selectCardFromPlayerZone(data.cardId, data.source, data.fromPlayerId, data.fromZone, [card.id]);
                    }
                  }}
                >
                  <strong>{card.name}</strong>
                </div>
              ))}
            </div>
            {data.targetZoneCards.length === 0 && <p>Target has no cards in their {data.fromZone}.</p>}
          </div>
        );

      case 'selectFactionForBribery': // New for Bribery
        return (
          <div className="pending-decision select-faction-bribery">
            <h4>{data.cardName || "Bribery"}</h4>
            <p>Choose a faction to gain {data.numInfluence || 2} influence:</p>
            {data.validFactions.map(factionId => (
              <button
                key={factionId}
                onClick={() => moves.resolveFactionChoice(data.cardId, data.reason || 'bribery', factionId)}
              >
                {factionId.charAt(0).toUpperCase() + factionId.slice(1)}
              </button>
            ))}
          </div>
        );

      case 'opponentChoice_blackmail': // New for Blackmail target
        return (
          <div className="pending-decision opponent-choice-blackmail">
            <h4>Blackmail from {data.demandingPlayerName}!</h4>
            <p>You must choose an option:</p>
            {data.options.map(opt => (
              <button
                key={opt.id}
                onClick={() => moves.resolveBlackmailChoice(opt.id)}
                disabled={opt.id === 'solari' && !data.canPaySolari}
              >
                {opt.text} {(opt.id === 'solari' && !data.canPaySolari) ? "(Cannot afford)" : ""}
              </button>
            ))}
          </div>
        );

      case 'opponentChoice_test_of_humanity': // New for Test of Humanity target
        return (
          <div className="pending-decision opponent-choice-testofhumanity">
            <h4>Test of Humanity!</h4>
            <p>Choose your penalty:</p>
            {data.options.map(opt => (
              <button
                key={opt.id}
                onClick={() => moves.resolveTestOfHumanityChoice(opt.id)}
                disabled={(opt.id === 'troop' && !data.canLoseTroop) || (opt.id === 'discard' && !data.canDiscardCard)}
              >
                {opt.text}
                {(opt.id === 'troop' && !data.canLoseTroop) ? " (No troops in garrison)" : ""}
                {(opt.id === 'discard' && !data.canDiscardCard) ? " (No cards in hand)" : ""}
              </button>
            ))}
            {/* If both disabled, player might be stuck - game logic should ideally prevent this or auto-resolve. */}
            {(!data.canLoseTroop && !data.canDiscardCard) && <p>No valid option to choose. The effect may not apply to you.</p>}
          </div>
        );

      case 'selectCardToTrash': // For single card trash like BG Initiate / Thufir
        return (
          <div className="pending-decision select-card-to-trash">
            <h4>{data.cardName || "Trash Card"}</h4>
            <p>{data.mustTrash ? "You must trash 1 card." : "You may trash 1 card."} From: {data.source === 'handOrDiscard' ? "Hand or Discard Pile" : "Hand"}</p>
            <div className="cards-grid">
              { (data.source === 'handOrDiscard' ? [...player.hand.map(c=>({...c, fromZone:'hand'})), ...player.discardPile.map(c=>({...c, fromZone:'discardPile'}))] : player.hand.map(c=>({...c, fromZone:'hand'})) ).map(card => (
                <div
                  key={card.id + card.fromZone}
                  className={`card ${this.state.cardsSelectedForTrash[0]?.id === card.id && this.state.cardsSelectedForTrash[0]?.fromZone === card.fromZone ? 'selected-for-action' : ''}`}
                  onClick={() => this.toggleCardForTrash({id: card.id, name: card.name, fromZone: card.fromZone})}
                >
                  <strong>{card.name}</strong> ({card.fromZone})
                </div>
              ))}
            </div>
            <button onClick={this.handleConfirmTrash} disabled={data.mustTrash && this.state.cardsSelectedForTrash.length === 0}>
              Confirm Trash ({this.state.cardsSelectedForTrash.length} selected)
            </button>
            {!data.mustTrash && this.state.cardsSelectedForTrash.length === 0 && (
              <button onClick={() => moves.resolveTrashCardChoice(data.cardId, null, data.source)}>Skip Trashing</button>
            )}
          </div>
        );

      case 'selectCardsToTrash': // For Sietch Reverend Mother (plural)
        return (
          <div className="pending-decision select-cards-to-trash">
            <h4>{data.cardName || "Trash Cards"}</h4>
            <p>{data.reason || `You may trash up to ${data.maxCards} card(s) from your hand or discard pile.`}</p>
            <p>Selected {this.state.cardsSelectedForTrash.length} of {data.maxCards}.</p>
            <div className="cards-grid">
              {data.availableCards.map(card => (
                <div
                  key={card.id + card.fromZone}
                  className={`card ${this.state.cardsSelectedForTrash.some(c => c.id === card.id && c.fromZone === card.fromZone) ? 'selected-for-action' : ''}`}
                  onClick={() => this.toggleCardForTrash({id: card.id, name: card.name, fromZone: card.fromZone})}
                >
                  <strong>{card.name}</strong> ({card.fromZone})
                </div>
              ))}
            </div>
            <button onClick={this.handleConfirmTrash}>
              Confirm Trash ({this.state.cardsSelectedForTrash.length} card(s))
            </button>
          </div>
        );


      default:
        return <div className="pending-decision">Unhandled decision: {type}</div>;
    }
  }

  render() {
    const { G, ctx, playerID, isActive } = this.props;
    const player = G.core.players[playerID]; // Current player's full state from core

    if (!player) {
      return <div className="dune-board">Loading or no player data...</div>;
    }

    const decisionElement = this.renderPendingDecision();

    return (
      <div className="dune-board">
        <header>
          <h1>Dune: Imperium (Player {parseInt(playerID) + 1} - {player.leader.name})</h1>
          <p>Phase: {G.core.gamePhase}, Round: {G.core.round}, Current Turn: Player {G.core.currentPlayerIndex + 1}</p>
          {isActive ? <p style={{color: 'green'}}>Your Turn</p> : <p style={{color: 'red'}}>Waiting for opponent</p>}
        </header>

        {decisionElement && <div className="decision-panel">{decisionElement}</div>}

        {!decisionElement && isActive && (
          <div className="actions-panel">
            {/* Placeholder for general actions like reveal turn, buy card, pass */}
            {player.agents === 0 && !player.hasPassedReveal && G.core.gamePhase === 'playerTurn' && (
              <>
                <button onClick={this.handleRevealTurn}>Reveal Turn</button>
                <button onClick={this.handleEndTurnActions}>End Reveal Actions (Pass Purchases)</button>
              </>
            )}
             {player.agents === 0 && player.hasPassedReveal && G.core.gamePhase === 'playerTurn' && (
                <button onClick={() => this.props.moves.endPlayerTurnActions()}>End Turn (Combat)</button>
            )}
          </div>
        )}

        <div className="main-layout">
          <div className="player-area">
            <h3>Your Hand (Player {parseInt(playerID) + 1})</h3>
            <div className="cards-grid">
              {player.hand.map(card => (
                <div key={card.id} className={`card ${this.state.selectedCardId === card.id ? 'selected' : ''}`} onClick={() => this.handleCardClick(card.id)}>
                  <strong>{card.name}</strong> ({card.type})
                  <p>Icons: {card.agentIcons?.join(', ')}</p>
                  <p><em>{card.agentEffectText}</em></p>
                  <p>Reveal: {card.revealEffectText || `${card.persuasion || 0}P, ${card.swords || 0}S`}</p>
                </div>
              ))}
            </div>
             <h4>Intrigue Cards:</h4>
            <div className="cards-grid">
            {player.intrigueCards.map(card => (
                <div key={card.id} className="card intrigue-card">
                    <strong>{card.name}</strong> ({card.intrigueType})
                    <p>{card.effectText}</p>
                    {isActive && G.core.gamePhase === 'playerTurn' && (
                        <button onClick={() => this.handlePlayIntrigueCard(card.id, {})}>Play Intrigue</button>
                    )}
                </div>
            ))}
            </div>
            <p>Resources: Spice: {player.resources.spice}, Solari: {player.resources.solari}, Water: {player.resources.water}</p>
            <p>Persuasion: {player.resources.persuasion}, Swords: {player.resources.swords}</p>
            <p>Agents: {player.agents}</p>
            {/* Display other player info: VP, influence, garrison, etc. */}
          </div>

          <div className="board-area">
            <h3>Board Locations</h3>
            <div className="locations-grid">
              {Object.entries(G.core.boardLocations).map(([locId, locData]) => (
                <div key={locId} className={`location ${this.state.selectedLocationId === locId ? 'selected-location' : ''}`} onClick={() => this.handleLocationClick(locId)}>
                  <strong>{locData.name}</strong> ({locData.faction}) [{locData.agents.length}/{locData.agentSlots}]
                  <p>{locData.effectText}</p>
                  <p>Agents: {locData.agents.map(pId => `P${parseInt(pId)+1}`).join(', ')}</p>
                </div>
              ))}
            </div>
             <h3>Imperium Row</h3>
            <div className="cards-grid">
              {G.core.imperiumRow.map(card => (
                <div key={card.id} className="card imperium-row-card" onClick={() => this.handleBuyCard(card.id)}>
                  <strong>{card.name}</strong> (Cost: {card.cost})
                  <p>Icons: {card.agentIcons?.join(', ')}</p>
                  <p><em>{card.agentEffectText}</em></p>
                   <p>Reveal: {card.revealEffectText || `${card.persuasion || 0}P, ${card.swords || 0}S`}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="opponents-area">
            <h3>Opponents</h3>
            {G.core.players.filter(p => p.id !== parseInt(playerID)).map(opp => (
              <div key={opp.id} className="opponent-summary">
                Player {opp.id + 1} ({opp.leader.name}) - VP: {opp.victoryPoints}, Agents: {opp.agents}, Hand: {opp.hand.length}, Intrigue: {opp.intrigueCards.length}
              </div>
            ))}
          </div>
        </div>

        {/* Game Log could go here */}
        <div className="game-log">
            <h4>Game Log:</h4>
            {G.core.logs.slice(0,10).map((log, index) => <p key={index}>{log}</p>)}
        </div>

      </div>
    );
  }
}

export default DuneImperiumBoard;
