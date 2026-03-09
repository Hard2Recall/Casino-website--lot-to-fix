// Simple slot machine simulator
(function(){
  const SYMBOLS = ['🍒','🍋','🔔','🍀','💎','7️⃣'];
  const PAYTABLE = {
    '7️⃣,7️⃣,7️⃣': 50,
    '💎,💎,💎': 30,
    '🍀,🍀,🍀': 20,
    '🔔,🔔,🔔': 15,
    '🍋,🍋,🍋': 10,
    '🍒,🍒,🍒': 8
  };

  const bankrollEl = document.getElementById('bankroll');
  const lastWinEl = document.getElementById('last-win');
  const historyEl = document.getElementById('history');
  const betInput = document.getElementById('bet');
  const spinBtn = document.getElementById('spin');
  const resetBtn = document.getElementById('reset');
  const betHalfBtn = document.getElementById('bet-half');
  const betMaxBtn = document.getElementById('bet-max');

  let bankroll = loadBankroll();
  let lastWin = 0;

  function loadBankroll(){
    try{
      const v = localStorage.getItem('casino_bankroll');
      return v ? Number(v) : 1000;
    }catch(e){
      return 1000;
    }
  }

  function saveBankroll(){
    try{ localStorage.setItem('casino_bankroll', String(bankroll)); }catch(e){}
  }

  function render(){
    bankrollEl.textContent = `$${bankroll.toFixed(2)}`;
    lastWinEl.textContent = `$${lastWin.toFixed(2)}`;
  }

  function spinOnce(bet){
    // pick random symbols per reel
    const res = [randSym(), randSym(), randSym()];
    return res;
  }

  function randSym(){
    return SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)];
  }

  function payoutFor(result, bet){
    const key = result.join(',');
    if(PAYTABLE[key]) return bet * PAYTABLE[key];

    // two of a kind pays 1.5x
    const counts = {};
    for(const s of result) counts[s] = (counts[s]||0)+1;
    if(Object.values(counts).includes(2)) return Math.floor(bet * 1.5);

    return 0;
  }

  function addHistory(text){
    const li = document.createElement('li');
    li.textContent = text;
    historyEl.prepend(li);
    // limit history
    while(historyEl.children.length>30) historyEl.removeChild(historyEl.lastChild);
  }

  function animateSpin(finalSymbols){
    const reels = [document.getElementById('reel1'), document.getElementById('reel2'), document.getElementById('reel3')];
    const durations = [900,1200,1500];
    reels.forEach((r,i)=>{
      const start = Date.now();
      const dur = durations[i];
      const tick = ()=>{
        const t = Date.now()-start;
        if(t<dur){
          r.textContent = SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)];
          requestAnimationFrame(tick);
        }else{
          r.textContent = finalSymbols[i];
        }
      };
      tick();
    });
  }

  spinBtn.addEventListener('click',()=>{
    let bet = Number(betInput.value) || 0;
    if(bet<=0){ alert('Bet must be at least 1'); return; }
    if(bet>bankroll){ alert('Not enough bankroll for that bet'); return; }

    // perform spin
    bankroll -= bet;
    saveBankroll();
    render();

    const result = spinOnce(bet);
    animateSpin(result);

    // after animation ends (max duration 1600ms), compute payout
    setTimeout(()=>{
      const win = payoutFor(result, bet);
      lastWin = win;
      bankroll += win;
      saveBankroll();
      render();

      addHistory(`${new Date().toLocaleTimeString()} — Bet $${bet} → ${result.join(' ')} — Win $${win}`);
    },1700);
  });

  resetBtn.addEventListener('click',()=>{
    if(!confirm('Reset bankroll to $1000?')) return;
    bankroll = 1000; lastWin = 0; saveBankroll(); render();
    historyEl.innerHTML = '';
  });

  betHalfBtn.addEventListener('click',()=>{
    betInput.value = Math.max(1, Math.floor((bankroll||0)/2));
  });

  betMaxBtn.addEventListener('click',()=>{
    betInput.value = Math.max(1, Math.floor(bankroll||0));
  });

  // initial render
  render();

  // expose some functions for console tinkering
  window.casino = {getBankroll:()=>bankroll, setBankroll:(v)=>{bankroll=Number(v);saveBankroll();render()}}

})();
