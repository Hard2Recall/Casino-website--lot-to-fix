/* Coin Toss — redesigned to match Dice/Slots/Higher-Lower visual style
   Adds a realistic coin toss animation (3D Y-rotation) while preserving provably-fair logic.
   Fix: ensure the toss animation promise resolves only once (prevents "double spin").
*/
(async function(){
  // elements
  const bankrollEl = document.getElementById('sidebar-bankroll') || document.getElementById('bankroll');
  const betInput = document.getElementById('bet');
  const choiceSel = document.getElementById('choice');
  const flipBtn = document.getElementById('flip');
  const quickBtn = document.getElementById('quick');
  const payoutEl = document.getElementById('payout');
  const lastResultEl = document.getElementById('last-result');
  const coin = document.getElementById('coin');
  const coinInner = document.getElementById('coin-inner');
  const ctLog = document.getElementById('ct-log');
  const serverHashEl = document.getElementById('server-hash');
  const serverSeedEl = document.getElementById('server-seed');
  const clientSeedInput = document.getElementById('client-seed');

  // sidebar elements for sync
  const sidebarLastTxt = document.getElementById('sidebar-last-roll-txt');
  const sidebarResultBox = document.getElementById('sidebar-result');
  const sidebarResultText = document.getElementById('sidebar-result-text');
  const sidebarResultAmount = document.getElementById('sidebar-result-amount');

  // bankroll persistence
  let bankroll = loadBankroll();
  function loadBankroll(){ try{ const v=localStorage.getItem('casino_bankroll'); return v?Number(v):1000 }catch(e){return 1000} }
  function saveBankroll(){ try{ localStorage.setItem('casino_bankroll',String(bankroll)); }catch(e){} }
  function renderBankroll(){ if(bankrollEl) bankrollEl.textContent = `$${bankroll.toFixed(2)}`; }
  renderBankroll();

  // client seed persistence
  const CLIENT_SEED_KEY = 'casino_client_seed';
  clientSeedInput.value = localStorage.getItem(CLIENT_SEED_KEY) || '';
  clientSeedInput.addEventListener('change', ()=>{ localStorage.setItem(CLIENT_SEED_KEY, clientSeedInput.value); });

  const HOUSE_EDGE = 1.0;
  function payoutMulForEven(){ return (100 - HOUSE_EDGE) / 50; } // 50% chance
  function formatMoney(v){ return `$${(Math.round(v*100)/100).toFixed(2)}`; }

  // crypto helpers
  async function sha256Hex(str){ const enc = new TextEncoder().encode(str); const h = await crypto.subtle.digest('SHA-256', enc); return Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join(''); }
  function randomHex(len=32){ const buf = new Uint8Array(len); crypto.getRandomValues(buf); return Array.from(buf).map(b=>b.toString(16).padStart(2,'0')).join(''); }

  // provably-fair state
  let serverSeed = null;
  let serverHash = null;
  let nonce = 0;

  async function newServerSeed(){ serverSeed = randomHex(32); serverHash = await sha256Hex(serverSeed); nonce = 0; serverHashEl.textContent = serverHash.slice(0,16) + '…'; serverHashEl.title = serverHash; serverSeedEl.textContent = '-'; }

  // derive flip result deterministically
  async function deriveFlipResult(sSeed, cSeed, n){
    const h = await sha256Hex(`${sSeed}:${cSeed}:${n}`);
    const firstByte = parseInt(h.slice(0,2),16);
    return firstByte % 2 === 0 ? 'heads' : 'tails';
  }

  // coin animation helpers
  // Ensure the animation promise resolves only once (guard + timeout fallback).
  function startCoinTossAnimation(finalFace){
    // choose a random number of half-rotations so the coin looks realistic (odd number => flipped)
    const spins = 5 + Math.floor(Math.random()*4); // 5..8 half-turns
    // Each half-turn is 180deg. To end showing "heads" we set rotation deg accordingly.
    // We assume front (heads) at 0deg, back (tails) at 180deg.
    let finalDeg;
    if(finalFace === 'heads'){
      // make total rotation land with front up (multiple of 360)
      finalDeg = 360 * Math.floor(spins/2);
    } else {
      // make total rotation land with back up (180 + multiple of 360)
      finalDeg = 180 + 360 * Math.floor(spins/2);
    }

    coin.classList.add('tossing');
    // explicit transition so we can control duration reliably
    const DURATION = 900; // ms
    coinInner.style.transition = `transform ${DURATION}ms cubic-bezier(.2,.8,.2,1)`;
    // Trigger the rotation
    // Use requestAnimationFrame to ensure the browser applies the transition
    requestAnimationFrame(()=> {
      coinInner.style.transform = `rotateY(${finalDeg}deg)`;
    });

    return new Promise(resolve => {
      let settled = false;
      // fallback timeout in case transitionend doesn't fire (or fired for other properties)
      const safeTimeout = setTimeout(()=>{
        if(settled) return;
        settled = true;
        cleanupAndResolve();
      }, DURATION + 200);

      function onEnd(e){
        // ensure we react only to the transform transition
        if(e && e.propertyName && e.propertyName !== 'transform') return;
        if(settled) return;
        settled = true;
        clearTimeout(safeTimeout);
        cleanupAndResolve();
      }

      function cleanupAndResolve(){
        coinInner.removeEventListener('transitionend', onEnd);
        // small settle delay so the final state feels natural
        setTimeout(()=> {
          coin.classList.remove('tossing');
          // remove transition so setting normalized transform is immediate/no extra animation
          coinInner.style.transition = '';
          if(finalFace === 'heads') coinInner.style.transform = 'rotateY(0deg)';
          else coinInner.style.transform = 'rotateY(180deg)';
          resolve();
        }, 60);
      }

      coinInner.addEventListener('transitionend', onEnd);
    });
  }

  function updatePayout(){ const mul = payoutMulForEven(); payoutEl.textContent = `x${mul.toFixed(2)} (50% win)`; }
  updatePayout();

  // sidebar sync
  function syncSidebar(message){
    if(sidebarLastTxt) sidebarLastTxt.textContent = lastResultEl.textContent || '-';
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

  // main flip logic
  async function doFlip(){
    const bet = Math.max(1, Math.round(Number(betInput.value) || 0));
    const choice = choiceSel.value;
    if(!Number.isFinite(bet) || bet <= 0){ alert('Bet must be > 0'); return; }
    if(bet > bankroll){ alert('Not enough bankroll'); return; }

    flipBtn.disabled = true;
    quickBtn.disabled = true;
    ctLog.innerHTML = '';

    // take bet
    bankroll -= bet; saveBankroll(); renderBankroll();
    syncSidebar('');

    const clientSeed = clientSeedInput.value || (localStorage.getItem(CLIENT_SEED_KEY) || '');
    // compute result
    const result = await deriveFlipResult(serverSeed, clientSeed, nonce);
    // play animation (now guarded to resolve only once)
    await startCoinTossAnimation(result);
    // reveal
    const pretty = result === 'heads' ? 'Heads' : 'Tails';
    lastResultEl.textContent = pretty;
    serverSeedEl.textContent = serverSeed;

    // evaluate
    if(result === choice){
      const mul = payoutMulForEven();
      const payout = Math.round(bet * mul * 100) / 100;
      bankroll += payout; saveBankroll(); renderBankroll();
      ctLog.innerHTML = `<p style="color:#8f8">Win! ${pretty} — payout ${formatMoney(payout)}</p>`;
      syncSidebar(`Win ${formatMoney(payout)}`);
    } else {
      ctLog.innerHTML = `<p style="color:#f66">Lose. ${pretty} — lost ${formatMoney(bet)}</p>`;
      syncSidebar(`Lose ${formatMoney(bet)}`);
    }

    // increment nonce and rotate seed
    nonce++;
    await newServerSeed();
    updatePayout();

    flipBtn.disabled = false;
    quickBtn.disabled = false;
  }

  // quick flip helper
  quickBtn.addEventListener('click', ()=>{ const prev = betInput.value; betInput.value = Math.max(1, Math.floor((bankroll||1000)/100)); doFlip().finally(()=>{ betInput.value = prev; }); });
  flipBtn.addEventListener('click', ()=>{ doFlip().catch(e=>{ console.error(e); alert('Flip error'); flipBtn.disabled=false; quickBtn.disabled=false; }); });

  // init
  async function drawStatic(){ coinInner.style.transform = 'rotateY(0deg)'; await newServerSeed(); renderBankroll(); updatePayout(); syncSidebar(''); }
  drawStatic();

  // expose debug helper
  window.casino = { getBankroll: ()=>bankroll, setBankroll:(v)=>{ bankroll = Number(v); saveBankroll(); renderBankroll(); syncSidebar(''); } };

})();