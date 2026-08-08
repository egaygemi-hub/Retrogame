const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const $ = id => document.getElementById(id);

const ui = {
  health: $('healthFill'),
  level: $('levelText'),
  level2: $('levelText2'),
  xp: $('xpText'),
  coins: $('coinText'),
  gems: $('gemText'),
  weapon: $('weaponText'),
  lives: $('livesText'),
  power: $('powerText'),
  overlay: $('overlay'),
  title: $('overlayTitle'),
  text: $('overlayText'),
  quests: $('questList'),
  xpFill: $('xpFill')
};

const W = canvas.width;
const H = canvas.height;
const GR = 0.72;

const input = {
  left: false,
  right: false,
  jump: false,
  fire: false,
  dash: false,
  up: false,
  down: false
};

const weapons = ['blaster', 'spread', 'laser', 'bomb', 'rapid'];

const weaponName = {
  blaster: 'BLASTER',
  spread: 'SPREAD',
  laser: 'LASER',
  bomb: 'BOMB',
  rapid: 'RAPID'
};

const enemyDefs = {
  walker: {
    hp: 1,
    speed: 1.1,
    color: '#7cbd62',
    score: 50,
    xp: 12
  },
  flyer: {
    hp: 2,
    speed: 1.4,
    color: '#9d75d6',
    score: 80,
    xp: 18
  },
  shooter: {
    hp: 3,
    speed: 0.7,
    color: '#e0a33b',
    score: 110,
    xp: 25
  },
  tank: {
    hp: 6,
    speed: 0.45,
    color: '#6e8399',
    score: 180,
    xp: 40
  },
  charger: {
    hp: 3,
    speed: 2,
    color: '#db5b5b',
    score: 140,
    xp: 30
  },
  boss: {
    hp: 25,
    speed: 0.8,
    color: '#cf4c7a',
    score: 1000,
    xp: 180
  }
};

const palettes = [
  ['#7ba46d', '#a9c77b'],
  ['#5d8cc7', '#a8d9ed'],
  ['#7866a8', '#e5a06b'],
  ['#3e7c89', '#7ad1bd'],
  ['#8f4b37', '#e7a14a'],
  ['#435b93', '#a9d5ff'],
  ['#34374d', '#9a91b8'],
  ['#7b4c88', '#e8a1d3'],
  ['#3e6e57', '#b7d46e'],
  ['#8b6a35', '#e7ca65'],
  ['#3e4d70', '#8bc4e8'],
  ['#5b3038', '#d96969']
];

const levelNames = [
  'Meadow Gate',
  'Cloud Climb',
  'Moonlit Castle',
  'Crystal Caves',
  'Volcano Run',
  'Sky Fortress',
  'Shadow Factory',
  'Mushroom Marsh',
  'Frost Kingdom',
  'Golden Ruins',
  'Star Temple',
  'Demon Citadel'
];

const quests = [
  {
    id: 'coins',
    label: 'Coin Collector',
    target: 8,
    reward: 120
  },
  {
    id: 'kills',
    label: 'Bug Hunter',
    target: 5,
    reward: 150
  },
  {
    id: 'gems',
    label: 'Gem Seeker',
    target: 2,
    reward: 180
  },
  {
    id: 'power',
    label: 'Power Up!',
    target: 1,
    reward: 100
  },
  {
    id: 'finish',
    label: 'Reach the Flag',
    target: 1,
    reward: 200
  }
];

let game = null;
let raf = 0;
let last = performance.now();
let audioCtx = null;


/* =========================
   AUDIO
========================= */

