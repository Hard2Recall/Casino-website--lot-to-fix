// Crash game implementation with provably-fair seed reveal
// Crash game implementation with provably-fair seed reveal
(function(){
  const bankrollEl = document.getElementById('bankroll');
  const betInput = document.getElementById('bet');
  const placeBtn = document.getElementById('place');
  const cashoutBtn = document.getElementById('cashout');
  const multiplierEl = document.getElementById('multiplier');
  const logEl = document.getElementById('crash-log');
  const serverHashEl = document.getElementById('server-hash');
  const serverSeedEl = document.getElementById('server-seed');
  const clientSeedInput = document.getElementById('client-seed');

  let bankroll = loadBankroll();
  let round = null; // {bet, crashMult, duration, startedAt, serverSeed, serverHash, clientSeed}
  let rafId = null;

  function loadBankroll(){ try{ const v=localStorage.getItem('casino_bankroll'); return v?Number(v):1000 }catch(e){return 1000} }
  function saveBankroll(){ try{ localStorage.setItem('casino_bankroll',String(bankroll)); }catch(e){} }
  function renderBankroll(){ bankrollEl.textContent = `$${bankroll.toFixed(2)}` }
  renderBankroll();

  function formatMoney(v){ return `$${v.toFixed(2)}` }

  async function sha256Hex(str){ const enc = new TextEncoder().encode(str); const buf = await crypto.subtle.digest('SHA-256', enc); return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join(''); }
  function randomHex(bytes=16){ const arr = new Uint8Array(bytes); crypto.getRandomValues(arr); return Array.from(arr).map(b=>b.toString(16).padStart(2,'0')).join(''); }

  // convert SHA256-derived bytes to a uniform number in (0,1)
  async function deriveU(serverSeed, clientSeed, nonce){
    const input = `${serverSeed}:${clientSeed}:${nonce}`;
    const enc = new TextEncoder().encode(input);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    const bytes = new Uint8Array(buf);
    // take first 8 bytes as big-endian integer
    let v = 0n;
    for(let i=0;i<8;i++){ v = (v<<8n) + BigInt(bytes[i]); }
    const denom = (1n<<64n);
    const u = Number(v) / Number(denom);
    // avoid exactly 0 or 1
    return Math.min(0.9999999999999999, Math.max(1e-16, u));
  }

  // derive crash multiplier from u using formula: crash = max(1, floor((1/(1-u))*100)/100)
  function crashFromU(u){
    const raw = 1/(1-u);
    const capped = Math.min(raw, 10000); // cap to avoid extreme values
    const rounded = Math.floor(capped*100)/100;
    return Math.max(1, rounded);
  }

  function startAnimation(){
    const start = performance.now();
    function frame(now){
      if(!round) return;
      const t = now - round.startedAt;
      const T = round.duration;
      // growth chosen so multiplier(t) = exp( (ln(crash)/T) * t )
      const k = Math.log(round.crashMult) / T;
      const m = Math.exp(k * t);
      const display = Math.max(1, m);
      multiplierEl.textContent = `${display.toFixed(2)}x`;
      // stop if crashed
      if(t >= T){
        onCrash(); return;
      }
      rafId = requestAnimationFrame(frame);
    }
    round.startedAt = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function stopAnimation(){ if(rafId) cancelAnimationFrame(rafId); rafId = null; }

  function onCrash(){
    if(!round) return;
    stopAnimation();
    multiplierEl.textContent = `${round.crashMult.toFixed(2)}x (CRASH)`;
    serverSeedEl.textContent = round.serverSeed;
    cashoutBtn.disabled = true; placeBtn.disabled = false;
    logEl.innerHTML = `<p style="color:#f66">Crashed at ${round.crashMult.toFixed(2)}x — you lost ${formatMoney(round.bet)}.</p>`;
    round = null;
  }

  function endRoundWithPayout(payout){
    stopAnimation();
    serverSeedEl.textContent = round.serverSeed;
    multiplierEl.textContent = `${(payout/round.bet).toFixed(2)}x (CASHED OUT)`;
    logEl.innerHTML = `<p style="color:#8f8">Cashed out ${formatMoney(payout)}.</p>`;
    cashoutBtn.disabled = true; placeBtn.disabled = false; round = null;
  }

  placeBtn.addEventListener('click', async ()=>{
    if(round) return;
    const bet = Number(betInput.value) || 0;
    if(bet<=0 || bet>bankroll){ alert('Invalid bet or insufficient bankroll'); return; }
    // seeds
    const serverSeed = randomHex(16);
    const serverHash = await sha256Hex(serverSeed);
    let clientSeed = clientSeedInput.value && clientSeedInput.value.trim();
    if(!clientSeed){ clientSeed = localStorage.getItem('casino_client_seed') || randomHex(8); clientSeedInput.value = clientSeed; }
    localStorage.setItem('casino_client_seed', clientSeed);
    const nonce = Date.now().toString();

    serverHashEl.textContent = serverHash.slice(0,16) + '...'; serverHashEl.title = serverHash;
    serverSeedEl.textContent = '-';

    const u = await deriveU(serverSeed, clientSeed, nonce);
    const crashMult = crashFromU(u);
    // map crash multiplier to duration (ms): base + scale*log10(crash)
    const duration = 800 + Math.max(200, 800 * Math.log10(crashMult + 1));

    // start round
    round = {bet, crashMult, duration, serverSeed, serverHash, clientSeed, nonce, startedAt: null};

    // deduct bet
    bankroll -= bet; saveBankroll(); renderBankroll();

    placeBtn.disabled = true; cashoutBtn.disabled = false; logEl.innerHTML = `<p>Round started — crash target determined. Good luck!</p>`;
    // begin animation
    startAnimation();
  });

  cashoutBtn.addEventListener('click', ()=>{
    if(!round) return;
    // compute current multiplier based on time
    const now = performance.now(); const t = now - round.startedAt; const T = round.duration; const k = Math.log(round.crashMult)/T; const m = Math.exp(k * t);
    const payout = Math.floor((round.bet * m)*100)/100;
    bankroll += payout; saveBankroll(); renderBankroll();
    endRoundWithPayout(payout);
  });

  // initialize UI
  cashoutBtn.disabled = true; placeBtn.disabled = false; serverHashEl.textContent = '-'; serverSeedEl.textContent = '-'; multiplierEl.textContent = '1.00x';
})();
