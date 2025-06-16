let isPaused = false;

class Bubble {
  constructor(x, y, radius, speed, type = 'normal') {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.speed = speed;
    this.type = type; // 'normal', 'obstacle', 'gold'
    this.isPopped = false;
    this.popped = false; // for compatibility
    this.el = document.createElement('div');
    this.el.className = 'bubble' + (type === 'obstacle' ? ' obstacle' : '') + (type === 'gold' ? ' gold' : '');
    this.el.style.width = this.el.style.height = (radius * 2) + 'px';
    this.el.style.left = (x - radius) + 'px';
    this.el.style.top = (y - radius) + 'px';
    this.el.style.animationDuration = (Math.max(3, 7 - speed * 2)).toFixed(2) + 's';
    this.el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (!this.isPopped) this.pop();
    });
    document.getElementById('game-area').appendChild(this.el);
  }
  update(dt) {
    if (this.isPopped) return;
    this.y -= this.speed * dt;
    this.el.style.top = (this.y - this.radius) + 'px';
    if (this.y + this.radius < 0) this.isPopped = true; // Mark for removal if off screen
  }
  pop() {
    if (this.isPopped) return;
    this.isPopped = true;
    this.popped = true;
    this.el.classList.add('pop');
    if (this.type === 'obstacle') {
      game.addScore(-20);
    } else if (this.type === 'gold') {
      game.addScore(200);
    } else {
      game.addScore(10);
    }
    // Optional: play pop sound here
    setTimeout(() => {
      if (this.el && this.el.parentNode) this.el.remove();
    }, this.type === 'gold' ? 500 : 350);
  }
  remove() {
    if (this.el && this.el.parentNode) this.el.remove();
  }
}

