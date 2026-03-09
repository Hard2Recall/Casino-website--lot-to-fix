(function(){
  const key = 'casino_bankroll';
  
  // First controller
  const display1 = document.getElementById('menu-bankroll');
  const input1 = document.getElementById('menu-set-bank');
  const setBtn1 = document.getElementById('menu-set-btn');
  const resetBtn1 = document.getElementById('menu-reset-btn');

  // Second controller
  const display2 = document.getElementById('menu-bankroll2');
  const input2 = document.getElementById('menu-set-bank2');
  const setBtn2 = document.getElementById('menu-set-btn2');
  const resetBtn2 = document.getElementById('menu-reset-btn2');

  function load(){ try{ const v=localStorage.getItem(key); return v?Number(v):1000 }catch(e){return 1000} }
  function save(v){ try{ localStorage.setItem(key,String(v)); }catch(e){} }
  function render(){ 
    const v = load(); 
    if(display1) display1.textContent = `$${v.toFixed(2)}`;
    if(display2) display2.textContent = `$${v.toFixed(2)}`;
  }

  // First controller listeners
  setBtn1?.addEventListener('click', ()=>{
    const v = Number(input1.value);
    if(!Number.isFinite(v) || v < 0){ alert('Enter a valid non-negative number'); return; }
    save(v); render(); input1.value = '';
    alert('Bankroll updated locally. Open any game to see updated balance.');
  });

  resetBtn1?.addEventListener('click', ()=>{
    if(!confirm('Reset bankroll to $1000?')) return;
    save(1000); render();
  });

  // Second controller listeners
  setBtn2?.addEventListener('click', ()=>{
    const v = Number(input2.value);
    if(!Number.isFinite(v) || v < 0){ alert('Enter a valid non-negative number'); return; }
    save(v); render(); input2.value = '';
    alert('Bankroll updated locally. Open any game to see updated balance.');
  });

  resetBtn2?.addEventListener('click', ()=>{
    if(!confirm('Reset bankroll to $1000?')) return;
    save(1000); render();
  });

  // initial
  render();
})();
