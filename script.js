  // Show/hide game card
  const gameStage = document.getElementById('gameStage');
  function showGameCard(show=true){
    if(gameStage) gameStage.style.display = show ? '' : 'none';
  }
  // Hide on load
  showGameCard(false);
(function(){
  // === CONFIG (for beta) ===
  const PLAY_CODES = ["ALPHA2025", "BETAPLAY1", "GAMEX2025", "CAMPUSQAR"]; // DO NOT publish in marketing copy
  const MAX_VOUCHER = 100;
  const WIN_INCREMENT = 10;
  const LOSS_DECREMENT = 5;

  // === UI elements ===
  const codeInput = document.getElementById('codeInput');
  const validateBtn = document.getElementById('validateBtn');
  const codeStatus = document.getElementById('codeStatus');
  const gameSelect = document.getElementById('gameSelect');
  const startBtn = document.getElementById('startBtn');
  let gameArea = document.getElementById('gameArea');
  // Defensive fallback: if the HTML is missing the gameArea element, create and append one.
  // Prefer the .game-stage section (full-width under instructions) if present, otherwise fallback
  if(!gameArea){
    const stage = document.querySelector('.game-stage');
    const playInner = document.querySelector('.play .play-inner');
    const ga = document.createElement('div');
    ga.id = 'gameArea';
    ga.className = 'game-area';
    ga.setAttribute('aria-live','polite');
    if(stage) stage.appendChild(ga);
    else if(playInner) playInner.appendChild(ga);
    gameArea = ga;
  }
  const voucherValueEl = document.getElementById('voucherValue');
  const claimBtn = document.getElementById('claimBtn');
  const ugcText = document.getElementById('ugcText');
  const copyUgc = document.getElementById('copyUgc');
  const themeToggle = document.getElementById('themeToggle');

  // state
  let validated = false;
  let activeCode = null;
  let voucherValue = 0;

  voucherValueEl.textContent = voucherValue;

  // helper
  function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
  function setStatus(txt, ok){
    codeStatus.textContent = 'Status: ' + txt;
    // remove previous status classes and set new state class for styling
    codeStatus.classList.remove('status--ok','status--err');
    if(ok) codeStatus.classList.add('status--ok');
    else codeStatus.classList.add('status--err');
  }

  // --- Spin-the-wheel ---
  function showWheelModal({maxSpins=1} = {}){
    return new Promise(resolve => {
      // slices (percent values) - six equal slices (angles), values shown are percentages of MAX_VOUCHER
      const slices = [5,10,15,20,25,25];
      const sliceAngle = 360 / slices.length;

      const overlay = document.createElement('div'); overlay.className = 'wheel-overlay';
      const modal = document.createElement('div'); modal.className = 'wheel-modal';
      modal.innerHTML = `
        <div class="wheel-header">
          <div class="wheel-title">Spin the wheel — win a starting voucher</div>
          <button type="button" id="wheelClose" class="wheel-close" title="Close">✕</button>
        </div>
        <div class="wheel">
          <div class="pointer" aria-hidden="true"></div>
          <div class="wheel-face"></div>
        </div>
        <div class="wheel-controls">
          <button id="wheelSpin" class="wheel-btn primary">Spin</button>
          <button id="wheelAgain" class="wheel-btn" style="display:none">Spin again</button>
          <button id="wheelAccept" class="wheel-btn primary" style="display:none">Accept</button>
        </div>
        <div class="wheel-result" id="wheelResult" aria-live="polite"></div>
      `;
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      const face = modal.querySelector('.wheel-face');
      const spinBtn = modal.querySelector('#wheelSpin');
      const againBtn = modal.querySelector('#wheelAgain');
      const resultEl = modal.querySelector('#wheelResult');
      const closeBtn = modal.querySelector('#wheelClose');

      // Enhanced colors with gradients for 3D effect
      const colors = [
        ['#FFD700', '#FFA000'], // Gold
        ['#FF4081', '#C2185B'], // Pink
        ['#4CAF50', '#2E7D32'], // Green
        ['#2196F3', '#1565C0'], // Blue
        ['#9C27B0', '#6A1B9A'], // Purple
        ['#FF5722', '#D84315']  // Orange
      ];
      
      let gradientParts = [];
      slices.forEach((pct, i) => {
        const start = i * sliceAngle;
        const end = start + sliceAngle;
        const [color1, color2] = colors[i % colors.length];
        // Create shaded effect with multiple color stops
        gradientParts.push(
          `${color1} ${start}deg, ${color2} ${start + sliceAngle/2}deg, ${color1} ${end}deg`
        );
      });
      face.style.background = `conic-gradient(${gradientParts.join(',')})`;

      // Enhanced labels with better positioning and styling
      slices.forEach((pct, i) => {
        const angle = (i*sliceAngle + sliceAngle/2) - 90;
        const label = document.createElement('div');
        label.className = 'label';
        // Position labels slightly closer to edge for better visibility
        label.style.transform = `translate(-50%,-50%) rotate(${angle}deg) translate(0,-130px) rotate(${-angle}deg)`;
        label.textContent = pct + '%';
        face.parentElement.appendChild(label);
      });

  let spinning = false;
  let spinsCount = 0;
  let lastResult = null;

  function cleanup(){ overlay.remove(); }

  function doSpin(forcedPct){
        if(spinning) return;
        spinning = true;
        spinBtn.disabled = true;
        againBtn.style.display = 'none';
        
        // Add spinning class for visual feedback
        face.parentElement.classList.add('spinning');

        // decide index with visible randomness
        let index;
        if(typeof forcedPct === 'number'){
          // pick index of slice that equals forcedPct (first match)
          index = slices.findIndex(s => s === forcedPct);
          if(index === -1) index = 1; // fallback
        } else {
          // Create visible randomness by spinning multiple times with different speeds
          index = Math.floor(Math.random() * slices.length);
        }

        const minTurns = 5; // Minimum full rotations
        const randomTurns = Math.random() * 3; // Additional random rotations
        const fullTurns = minTurns + randomTurns;
        
        // Add small random offset within the slice for natural feel
        const sliceOffset = (Math.random() - 0.5) * (sliceAngle * 0.5);
        const targetAngle = (fullTurns * 360) + (360 - (index * sliceAngle) - sliceAngle/2) + sliceOffset;
        
        // Apply transform with enhanced easing for realistic momentum
        face.style.transition = 'transform 4.5s cubic-bezier(.2,.8,.2,1)';
        face.style.transform = `rotate(${targetAngle}deg)`;

        // Enhanced transition end handling with better visual feedback
        const onEnd = ()=>{
          face.removeEventListener('transitionend', onEnd);
          // Remove spinning class
          face.parentElement.classList.remove('spinning');
          
          // Add winning animation
          face.style.animation = 'win-pulse 0.5s ease-out';
          setTimeout(() => {
            face.style.animation = '';
          }, 500);
          
          spinning = false;
          spinsCount++;
          const pct = slices[index];
          const amount = Math.round((pct/100) * MAX_VOUCHER);
          lastResult = {pct, amount};
          
          // Animate the result text
          resultEl.style.opacity = '0';
          resultEl.textContent = `You won ${pct}% — ${amount} QAR`;
          requestAnimationFrame(() => {
            resultEl.style.transition = 'opacity 0.3s ease-in';
            resultEl.style.opacity = '1';
          });
          
          // show spin again if first spin with animation
          if(spinsCount < maxSpins){
            againBtn.style.display = '';
            againBtn.style.animation = 'button-pop 0.3s ease-out';
          }
          
          // reveal Accept button with animation
          const acceptBtn = modal.querySelector('#wheelAccept');
          if(acceptBtn) {
            acceptBtn.style.display = '';
            acceptBtn.style.animation = 'button-pop 0.3s ease-out';
          }
          
          // reveal spin button again
          spinBtn.disabled = false;
        };
        face.addEventListener('transitionend', onEnd);
      }

      // first spin button
      spinBtn.addEventListener('click', ()=>{
        doSpin();
      });

      // spin again will always land on 10%
      againBtn.addEventListener('click', ()=>{
        // hide again while spinning
        againBtn.style.display = 'none';
        doSpin(10);
      });

      // accept final result
      const acceptBtn = modal.querySelector('#wheelAccept');
      acceptBtn.addEventListener('click', ()=>{
        cleanup();
        resolve(lastResult);
      });

      // close (cancel)
      closeBtn.addEventListener('click', ()=>{ cleanup(); resolve(null); });
    });
  }

  // THEME: apply, persist and init
  function applyTheme(theme){
    if(theme === 'dark'){
      document.body.classList.add('dark');
      if(themeToggle) themeToggle.setAttribute('aria-pressed','true');
      if(themeToggle) themeToggle.textContent = '☀️';
    } else {
      document.body.classList.remove('dark');
      if(themeToggle) themeToggle.setAttribute('aria-pressed','false');
      if(themeToggle) themeToggle.textContent = '🌙';
    }
  }

  // load saved theme (localStorage) or prefer OS setting
  (function initTheme(){
    try{
      const saved = localStorage.getItem('theme');
      if(saved) applyTheme(saved);
      else if(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) applyTheme('dark');
      else applyTheme('light');
    } catch(e){
      // ignore storage errors
      applyTheme('light');
    }
  })();

  if(themeToggle){
    themeToggle.addEventListener('click', ()=>{
      const isDark = document.body.classList.contains('dark');
      const next = isDark ? 'light' : 'dark';
      applyTheme(next);
      try{ localStorage.setItem('theme', next); } catch(e){}
    });
  }

  // validate code (client-side for beta)
  validateBtn.addEventListener('click', ()=>{
    const v = codeInput.value.trim();
    if(!v){ setStatus('please enter a code (ask in DM)', false); return; }
    if(PLAY_CODES.includes(v)){
      validated = true;
      activeCode = v;
      setStatus('code validated — you may choose a game', true);
      // enable the select and remove the placeholder option so it doesn't appear in the dropdown
      gameSelect.disabled = false;
      const placeholder = gameSelect.querySelector('option[value=""]');
      if(placeholder) placeholder.remove();
  // ensure user actively selects a game before Start is enabled
  try{ gameSelect.selectedIndex = -1; } catch(e){}
  startBtn.disabled = true;
    } else {
      validated = false;
      activeCode = null;
      setStatus('invalid code. Ask for a code via DM', false);
      // disable select and ensure the initial placeholder is visible as the selected hint
      gameSelect.disabled = true;
      startBtn.disabled = true;
      if(!gameSelect.querySelector('option[value=""]')){
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '-- validate code first --';
        opt.selected = true;
        opt.disabled = true;
        gameSelect.insertBefore(opt, gameSelect.firstChild);
      } else {
        // ensure placeholder is selected
        const ph = gameSelect.querySelector('option[value=""]');
        if(ph) ph.selected = true;
      }
    }
  });

  gameSelect.addEventListener('change', ()=>{
    startBtn.disabled = !validated || !gameSelect.value;
  });

  startBtn.addEventListener('click', async ()=>{
    if(!validated){ setStatus('validate a code first', false); return; }
    const choice = gameSelect.value;
    if(!choice) return;

    // Show wheel modal and wait for final accepted result
    const result = await showWheelModal({ maxSpins: 2 });
    if(!result){
      // user cancelled
      return;
    }

    // set starting voucher based on wheel
    voucherValue = clamp(result.amount, 0, MAX_VOUCHER);
    updateVoucherUI();

    // start selected game
    if(choice === 'memory') startMemoryGame();
    else if(choice === 'trivia') startTriviaGame();
  });

  // ====== Memory Game (simple 4-pair) ======
  function startMemoryGame(){
    showGameCard(true);
    gameArea.innerHTML = '';
    const heading = document.createElement('h3');
    heading.textContent = 'Match & Win — find all pairs';
    gameArea.appendChild(heading);

  const board = document.createElement('div');
  board.className = 'game-board';
  board.style.display = 'grid';
  board.style.gridTemplateColumns = 'repeat(4, 70px)';
  board.style.gap = '8px';
  board.style.marginTop = '12px';

    // simple emoji pairs
    const icons = ['💻','🔒','🎯','🧠'];
    const deck = icons.concat(icons).sort(()=>Math.random()-0.5);

    let flipped = [];
    let matched = new Array(deck.length).fill(false);
    let mistakes = 0;

    deck.forEach((icon, idx) => {
      const card = document.createElement('button');
      card.className = 'card-btn';
      card.style.width = '70px';
      card.style.height = '70px';
      card.style.fontSize = '24px';
      card.textContent = '';
      card.dataset.idx = idx;
      card.dataset.icon = icon;
      card.addEventListener('click', () => {
        if(matched[idx] || flipped.includes(idx) || flipped.length === 2) return;
        flipped.push(idx);
        card.textContent = icon;
        if(flipped.length === 2){
          const [a,b] = flipped;
          if(deck[a] === deck[b]){
            matched[a]=matched[b]=true;
            flipped = [];
            // update voucher win
            voucherValue = clamp(voucherValue + WIN_INCREMENT, 0, MAX_VOUCHER);
            updateVoucherUI();
            checkAllMatched();
          } else {
            mistakes++;
            // penalize
            voucherValue = clamp(voucherValue - LOSS_DECREMENT, 0, MAX_VOUCHER);
            updateVoucherUI();
            setTimeout(()=> {
              // flip back
              [...board.querySelectorAll('button')].forEach(btn=>{
                const i = +btn.dataset.idx;
                if(!matched[i]) btn.textContent = '';
              });
              flipped = [];
            }, 800);
          }
        }
      });
      board.appendChild(card);
    });

    const info = document.createElement('p');
    info.style.marginTop = '10px';
    info.textContent = 'Each correct pair = +' + WIN_INCREMENT + ' QAR. Each mistake = -' + LOSS_DECREMENT + ' QAR.';
    gameArea.appendChild(info);
    gameArea.appendChild(board);

    function checkAllMatched(){
      if(matched.every(Boolean)){
        const winMsg = document.createElement('div');
        winMsg.innerHTML = `<h3>All pairs found 🎉</h3><p>Your voucher is now <strong>${voucherValue} QAR</strong>.</p>`;
        const claim = document.createElement('button');
        claim.textContent = 'I won — Prepare screenshot & DM to claim';
        claim.addEventListener('click', ()=> {
          // enable claim button
          claimBtn.disabled = false;
        });
        winMsg.appendChild(claim);
        gameArea.appendChild(winMsg);
      }
    }
  }

  // ====== Trivia Game (3 questions) ======
  function startTriviaGame(){
    showGameCard(true);
    gameArea.innerHTML = '';
    const heading = document.createElement('h3');
    heading.textContent = 'Trivia Hunt — 3 quick questions';
    gameArea.appendChild(heading);

    const questions = [
      {
        q: 'What does "BPO" stand for?',
        choices: ['Business Process Outsourcing','Basic Product Offer','Binary Protocol Operation','Back-end Programming Option'],
        a: 0
      },
      {
        q: 'Which file is used to style a webpage?',
        choices: ['index.js','styles.css','app.exe','readme.md'],
        a: 1
      },
      {
        q: 'Which practice improves account security?',
        choices: ['Use same password everywhere','Disable 2FA','Use unique strong passwords + 2FA','Share passwords with teammates'],
        a: 2
      }
    ];
    let idx = 0;
    let score = 0;
  const container = document.createElement('div');
  container.className = 'trivia-container';
  container.style.marginTop = '12px';
    gameArea.appendChild(container);

    function renderQuestion(){
      container.innerHTML = '';
      const item = questions[idx];
      const qEl = document.createElement('p'); qEl.textContent = (idx+1)+'. '+item.q;
      container.appendChild(qEl);
      item.choices.forEach((c, i)=>{
        const btn = document.createElement('button');
        btn.textContent = c;
        btn.style.display = 'block';
        btn.style.margin = '6px 0';
        btn.addEventListener('click', ()=>{
          if(i === item.a){
            score++;
            voucherValue = clamp(voucherValue + WIN_INCREMENT, 0, MAX_VOUCHER);
            updateVoucherUI();
          } else {
            voucherValue = clamp(voucherValue - LOSS_DECREMENT, 0, MAX_VOUCHER);
            updateVoucherUI();
          }
          idx++;
          if(idx < questions.length) renderQuestion();
          else finishTrivia();
        });
        container.appendChild(btn);
      });
    }

    function finishTrivia(){
      container.innerHTML = `<h4>Done — Score: ${score}/${questions.length}</h4>
        <p>Your voucher: <strong>${voucherValue} QAR</strong></p>
        <button id="trClaim">Ready to claim — screenshot & DM</button>
      `;
      const btn = document.getElementById('trClaim');
      btn.addEventListener('click', ()=>{ claimBtn.disabled = false; });
    }

    renderQuestion();
  }

  // update voucher display & UGC text
  function updateVoucherUI(){
    voucherValueEl.textContent = voucherValue;
    // prepare UGC caption template
    ugcText.value = `I just played Marshmallow.Projects puzzle beta and my voucher is ${voucherValue} QAR! 🎉\nCode used: ${activeCode || '[code]'}\nI tag @Marshmallow.Projects — check them out! #MarshmallowPuzzle`;
    if(voucherValue > 0) claimBtn.disabled = false;
    else claimBtn.disabled = true;
  }

  // claim button opens DM link (manual)
  claimBtn.addEventListener('click', ()=>{
    alert('To claim: DM @Marshmallow.Projects on Instagram or Facebook with your screenshot, profile handle and the code you used. We will verify and reply.');
    window.open('https://instagram.com/Marshmallow.Projects','_blank');
  });

  // copy UGC text
  copyUgc.addEventListener('click', ()=>{
    ugcText.select();
    document.execCommand('copy');
    alert('Caption copied — paste to your post & story and tag @Marshmallow.Projects');
  });

  // initially populate UGC text
  ugcText.value = 'Play Marshmallow.Projects puzzle and win 100QAR voucher! DM us to request a code and start. Tag @Marshmallow.Projects when posting your win.';
})();