function beep(freq = 440, duration = 0.05) {
  try {
    if (!audioCtx) {
      audioCtx = new (
        window.AudioContext ||
        window.webkitAudioContext
      )();
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.frequency.value = freq;
    osc.type = 'square';
    gain.gain.value = 0.04;

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    // Audio is optional.
  }
}


/* =========================
   LEVEL CREATION
========================= */

function makeLevel(n) {
  const width = 2500 + n * 170;

  const platforms = [];

  platforms.push(
    [0, 492, 720, 60],
    [850, 492, 560, 60],
    [1540, 492, 960 + n * 50, 60]
  );

  for (let i = 0; i < 8 + n % 4; i++) {
    const x = 260 + i * 280 + (n % 2) * 40;
    const y = 360 - (i % 3) * 55;

    platforms.push([
      x,
      y,
      150 + (i % 2) * 45,
      22
    ]);
  }

  const coins = [];
  const gems = [];
  const powerups = [];
  const enemies = [];

  for (let i = 0; i < 10 + n % 4; i++) {
    const x = 300 + i * 205;

    coins.push([
      x,
      300 - (i % 3) * 45
    ]);
  }

  for (let i = 0; i < 3 + (n % 3); i++) {
    gems.push([
      620 + i * 620,
      440
    ]);
  }

  powerups.push({
    x: 620,
    y: 270,
    type: weapons[n % weapons.length]
  });

  powerups.push({
    x: 1600 + n * 20,
    y: 270,
    type: n % 2 ? 'shield' : 'heart'
  });

  const types = [
    'walker',
    'walker',
    'flyer',
    'shooter',
    'charger',
    'tank'
  ];

  for (let i = 0; i < 5 + n % 4; i++) {
    const type = types[(i + n) % types.length];
    const def = enemyDefs[type];
    const x = 500 + i * 370;

    enemies.push({
      x,
      y: type === 'flyer' ? 250 : 456,
      w: 38,
      h: 38,
      hp: def.hp,
      maxHp: def.hp,
      vx: def.speed,
      min: x - 100,
      max: x + 180,
      type,
      score: def.score,
      xp: def.xp
    });
  }

  if (n === 11) {
    const def = enemyDefs.boss;

    enemies.push({
      x: width - 420,
      y: 390,
      w: 72,
      h: 72,
      hp: def.hp,
      maxHp: def.hp,
      vx: def.speed,
      min: width - 520,
      max: width - 180,
      type: 'boss',
      score: def.score,
      xp: def.xp
    });
  }

  return {
    n,
    name: levelNames[n],
    width,
    sky: palettes[n],
    platforms,
    coins,
    gems,
    powerups,
    enemies,
    flag: {
      x: width - 90,
      y: 420
    }
  };
}


/* =========================
   GAME STATE
========================= */

function freshGame(n = 0) {
  const oldProfile =
    game && game.profile
      ? game.profile
      : null;

  const profile = oldProfile || {
    level: 1,
    xp: 0,
    coins: 0,
    gems: 0,
    totalKills: 0,
    weapon: 'blaster',
    maxHp: 5,
    hp: 5,
    damage: 1,
    speed: 3.6
  };

  const lvl = makeLevel(n);

  return {
    n,
    lvl,
    profile,
    cam: 0,
    state: 'playing',
    score: game && Number.isFinite(game.score)
      ? game.score
      : 0,

    bullets: [],
    enemyBullets: [],
    particles: [],

    power: null,
    powerTimer: 0,

    inv: 0,
    dash: 0,

    spawn: {
      x: 80,
      y: 400
    },

    player: {
      x: 80,
      y: 400,
      w: 38,
      h: 42,
      vx: 0,
      vy: 0,
      jumpLock: false,
      fireLock: false
    },

    quest: quests.map(q => ({
      ...q,
      progress: 0,
      done: false
    })),

    time: 0
  };
}


/* =========================
   XP
========================= */

function xpNeed() {
  return 100 + (game.profile.level - 1) * 70;
}

function addXP(value) {
  if (!game || !Number.isFinite(value)) return;

  const p = game.profile;

  p.xp += value;

  while (p.xp >= xpNeed()) {
    p.xp -= xpNeed();

    p.level++;
    p.maxHp++;
    p.hp = p.maxHp;
    p.damage += 0.35;
    p.speed += 0.18;

    showOverlay(
      'LEVEL UP!',
      `Level ${p.level}! HP, damage and movement speed increased.`,
      'CONTINUE'
    );

    beep(760, 0.16);
  }
}


/* =========================
   POWERUPS
========================= */

function setPower(type) {
  if (!game) return;

  game.power = type;

  game.powerTimer =
    type === 'heart'
      ? 0
      : 600;

  if (type === 'heart') {
    game.profile.hp = Math.min(
      game.profile.maxHp,
      game.profile.hp + 2
    );

    game.power = null;
  } else if (weapons.includes(type)) {
    game.profile.weapon = type;
  }
}


/* =========================
   QUESTS
========================= */

function updateQuest(id, amount = 1) {
  if (!game || !game.quest) return;

  const q = game.quest.find(q => q.id === id);

  if (!q || q.done) return;

  q.progress = Math.min(
    q.target,
    q.progress + amount
  );

  if (q.progress >= q.target) {
    q.done = true;

    game.score += q.reward;

    addXP(q.reward / 2);

    beep(900, 0.1);
  }
}


/* =========================
   OVERLAY
========================= */

function showOverlay(
  title,
  text,
  button = 'START GAME'
) {
  ui.title.textContent = title;
  ui.text.textContent = text;

  const btn = $('startBtn');

  if (btn) {
    btn.textContent = button;
  }

  ui.overlay.classList.remove('hidden');
}

function hideOverlay() {
  ui.overlay.classList.add('hidden');
}


/* =========================
   START / RESTART
========================= */

function start(n = 0) {
  game = freshGame(n);

  hideOverlay();

  last = performance.now();

  if (!raf) {
    raf = requestAnimationFrame(loop);
  }

  updateHUD();
}

function restart() {
  start(
    game && game.n != null
      ? game.n
      : 0
  );
}


/* =========================
   LEVEL COMPLETE
========================= */

function completeLevel() {
  if (!game || game.state !== 'playing') {
    return;
  }

  for (const q of game.quest) {
    if (q.id === 'finish' && !q.done) {
      updateQuest('finish');
    }
  }

  addXP(120);

  if (game.n < 11) {
    game.state = 'between';

    showOverlay(
      `LEVEL ${game.n + 1} CLEAR!`,
      `Next: ${levelNames[game.n + 1]}. Quests and XP carry over.`,
      'NEXT LEVEL'
    );
  } else {
    game.state = 'win';

    showOverlay(
      'YOU WIN!',
      `All 12 levels cleared! Final level: ${game.profile.level}.`,
      'PLAY AGAIN'
    );
  }
}


/* =========================
   COLLISION
========================= */

function rectHit(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}


/* =========================
   BULLETS
========================= */

function spawnBullet() {
  if (!game || !game.player) return;

  const w = game.profile.weapon;

  const x =
    game.player.x +
    game.player.w;

  const y =
    game.player.y + 14;

  let shots =
    w === 'spread'
      ? [
          { dx: 7, dy: -2 },
          { dx: 7, dy: 0 },
          { dx: 7, dy: 2 }
        ]
      : [
          { dx: 9, dy: 0 }
        ];

  if (w === 'laser') {
    shots = [
      { dx: 15, dy: 0 }
    ];
  }

  if (w === 'bomb') {
    shots = [
      {
        dx: 6,
        dy: -1,
        bomb: true
      }
    ];
  }

  for (const s of shots) {
    game.bullets.push({
      x,
      y,
      vx: s.dx,
      vy: s.dy,
      w: w === 'laser' ? 32 : 12,
      h: 6,
      damage:
        w === 'laser'
          ? 3
          : game.profile.damage,
      bomb: s.bomb,
      life: 70
    });
  }

  beep(
    w === 'laser'
      ? 880
      : 520,
    0.035
  );
}


/* =========================
   PLAYER DAMAGE
========================= */

function hurt(d = 1) {
  if (!game) return;

  if (
    game.inv > 0 ||
    game.power === 'shield'
  ) {
    return;
  }

  game.profile.hp -= d;
  game.inv = 70;

  beep(150, 0.12);

  if (game.profile.hp <= 0) {
    game.profile.hp =
      game.profile.maxHp;

    game.score = Math.max(
      0,
      game.score - 100
    );

    game.player.x =
      game.spawn.x;

    game.player.y =
      game.spawn.y;

    game.player.vx = 0;
    game.player.vy = 0;

    game.cam = 0;
  }
}


/* =========================
   ENEMY DEATH
========================= */

function killEnemy(e) {
  if (!game || !e || e.dead) return;

  e.dead = true;

  game.score +=
    Number.isFinite(e.score)
      ? e.score
      : 0;

  game.profile.totalKills++;

  addXP(
    Number.isFinite(e.xp)
      ? e.xp
      : 0
  );

  updateQuest('kills');

  for (let i = 0; i < 8; i++) {
    game.particles.push({
      x: e.x + e.w / 2,
      y: e.y + e.h / 2,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.8) * 4,
      life: 30
    });
  }
}


