// Placeholder Roulette script (moved into games/roulette)
// Realistic European Roulette implementation
(async function(){
  const bankrollEl = document.getElementById('bankroll');
  const betInput = document.getElementById('bet');
  const typeInput = document.getElementById('bet-type');
  const betParams = document.getElementById('bet-params');
  const spinBtn = document.getElementById('spin');
  const quickBtn = document.getElementById('quick');
  const clearBtn = document.getElementById('clear');
  const payoutEl = document.getElementById('payout');
  const lastOutcomeEl = document.getElementById('last-outcome');
  const log = document.getElementById('roulette-log');
  const canvas = document.getElementById('wheel');
  const ctx = canvas.getContext('2d');
  const serverHashEl = document.getElementById('server-hash');
  const serverSeedEl = document.getElementById('server-seed');
  const clientSeedInput = document.getElementById('client-seed');
  const resultEl = document.getElementById('result');

  // Bankroll persistence
  let bankroll = loadBankroll();
  function loadBankroll(){ try{ const v=localStorage.getItem('casino_bankroll'); return v?Number(v):1000 }catch(e){return 1000} }
  function saveBankroll(){ try{ localStorage.setItem('casino_bankroll',String(bankroll)); }catch(e){} }
  function renderBankroll(){ bankrollEl.textContent = `$${bankroll.toFixed(2)}` }
  renderBankroll();

  // provably-fair seeds
  const CLIENT_SEED_KEY = 'casino_client_seed';
  clientSeedInput.value = localStorage.getItem(CLIENT_SEED_KEY) || '';
  clientSeedInput.addEventListener('change', ()=> localStorage.setItem(CLIENT_SEED_KEY, clientSeedInput.value));

  // House edge
  const HOUSE_EDGE = 2.7; // typical European roulette ~2.7%

  // European wheel sequence (single zero) clockwise
  const WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
  const SECTORS = WHEEL.length; // 37

  // reds in European wheel
  const REDS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

  // crypto helpers
  async function sha256Hex(str){ const enc=new TextEncoder().encode(str); const h=await crypto.subtle.digest('SHA-256',enc); return Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join(''); }
  function randomHex(len=32){ const buf=new Uint8Array(len); crypto.getRandomValues(buf); return Array.from(buf).map(b=>b.toString(16).padStart(2,'0')).join(''); }

  let serverSeed=null, serverHash=null, nonce=0;
  async function newServerSeed(hideSeed = true){ serverSeed=randomHex(32); serverHash=await sha256Hex(serverSeed); nonce=0; serverHashEl.textContent=serverHash.slice(0,18)+'…'; serverHashEl.title=serverHash; if(hideSeed) serverSeedEl.textContent='-'; }

  // derive uniform integer 0..36 from sha256(server:client:nonce)
  async function deriveOutcome(s,c,n){ const h=await sha256Hex(`${s}:${c}:${n}`); // take first 8 hex chars -> 32 bits
    const num = parseInt(h.slice(0,8),16); return num % SECTORS; }

  // draw wheel
  function drawWheel(rotation=0,highlightIndex=null){ const w=canvas.width, h=canvas.height, cx=w/2, cy=h/2, r=Math.min(w,h)/2 - 10; ctx.clearRect(0,0,w,h);
    // background
    ctx.fillStyle='#021017'; ctx.fillRect(0,0,w,h);
    // draw sectors
    for(let i=0;i<SECTORS;i++){ const angle=(i/SECTORS)*Math.PI*2 + rotation; const next=( (i+1)/SECTORS)*Math.PI*2 + rotation;
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,angle,next); ctx.closePath();
      // color zero as green, red numbers red, others dark (black)
      ctx.fillStyle = WHEEL[i]===0 ? '#2e7d32' : (REDS.has(WHEEL[i]) ? '#b71c1c' : '#111111'); ctx.fill();
      // highlight the outcome sector with a bright glow
      if(highlightIndex !== null && i === highlightIndex){ ctx.fillStyle = 'rgba(255,215,79,0.4)'; ctx.fill(); }
      // outline
      ctx.strokeStyle='#333'; ctx.stroke();
      // number label
      const mid = (angle+next)/2; const tx = cx + Math.cos(mid)*(r*0.72); const ty = cy + Math.sin(mid)*(r*0.72);
      ctx.save(); ctx.translate(tx,ty); ctx.rotate(mid+Math.PI/2); ctx.fillStyle = '#fff'; ctx.font='14px Segoe UI'; ctx.textAlign='center'; ctx.fillText(String(WHEEL[i]),0,0); ctx.restore();
    }
    // draw center
    ctx.beginPath(); ctx.arc(cx,cy,r*0.25,0,Math.PI*2); ctx.fillStyle='#0a2740'; ctx.fill();
    // highlight
    if(highlightIndex!==null){ ctx.strokeStyle='#ffd54f'; ctx.lineWidth=4; const a=(highlightIndex/SECTORS)*Math.PI*2 + rotation; ctx.beginPath(); ctx.arc(cx,cy,r+6,a-0.02,a+0.02); ctx.stroke(); ctx.lineWidth=1; }
  }

  // initial draw
  drawWheel(0);

  // bet state: allow a single bet for now
  function renderBetParams(){ betParams.innerHTML=''; const t=typeInput.value; if(t==='number'){ const el = document.createElement('input'); el.type='number'; el.min=0; el.max=36; el.id='bet-number'; el.placeholder='0-36'; el.style.width='100%'; betParams.appendChild(el); }
    if(t==='color'){ const s=document.createElement('select'); s.id='bet-color'; s.innerHTML='<option value="red">Red</option><option value="black">Black</option>'; betParams.appendChild(s); }
    if(t==='parity'){ const s=document.createElement('select'); s.id='bet-parity'; s.innerHTML='<option value="odd">Odd</option><option value="even">Even</option>'; betParams.appendChild(s); }
    if(t==='dozen'){ const s=document.createElement('select'); s.id='bet-dozen'; s.innerHTML='<option value="1">1-12</option><option value="2">13-24</option><option value="3">25-36</option>'; betParams.appendChild(s); }
    if(t==='column'){ const s=document.createElement('select'); s.id='bet-column'; s.innerHTML='<option value="1">1st</option><option value="2">2nd</option><option value="3">3rd</option>'; betParams.appendChild(s); }
    if(t==='highlow'){ const s=document.createElement('select'); s.id='bet-highlow'; s.innerHTML='<option value="low">1-18</option><option value="high">19-36</option>'; betParams.appendChild(s); }
  }
  typeInput.addEventListener('change', ()=>{ renderBetParams(); updatePayoutUI(); });
  renderBetParams();

  function updatePayoutUI(){ const t=typeInput.value; if(t==='number'){ payoutEl.textContent='35:1'; } else if(t==='dozen'||t==='column'){ payoutEl.textContent='2:1'; } else { payoutEl.textContent='1:1'; } }
  updatePayoutUI();

  // spin animation helper
  function animateToSector(targetIndex){ return new Promise(resolve=>{
    const start = performance.now(); const duration = 3000; const startRot = Math.random()*Math.PI*2; // start angle
    // pointer is at top (around -π/2 or 3π/2 in standard coords)
    // sector i starts at angle (i/SECTORS)*2π
    // we want sector targetIndex to be at angle -π/2 (top/pointer position)
    // so: rotation + (targetIndex/SECTORS)*2π = -π/2
    // rotation = -π/2 - (targetIndex/SECTORS)*2π
    const sectorAngle = (2*Math.PI)/SECTORS;
    const targetAngle = -Math.PI/2 - (targetIndex/SECTORS)*2*Math.PI;
    const spins = 5 + Math.floor(Math.random()*3); 
    const endRot = startRot + spins*2*Math.PI + targetAngle;
    function frame(now){ const t = Math.min(1,(now-start)/duration); const eased = 1 - Math.pow(1-t,3); const rot = startRot + (endRot-startRot)*eased; drawWheel(rot, targetIndex); if(t<1) requestAnimationFrame(frame); else resolve(endRot); }
    requestAnimationFrame(frame);
  }); }

  function formatMoney(v){ return `$${v.toFixed(2)}` }

  // resolve a placed bet and return payout amount (not including returned bet)
  function resolveBet(outcomeNumber, betType, params, stake){ // outcomeNumber is actual number (0-36)
    if(betType==='number'){ const n = Number(params.number); if(n===outcomeNumber) return stake*35; else return 0; }
    if(betType==='color'){ if(outcomeNumber===0) return 0; const color = params.color; const isRed = REDS.has(outcomeNumber); return ( (isRed && color==='red') || (!isRed && color==='black') ) ? stake*1 : 0; }
    if(betType==='parity'){ if(outcomeNumber===0) return 0; const isEven = outcomeNumber%2===0; return ( (params.parity==='even' && isEven) || (params.parity==='odd' && !isEven) ) ? stake*1 : 0; }
    if(betType==='dozen'){ if(outcomeNumber===0) return 0; const idx = params.dozen; if(idx==='1' && outcomeNumber>=1 && outcomeNumber<=12) return stake*2; if(idx==='2' && outcomeNumber>=13 && outcomeNumber<=24) return stake*2; if(idx==='3' && outcomeNumber>=25 && outcomeNumber<=36) return stake*2; return 0; }
    if(betType==='column'){ if(outcomeNumber===0) return 0; // columns: 1st = numbers 1,4,7,...34 (i % 3 === 1)
      const col = Number(params.column); const mod = outcomeNumber % 3; const colIndex = mod===1?1:(mod===2?2:3); return (colIndex===col) ? stake*2 : 0; }
    if(betType==='highlow'){ if(outcomeNumber===0) return 0; if(params.highlow==='low' && outcomeNumber>=1 && outcomeNumber<=18) return stake*1; if(params.highlow==='high' && outcomeNumber>=19 && outcomeNumber<=36) return stake*1; return 0; }
    return 0;
  }

  // draw outcome label
  function prettyOutcome(n){ return `${n} (${REDS.has(n)?'Red': n===0? 'Green':'Black'})`; }

  // derive flip + spin
  async function doSpin(){ const bet = Number(betInput.value)||0; if(bet<=0){ alert('Set a bet'); return; } if(bet>bankroll){ alert('Not enough bankroll'); return; }
    // collect bet params
    const betType = typeInput.value; const params = {};
    if(betType==='number'){ const el=document.getElementById('bet-number'); params.number = el?Number(el.value):NaN; if(!Number.isInteger(params.number) || params.number<0 || params.number>36){ alert('Invalid number (0-36)'); return; } }
    if(betType==='color'){ params.color = document.getElementById('bet-color').value; }
    if(betType==='parity'){ params.parity = document.getElementById('bet-parity').value; }
    if(betType==='dozen'){ params.dozen = document.getElementById('bet-dozen').value; }
    if(betType==='column'){ params.column = document.getElementById('bet-column').value; }
    if(betType==='highlow'){ params.highlow = document.getElementById('bet-highlow').value; }

    // take bet
    bankroll -= bet; saveBankroll(); renderBankroll(); log.innerHTML=''; lastOutcomeEl.textContent='Spinning...'; if(resultEl){ resultEl.textContent='-'; resultEl.style.color=''; }
    // determine result via provably-fair derivation
    const client = clientSeedInput.value || (localStorage.getItem(CLIENT_SEED_KEY) || '');
    const idx = await deriveOutcome(serverSeed, client, nonce); 
    const resultNumber = WHEEL[idx];
    // animate wheel to idx
    spinBtn.disabled=true; quickBtn.disabled=true; clearBtn.disabled=true;
    await animateToSector(idx);
    // reveal server seed
    serverSeedEl.textContent = serverSeed;
    // compute payout
    const winAmount = resolveBet(resultNumber, betType, params, bet);
    // compute proper payout including returned stake: if win: return stake + winAmount, else 0
    const totalReturn = winAmount>0 ? (bet + Math.floor(winAmount*100)/100) : 0;
    if(totalReturn>0){ bankroll += totalReturn; }
    // update log and UI
    if(totalReturn>0){ log.innerHTML = `<p style="color:#8f8">Result: ${prettyOutcome(resultNumber)} — You won ${formatMoney(totalReturn)} (includes stake)</p>`; }
    else{ log.innerHTML = `<p style="color:#f66">Result: ${prettyOutcome(resultNumber)} — You lost ${formatMoney(bet)}</p>`; }
    lastOutcomeEl.textContent = prettyOutcome(resultNumber);
    // update result display (Win / Lose with amount)
    if(resultEl){ if(totalReturn>0){ resultEl.textContent = `Win +${formatMoney(totalReturn)}`; resultEl.style.color = '#8f8'; } else { resultEl.textContent = 'Lose'; resultEl.style.color = '#f66'; } }
    // increment nonce and reset server seed for next round (new hash shown). Keep revealed seed visible until user navigates away.
    nonce++; await newServerSeed(false);
    saveBankroll(); renderBankroll();
    spinBtn.disabled=false; quickBtn.disabled=false; clearBtn.disabled=false; }

  // quick and clear
  quickBtn.addEventListener('click', ()=>{ const prev=betInput.value; betInput.value = Math.max(1, Math.floor((bankroll||1000)/100)); doSpin().finally(()=>{ betInput.value = prev; }); });
  spinBtn.addEventListener('click', ()=>{ doSpin().catch(e=>{ console.error(e); alert('Spin error'); spinBtn.disabled=false; quickBtn.disabled=false; clearBtn.disabled=false; }); });
  clearBtn.addEventListener('click', ()=>{ betInput.value=''; betParams.innerHTML=''; renderBetParams(); updatePayoutUI(); });

  // generate initial seed
  await newServerSeed();

})();
