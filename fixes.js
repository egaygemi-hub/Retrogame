/* Gameplay fixes: movement, weapons, platforms, and enemies */
(() => {
  const originalFreshGame = freshGame;
  const originalMakeLevel = makeLevel;
  const originalSetPower = setPower;
  const originalUpdate = update;
  const originalDraw = draw;
  const originalUpdateHUD = updateHUD;

  const weaponOrder = ['blaster', 'spread', 'laser', 'bomb', 'rapid'];

  function weaponForLevel(n) {
    if (n >= 1 && n <= 4) return weaponOrder[n];
    return null;
  }

  function rebuildPlatforms(n, width) {
    const platforms = [
      [0, 492, 690, 60],
      [780, 492, 680, 60],
      [1550, 492, Math.max(850, width - 1550), 60]
    ];

    const layouts = [
      [300, 390, 150],
      [520, 330, 145],
      [850, 385, 150],
      [1080, 320, 150],
      [1320, 385, 150],
      [1640, 380, 155],
      [1870, 325, 150],
      [2110, 385, 160]
    ];

    for (const [x, y, w] of layouts) {
      if (x + w < width - 100) platforms.push([x, y, w, 22]);
    }

    return platforms;
  }

  function nearestPlatform(level, x, preferGround = false) {
    const candidates = level.platforms.filter(r =>
      x + 10 >= r[0] && x - 10 <= r[0] + r[2]
    );

    if (!candidates.length) {
      return level.platforms.find(r => r[1] === 492) || level.platforms[0];
    }

    if (preferGround) {
      return candidates.find(r => r[1] === 492) || candidates[0];
    }

    return candidates.sort((a, b) => Math.abs(a[1] - 492) - Math.abs(b[1] - 492))[0];
  }

  makeLevel = function fixedMakeLevel(n) {
    const level = originalMakeLevel(n);
    level.platforms = rebuildPlatforms(n, level.width);

    level.flag.x = level.width - 90;
    level.flag.y = 492;

    level.coins = [];
    const coinSpots = [
      [180, 450], [350, 348], [550, 288], [650, 450],
      [880, 450], [1110, 278], [1350, 348], [1420, 450],
      [1670, 343], [1900, 288], [2140, 348], [2320, 450]
    ];
    for (const [x, y] of coinSpots) {
      if (x < level.width - 80) level.coins.push([x, y]);
    }

    level.gems = [];
    const gemSpots = [[610, 365], [1190, 295], [1960, 300]];
    for (const [x, y] of gemSpots) {
      if (x < level.width - 120) level.gems.push([x, y]);
    }

    level.powerups = [];
    const unlock = weaponForLevel(n);
    if (unlock) {
      const pickupX = [550, 1080, 1640, 2140][n - 1];
      const platform = nearestPlatform(level, pickupX);
      level.powerups.push({
        x: pickupX,
        y: platform[1] - 30,
        type: unlock
      });
    }

    level.powerups.push({
      x: Math.min(1750 + n * 20, level.width - 300),
      y: 462,
      type: n % 2 ? 'shield' : 'heart'
    });

    for (const e of level.enemies) {
      if (e.type === 'flyer') continue;

      const platform = nearestPlatform(level, e.x, e.type !== 'boss');
      const left = platform[0] + 20;
      const right = platform[0] + platform[2] - e.w - 20;

      e.x = Math.max(left, Math.min(right, e.x));
      e.y = platform[1] - e.h;
      e.min = left;
      e.max = right;
      if (!e.vx) e.vx = enemyDefs[e.type].speed;
    }

    for (const e of level.enemies) {
      if (e.type === 'flyer') {
        e.baseY = 235;
        e.y = e.baseY;
        e.min = Math.max(100, e.x - 120);
        e.max = Math.min(level.width - 100, e.x + 180);
      }
    }

    return level;
  };

  freshGame = function fixedFreshGame(n = 0) {
    const g = originalFreshGame(n);
    if (!Array.isArray(g.profile.unlockedWeapons)) {
      g.profile.unlockedWeapons = ['blaster'];
    }
    if (!g.profile.unlockedWeapons.includes('blaster')) {
      g.profile.unlockedWeapons.unshift('blaster');
    }
    g.grounded = true;
    g.jumpUsed = false;
    return g;
  };

  setPower = function fixedSetPower(type) {
    if (game && weaponOrder.includes(type)) {
      if (!Array.isArray(game.profile.unlockedWeapons)) {
        game.profile.unlockedWeapons = ['blaster'];
      }
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

  cycleWeapon = function fixedCycleWeapon() {
    if (!game) return;

    const unlocked = (game.profile.unlockedWeapons || ['blaster'])
      .filter(w => weaponOrder.includes(w));

    const current = unlocked.indexOf(game.profile.weapon);
    const next = (current + 1) % unlocked.length;
    game.profile.weapon = unlocked[next];
    updateHUD();
    beep(620, 0.05);
  };

  update = function fixedUpdate(dt) {
    if (!game || !game.player || game.state !== 'playing') {
      originalUpdate(dt);
      return;
    }

    const p = game.player;
    const wasGrounded = game.grounded === true;

    if (input.jump && !wasGrounded) {
      input.jump = false;
    } else if (input.jump && wasGrounded) {
      game.grounded = false;
      p.jumpLock = false;
    }

    originalUpdate(dt);

    const bottom = p.y + p.h;
    let grounded = false;

    for (const r of game.lvl.platforms) {
      const horizontal = p.x + p.w > r[0] && p.x < r[0] + r[2];
      const standing = Math.abs(bottom - r[1]) <= 2.5;
      if (horizontal && standing && Math.abs(p.vy) < 0.5) {
        grounded = true;
        p.y = r[1] - p.h;
        p.vy = 0;
        break;
      }
    }

    game.grounded = grounded;
  };

  draw = function fixedDraw() {
    if (game && game.lvl) {
      for (const e of game.lvl.enemies) {
        if (e.dead || e.type === 'flyer') continue;
        if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) {
          e.dead = true;
          continue;
        }
        e.x = Math.max(e.min, Math.min(e.max, e.x));
      }
    }
    originalDraw();
  };

  updateHUD = function fixedHUD() {
    originalUpdateHUD();
    if (game && ui.weapon) {
      ui.weapon.textContent = weaponName[game.profile.weapon] || 'BLASTER';
    }
  };
})();
