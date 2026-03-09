// Dice game: bet whether a roll (1-6) is above/below target determined by win chance
(function(){
  const bankrollEl = document.getElementById('bankroll');
  const betInput = document.getElementById('bet');
  const directionSelect = document.getElementById('direction');
  const rollBtn = document.getElementById('roll');
  const quickBtn = document.getElementById('quick');
  const payoutEl = document.getElementById('payout');
  const lastRollEl = document.getElementById('last-roll');
  const logEl = document.getElementById('dice-log');
  const shownEl = document.getElementById('shown-roll');
  const rerollBtn = document.getElementById('reroll');
  const canvas = document.getElementById('dice-canvas');
  const ctx = canvas.getContext('2d');

  let bankroll = loadBankroll();

  function loadBankroll(){ try{ const v=localStorage.getItem('casino_bankroll'); return v?Number(v):1000 }catch(e){return 1000} }
  function saveBankroll(){ try{ localStorage.setItem('casino_bankroll',String(bankroll)); }catch(e){} }
  function renderBankroll(){ bankrollEl.textContent = `$${bankroll.toFixed(2)}` }
  renderBankroll();

  const HOUSE_EDGE = 1.0; // percent

  function payoutForChance(chance){ // chance in percent (1..99)
    const c = Math.max(1, Math.min(99, Number(chance)));
    const payout = (100 - HOUSE_EDGE) / c;
    return payout;
  }

  const SIDES = 6;

  let shownRoll = null;

  function updatePayoutPreview(){
    if(!shownRoll){ payoutEl.textContent = '—'; rollBtn.disabled = true; return; }
    const dir = directionSelect.value;
    const higherCount = SIDES - shownRoll; // outcomes strictly greater than shown
    const lowerCount = shownRoll - 1; // outcomes strictly less than shown
    const chanceFrac = dir === 'higher' ? (higherCount / SIDES) : (lowerCount / SIDES);
    const chancePercent = Math.round(chanceFrac * 100 * 100) / 100; // two decimals
    if(chanceFrac <= 0){ payoutEl.textContent = '—'; rollBtn.disabled = true; return; }
    const mul = payoutForChance(chancePercent);
    payoutEl.textContent = `x${mul.toFixed(2)} (${chancePercent}% win)`;
    rollBtn.disabled = false;
  }

  function drawStatic(){ ctx.clearRect(0,0,canvas.width,canvas.height); ctx.fillStyle='#e6eef6'; ctx.font='20px Segoe UI, Roboto'; ctx.textAlign='center'; ctx.fillText('Result', canvas.width/2, canvas.height/2); }
  drawStatic();

  function rollOnce(){ return Math.floor(Math.random()*SIDES) + 1; }

  function animateRoll(finalValue){ return new Promise(resolve=>{
    const start = performance.now(); const duration = 600; function frame(now){ const t = Math.min(1,(now-start)/duration); const eased = 1 - Math.pow(1-t,3); const display = Math.round(eased*finalValue + (1-eased)*(Math.random()*SIDES + 1));
        // draw
        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle='#e6eef6'; ctx.font='48px Segoe UI, Roboto'; ctx.textAlign='center'; ctx.fillText(String(display), canvas.width/2, canvas.height/2+13);
        if(t<1) requestAnimationFrame(frame); else resolve(); }
    requestAnimationFrame(frame);
  }); }

  async function handleRoll(){ const bet = Number(betInput.value)||0; const dir = directionSelect.value; if(!Number.isFinite(bet) || bet<=0){ alert('Bet must be > 0'); return; } if(bet>bankroll){ alert('Not enough bankroll'); return; }
    rollBtn.disabled = true; quickBtn.disabled = true; logEl.innerHTML='';
    if(!shownRoll){ alert('No shown roll available'); rollBtn.disabled=false; quickBtn.disabled=false; return; }
    const higherCount = SIDES - shownRoll;
    const lowerCount = shownRoll - 1;
    const chanceFrac = dir === 'higher' ? (higherCount / SIDES) : (lowerCount / SIDES);
    if(chanceFrac <= 0){ alert('That direction cannot win against the shown roll. Reroll first.'); rollBtn.disabled=false; quickBtn.disabled=false; return; }
    const chancePercent = Math.round(chanceFrac * 100 * 100) / 100;
    const payoutMul = payoutForChance(chancePercent); payoutEl.textContent = `x${payoutMul.toFixed(2)} (${chancePercent}% win)`;

    bankroll -= bet; saveBankroll(); renderBankroll();
    const roll = rollOnce(); await animateRoll(roll);
    lastRollEl.textContent = String(roll);
    // determine result: draw if equal, higher if roll > shownRoll, lower if roll < shownRoll
    if(roll === shownRoll){
      // draw/push: refund bet
      bankroll += bet; saveBankroll(); renderBankroll();
      logEl.innerHTML = `<p style="color:#cc0">Draw. Rolled ${roll} — bet returned ${formatMoney(bet)}</p>`;
    } else {
      let win = false; if(dir === 'lower'){ win = roll < shownRoll; } else { win = roll > shownRoll; }
      if(win){ const payout = Math.floor(bet * payoutMul * 100)/100; bankroll += payout; saveBankroll(); renderBankroll(); logEl.innerHTML = `<p style="color:#8f8">Win! Rolled ${roll} — payout ${formatMoney(payout)}</p>`; }
      else{ logEl.innerHTML = `<p style="color:#f66">Lose. Rolled ${roll} — lost ${formatMoney(bet)}</p>`; }
    }
    rollBtn.disabled = false; quickBtn.disabled = false; }

  quickBtn.addEventListener('click', ()=>{ const prev = betInput.value; betInput.value = Math.max(1, Math.floor((bankroll||1000)/100)); handleRoll().finally(()=>{ betInput.value = prev; }); });
  rollBtn.addEventListener('click', ()=>{ handleRoll().catch(e=>{ console.error(e); alert('Error during roll'); rollBtn.disabled=false; quickBtn.disabled=false; }); });

  // payout preview update when direction changes and reroll button
  directionSelect.addEventListener('change', updatePayoutPreview);
  rerollBtn.addEventListener('click', ()=>{ generateShownRoll(); });

  function generateShownRoll(){ shownRoll = rollOnce(); shownEl.textContent = String(shownRoll); updatePayoutPreview(); }

  // generate initial free roll on load
  generateShownRoll();

  function formatMoney(v){ return `$${v.toFixed(2)}` }
})();