/* =========================================================
   MUSHROOM MEADOW - GAMEPLAY POLISH PATCH
   Keeps the original game engine, but fixes movement,
   double-jump, terrain, flag placement, weapons, enemies,
   and character rendering.
========================================================= */
(() => {
  const originalMakeLevel = makeLevel;
  const originalFreshGame = freshGame;
  const originalUpdate = update;
  const originalDraw = draw;
  const originalSetPower = setPower;

  const weaponUnlocks = ['spread', 'laser', 'bomb', 'rapid'];

  /* -------------------------
     LEVEL / TERRAIN
  ------------------------- */
  makeLevel = function (n) {
    const L = originalMakeLevel(n);

    // Use a continuous ground path with intentional gaps.
    // Every raised platform is reachable with the normal jump.
    const groundEnd = L.width;
    L.platforms = [
      [0, 492, 760, 60],
      [850, 492, 560, 60],
      [1500, 492, groundEnd - 1500, 60]
    ];

    const terrain = [
      [230, 410, 150, 22],
      [470, 350, 155, 22],
      [690, 405, 125, 22],
      [900, 390, 150, 22],
      [1130, 325, 155, 22],
      [1330, 400, 120, 22],
      [1580, 405, 150, 22],
      [1810, 345, 155, 22],
      [2050, 405, 140, 22],
      [2280, 330, 160, 22],
      [2520, 395, 140, 22],
      [2760, 335, 155, 22]
    ];

    for (const platform of terrain) {
      if (platform[0] + platform[2] < L.width - 60) {
        L.platforms.push(platform);
      }
    }

    // Put the flag ON the ground, not 72px above it.
    L.flag.x = L.width - 100;
    L.flag.y = 492;

    // Weapon pickups: one pickup unlocks ONE weapon only.
    // No pickup gives access to every weapon.
    L.powerups = L.powerups.filter(p =>
      p.type === 'heart' || p.type === 'shield'
    );

    const unlock = weaponUnlocks[n];
    if (unlock) {
      const positions = [
        [520, 320],
        [1120, 295],
        [1810, 315],
        [2280, 300]
      ];
      const spot = positions[n];
      if (spot && spot[0] < L.width - 80) {
        L.powerups.unshift({
          x: spot[0],
          y: spot[1],
          type: unlock,
          got: false
        });
      }
    }

    // Put ground enemies on actual ground/raised platforms.
    let groundIndex = 0;
    for (const e of L.enemies) {
      e.phase = groundIndex * 1.7;

      if (e.type === 'flyer') {
        e.baseY = 220 + (groundIndex % 2) * 35;
        e.y = e.baseY;
        e.vy = 0;
      } else {
        const platform = L.platforms[1 + (groundIndex % Math.max(1, L.platforms.length - 1))];
        if (platform) {
          e.x = Math.max(platform[0] + 20, Math.min(e.x, platform[0] + platform[2] - e.w - 20));
          e.min = platform[0] + 15;
          e.max = platform[0] + platform[2] - e.w - 15;
          e.y = platform[1] - e.h;
        }
      }
      groundIndex++;
    }

    return L;
  };

  /* -------------------------
     PLAYER / WEAPON STATE
  ------------------------- */
  freshGame = function (n = 0) {
    const g = originalFreshGame(n);

    // Faster, more responsive movement.
    g.profile.speed = 6.2;

    // Only the basic weapon is initially available.
    g.profile.unlockedWeapons = ['blaster'];
    g.jumpCount = 0;
    g.jumpHeld = false;

    return g;
  };

  setPower = function (type) {
    if (!game) return;

    if (weapons.includes(type)) {
      if (!Array.isArray(game.profile.unlockedWeapons)) {
        game.profile.unlockedWeapons = ['blaster'];
      }

      // Unlock ONLY the weapon that was picked up.
      if (!game.profile.unlockedWeapons.includes(type)) {
        game.profile.unlockedWeapons.push(type);
      }

      game.profile.weapon = type;
      game.power = type;
      game.powerTimer = 600;
      return;
    }

    originalSetPower(type);
  };

  cycleWeapon = function () {
    if (!game) return;

    const unlocked = Array.isArray(game.profile.unlockedWeapons)
      ? game.profile.unlockedWeapons
      : ['blaster'];

    const current = unlocked.indexOf(game.profile.weapon);
    const next = (current + 1) % unlocked.length;

    game.profile.weapon = unlocked[next];
    updateHUD();
    beep(620, 0.05);
  };

  /* -------------------------
     MOVEMENT + DOUBLE JUMP
  ------------------------- */
  update = function (dt) {
    if (!game || !game.player || game.state !== 'playing') {
      return originalUpdate(dt);
    }

    const p = game.player;
    const L = game.lvl;
    const pressed = input.jump && !game.jumpHeld;
    game.jumpHeld = input.jump;

    // Determine whether the player is standing on a platform BEFORE update.
    let grounded = false;
    const bottom = p.y + p.h;

    for (const r of L.platforms) {
      if (
        p.x + p.w > r[0] &&
        p.x < r[0] + r[2] &&
        Math.abs(bottom - r[1]) <= 4 &&
        p.vy >= 0
      ) {
        grounded = true;
        break;
      }
    }

    if (grounded) {
      game.jumpCount = 0;
    }

    // Handle exactly two jumps. The original update is prevented from
    // processing the same input so holding the button cannot fly.
    if (pressed && (grounded || game.jumpCount < 2)) {
      p.vy = -11;
      game.jumpCount++;
      input.jump = false;
    }

    // Make horizontal movement immediately responsive instead of sluggish.
    if (input.left) p.vx = -7.2;
    if (input.right) p.vx = 7.2;

    originalUpdate(dt);

    // Restore input state after the original update.
    input.jump = game.jumpHeld;

    // Snap the player cleanly onto platforms after movement.
    const newBottom = p.y + p.h;
    if (p.vy >= 0) {
      for (const r of L.platforms) {
        if (
          p.x + p.w > r[0] &&
          p.x < r[0] + r[2] &&
          newBottom >= r[1] &&
          newBottom <= r[1] + 14
        ) {
          p.y = r[1] - p.h;
          p.vy = 0;
          game.jumpCount = 0;
          break;
        }
      }
    }

    // Stabilize all enemies after the original update.
    for (const e of L.enemies) {
      if (e.dead) continue;

      if (e.type === 'flyer') {
        if (!Number.isFinite(e.baseY)) e.baseY = 230;
        if (!Number.isFinite(e.phase)) e.phase = 0;

        e.y = e.baseY + Math.sin(game.time * 0.035 + e.phase) * 28;
        e.y = Math.max(120, Math.min(330, e.y));
      } else {
        if (Number.isFinite(e.min) && Number.isFinite(e.max)) {
          e.x = Math.max(e.min, Math.min(e.max, e.x));
        }
      }
    }
  };

  /* -------------------------
     BETTER CHARACTER ART
  ------------------------- */
  draw = function () {
    originalDraw();

    if (!game || !game.lvl) return;

    const L = game.lvl;
    const p = game.player;

    ctx.save();
    ctx.translate(-game.cam, 0);

    // Player: simple readable retro adventurer instead of a plain rectangle.
    ctx.globalAlpha = game.inv % 8 < 4 ? 0.45 : 1;

    // legs
    ctx.fillStyle = '#26313b';
    ctx.fillRect(p.x + 7, p.y + 30, 9, 12);
    ctx.fillRect(p.x + 23, p.y + 30, 9, 12);

    // body
    ctx.fillStyle = '#3f78bd';
    ctx.fillRect(p.x + 5, p.y + 17, 28, 17);

    // head
    ctx.fillStyle = '#f2bd88';
    ctx.fillRect(p.x + 8, p.y + 7, 22, 15);

    // hair/cap
    ctx.fillStyle = '#d84d55';
    ctx.fillRect(p.x + 6, p.y + 4, 26, 7);
    ctx.fillRect(p.x + 13, p.y + 1, 12, 5);

    // eyes
    ctx.fillStyle = '#111';
    ctx.fillRect(p.x + 13, p.y + 12, 3, 3);
    ctx.fillRect(p.x + 23, p.y + 12, 3, 3);

    ctx.globalAlpha = 1;

    // Enemy sprites: distinct silhouettes by type.
    for (const e of L.enemies) {
      if (e.dead) continue;

      const c = enemyDefs[e.type].color;
      ctx.fillStyle = c;

      if (e.type === 'flyer') {
        ctx.beginPath();
        ctx.arc(e.x + e.w / 2, e.y + e.h / 2, e.w / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#efe9ff';
        ctx.fillRect(e.x - 7, e.y + 10, 10, 7);
        ctx.fillRect(e.x + e.w - 3, e.y + 10, 10, 7);
      } else if (e.type === 'tank' || e.type === 'boss') {
        ctx.fillRect(e.x, e.y + 7, e.w, e.h - 7);
        ctx.fillStyle = '#aeb9c5';
        ctx.fillRect(e.x + 6, e.y, e.w - 12, 9);
      } else if (e.type === 'charger') {
        ctx.beginPath();
        ctx.moveTo(e.x + e.w / 2, e.y);
        ctx.lineTo(e.x + e.w, e.y + e.h);
        ctx.lineTo(e.x, e.y + e.h);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(e.x + 3, e.y + 5, e.w - 6, e.h - 5);
      }

      ctx.fillStyle = '#111';
      ctx.fillRect(e.x + 8, e.y + 12, 5, 5);
      ctx.fillRect(e.x + e.w - 13, e.y + 12, 5, 5);
    }

    ctx.restore();
  };
})();
