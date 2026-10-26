import { platforms, spikes, gemLocations, checkpoints, spawn, step } from './physics.js';
import { drawCharacter } from './character.js';

const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const overlay = document.querySelector('#overlay');
const start = document.querySelector('#start');
const pause = document.querySelector('#pause');
const hint = document.querySelector('#action-hint');
const keys = new Set();
const particles = [];
let p = spawn();
let collected = new Set();
let state = 'intro';
let camera = 0, viewWidth = 1000, time = 0, last = 0, accumulator = 0;
let muted = true, audio, jump = false, up = false;
let checkpoint = 0, deathTimer = 0, footDistance = 0, shake = 0;

function tone(frequency = 440, duration = .18, volume = .04) {
  if (muted) return;
  audio ??= new AudioContext();
  audio.resume();
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(frequency * .65, audio.currentTime + duration);
  gain.gain.setValueAtTime(volume, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration);
  oscillator.start();
  oscillator.stop(audio.currentTime + duration);
}

function toast(text) {
  document.querySelector('#toast').textContent = text;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => document.querySelector('#toast').textContent = '', 3000);
}

function dust(x, y, count = 8, force = 1) {
  for (let i = 0; i < count; i++) {
    particles.push({ x, y, vx: (Math.random() - .5) * 90 * force,
      vy: -Math.random() * 65 * force - 8, life: .35 + Math.random() * .3, maxLife: .65,
      size: 1 + Math.random() * 2.5, color: '#d5b891' });
  }
}

function reset() {
  p = spawn(); collected.clear(); checkpoint = 0; camera = 0;
  deathTimer = 0; shake = 0; particles.length = 0; jump = up = false; footDistance = 0;
  keys.clear();
  document.querySelector('#gems').textContent = '0 / 3';
  document.querySelector('#checkpoint').textContent = 'DZIEDZINIEC';
  document.querySelector('#toast').textContent = '';
  clearTimeout(toast.timer);
  toast.gateShown=false;
}

function show(title, description, label) {
  overlay.hidden = false;
  overlay.querySelector('h2').textContent = title;
  overlay.querySelector('p:not(.eyebrow)').textContent = description;
  start.innerHTML = label + ' <span>→</span>';
}

function play() {
  if (state === 'won') reset();
  state = 'playing'; overlay.hidden = true;
  pause.classList.remove('is-paused'); pause.setAttribute('aria-label', 'Wstrzymaj grę');
  canvas.focus({ preventScroll: true });
}

function toggle() {
  if (state === 'intro' || state === 'won') return;
  keys.clear(); jump = up = false;
  if (state === 'playing') {
    state = 'paused';
    show('Chwila oddechu.', 'Złap krawędź w locie. W — podciągnij się. S — puść.', 'KONTYNUUJ');
    pause.classList.add('is-paused'); pause.setAttribute('aria-label', 'Wznów grę');
  } else play();
}

start.onclick = play;
pause.onclick = toggle;
document.querySelector('#sound').onclick = event => {
  muted = !muted;
  event.target.textContent = 'DŹWIĘK: ' + (muted ? 'WYŁ.' : 'WŁ.');
  event.target.setAttribute('aria-label', muted ? 'Włącz dźwięk' : 'Wyłącz dźwięk');
  tone();
};

