// Blackjack Game Logic
const BANKROLL_KEY = 'casino_bankroll';
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

let bankroll = 0;
let currentBet = 0;
let gameState = 'idle'; // idle, betting, playing, dealerTurn, finished
let deck = [];
let playerHand = [];
let dealerHand = [];

// Initialize game
function init() {
  loadBankroll();
  updateDisplay();
  createDeck();
  document.getElementById('deal').addEventListener('click', dealHand);
  document.getElementById('hit').addEventListener('click', playerHit);
  document.getElementById('stand').addEventListener('click', playerStand);
  document.getElementById('bet').addEventListener('change', (e) => {
    e.target.value = Math.max(1, Math.min(e.target.value, bankroll));
  });
}

// Load bankroll from localStorage
function loadBankroll() {
  bankroll = parseFloat(localStorage.getItem(BANKROLL_KEY)) || 1000;
  updateDisplay();
}

// Save bankroll to localStorage
function saveBankroll() {
  localStorage.setItem(BANKROLL_KEY, bankroll.toFixed(2));
  updateDisplay();
}

// Update UI display
function updateDisplay() {
  const bankrollEl = document.getElementById('bankroll');
  const sidebarEl = document.getElementById('sidebar-bankroll');
  const betInput = document.getElementById('bet');
  
  const formatted = formatMoney(bankroll);
  if (bankrollEl) bankrollEl.textContent = formatted;
  if (sidebarEl) sidebarEl.textContent = formatted;
  if (betInput) betInput.max = bankroll;
}

// Format money as currency
function formatMoney(amount) {
  return '$' + parseFloat(amount).toFixed(2);
}

// Create and shuffle deck (8-deck shoe)
function createDeck() {
  deck = [];
  const NUM_DECKS = 8;
  for (let d = 0; d < NUM_DECKS; d++) {
    for (let suit of SUITS) {
      for (let rank of RANKS) {
        deck.push({ rank, suit });
      }
    }
  }
  shuffleDeck();
}

// Fisher-Yates shuffle
function shuffleDeck() {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

// Reshuffle if less than 25% of deck remaining
function checkReshuffle() {
  if (deck.length < 26) {
    createDeck();
  }
}

// Deal initial hand
function dealHand() {
  if (gameState !== 'idle') return;

  const betAmount = parseInt(document.getElementById('bet').value);
  if (isNaN(betAmount) || betAmount < 1 || betAmount > bankroll) {
    alert('Invalid bet amount');
    return;
  }

  currentBet = betAmount;
  bankroll -= currentBet;
  gameState = 'playing';

  // Clear previous hands
  playerHand = [];
  dealerHand = [];

  // Deal 2 cards to player and dealer
  playerHand.push(drawCard());
  dealerHand.push(drawCard());
  playerHand.push(drawCard());
  const dealerHoleCard = drawCard();
  dealerHoleCard.visible = false; // Hide dealer's second card
  dealerHand.push(dealerHoleCard);

  checkReshuffle();
  updateGameDisplay();

  // Check for blackjack
  if (getHandValue(playerHand) === 21 && playerHand.length === 2) {
    // Player blackjack - instant win with 3:2 payout
    setTimeout(() => {
      dealerHand[1].visible = true; // Reveal dealer hole card
      updateGameDisplay();
      setTimeout(() => {
        const payout = currentBet * 2.5; // 3:2 = 2.5x total return
        bankroll += payout;
        showResult('Blackjack!', 'win', payout - currentBet);
        saveBankroll();
        gameState = 'finished';
        resetGameUI();
      }, 500);
    }, 300);
    return;
  }

  // Enable Hit/Stand buttons
  document.getElementById('action-buttons').style.display = 'flex';
  document.getElementById('deal').disabled = true;
}

// Draw a card from deck
function drawCard() {
  if (deck.length === 0) createDeck();
  const card = deck.pop();
  card.visible = true;
  return card;
}

// Get numeric value of a hand
function getHandValue(hand, countHidden = false) {
  let value = 0;
  let aces = 0;

  for (let card of hand) {
    if (!card.visible && !countHidden) continue; // Skip hidden cards unless explicitly counting

    if (card.rank === 'A') {
      aces++;
      value += 11;
    } else if (['J', 'Q', 'K'].includes(card.rank)) {
      value += 10;
    } else {
      value += parseInt(card.rank);
    }
  }

  // Adjust for aces
  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }

  return value;
}

