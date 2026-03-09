// Slots — updated to match the Dice design and behavior (no reset button references)
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

  // Elements
  const bankrollEl = document.getElementById('bankroll') || document.getElementById('sidebar-bankroll');
  const lastWinEl = document.getElementById('last-win');
  const historyEl = document.getElementById('history');
  const betInput = document.getElementById('bet');
  const spinBtn = document.getElementById('spin');
  const betHalfBtn = document.getElementById('bet-half');
  const betMaxBtn = document.getElementById('bet-max');

  const reelEls = [
    document.getElementById('reel1'),
    document.getElementById('reel2'),
    document.getElementById('reel3')
  ];

  // Sidebar elements (for sync)
  const sidebarBankroll = document.getElementById('sidebar-bankroll');
  const sidebarLast = document.getElementById('sidebar-last-roll-txt');
  const sidebarResultBox = document.getElementById('sidebar-result');
  const sidebarResultText = document.getElementById('sidebar-result-text');
  const sidebarResultAmount = document.getElementById('sidebar-result-amount');

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

  function formatMoney(v){ return `$${(Math.round(v*100)/100).toFixed(2)}`; }

  function render(){
    if(bankrollEl) bankrollEl.textContent = formatMoney(bankroll);
    if(lastWinEl) lastWinEl.textContent = formatMoney(lastWin);
  }

  // Sidebar sync (event-driven)
  function syncSidebar(latestResultText){
    if(sidebarBankroll) sidebarBankroll.textContent = formatMoney(bankroll);
    if(sidebarLast) sidebarLast.textContent = latestResultText || '-';

    if(typeof latestResultText === 'string' && latestResultText.indexOf('Win')===0){
      sidebarResultText.textContent = 'WIN!';
      sidebarResultAmount.textContent = formatMoney(lastWin);
      sidebarResultBox.className = 'sidebar-result win';
    } else if(typeof latestResultText === 'string' && latestResultText.indexOf('Lose')===0){
      sidebarResultText.textContent = 'LOSE';
      sidebarResultAmount.textContent = latestResultText.split(' ').pop();
      sidebarResultBox.className = 'sidebar-result lose';
    } else {
      sidebarResultText.textContent = 'RESULT';
      sidebarResultAmount.textContent = '$0';
      sidebarResultBox.className = 'sidebar-result';
    }
  }

  // Random helpers
  function randSym(){ return SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)]; }
  function spinOnce(){ return [randSym(), randSym(), randSym()]; }

  // Payout logic (round to 2 decimals)
  function payoutFor(result, bet){
    const key = result.join(',');
    if(PAYTABLE[key]) return Math.round(bet * PAYTABLE[key] * 100) / 100;

    const counts = {};
    for(const s of result) counts[s] = (counts[s]||0)+1;
    if(Object.values(counts).includes(2)) return Math.round(bet * 1.5 * 100) / 100;

    return 0;
  }

  // Keep history
  function addHistory(text){
    const li = document.createElement('li');
    li.textContent = text;
    historyEl.prepend(li);
    while(historyEl.children.length>30) historyEl.removeChild(historyEl.lastChild);
  }

  // Animate reels with deterministic finalSymbols; ensure we can't spam
  function animateSpin(finalSymbols){
    return new Promise(resolve=>{
      spinBtn.disabled = true;
      betHalfBtn.disabled = true;
      betMaxBtn.disabled = true;

      const durations = [900,1200,1500];
      let finished = 0;
      reelEls.forEach((r,i)=>{
        const start = performance.now();
        const dur = durations[i];
        function frame(now){
          const t = Math.min(1,(now-start)/dur);
          if(t < 0.88){
            r.textContent = SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)];
            requestAnimationFrame(frame);
          } else {
            r.textContent = finalSymbols[i];
            finished++;
            if(finished === reelEls.length){
              setTimeout(()=>{
                spinBtn.disabled = false;
                betHalfBtn.disabled = false;
                betMaxBtn.disabled = false;
                resolve();
              }, 150);
            }
          }
        }
        requestAnimationFrame(frame);
      });
    });
  }

  // Main spin handler
  async function handleSpin(){
    let bet = Math.max(1, Math.round(Number(betInput.value) || 0));
    if(bet<=0){ alert('Bet must be at least 1'); return; }
    if(bet>bankroll){ alert('Not enough bankroll for that bet'); return; }

    bankroll -= bet;
    saveBankroll();
    render();
    syncSidebar('');

    const result = spinOnce();
    await animateSpin(result);

    const win = payoutFor(result, bet);
    lastWin = win;
    bankroll += win;
    saveBankroll();
    render();

    const time = new Date().toLocaleTimeString();
    const historyText = `${time} — Bet ${formatMoney(bet)} → ${result.join(' ')} — Win ${formatMoney(win)}`;
    addHistory(historyText);

    if(win > 0){
      syncSidebar(`Win ${formatMoney(win)}`);
    } else {
      syncSidebar(`Lose ${formatMoney(bet)}`);
    }
  }

  // Event listeners
  spinBtn.addEventListener('click', ()=>{ handleSpin().catch(err=>{ console.error(err); spinBtn.disabled=false; }); });

  betHalfBtn.addEventListener('click', ()=>{
    betInput.value = Math.max(1, Math.floor((bankroll||0)/2));
  });

  betMaxBtn.addEventListener('click', ()=>{
    betInput.value = Math.max(1, Math.floor(bankroll||0));
  });

  // initial render + initial sidebar sync
  render();
  syncSidebar('');

  // Expose a small debug API
  window.casino = {
    getBankroll: ()=>bankroll,
    setBankroll: (v)=>{ bankroll = Number(v); saveBankroll(); render(); syncSidebar(''); }
  };
})();