/* =========================
   GAME UPDATE
========================= */

function update(dt) {
  if (
    !game ||
    !game.player ||
    game.state !== 'playing'
  ) {
    return;
  }

  game.time += dt;

  const p = game.player;
  const L = game.lvl;

  /* Movement */

  if (input.left) {
    p.vx -= 0.35;
  }

  if (input.right) {
    p.vx += 0.35;
  }

  p.vx *= 0.86;

  p.vx = Math.max(
    -game.profile.speed,
    Math.min(
      game.profile.speed,
      p.vx
    )
  );

  /* Jump */

  if (
    input.jump &&
    !p.jumpLock
  ) {
    p.vy = -11;
    p.jumpLock = true;
  }

  if (!input.jump) {
    p.jumpLock = false;
  }

  /* Dash */

  if (
    input.dash &&
    game.dash <= 0
  ) {
    p.vx =
      (p.vx < 0 ? -1 : 1) * 12;

    game.dash = 55;
    game.inv = 20;
  }

  game.dash = Math.max(
    0,
    game.dash - dt
  );

  /* Gravity */

  p.vy += GR;

  p.x += p.vx;
  p.y += p.vy;

  p.x = Math.max(
    0,
    Math.min(
      L.width - p.w,
      p.x
    )
  );

  /* Platforms */

  for (const r of L.platforms) {
    if (
      p.x + p.w > r[0] &&
      p.x < r[0] + r[2] &&
      p.y + p.h <= r[1] + 12 &&
      p.y + p.h + p.vy >= r[1]
    ) {
      p.y = r[1] - p.h;
      p.vy = 0;
    }
  }

  /* Falling */

  if (p.y > 650) {
    p.x = game.spawn.x;
    p.y = game.spawn.y;
    p.vy = 0;
  }

  /* Shooting */

  if (
    input.fire &&
    !p.fireLock
  ) {
    spawnBullet();
    p.fireLock = true;
  }

  if (!input.fire) {
    p.fireLock = false;
  }

  if (
    game.profile.weapon === 'rapid' &&
    input.fire &&
    Math.random() < 0.25
  ) {
    spawnBullet();
  }

  /* Player bullets */

  for (const b of game.bullets) {
    b.x += b.vx;
    b.y += b.vy;
    b.life--;

    for (const e of L.enemies) {
      if (
        !e.dead &&
        rectHit(b, e)
      ) {
        e.hp -= b.damage;
        b.life = 0;

        if (e.hp <= 0) {
          killEnemy(e);
        }

        break;
      }
    }
  }

  game.bullets =
    game.bullets.filter(
      b =>
        b.life > 0 &&
        b.x < L.width + 100
    );

  /* Enemies */

  for (const e of L.enemies) {
    if (e.dead) continue;

    e.x += e.vx || 0;

    if (
      e.x < e.min ||
      e.x > e.max
    ) {
      e.vx =
        -(e.vx ||
          enemyDefs[e.type].speed);
    }

    if (e.type === 'flyer') {
      e.y =
        260 +
        Math.sin(
          game.time * 0.06 + e.x
        ) * 45;
    }

    if (
      e.type === 'charger' &&
      Math.abs(p.x - e.x) < 240
    ) {
      e.vx =
        p.x < e.x
          ? -2
          : 2;
    }

    if (
      e.type === 'shooter' &&
      Math.random() < 0.012
    ) {
      game.enemyBullets.push({
        x: e.x,
        y: e.y,
        vx: p.x < e.x ? -4 : 4,
        vy: -0.3,
        w: 10,
        h: 5
      });
    }

    if (
      e.type === 'boss' &&
      Math.random() < 0.035
    ) {
      for (let a = -1; a <= 1; a++) {
        game.enemyBullets.push({
          x: e.x,
          y: e.y,
          vx: a * 3,
          vy: -2,
          w: 12,
          h: 7
        });
      }
    }

    if (rectHit(p, e)) {
      hurt(
        e.type === 'boss'
          ? 2
          : 1
      );
    }
  }

  /* Enemy bullets */

  for (const b of game.enemyBullets) {
    b.x += b.vx;
    b.y += b.vy;

    if (rectHit(b, p)) {
      b.x = -999;
      hurt(1);
    }
  }

  game.enemyBullets =
    game.enemyBullets.filter(
      b => b.x > -500
    );

  /* Coins */

  for (const c of L.coins) {
    if (
      !c.got &&
      Math.hypot(
        p.x - c[0],
        p.y - c[1]
      ) < 35
    ) {
      c.got = true;

      game.profile.coins++;
      game.score += 10;

      addXP(5);
      updateQuest('coins');

      beep(700, 0.03);
    }
  }

  /* Gems */

  for (const g of L.gems) {
    if (
      !g.got &&
      Math.hypot(
        p.x - g[0],
        p.y - g[1]
      ) < 35
    ) {
      g.got = true;

      game.profile.gems++;
      game.score += 50;

      addXP(20);
      updateQuest('gems');

      beep(980, 0.05);
    }
  }

  /* Powerups */

  for (const pu of L.powerups) {
    if (
      !pu.got &&
      Math.hypot(
        p.x - pu.x,
        p.y - pu.y
      ) < 40
    ) {
      pu.got = true;

      setPower(pu.type);
      updateQuest('power');

      beep(820, 0.08);
    }
  }

  if (game.powerTimer > 0) {
    game.powerTimer -= dt;

    if (game.powerTimer <= 0) {
      game.power = null;
    }
  }

  /* Flag */

  if (
    Math.abs(
      p.x - L.flag.x
    ) < 55
  ) {
    completeLevel();
    return;
  }

  /* Camera */

  game.cam = Math.max(
    0,
    Math.min(
      L.width - W,
      p.x - W * 0.38
    )
  );

  game.inv = Math.max(
    0,
    game.inv - dt
  );

  updateHUD();
}