function press(code) {
  if (!keys.has(code)) {
    if (['Space', 'ArrowUp', 'KeyW'].includes(code) && state === 'playing') jump = true;
    if (['ArrowUp', 'KeyW'].includes(code) && state === 'playing') up = true;
    if (code === 'KeyP' || code === 'Escape') toggle();
    if (code === 'KeyR') { reset(); play(); }
  }
  keys.add(code);
}
const gameKeys = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','KeyW','KeyA','KeyS','KeyD'];
window.addEventListener('keydown', event => {
  if (event.target.closest?.('button') && ['Space','Enter'].includes(event.code)) return;
  if (gameKeys.includes(event.code)) event.preventDefault();
  press(event.code);
});
window.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', () => { keys.clear(); jump = up = false; if (state === 'playing') toggle(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') toggle(); });
for (const button of document.querySelectorAll('[data-key]')) {
  button.onpointerdown = event => {
    event.preventDefault(); button.setPointerCapture(event.pointerId); press(button.dataset.key);
  };
  button.onpointerup = button.onpointercancel = button.onlostpointercapture = () => keys.delete(button.dataset.key);
}
function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}
function arch(x,y,w,h,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x,y+h);ctx.lineTo(x,y+w*.5);ctx.bezierCurveTo(x,y-w*.1,x+w*.5,y-w*.35,x+w*.5,y-w*.35);ctx.bezierCurveTo(x+w*.5,y-w*.35,x+w,y-w*.1,x+w,y+w*.5);ctx.lineTo(x+w,y+h);ctx.fill();}
function background(){const grad=ctx.createLinearGradient(0,0,0,540);grad.addColorStop(0,'#252b41');grad.addColorStop(.6,'#777078');grad.addColorStop(1,'#bb997e');ctx.fillStyle=grad;ctx.fillRect(0,0,viewWidth,540);
ctx.fillStyle='#efd6a6';ctx.beginPath();ctx.arc(754-camera*.025,100,36,0,Math.PI*2);ctx.fill();
for(let layer=0;layer<3;layer++){ctx.save();ctx.translate(-camera*(.08+layer*.09),0);for(let i=-1;i<19;i++){let x=i*150+layer*55,y=230+layer*38+Math.sin(i*5)*24;rect(x,y,105,320,['#55576a','#626071','#797077'][layer]);arch(x+12,y-27,80,65,['#55576a','#626071','#797077'][layer]);rect(x+43,y-65,9,43,['#55576a','#626071','#797077'][layer]);for(let k=0;k<3;k++)arch(x+15+k*29,y+60,13,33,'#383e5055');}ctx.restore();}
ctx.save();ctx.translate(-camera*.35,0);for(let i=-1;i<10;i++){const x=i*290;rect(x,0,32,540,'#242a38');rect(x-9,0,50,23,'#333544');rect(x-6,315,44,13,'#444351');ctx.strokeStyle='#373a49';ctx.lineWidth=18;ctx.beginPath();ctx.moveTo(x+32,180);ctx.bezierCurveTo(x+80,-40,x+240,-40,x+290,180);ctx.stroke();}ctx.restore();
const haze=ctx.createLinearGradient(0,200,0,540);haze.addColorStop(0,'#e6b98100');haze.addColorStop(1,'#e6b98130');ctx.fillStyle=haze;ctx.fillRect(0,0,viewWidth,540);
for(let i=0;i<35;i++){ctx.fillStyle='#f6d79550';ctx.beginPath();ctx.arc((i*79+time*7)%(viewWidth+40)-20,(i*47+Math.sin(time+i)*8)%530,1,0,7);ctx.fill();}}

function drawPlatforms() {
  for (const b of platforms) {
    const gradient = ctx.createLinearGradient(0, b.y, 0, 600);
    gradient.addColorStop(0, '#8c7463'); gradient.addColorStop(.3, '#544c4d'); gradient.addColorStop(1, '#292c37');
    ctx.fillStyle = gradient; ctx.fillRect(b.x, b.y, b.w, b.h);
    rect(b.x - 4, b.y, b.w + 8, 9, '#c2aa85');
    rect(b.x, b.y + 10, b.w, 5, '#3e3b40');
    ctx.strokeStyle = '#282c3640'; ctx.lineWidth = 1;
    for (let row = 0; row < 10; row++) {
      const y = b.y + 28 + row * 35;
      ctx.beginPath(); ctx.moveTo(b.x,y); ctx.lineTo(b.x+b.w,y); ctx.stroke();
      for (let x = b.x + (row % 2) * 40; x < b.x+b.w; x += 80) {
        ctx.beginPath(); ctx.moveTo(x,y-30); ctx.lineTo(x,y); ctx.stroke();
      }
    }
    // Worn, bright stone lip makes a catchable edge readable against the wall.
    rect(b.x - 3, b.y + 2, 6, 18, '#dbc49b');
    rect(b.x + b.w - 3, b.y + 2, 6, 18, '#b49a76');
  }
  for (const s of spikes) {
    rect(s.x - 4, s.y - 3, s.w + 8, 3, '#322e33');
    for (let x = s.x; x < s.x + s.w; x += 13) {
      ctx.fillStyle = '#c8c1b4'; ctx.beginPath();
      ctx.moveTo(x,s.y); ctx.lineTo(x+6,s.y-21); ctx.lineTo(x+12,s.y); ctx.fill();
      ctx.fillStyle = '#767785'; ctx.beginPath();
      ctx.moveTo(x+6,s.y-21); ctx.lineTo(x+12,s.y); ctx.lineTo(x+7,s.y); ctx.fill();
    }
  }
}