// Player hits
function playerHit() {
  if (gameState !== 'playing') return;

  playerHand.push(drawCard());
  checkReshuffle();
  updateGameDisplay();

  const playerValue = getHandValue(playerHand);
  if (playerValue > 21) {
    // Player bust
    setTimeout(() => {
      dealerHand[1].visible = true;
      updateGameDisplay();
      setTimeout(() => {
        showResult('You Bust!', 'lose', 0);
        gameState = 'finished';
        resetGameUI();
      }, 300);
    }, 200);
  }
}

// Player stands
function playerStand() {
  if (gameState !== 'playing') return;

  gameState = 'dealerTurn';
  document.getElementById('action-buttons').style.display = 'none';
  document.getElementById('deal').disabled = false;

  // Reveal dealer's hole card
  dealerHand[1].visible = true;
  updateGameDisplay();

  setTimeout(() => {
    // Dealer hits on 16 or less, stands on 17+
    while (getHandValue(dealerHand) < 17) {
      dealerHand.push(drawCard());
      checkReshuffle();
      updateGameDisplay();
    }

    setTimeout(() => {
      evaluateWinner();
    }, 300);
  }, 500);
}

// Evaluate winner
function evaluateWinner() {
  const playerValue = getHandValue(playerHand);
  const dealerValue = getHandValue(dealerHand);

  let result, resultClass, payout;

  if (dealerValue > 21) {
    // Dealer busts, player wins
    result = 'Dealer Busts — You Win!';
    resultClass = 'win';
    payout = currentBet * 2;
    bankroll += payout;
  } else if (playerValue > dealerValue) {
    // Player wins
    result = 'You Win!';
    resultClass = 'win';
    payout = currentBet * 2;
    bankroll += payout;
  } else if (playerValue === dealerValue) {
    // Push
    result = 'Push — Tie';
    resultClass = 'push';
    payout = currentBet;
    bankroll += payout;
  } else {
    // Dealer wins
    result = 'Dealer Wins';
    resultClass = 'lose';
    payout = 0;
  }

  showResult(result, resultClass, payout - currentBet);
  saveBankroll();
  gameState = 'finished';
  resetGameUI();
}

// Show result
function showResult(message, resultClass, profit) {
  const sidebarResult = document.getElementById('sidebar-result');
  const resultText = document.getElementById('sidebar-result-text');
  const resultAmount = document.getElementById('sidebar-result-amount');
  
  let profitText = profit > 0 ? `+${formatMoney(profit)}` : profit < 0 ? formatMoney(profit) : 'Return Bet';

  sidebarResult.className = `sidebar-result show ${resultClass}`;
  resultText.textContent = message;
  resultAmount.textContent = profitText;
}

// Reset UI for next hand
function resetGameUI() {
  setTimeout(() => {
    const sidebarResult = document.getElementById('sidebar-result');
    sidebarResult.className = 'sidebar-result';
    document.getElementById('action-buttons').style.display = 'none';
    document.getElementById('deal').disabled = false;
    document.getElementById('bet').focus();
    gameState = 'idle'; // Reset game state to allow next deal
  }, 2000);
}

// Update game display (cards and values)
function updateGameDisplay() {
  // Dealer hand
  const dealerCardsDiv = document.getElementById('dealer-cards');
  dealerCardsDiv.innerHTML = dealerHand
    .map((card, i) => renderCard(card, i === 1 && gameState !== 'dealerTurn' && gameState !== 'finished'))
    .join('');

  // Only show dealer value when second card is visible
  const dealerValue = getHandValue(dealerHand);
  document.getElementById('dealer-value').textContent =
    dealerHand.length >= 2 && dealerHand[1].visible ? `${dealerValue}` : '';

  // Player hand
  const playerCardsDiv = document.getElementById('player-cards');
  playerCardsDiv.innerHTML = playerHand.map((card) => renderCard(card, false)).join('');

  const playerValue = getHandValue(playerHand);
  document.getElementById('player-value').textContent = playerValue > 0 ? `${playerValue}` : '';
}

// Render card HTML
function renderCard(card, isHidden) {
  if (isHidden) {
    return '<div class="card card-back">🂠</div>';
  }

  const isRed = card.suit === '♥' || card.suit === '♦';
  const colorClass = isRed ? 'red' : 'black';

  return `
    <div class="card ${colorClass}">
      <div class="card-rank">${card.rank}</div>
      <div class="card-suit">${card.suit}</div>
    </div>
  `;
}

// Initialize on load
window.addEventListener('DOMContentLoaded', init);