/* =========================
   DRAW
========================= */

function draw() {
  ctx.clearRect(
    0,
    0,
    W,
    H
  );

  if (!game) return;

  const L = game.lvl;
  const p = game.player;

  const gradient =
    ctx.createLinearGradient(
      0,
      0,
      0,
      H
    );

  gradient.addColorStop(
    0,
    L.sky[0]
  );

  gradient.addColorStop(
    1,
    L.sky[1]
  );

  ctx.fillStyle = gradient;
  ctx.fillRect(
    0,
    0,
    W,
    H
  );

  ctx.save();

  ctx.translate(
    -game.cam,
    0
  );

  /* Background */

  ctx.fillStyle = '#ffffff22';

  for (
    let x = 100;
    x < L.width;
    x += 260
  ) {
    ctx.fillRect(
      x,
      100 + (x % 130),
      90,
      3
    );
  }

  /* Platforms */

  for (const r of L.platforms) {
    ctx.fillStyle =
      '#28352c';

    ctx.fillRect(
      r[0],
      r[1],
      r[2],
      r[3]
    );

    ctx.fillStyle =
      '#91c05e';

    ctx.fillRect(
      r[0],
      r[1],
      r[2],
      6
    );
  }

  /* Coins */

  for (const c of L.coins) {
    if (c.got) continue;

    ctx.fillStyle =
      '#f5d44e';

    ctx.beginPath();

    ctx.arc(
      c[0],
      c[1],
      10,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.fillStyle =
      '#fff3a0';

    ctx.fillRect(
      c[0] - 2,
      c[1] - 6,
      4,
      12
    );
  }

  /* Gems */

  for (const g of L.gems) {
    if (g.got) continue;

    ctx.fillStyle =
      '#72e8ff';

    ctx.beginPath();

    ctx.moveTo(
      g[0],
      g[1] - 12
    );

    ctx.lineTo(
      g[0] + 9,
      g[1]
    );

    ctx.lineTo(
      g[0],
      g[1] + 12
    );

    ctx.lineTo(
      g[0] - 9,
      g[1]
    );

    ctx.fill();
  }

  /* Powerups */

  for (const pu of L.powerups) {
    if (pu.got) continue;

    ctx.fillStyle =
      pu.type === 'shield'
        ? '#65c7ff'
        : pu.type === 'heart'
        ? '#ff6a76'
        : '#f2cf51';

    ctx.fillRect(
      pu.x - 13,
      pu.y - 13,
      26,
      26
    );

    ctx.fillStyle =
      '#18202a';

    ctx.font =
      'bold 15px sans-serif';

    ctx.textAlign = 'center';

    ctx.fillText(
      pu.type === 'heart'
        ? '♥'
        : pu.type === 'shield'
        ? '◆'
        : '★',
      pu.x,
      pu.y + 5
    );
  }

  /* Enemies */

  for (const e of L.enemies) {
    if (e.dead) continue;

    ctx.fillStyle =
      enemyDefs[e.type].color;

    ctx.fillRect(
      e.x,
      e.y,
      e.w,
      e.h
    );

    ctx.fillStyle =
      '#111';

    ctx.fillRect(
      e.x + 7,
      e.y + 8,
      6,
      6
    );

    ctx.fillRect(
      e.x + 25,
      e.y + 8,
      6,
      6
    );

    if (e.type === 'boss') {
      ctx.fillStyle =
        '#ffdf64';

      ctx.fillRect(
        e.x,
        e.y - 12,
        Math.max(
          0,
          (e.hp / e.maxHp) * e.w
        ),
        5
      );
    }
  }

  /* Flag */

  ctx.fillStyle =
    '#e9e2a0';

  ctx.fillRect(
    L.flag.x,
    L.flag.y - 70,
    5,
    70
  );

  ctx.fillStyle =
    '#ef5a67';

  ctx.beginPath();

  ctx.moveTo(
    L.flag.x + 5,
    L.flag.y - 70
  );

  ctx.lineTo(
    L.flag.x + 48,
    L.flag.y - 55
  );

  ctx.lineTo(
    L.flag.x + 5,
    L.flag.y - 40
  );

  ctx.fill();

  /* Player bullets */

  for (const b of game.bullets) {
    ctx.fillStyle =
      b.bomb
        ? '#ff9d4a'
        : game.profile.weapon === 'laser'
        ? '#9dfcff'
        : '#f6e35f';

    ctx.fillRect(
      b.x,
      b.y,
      b.w,
      b.h
    );
  }

  /* Enemy bullets */

  for (const b of game.enemyBullets) {
    ctx.fillStyle =
      '#ff6b75';

    ctx.fillRect(
      b.x,
      b.y,
      b.w,
      b.h
    );
  }

  /* Player */

  ctx.globalAlpha =
    game.inv % 8 < 4
      ? 0.45
      : 1;

  ctx.fillStyle =
    '#e74f58';

  ctx.fillRect(
    p.x,
    p.y,
    p.w,
    p.h
  );

  ctx.fillStyle =
    '#f7d36b';

  ctx.fillRect(
    p.x + 8,
    p.y + 8,
    18,
    12
  );

  ctx.globalAlpha = 1;

  