function draw() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const width = Math.round(canvas.clientWidth * dpr), height = Math.round(canvas.clientHeight * dpr);
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  // Uniform world scale: character proportions and jump arcs stay intact on phones.
  viewWidth = 540 * canvas.clientWidth / canvas.clientHeight;
  ctx.setTransform(height/540, 0, 0, height/540, 0, 0);
  background();
  ctx.save();
  ctx.translate(-camera, shake > 0 ? Math.sin(time * 85) * shake : 0);
  drawPlatforms();
  for (let i = 0; i < gemLocations.length; i++) {
    if (collected.has(i)) continue;
    const gem = gemLocations[i], y = gem.y + Math.sin(time*3+i)*5;
    ctx.save(); ctx.translate(gem.x,y); ctx.shadowBlur = 25; ctx.shadowColor = '#f7ca70';
    ctx.fillStyle = '#ffdda0'; ctx.beginPath(); ctx.moveTo(0,-12); ctx.lineTo(7,0);
    ctx.lineTo(0,12); ctx.lineTo(-7,0); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  arch(2540,283,94,137,'#292836');
  arch(2550,295,74,125,collected.size===3?'#f0c982':'#141c2a');
  for (let i=0; i<3; i++) {
    ctx.fillStyle = collected.has(i)?'#f7d18b':'#69615d';
    ctx.beginPath(); ctx.arc(2561+i*26,282,4,0,7); ctx.fill();
  }
  for (const x of [280,1030,1750,2430]) {
    const floor = platforms.find(b => x>=b.x && x<b.x+b.w)?.y ?? 420;
    rect(x,floor-96,8,35,'#493d3b');
    ctx.fillStyle='#edb369'; ctx.shadowColor='#e7a24d'; ctx.shadowBlur=28;
    ctx.beginPath();ctx.ellipse(x+4,floor-100,5+Math.sin(time*13)*1.5,12,0,0,7);ctx.fill();ctx.shadowBlur=0;
  }
  // Contact shadow follows the floor instead of hovering underneath airborne feet.
  const floor = platforms.filter(b => p.x+p.w>b.x && p.x<b.x+b.w && b.y>=p.y+p.h-2)
    .sort((a,b)=>a.y-b.y)[0];
  if (floor) {
    const height = Math.max(0, floor.y-p.y-p.h);
    ctx.fillStyle = `rgba(17,20,29,${Math.max(.03,.28-height/600)})`;
    ctx.beginPath(); ctx.ellipse(p.x+p.w/2,floor.y+1,Math.max(6,18-height*.04),3,0,0,Math.PI*2); ctx.fill();
  }
  ctx.save(); if (deathTimer > 0) ctx.globalAlpha = Math.max(.1,deathTimer/.65);
  drawCharacter(ctx,p,time); ctx.restore();
  for (const particle of particles) {
    ctx.globalAlpha=Math.max(0,particle.life/particle.maxLife);
    rect(particle.x,particle.y,particle.size,particle.size,particle.color);
  }
  ctx.globalAlpha=1;
  // Ground markings introduce the first ledge without an overlay interrupting play.
  ctx.fillStyle='#f3d4a177'; ctx.font='9px Manrope, sans-serif'; ctx.textAlign='center';
  ctx.fillText('ROZBIEG  →  SKOK',295,457);
  ctx.fillText('W / SPACJA: PODCIĄGNIJ',482,467);
  ctx.restore();
  const text = deathTimer>0 ? 'Powrót do ostatniego punktu…' : p.mode==='hang' ? 'W / SPACJA: podciągnij się · S: puść krawędź' : p.mode==='climb' ? 'Podciąganie…' : p.x<390 ? 'Przytrzymaj skok, żeby sięgnąć wyżej. Krawędź złapiesz w locie.' : '';
  hint.textContent=text;
  hint.hidden = state!=='playing' || !text;
}