class Game {
  constructor() {
    this.bubbles = [];
    this.score = 0;
    this.time = 60;
    this.running = false;
    this.timerInterval = null;
    this.lastTimestamp = null;
    this.spawnCooldown = 0;
    this.obstacleCooldown = 0;
    this.difficulty = 1;
    this.confettiActive = false;
    this.maxBubbles = 10;
    this.countdownEl = document.getElementById('countdown');
    this.escapedOrdinary = 0;
    this.initUI();
    this.resizeHandler = () => this.onResize();
    window.addEventListener('resize', this.resizeHandler);
    this.goldBubbleCooldown = 0;
    this.paused = false;
    this.pauseBtn = document.getElementById('pause-btn');
    this.pauseBtn.onclick = () => this.togglePause();
  }
  initUI() {
    this.scoreEl = document.getElementById('score');
    this.timerEl = document.getElementById('timer');
    this.startBtn = document.getElementById('start-btn');
    this.restartBtn = document.getElementById('restart-btn');
    this.modal = document.getElementById('modal');
    this.modalTitle = document.getElementById('modal-title');
    this.modalBody = document.getElementById('modal-body');
    this.startBtn.onclick = () => this.startCountdown();
    this.restartBtn.onclick = () => this.restart();
  }
  showInstructions() {
    this.modalTitle.textContent = 'Bubble Popper Game 🫧';
    this.modalBody.innerHTML = `Pop as many bubbles as you can in 1 minute! ✅<br>\
Avoid the obstacle bubbles! ❌ (they subtract points)<br>\
You win when timer ends. Game over if your score drops too low.`;
    this.startBtn.style.display = 'inline-block';
    this.restartBtn.style.display = 'none';
    this.modal.classList.remove('hidden');
  }
  startCountdown() {
    this.modal.classList.add('hidden');
    let count = 3;
    this.countdownEl.textContent = count;
    this.countdownEl.classList.remove('hidden');
    const tick = () => {
      if (count > 1) {
        count--;
        this.countdownEl.textContent = count;
        setTimeout(tick, 800);
      } else {
        this.countdownEl.textContent = 'Go!';
        setTimeout(() => {
          this.countdownEl.classList.add('hidden');
          this.start();
        }, 700);
      }
    };
    setTimeout(tick, 800);
  }
  start() {
    this.score = 0;
    this.time = 60;
    this.running = true;
    this.paused = false;
    this.difficulty = 1;
    this.confettiActive = false;
    this.clearBubbles();
    this.updateScore();
    this.updateTimer();
    this.startBtn.style.display = 'none';
    this.restartBtn.style.display = 'none';
    this.modal.classList.add('hidden');
    this.lastTimestamp = null;
    this.spawnCooldown = 0;
    this.obstacleCooldown = 0;
    this.goldBubbleCooldown = 0;
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (!this.running || this.paused) return;
      this.time--;
      this.updateTimer();
      if (this.time <= 0) this.win();
    }, 1000);
    requestAnimationFrame((ts) => this.loop(ts));
  }
  restart() {
    this.showInstructions();
  }
  win() {
    this.running = false;
    clearInterval(this.timerInterval);
    this.showModal('You Won! 😊', true);
    this.launchConfetti();
  }
  lose() {
    this.running = false;
    clearInterval(this.timerInterval);
    this.showModal('Game Over 😞', false);
  }
  showModal(text, showConfetti) {
    this.modalTitle.textContent = text;
    this.modalBody.innerHTML = '';
    this.startBtn.style.display = 'none';
    this.restartBtn.style.display = 'inline-block';
    this.modal.classList.remove('hidden');
    if (showConfetti) this.launchConfetti();
  }
  updateScore() {
    this.scoreEl.textContent = this.score;
    // Glow and bonus when reaching 100
    if (this.score === 100 && !this.glowShown) {
      this.glowShown = true;
      this.scoreEl.parentElement.classList.add('glow');
      this.showScoreBonus('+20');
      setTimeout(() => {
        this.scoreEl.parentElement.classList.remove('glow');
      }, 1500);
    }
    if (this.score <= -50) this.lose();
  }
  showScoreBonus(text) {
    const bonus = document.createElement('div');
    bonus.className = 'score-bonus';
    bonus.textContent = text;
    const scoreboard = this.scoreEl.parentElement;
    scoreboard.appendChild(bonus);
    setTimeout(() => bonus.remove(), 120);
  }
  updateTimer() {
    this.timerEl.textContent = this.time;
  }
  addScore(val) {
    this.score += val;
    this.updateScore();
  }
  clearBubbles() {
    this.bubbles.forEach(b => b.remove());
    this.bubbles = [];
    this.escapedOrdinary = 0;
  }
  removeBubble(bubble) {
    // If ordinary bubble escapes (not popped), increment counter
    if (!bubble.popped && bubble.type === 'normal') {
      this.escapedOrdinary++;
      if (this.escapedOrdinary > 5) {
        this.lose();
      }
    }
    this.bubbles = this.bubbles.filter(b => b !== bubble);
  }
  spawnBubble(type = 'normal') {
    if (this.bubbles.length >= this.maxBubbles) return;
    const area = document.getElementById('game-area');
    const w = area.offsetWidth;
    const h = area.offsetHeight;
    let minR, maxR;
    if (type === 'obstacle') {
      minR = 25; maxR = 50; // 50-100px diameter
    } else if (type === 'gold') {
      minR = 30; maxR = 60; // 60-120px diameter
    } else {
      minR = 20; maxR = 60; // 40-120px diameter
    }
    const radius = Math.random() * (maxR - minR) + minR;
    const x = Math.random() * (w - 2 * radius) + radius;
    const y = h + radius;
    const speed = (Math.random() * 0.06 + 0.05) * (1 + Math.floor((60-this.time)/20)*0.2) * h / 60;
    const bubble = new Bubble(x, y, radius, speed, type);
    this.bubbles.push(bubble);
  }
  togglePause() {
    if (!this.running) return;
    this.paused = !this.paused;
    this.pauseBtn.textContent = this.paused ? '▶️' : '⏸️';
    if (!this.paused) {
      this.lastTimestamp = null;
      requestAnimationFrame((ts) => this.loop(ts));
    }
  }
  loop(ts) {
    if (!this.running) return;
    if (this.paused) return;
    if (!this.lastTimestamp) this.lastTimestamp = ts;
    const dt = (ts - this.lastTimestamp) / 16.67;
    this.lastTimestamp = ts;
    // Spawn normal bubbles (max 1 every 1.5s)
    this.spawnCooldown -= dt / 60;
    if (this.spawnCooldown <= 0) {
      this.spawnBubble('normal');
      this.spawnCooldown = 1.5;
    }
    // Occasionally spawn obstacle bubbles
    this.obstacleCooldown -= dt / 60;
    if (this.obstacleCooldown <= 0) {
      if (Math.random() < 0.18) this.spawnBubble('obstacle');
      this.obstacleCooldown = Math.random() * 2 + 2.5;
    }
    // Gold bubble every 5-10 seconds
    this.goldBubbleCooldown -= dt / 60;
    if (this.goldBubbleCooldown <= 0) {
      this.spawnBubble('gold');
      this.goldBubbleCooldown = Math.random() * 5 + 5;
    }
    // Update all bubbles
    for (let b of this.bubbles) b.update(dt);
    // Remove popped bubbles after update
    this.bubbles = this.bubbles.filter(b => {
      if (b.isPopped) {
        // If ordinary bubble escapes (not popped by user), increment counter
        if (!b.popped && b.type === 'normal') {
          this.escapedOrdinary++;
          if (this.escapedOrdinary > 5) {
            this.lose();
          }
        }
        b.remove();
        return false;
      }
      return true;
    });
    requestAnimationFrame((ts) => this.loop(ts));
  }
  onResize() {
    // Optionally, reposition bubbles or adjust sizes
  }
  launchConfetti() {
    if (this.confettiActive) return;
    this.confettiActive = true;
    // Simple confetti effect using canvas
    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.left = '0';
    canvas.style.top = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.zIndex = 200;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const confetti = [];
    for (let i = 0; i < 120; i++) {
      confetti.push({
        x: Math.random() * canvas.width,
        y: Math.random() * -canvas.height,
        r: Math.random() * 8 + 4,
        c: `hsl(${Math.random()*360},90%,60%)`,
        vx: Math.random() * 2 - 1,
        vy: Math.random() * 2 + 2,
        rot: Math.random() * 2 * Math.PI
      });
    }
    let frames = 0;
    function draw() {
      ctx.clearRect(0,0,canvas.width,canvas.height);
      for (let p of confetti) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.r/2, -p.r/2, p.r, p.r);
        ctx.restore();
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.03;
        p.rot += 0.05;
        if (p.y > canvas.height + 20) p.y = -20;
      }
      frames++;
      if (frames < 120) requestAnimationFrame(draw);
      else setTimeout(() => canvas.remove(), 1000);
    }
    draw();
  }
}

// Background bubbling animation
function spawnBgBubble() {
  const bg = document.getElementById('bubble-bg');
  const size = Math.random() * 5 + 2;
  const left = Math.random() * 100;
  const dur = Math.random() * 3 + 4;
  const el = document.createElement('div');
  el.className = 'bg-bubble';
  el.style.width = el.style.height = size + 'vw';
  el.style.left = left + 'vw';
  el.style.bottom = '-10vh';
  el.style.animationDuration = dur + 's';
  bg.appendChild(el);
  setTimeout(() => el.remove(), dur * 1000);
}
setInterval(spawnBgBubble, 500);

// Game instance
const game = new Game();
game.showInstructions();