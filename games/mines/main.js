// Mines game implementation with provably-fair placement and multiplier progression
(function(){
  const bankrollEl = document.getElementById('bankroll');
  const betInput = document.getElementById('bet');
  const mineCountSelect = document.getElementById('mine-count');
  const gridEl = document.getElementById('grid');
  const log = document.getElementById('mines-log');
  const startBtn = document.getElementById('start');
  const cashoutBtn = document.getElementById('cashout');
  const cancelBtn = document.getElementById('cancel');
  const multiplierEl = document.getElementById('multiplier');
  const payoutEl = document.getElementById('payout');
  const serverHashEl = document.getElementById('server-hash');
  const serverSeedEl = document.getElementById('server-seed');
  const clientSeedInput = document.getElementById('client-seed');

  // fill mine count options
  for(let i=1;i<=24;i++){ const opt = document.createElement('option'); opt.value = String(i); opt.textContent = String(i); mineCountSelect.appendChild(opt); }

  let bankroll = loadBankroll();
  let round = null; // null or object with state

  function loadBankroll(){ try{ const v=localStorage.getItem('casino_bankroll'); return v?Number(v):1000 }catch(e){return 1000} }
  function saveBankroll(){ try{ localStorage.setItem('casino_bankroll',String(bankroll)); }catch(e){} }

  function renderBankroll(){ bankrollEl.textContent = `$${bankroll.toFixed(2)}` }
  renderBankroll();

  function formatMoney(v){ return `$${v.toFixed(2)}` }

  // SHA-256 hex helper
  async function sha256Hex(str){ const enc = new TextEncoder().encode(str); const buf = await crypto.subtle.digest('SHA-256', enc); return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join(''); }

  function randomHex(bytes=16){ const arr = new Uint8Array(bytes); crypto.getRandomValues(arr); return Array.from(arr).map(b=>b.toString(16).padStart(2,'0')).join(''); }

  // derive random bytes from combined seed+nonce via sha256
  async function deriveBytes(seedStr){ const enc = new TextEncoder().encode(seedStr); const buf = await crypto.subtle.digest('SHA-256', enc); return new Uint8Array(buf); }

  // deterministic mines placement using serverSeed + clientSeed + nonce
  async function generateMines(serverSeed, clientSeed, nonce, mineCount){
    const pool = Array.from({length:25},(_,i)=>i);
    const mines = [];
    let counter = 0;
    while(mines.length < mineCount){
      const bytes = await deriveBytes(`${serverSeed}:${clientSeed}:${nonce}:${counter}`);
      for(let i=0;i+3<bytes.length && mines.length < mineCount;i+=4){
        const num = (bytes[i]<<24) | (bytes[i+1]<<16) | (bytes[i+2]<<8) | (bytes[i+3]);
        const idx = Math.abs(num) % pool.length;
        mines.push(pool.splice(idx,1)[0]);
      }
      counter++;
    }
    return mines.sort((a,b)=>a-b);
  }

  // multiplier after k safe picks (k>=0) with m mines on board: product_{i=0..k-1} ((25-i)/(25-m-i))
  function multiplierForSafes(k, m){
    if(k<=0) return 1;
    let mult = 1;
    for(let i=0;i<k;i++){
      mult *= (25 - i) / (25 - m - i);
    }
    return mult;
  }

  function setupGrid(){ gridEl.innerHTML = '';
    for(let i=0;i<25;i++){
      const btn = document.createElement('button');
      btn.className = 'reel'; // reuse reel style for tiles
      btn.style.width = '64px'; btn.style.height = '64px'; btn.style.fontSize = '20px';
      btn.dataset.index = String(i);
      btn.textContent = '';
      btn.disabled = true;
      gridEl.appendChild(btn);
    }
  }

  function resetRoundState(){ round = null; serverHashEl.textContent = '-'; serverSeedEl.textContent = '-'; multiplierEl.textContent = '1.00x'; payoutEl.textContent = '$0.00'; log.innerHTML = ''; cashoutBtn.disabled = true; cancelBtn.disabled = true; startBtn.disabled = false; const tiles = gridEl.querySelectorAll('button'); tiles.forEach(b=>{ b.disabled = true; b.classList.remove('lost','safe'); b.textContent = ''; }); }

  async function startRound(){
    const bet = Number(betInput.value) || 0;
    const mineCount = Number(mineCountSelect.value) || 3;
    if(!Number.isFinite(bet) || bet <= 0){ alert('Bet must be > 0'); return; }
    if(bet > bankroll){ alert('Not enough bankroll'); return; }
    if(mineCount < 1 || mineCount > 24){ alert('Mine count must be 1..24'); return; }

    // prepare provably-fair seeds
    const serverSeed = randomHex(16);
    const serverHash = await sha256Hex(serverSeed);
    let clientSeed = clientSeedInput.value && clientSeedInput.value.trim();
    if(!clientSeed){ clientSeed = localStorage.getItem('casino_client_seed') || randomHex(8); clientSeedInput.value = clientSeed; }
    localStorage.setItem('casino_client_seed', clientSeed);
    const nonce = Date.now().toString();

    // show a shortened hash in the UI to avoid layout overflow; full hash available on hover/title
    serverHashEl.textContent = serverHash.slice(0,16) + '...';
    serverHashEl.title = serverHash;
    serverSeedEl.textContent = '-';

    // generate mines deterministically
    const mines = await generateMines(serverSeed, clientSeed, nonce, mineCount);

    // initialize round state
    round = {
      bet: bet,
      mineCount: mineCount,
      mines: new Set(mines),
      revealed: new Set(),
      serverSeed, serverHash, clientSeed, nonce,
      ended: false
    };

    // deduct bet immediately
    bankroll -= bet; saveBankroll(); renderBankroll();

    // enable tiles
    const tiles = gridEl.querySelectorAll('button'); tiles.forEach(b=>{ b.disabled = false; b.classList.remove('lost','safe'); b.textContent = ''; });

    startBtn.disabled = true; cashoutBtn.disabled = false; cancelBtn.disabled = false;
    multiplierEl.textContent = '1.00x'; payoutEl.textContent = formatMoney(0);
    log.innerHTML = `<p>Round started — ${mineCount} mine(s) hidden. Click tiles to reveal.</p>`;
  }

  function revealAllMines(){ const tiles = gridEl.querySelectorAll('button'); tiles.forEach(b=>{ const idx = Number(b.dataset.index); if(round && round.mines.has(idx)){ b.textContent = '💣'; b.classList.add('lost'); } }); }

  function revealTile(btn){ if(!round || round.ended) return; const idx = Number(btn.dataset.index); if(round.revealed.has(idx)) return; btn.disabled = true; round.revealed.add(idx);
    if(round.mines.has(idx)){
      // hit mine -> lose
      btn.textContent = '💥'; btn.classList.add('lost'); round.ended = true; revealAllMines(); serverSeedEl.textContent = round.serverSeed; cashoutBtn.disabled = true; cancelBtn.disabled = true; startBtn.disabled = false; log.innerHTML = `<p style="color:#ff9">Boom! You hit a mine — lost bet of ${formatMoney(round.bet)}.</p>`;
      return;
    }
    // safe tile
    btn.textContent = '💎'; btn.classList.add('safe');
    const safeCount = round.revealed.size;
    const mult = multiplierForSafes(safeCount, round.mineCount);
    multiplierEl.textContent = `${mult.toFixed(4)}x`;
    payoutEl.textContent = formatMoney(round.bet * mult);
    log.innerHTML = `<p>Safe! Revealed ${safeCount} safe tile(s). Multiplier: ${mult.toFixed(4)}x</p>`;

    // win condition: all safe tiles revealed
    if(safeCount >= 25 - round.mineCount){
      // player uncovered all safe tiles — award payout and end round
      const payout = round.bet * mult;
      bankroll += payout; saveBankroll(); renderBankroll(); round.ended = true; serverSeedEl.textContent = round.serverSeed; cashoutBtn.disabled = true; cancelBtn.disabled = true; startBtn.disabled = false; log.innerHTML = `<p style="color:#8f8">All safe tiles cleared! You won ${formatMoney(payout)}.</p>`;
    }
  }

  function cashout(){ if(!round || round.ended) return; const safeCount = round.revealed.size; const mult = multiplierForSafes(safeCount, round.mineCount); const payout = round.bet * mult; bankroll += payout; saveBankroll(); renderBankroll(); round.ended = true; serverSeedEl.textContent = round.serverSeed; cashoutBtn.disabled = true; cancelBtn.disabled = true; startBtn.disabled = false; log.innerHTML = `<p style="color:#8f8">Cashed out: ${formatMoney(payout)} (x${mult.toFixed(4)})</p>`; }

  function cancelRound(){ if(!round) return; // refund bet
    bankroll += round.bet; saveBankroll(); renderBankroll(); round.ended = true; serverSeedEl.textContent = round.serverSeed; cashoutBtn.disabled = true; cancelBtn.disabled = true; startBtn.disabled = false; log.innerHTML = `<p>Round canceled, bet refunded.</p>`; }

  // tile click handler
  gridEl.addEventListener('click', (e)=>{ if(!round || round.ended) return; const btn = e.target.closest('button'); if(!btn) return; revealTile(btn); });

  startBtn.addEventListener('click', ()=>{ startRound().catch(err=>{ console.error(err); alert('Failed to start round'); }); });
  cashoutBtn.addEventListener('click', ()=>{ cashout(); });
  cancelBtn.addEventListener('click', ()=>{ if(!confirm('Cancel round and refund bet?')) return; cancelRound(); });

  // initial UI setup
  setupGrid(); resetRoundState();
})();