function update(dt) {
  const oldMode=p.mode, oldGrounded=p.grounded, oldGait=p.gait || 0;
  if (deathTimer > 0) {
    deathTimer=Math.max(0,deathTimer-dt);
    if (deathTimer===0) {
      p=Object.assign(spawn(),checkpoints[checkpoint]);
      camera=Math.max(0,Math.min(2740-viewWidth,p.x-viewWidth*.35));
      jump=up=false;
    }
  } else {
    const dead=step(p,dt,{
      left:keys.has('ArrowLeft')||keys.has('KeyA'), right:keys.has('ArrowRight')||keys.has('KeyD'),
      jump, jumpHeld:keys.has('Space')||keys.has('ArrowUp')||keys.has('KeyW'), up,
      down:keys.has('ArrowDown')||keys.has('KeyS'),
    });
    jump=up=false;
    if (dead) {
      deathTimer=.65; keys.clear(); tone(115,.35,.07); shake=2;
      dust(p.x+p.w/2,Math.min(520,p.y+p.h),18,1.5);
      toast('Lepszy chwyt, kolejna próba. Fragmenty pozostają z Tobą.');
    } else {
      if (!oldGrounded && p.grounded && oldMode!=='climb') {
        dust(p.x+p.w/2,p.y+p.h,10,1+p.landImpact); tone(110,.08,.025);
        shake=Math.max(shake,p.landImpact*1.4);
      }
      if (oldMode!=='hang' && p.mode==='hang') { dust(p.ledge.x,p.ledge.y,7,.6); tone(260,.08,.025); }
      footDistance += Math.abs((p.gait || 0)-oldGait);
      if (p.grounded && footDistance>32 && Math.abs(p.vx)>45) {
        dust(p.x+p.w/2-p.facing*6,p.y+p.h,3,.35); footDistance=0; tone(85,.045,.012);
      }
      for (let i=0;i<gemLocations.length;i++) {
        const gem=gemLocations[i];
        if (!collected.has(i) && Math.hypot(p.x+p.w/2-gem.x,p.y+p.h*.45-gem.y)<39) {
          collected.add(i); document.querySelector('#gems').textContent=`${collected.size} / 3`;
          tone(550+collected.size*150,.25); dust(gem.x,gem.y,16,.6);
          if (collected.size===3) toast('Brama otwarta. Wolność jest blisko.');
        }
      }
      for (let i=checkpoint+1;i<checkpoints.length;i++) {
        const c=checkpoints[i];
        if (p.grounded && p.x>=c.x && Math.abs(p.y-c.y)<8) {
          checkpoint=i;
          document.querySelector('#checkpoint').textContent=`PUNKT POWROTU ${i}`;
          toast('Punkt powrotu zapisany');
        }
      }
      if (p.x>2525 && collected.size===3 && p.grounded) {
        state='won'; keys.clear(); tone(1000,.5);
        show('Światło zwyciężyło.','Zmierzyłeś się z przepaścią. Pałac zapamięta Twój krok.','ZAGRAJ PONOWNIE');
      }
      if (p.x>2500 && collected.size<3 && !toast.gateShown) {
        toast('Odnajdź wszystkie trzy fragmenty światła.'); toast.gateShown=true;
      }
    }
  }
  camera+=(Math.max(0,Math.min(Math.max(0,2740-viewWidth),p.x-viewWidth*.35))-camera)*Math.min(1,dt*5);
  shake=Math.max(0,shake-dt*7);
  for (let i=particles.length-1;i>=0;i--) {
    const particle=particles[i]; particle.life-=dt; particle.x+=particle.vx*dt;
    particle.y+=particle.vy*dt; particle.vy+=120*dt;
    if (particle.life<=0) particles.splice(i,1);
  }
}

function frame(ms) {
  const elapsed=Math.min((ms-last)/1000||0,.05); last=ms;
  if (state==='playing') {
    time+=elapsed; accumulator+=elapsed;
    while (accumulator>=1/120) {
      update(1/120); accumulator-=1/120;
      if (state!=='playing') break;
    }
  } else accumulator=0;
  draw(); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
