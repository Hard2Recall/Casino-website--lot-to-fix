// Plinko game: random bounce down a peg pyramid with binomial-based slot multipliers
(function(){
  const bankrollEl = document.getElementById('bankroll');
  const betInput = document.getElementById('bet');
  const riskSelect = document.getElementById('risk');
  const rowsInput = document.getElementById('rows');
  const canvas = document.getElementById('plinko-canvas');
  const ctx = canvas.getContext('2d');
  const dropBtn = document.getElementById('drop');
  const quickBtn = document.getElementById('quick');
  const multipliersEl = document.getElementById('multipliers');
  const log = document.getElementById('plinko-log');
  let lastResultEl = document.getElementById('last-result');
  if(!lastResultEl) {
    lastResultEl = document.createElement('span');
    lastResultEl.id = "last-result";
    lastResultEl.style.display = "none";
    document.body.appendChild(lastResultEl);
  }

  let bankroll = loadBankroll();
  let animating = false;

  function loadBankroll(){ try{ const v=localStorage.getItem('casino_bankroll'); return v?Number(v):1000 }catch(e){return 1000} }
  function saveBankroll(){ try{ localStorage.setItem('casino_bankroll',String(bankroll)); }catch(e){} }
  function renderBankroll(){ bankrollEl.textContent = `$${bankroll.toFixed(2)}` }
  renderBankroll();

  function formatMoney(v){ return `$${v.toFixed(2)}` }

  // compute binomial coefficient
  function binomial(n,k){ if(k<0||k>n) return 0; let res=1; for(let i=1;i<=k;i++){ res = res*(n-(k-i))/i; } return Math.round(res); }

  // compute slot probabilities and multipliers
  function computeMultipliers(rows, risk){
    const n = rows;
    const slots = n+1;
    const ps = new Array(slots);
    for(let j=0;j<slots;j++){ ps[j] = binomial(n,j) / Math.pow(2,n); }
    // choose target RTP per risk
    let targetRTP = 0.95;
    if(risk==='low') targetRTP = 0.98;
    if(risk==='medium') targetRTP = 0.95;
    if(risk==='high') targetRTP = 0.92;
    // multiplier_j = C / p_j where C chosen so expected payout = targetRTP
    const C = targetRTP / slots;
    const mults = ps.map(p => Math.max(0, C / p));
    return {ps,mults};
  }

  function showMultipliers(){
    multipliersEl.innerHTML = '';
    const rows = Math.min(Number(rowsInput.value)||10, 10);
    const risk = riskSelect.value;
    const {mults} = computeMultipliers(rows, risk);
    for(let i=0;i<mults.length;i++){
      const d = document.createElement('div');
      d.style.padding='8px 13px';
      d.style.background='rgba(255,255,255,0.03)';
      d.style.borderRadius='8px';
      d.style.fontSize='15px';
      d.textContent = `${i}: x${mults[i].toFixed(2)}`;
      multipliersEl.appendChild(d);
    }
  }

  // draw static board pegs and slots; store peg/slot positions for animation
  const plinkoState = {pegPositions: [], slotXs: [], slotTop: 0};
  function drawBoard(rows){
    rows = Math.min(rows, 10);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const w=canvas.width; const h=canvas.height; const margin = 20; const areaW = w - margin*2; const areaH = h - margin*2 - 60;
    ctx.fillStyle = '#cfeaf7';
    const pegRadius = 6.2; plinkoState.pegPositions = [];
    for(let r=0;r<rows;r++){
      const y = margin + (r+1) * (areaH/(rows+1));
      const cols = r+1;
      const spacing = 27;
      const startX = margin + (areaW - (cols-1)*spacing)/2;
      plinkoState.pegPositions[r] = [];
      for(let c=0;c<cols;c++){
        const x = startX + c*spacing;
        plinkoState.pegPositions[r].push({x,y});
        ctx.beginPath(); ctx.arc(x,y,pegRadius,0,Math.PI*2); ctx.fillStyle = '#7fb3d9'; ctx.fill();
      }
    }
    // draw slots
    const slots = rows+1; const slotW = areaW/slots; const top = margin + (rows+1)*(areaH/(rows+1)) + 7;
    plinkoState.slotTop = top;
    ctx.fillStyle = '#16343d'; ctx.fillRect(margin, top, areaW, 60);
    ctx.strokeStyle = '#1f5566'; for(let s=0;s<=slots;s++){ const x = margin + s*slotW; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top+60); ctx.stroke(); }

    // draw multipliers under slots (from computeMultipliers)
    const {mults} = computeMultipliers(rows, riskSelect.value);
    plinkoState.slotXs = [];
    ctx.fillStyle = '#e6eef6'; ctx.font = '15px Segoe UI, Roboto, Arial'; ctx.textAlign = 'center';
    for(let s=0;s<slots;s++){
      const x = margin + (s+0.5)*slotW;
      plinkoState.slotXs.push(x);
      // small pill background
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(x-18, top+34, 36,16,5);
      else ctx.fillRect(x-18, top+34, 36,16);
      ctx.fillStyle = '#e6eef6'; ctx.fillText(`x${mults[s].toFixed(2)}`, x, top+46);
    }
  }

  // animate a single drop using random left/right choices, returns final slot index
  async function dropBall(rows){
    rows = Math.min(rows, 10);
    const w = canvas.width; const h = canvas.height; const margin = 20; const areaW = w - margin*2; const areaH = h - margin*2 - 60; const slots = rows+1; const slotW = areaW/slots;
    let x = margin + areaW/2; let y = margin;
    const path = [{x,y}];
    for(let r=0;r<rows;r++){
      const pegRow = plinkoState.pegPositions[r];
      const rowY = pegRow[0].y;
      const dir = (Math.random() < 0.5) ? -1 : 1;
      const spacing = (pegRow.length>1) ? (pegRow[1].x - pegRow[0].x) : 27;
      x += dir * spacing/2 + (Math.random()-0.5)*6;
      const leftBound = margin + 4; const rightBound = margin + areaW - 4;
      x = Math.max(leftBound, Math.min(rightBound, x));
      path.push({x, y: rowY});
    }
    // final drop into slots area
    const top = plinkoState.slotTop; const finalY = top + 25;
    path.push({x, y: finalY});
    // animate path smoothly and return slot index
    await animatePath(path);
    // determine slot index by nearest slotX
    let closest = 0; let bestDist = Infinity;
    for(let i=0;i<plinkoState.slotXs.length;i++){ const dx = Math.abs(plinkoState.slotXs[i] - x); if(dx < bestDist){ bestDist = dx; closest = i; } }
    // final highlight animation to the exact slot center
    const finalX = plinkoState.slotXs[closest]; await animatePath([{x: x, y: finalY}, {x: finalX, y: finalY}], closest);
    return closest;
  }

  // animate along a path of positions [{x,y},...]
  function animatePath(path, highlightSlotIndex){
    return new Promise(resolve=>{
      const ballRadius = 8; let t0 = null; const totalSegments = path.length-1;
      // 180 ms per segment
      const segDuration = 180;
      const totalDuration = Math.max(390, segDuration * totalSegments);
      function step(ts){
        if(!t0) t0 = ts;
        const elapsed = ts - t0;
        const progress = Math.min(1, elapsed/totalDuration);
        const exact = progress * totalSegments;
        const seg = Math.min(totalSegments-1, Math.floor(exact));
        const local = exact - seg;
        const a = path[seg], b = path[seg+1];
        const x = a.x + (b.x - a.x) * local;
        const y = a.y + (b.y - a.y) * local;
        drawBoard(Math.min(Number(rowsInput.value)||10, 10));
        if(typeof highlightSlotIndex === 'number'){
          const top = plinkoState.slotTop; const slotX = plinkoState.slotXs[highlightSlotIndex];
          ctx.fillStyle = 'rgba(255,215,0,0.09)'; ctx.beginPath(); ctx.rect(slotX - 18, top, 36, 60); ctx.fill();
        }
        ctx.beginPath(); ctx.fillStyle = '#ffd36b'; ctx.arc(x, y, ballRadius, 0, Math.PI*2); ctx.fill();
        if(progress<1) requestAnimationFrame(step); else resolve();
      }
      requestAnimationFrame(step);
    });
  }

  async function handleDrop(){
    if(animating) return;
    const bet = Number(betInput.value)||0;
    let rows = Math.min(Number(rowsInput.value)||10, 10);
    rowsInput.value = rows; // enforce visual
    const risk = riskSelect.value;
    if(bet<=0 || bet>bankroll){ alert('Invalid bet or insufficient bankroll'); return; }
    animating = true; dropBtn.disabled = true; quickBtn.disabled = true; log.innerHTML = '';
    const {mults,ps} = computeMultipliers(rows, risk);
    showMultipliers();
    bankroll -= bet; saveBankroll(); renderBankroll();
    const slot = await dropBall(rows);
    const multiplier = mults[slot]; const payout = bet * multiplier;
    bankroll += payout; saveBankroll(); renderBankroll();
    lastResultEl.textContent = `Slot ${slot} — x${multiplier.toFixed(2)} — ${formatMoney(payout)}`;
    log.innerHTML = `<p>Dropped into slot ${slot}. Multiplier x${multiplier.toFixed(4)} — won ${formatMoney(payout)}</p>`;
    animating = false; dropBtn.disabled = false; quickBtn.disabled = false;
  }

  dropBtn.addEventListener('click', ()=>{ handleDrop().catch(e=>{ console.error(e); alert('Error during drop'); animating=false; dropBtn.disabled=false; quickBtn.disabled=false; }); });
  quickBtn.addEventListener('click', ()=>{ const original = betInput.value; betInput.value = Math.max(1, Math.floor((bankroll||1000)/100)); handleDrop().finally(()=>{ betInput.value = original; }); });

  rowsInput.addEventListener('change', ()=>{ rowsInput.value = Math.min(Math.max(Number(rowsInput.value)||10,8),10); drawBoard(Math.min(Number(rowsInput.value)||10, 10)); showMultipliers(); });
  riskSelect.addEventListener('change', ()=>{ showMultipliers(); });

  drawBoard(Math.min(Number(rowsInput.value)||10, 10)); showMultipliers();
})();