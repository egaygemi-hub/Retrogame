/* Gameplay balance fix: true double-jump + stable enemy movement */
(() => {
  const originalUpdate = update;
  let jumpCount = 0;
  let previousJump = false;

  update = function gameplayUpdate(dt) {
    if (!game || !game.player || game.state !== 'playing') {
      originalUpdate(dt);
      previousJump = input.jump;
      return;
    }

    const p = game.player;
    const wasFalling = p.vy > 0;
    const oldBottom = p.y + p.h;

    /* Allow exactly two jump presses per airtime. */
    const jumpPressed = input.jump && !previousJump;

    if (jumpPressed) {
      if (jumpCount >= 2) {
        input.jump = false;
      } else {
        jumpCount++;
      }
    }

    originalUpdate(dt);

    /* Detect landing and reset the two-jump counter. */
    let landed = false;
    for (const r of game.lvl.platforms) {
      const horizontal =
        p.x + p.w > r[0] &&
        p.x < r[0] + r[2];
      const bottom = p.y + p.h;

      if (
        horizontal &&
        bottom >= r[1] - 1 &&
        bottom <= r[1] + 4 &&
        p.vy === 0
      ) {
        landed = true;
        p.y = r[1] - p.h;
        break;
      }
    }

    if (landed || (wasFalling && p.vy === 0 && oldBottom <= p.y + p.h + 5)) {
      jumpCount = 0;
    }

    /* Prevent flyer animation from changing phase with its x-position.
       The old formula used e.x inside sin(), which made the vertical motion
       change whenever the enemy moved horizontally and could look jittery. */
    for (const e of game.lvl.enemies) {
      if (e.dead || e.type !== 'flyer') continue;

      if (!Number.isFinite(e.phase)) {
        e.phase = Math.random() * Math.PI * 2;
      }

      e.baseY = Number.isFinite(e.baseY) ? e.baseY : 255;
      e.y = e.baseY + Math.sin(game.time * 0.035 + e.phase) * 32;
    }

    /* Keep every ground enemy inside its patrol area. */
    for (const e of game.lvl.enemies) {
      if (e.dead || e.type === 'flyer') continue;
      if (!Number.isFinite(e.min) || !Number.isFinite(e.max)) continue;

      e.x = Math.max(e.min, Math.min(e.max, e.x));

      if (e.x <= e.min + 0.5 && e.vx < 0) {
        e.vx = Math.abs(e.vx);
      }
      if (e.x >= e.max - 0.5 && e.vx > 0) {
        e.vx = -Math.abs(e.vx);
      }
    }

    previousJump = input.jump;
  };
})();
