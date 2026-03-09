// Higher / Lower — redesigned to match Dice/Slots visual style and sidebar sync
(() => {
  // Elements
  const bankrollEl = document.getElementById('sidebar-bankroll') || document.getElementById('bankroll');
  const betInput = document.getElementById('bet');
  const shownEl = document.getElementById('shown-card');
  const rerollBtn = document.getElementById('reroll');
  const guessHigherBtn = document.getElementById('guess-higher');
  const guessLowerBtn = document.getElementById('guess-lower');
  const multiplierEl = document.getElementById('multiplier');
  const potentialEl = document.getElementById('potential');
  const lastCardEl = document.getElementById('last-card');
  const deckLeftEl = document.getElementById('deck-left');
  const cashoutBtn = document.getElementById('cashout');
  const logEl = document.getElementById('hl-log');
  const cardCanvas = document.getElementById('card-canvas');

  // Sidebar result elements
  const sidebarResultBox = document.getElementById('sidebar-result');
  const sidebarResultText = document.getElementById('sidebar-result-text');
  const sidebarResultAmount = document.getElementById('sidebar-result-amount');
  const sidebarLastTxt = document.getElementById('sidebar-last-roll-txt');

  // bankroll persistence
  let bankroll = loadBankroll();
  function loadBankroll(){ try{ const v=localStorage.getItem('casino_bankroll'); return v?Number(v):1000 }catch(e){return 1000} }
  function saveBankroll(){ try{ localStorage.setItem('casino_bankroll',String(bankroll)); }catch(e){} }
  function renderBankroll(){ if(bankrollEl) bankrollEl.textContent = `$${bankroll.toFixed(2)}`; }
  renderBankroll();

  const HOUSE_EDGE = 1.0; // percent

  // deck helpers
  const SUITS = ['♦','♥','♣','♠'];
  const RANK_NAMES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

  function makeDeck(){
    const d = [];
    for(let s=0;s<4;s++){
      for(let r=1;r<=13;r++){
        d.push({rank:r,suit:SUITS[s]});
      }
    }
    return d;
  }
  function shuffle(deck){
    for(let i=deck.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [deck[i],deck[j]]=[deck[j],deck[i]];
    }
  }
  function cardLabel(c){ return `${RANK_NAMES[c.rank-1]}${c.suit}`; }

  function payoutForChance(chance){ // chance in percent (0..100]
    const c = Math.max(1e-6, Math.min(99, Number(chance)));
    return (100 - HOUSE_EDGE) / c;
  }

  // state
  let deck = [];
  let shownCard = null;
  let currentBet = 0;
  let currentMultiplier = 1;
  let roundActive = false;

  // build/reset deck
  function resetDeck(){ deck = makeDeck(); shuffle(deck); }
  function generateShown(){ if(deck.length < 1) resetDeck(); shownCard = deck.pop(); shownEl.textContent = cardLabel(shownCard); cardCanvas.textContent = cardLabel(shownCard); deckLeftEl.textContent = deck.length; updatePotential(); syncSidebar(); }

  function updatePotential(){
    if(!roundActive){ potentialEl.textContent = '-'; multiplierEl.textContent = `x${currentMultiplier.toFixed(2)}`; return; }
    const higherCount = deck.reduce((acc,c)=> acc + (c.rank > shownCard.rank ? 1 : 0), 0);
    const lowerCount = deck.reduce((acc,c)=> acc + (c.rank < shownCard.rank ? 1 : 0), 0);
    const higherChance = higherCount / (deck.length + 1) * 100; // +1 to include the "next" card drawn probability approximation
    const lowerChance = lowerCount / (deck.length + 1) * 100;
    const higherMul = payoutForChance(higherChance);
    const lowerMul = payoutForChance(lowerChance);
    potentialEl.textContent = `Higher: x${higherMul.toFixed(2)} (${higherChance.toFixed(1)}%)  •  Lower: x${lowerMul.toFixed(2)} (${lowerChance.toFixed(1)}%)`;
    multiplierEl.textContent = `x${currentMultiplier.toFixed(2)}`;
  }

  function resetRoundState(){ currentBet = 0; currentMultiplier = 1; roundActive = false; cashoutBtn.disabled = true; lastCardEl.textContent = '-'; logEl.textContent=''; updatePotential(); syncSidebar(); }

  function startRoundWithBet(bet){ if(roundActive) return; if(bet<=0) return; if(bet>bankroll){ alert('Not enough bankroll'); return; }
    currentBet = bet; bankroll -= bet; saveBankroll(); renderBankroll(); roundActive = true; currentMultiplier = 1; cashoutBtn.disabled = false; updatePotential(); syncSidebar(); }

  // sync sidebar (event-driven)
  function syncSidebar(message){
    // bankroll already rendered; update last card and result box
    if(sidebarLastTxt) sidebarLastTxt.textContent = lastCardEl.textContent || '-';
    if(!message){
      sidebarResultText.textContent = 'RESULT';
      sidebarResultAmount.textContent = '$0';
      sidebarResultBox.className = 'sidebar-result';
      return;
    }
    if(message.startsWith('Win')){
      sidebarResultText.textContent = 'WIN!';
      sidebarResultAmount.textContent = message.split(' ').pop();
      sidebarResultBox.className = 'sidebar-result win';
    } else if(message.startsWith('Lose')){
      sidebarResultText.textContent = 'LOSE';
      sidebarResultAmount.textContent = message.split(' ').pop();
      sidebarResultBox.className = 'sidebar-result lose';
    } else {
      sidebarResultText.textContent = 'RESULT';
      sidebarResultAmount.textContent = '$0';
      sidebarResultBox.className = 'sidebar-result';
    }
  }

  // animate small flip (visual), then reveal card
  async function revealCard(next){
    cardCanvas.textContent = '...';
    await new Promise(r=>setTimeout(r, 240));
    cardCanvas.textContent = cardLabel(next);
  }

  async function doGuess(isHigher){
    if(!roundActive){
      const bet = Math.max(1, Math.round(Number(betInput.value) || 0));
      if(!Number.isFinite(bet) || bet<=0){ alert('Set a bet first'); return; }
      startRoundWithBet(bet);
    }
    if(deck.length < 1) resetDeck();
    const next = deck.pop();
    await revealCard(next);
    lastCardEl.textContent = cardLabel(next);
    deckLeftEl.textContent = deck.length;

    if(next.rank === shownCard.rank){
      // draw/push
      bankroll += currentBet; saveBankroll(); renderBankroll();
      logEl.innerHTML = `<p style="color:#cc0">Draw. Card ${cardLabel(next)} equals ${cardLabel(shownCard)} — bet returned ${formatMoney(currentBet)}</p>`;
      roundActive = false; cashoutBtn.disabled = true; updatePotential(); syncSidebar(`Win ${formatMoney(0)}`); // show push as neutral win
      return;
    }

    const won = isHigher ? (next.rank > shownCard.rank) : (next.rank < shownCard.rank);
    // compute remainingBefore including popped card
    const remainingBefore = deck.length + 1;
    const countWinningBefore = (isHigher ? (deck.reduce((acc,c)=> acc + (c.rank > shownCard.rank ? 1 : 0), 0) + (next.rank > shownCard.rank ? 1 : 0)) : (deck.reduce((acc,c)=> acc + (c.rank < shownCard.rank ? 1 : 0), 0) + (next.rank < shownCard.rank ? 1 : 0)));
    const chancePercent = (countWinningBefore / remainingBefore) * 100;
    const stageMul = payoutForChance(chancePercent);

    if(won){
      currentMultiplier = Math.round(currentMultiplier * stageMul * 100) / 100; // two decimals
      shownCard = next; shownEl.textContent = cardLabel(shownCard); updatePotential();
      logEl.innerHTML = `<p style="color:#8f8">Correct! Drew ${cardLabel(next)} — multiplier now x${currentMultiplier.toFixed(2)}</p>`;
      cashoutBtn.disabled = false;
      syncSidebar(''); // update sidebar but no final result yet
    } else {
      logEl.innerHTML = `<p style="color:#f66">Wrong. Drew ${cardLabel(next)} — you lost ${formatMoney(currentBet)}</p>`;
      currentBet = 0; roundActive = false; cashoutBtn.disabled = true; updatePotential();
      syncSidebar(`Lose ${formatMoney(currentBet)}`);
    }
  }

  function cashout(){
    if(!roundActive) return;
    const payout = Math.round(currentBet * currentMultiplier * 100) / 100;
    bankroll += payout; saveBankroll(); renderBankroll();
    logEl.innerHTML = `<p style="color:#8f8">Cashed out ${formatMoney(payout)} (mult x${currentMultiplier.toFixed(2)})</p>`;
    currentBet = 0; roundActive = false; cashoutBtn.disabled = true; updatePotential();
    syncSidebar(`Win ${formatMoney(payout)}`);
  }

  function formatMoney(v){ return `$${v.toFixed(2)}` }

  // wire events
  rerollBtn.addEventListener('click', ()=>{ resetDeck(); generateShown(); });
  guessHigherBtn.addEventListener('click', ()=> doGuess(true));
  guessLowerBtn.addEventListener('click', ()=> doGuess(false));
  cashoutBtn.addEventListener('click', cashout);

  // initial setup
  resetDeck(); generateShown();

  // expose small debug API
  window.casino = {
    getBankroll: ()=>bankroll,
    setBankroll: (v)=>{ bankroll = Number(v); saveBankroll(); renderBankroll(); syncSidebar(''); }
  };

  // ensure sidebar and bankroll visible on load
  renderBankroll();
  syncSidebar('');
})();