import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, step, platforms, gemLocations } from '../src/physics.js';

const dt = 1 / 120;
function tick(p, input = {}, count = 1, world) {
  for (let i = 0; i < count; i++) step(p, dt, input, world);
  return p;
}
function nearLeftLedge() {
  return { ...spawn(), x: 446, y: 289, grounded: false, vy: 120, vx: 80, mode: 'fall' };
}

test('ground acceleration, inertia and reversal take time instead of teleporting velocity', () => {
  const p = spawn();
  tick(p, { right: true });
  assert.ok(p.vx > 0 && p.vx < 30);
  tick(p, { right: true }, 30);
  assert.equal(p.vx, 275);
  const before = p.x;
  tick(p, { left: true });
  assert.equal(p.mode, 'brake');
  assert.ok(p.vx > 0);
  assert.ok(p.x > before, 'momentum carries the body forward during braking');
  tick(p, { left: true }, 40);
  assert.ok(p.vx < 0);
  tick(p, {}, 60);
  assert.equal(p.vx, 0);
});

test('full jump rises about 100 pixels and lands with impact and recovery', () => {
  const p = spawn(), floorY = p.y;
  tick(p, { jump: true, jumpHeld: true });
  assert.equal(p.mode, 'rise');
  let top = p.y, landed = false;
  for (let i = 0; i < 110; i++) {
    tick(p, { jumpHeld: true });
    top = Math.min(top, p.y);
    if (p.mode === 'land') { landed = true; break; }
  }
  assert.ok(floorY - top > 95 && floorY - top < 105);
  assert.equal(p.y, floorY);
  assert.equal(p.vy, 0);
  assert.ok(landed && p.landImpact > 0.5);
  tick(p, {}, 30);
  assert.equal(p.mode, 'idle');
});

test('releasing jump early produces a shorter arc; pressing in air cannot double jump', () => {
  const p = spawn();
  tick(p, { jump: true, jumpHeld: true });
  tick(p, { jumpHeld: false });
  assert.ok(p.vy > -240);
  let top = p.y;
  for (let i = 0; i < 20; i++) { tick(p, {}); top = Math.min(top, p.y); }
  assert.ok(356 - top < 30);
  const velocity = p.vy;
  tick(p, { jump: true, jumpHeld: true });
  assert.ok(p.vy > velocity, 'second press does not reset vertical velocity');
});

test('late jump after leaving a ledge uses coyote time but not indefinitely', () => {
  const p = { ...spawn(), x: 389, vx: 275 };
  tick(p, { right: true }, 5);
  assert.equal(p.grounded, false);
  tick(p, { jump: true });
  assert.ok(p.vy < -500);
  const late = { ...spawn(), x: 410, y: 358, grounded: false, coyote: 0, vy: 60 };
  tick(late, { jump: true });
  assert.ok(late.vy > 0);
});

test('jump pressed just before landing is buffered and fires on ground contact', () => {
  const p = { ...spawn(), y: 348, grounded: false, vy: 250, coyote: 0, mode: 'fall' };
  tick(p, { jump: true });
  tick(p, {}, 6);
  assert.ok(p.vy < -450);
  assert.equal(p.mode, 'rise');
});

test('descending toward a raised edge catches it and holds body without drift', () => {
  const p = nearLeftLedge();
  tick(p, { right: true }, 5);
  assert.equal(p.mode, 'hang');
  assert.deepEqual(p.ledge, { x: 470, y: 300, side: 1 });
  assert.equal(p.x, 446);
  assert.equal(p.y, 308);
  tick(p, { right: true }, 240);
  assert.equal(p.x, 446);
  assert.equal(p.y, 308);
  assert.equal(p.vy, 0);
});

test('climbing lifts over time and finishes standing safely on the ledge', () => {
  const p = nearLeftLedge();
  tick(p, { right: true }, 5);
  tick(p, { up: true });
  assert.equal(p.mode, 'climb');
  const start = { x: p.x, y: p.y };
  tick(p, {}, 30);
  assert.ok(p.y < start.y && p.y > 220);
  assert.ok(p.x > start.x && p.x < 480);
  assert.ok(p.climbProgress > 0.3 && p.climbProgress < 0.6);
  tick(p, {}, 50);
  assert.equal(p.x, 480);
  assert.equal(p.y, 236);
  assert.equal(p.grounded, true);
  assert.equal(p.ledge, null);
});

test('right-hand ledges support a mirrored grab and climb', () => {
  const p = { ...spawn(), x: 391, y: 409, vy: 120, vx: -40, grounded: false, facing: -1 };
  tick(p, { left: true }, 5);
  assert.equal(p.mode, 'hang');
  assert.deepEqual(p.ledge, { x: 390, y: 420, side: -1 });
  tick(p, { jump: true });
  tick(p, {}, 80);
  assert.equal(p.x, 356);
  assert.equal(p.y, 356);
  assert.equal(p.grounded, true);
});

test('down releases a ledge and cooldown prevents immediately regrabbing it', () => {
  const p = nearLeftLedge();
  tick(p, { right: true }, 5);
  tick(p, { down: true });
  assert.equal(p.mode, 'fall');
  assert.equal(p.ledge, null);
  tick(p, { right: true }, 20);
  assert.notEqual(p.mode, 'hang');
  assert.ok(p.y > 308);
});

test('a low ceiling stops jumps and blocks climbing through solid geometry', () => {
  const jumpWorld = { platforms: [platforms[0], { x: 50, y: 250, w: 250, h: 20 }], spikes: [] };
  const p = spawn();
  tick(p, { jump: true }, 1, jumpWorld);
  let ceilingHit = false;
  for (let i = 0; i < 60; i++) {
    tick(p, {}, 1, jumpWorld);
    assert.ok(p.y >= 270);
    if (p.y === 270 && p.vy === 0) ceilingHit = true;
  }
  assert.ok(ceilingHit);
  const q = nearLeftLedge();
  const climbWorld = { platforms: [...platforms, { x: 460, y: 230, w: 100, h: 20 }], spikes: [] };
  tick(q, { right: true }, 5, climbWorld);
  assert.equal(q.mode, 'hang');
  tick(q, { up: true }, 80, climbWorld);
  assert.equal(q.mode, 'hang');
  assert.equal(q.y, 308);
});

test('spikes and deep falls cause death, and tall walls cannot be walked through', () => {
  const p = { ...spawn(), x: 675, y: 236 };
  assert.equal(step(p, dt, {}), true);
  assert.equal(p.mode, 'dead');
  const fallen = { ...spawn(), x: 410, y: 660, grounded: false };
  assert.equal(step(fallen, dt, {}), true);
  const wallWorld = { platforms: [platforms[0], { x: 200, y: 250, w: 30, h: 170 }], spikes: [] };
  const q = spawn();
  tick(q, { right: true }, 180, wallWorld);
  assert.equal(q.x, 176);
  assert.equal(q.vx, 0);
});

test('entire level can be traversed collecting all gems using real jumps, grabs and climbs', () => {
  const p = spawn(), jumpAt = [325, 620, 1080, 1540, 1760, 1975];
  const collected = new Set();
  let nextJump = 0, grabs = 0, climbs = 0;
  for (let i = 0; i < 2400 && p.x <= 2525; i++) {
    const jump = nextJump < jumpAt.length && p.x >= jumpAt[nextJump] && p.grounded;
    if (jump) nextJump++;
    const before = p.mode;
    const dead = step(p, dt, { right: true, jumpHeld: true, jump, up: p.mode === 'hang' });
    assert.equal(dead, false, `route died at x=${p.x}, y=${p.y}`);
    if (p.mode === 'hang' && before !== 'hang') grabs++;
    if (p.mode === 'climb' && before !== 'climb') climbs++;
    gemLocations.forEach((g, index) => {
      if (Math.hypot(p.x + p.w / 2 - g.x, p.y + p.h * 0.45 - g.y) < 39) collected.add(index);
    });
  }
  assert.ok(p.x > 2525 && p.grounded, 'the exit is reachable on its platform');
  assert.equal(collected.size, 3);
  assert.ok(grabs >= 2 && climbs >= 2, 'ledge mechanics are exercised along the route');
});


test('a nearby wall is not a grab when rising, too far away, below the grip, or facing away', () => {
  for (const changes of [
    { vy: -120, mode: 'rise' },
    { x: 425 },
    { y: 330 },
    { facing: -1 },
  ]) {
    const p = { ...nearLeftLedge(), ...changes };
    tick(p, {}, 1);
    assert.notEqual(p.mode, 'hang', JSON.stringify(changes));
  }
});

test('hanging or climbing does not make the body immune to hazards', () => {
  const p = nearLeftLedge();
  tick(p, { right: true }, 5);
  const world = { platforms, spikes: [{ x: 440, y: 370, w: 20 }] };
  assert.equal(step(p, dt, {}, world), true);
  const q = nearLeftLedge();
  tick(q, { right: true }, 5);
  tick(q, { up: true });
  const climbingHazard = { platforms, spikes: [{ x: 440, y: 360, w: 20 }] };
  assert.equal(step(q, dt, {}, climbingHazard), true);
});


test('releasing a full run takes recovery steps and distance before coming to rest in either direction', () => {
  for (const direction of [-1, 1]) {
    const p = { ...spawn(), x: 190, vx: 275 * direction, facing: direction, mode: 'run' };
    const origin = p.x;
    tick(p);
    assert.equal(p.mode, 'brake');
    assert.ok(Math.abs(p.vx) > 260, 'release preserves momentum instead of snapping to idle');
    tick(p, {}, 23);
    assert.ok(Math.abs(p.vx) > 130 && Math.abs(p.vx) < 150);
    assert.equal(p.facing, direction);
    tick(p, {}, 36);
    assert.equal(p.vx, 0);
    assert.equal(p.mode, 'idle');
    const stoppingDistance = (p.x - origin) * direction;
    assert.ok(stoppingDistance > 55 && stoppingDistance < 61, `stopping distance: ${stoppingDistance}`);
    const stoppedAt = p.x;
    tick(p, {}, 60);
    assert.equal(p.x, stoppedAt, 'no endless sliding after the recovery steps');
  }
});

test('reversing brakes in the original facing direction before turning, mirrored for left and right', () => {
  for (const direction of [-1, 1]) {
    const p = { ...spawn(), x: 190, vx: 275 * direction, facing: direction, mode: 'run' };
    const input = direction > 0 ? { left: true } : { right: true };
    tick(p, input, 24);
    assert.equal(p.mode, 'brake');
    assert.equal(p.facing, direction, 'body does not turn backwards while still moving quickly');
    assert.ok(p.vx * direction > 60);
    tick(p, input, 12);
    assert.ok(p.vx * direction < 0);
    assert.equal(p.facing, -direction);
    assert.equal(p.mode, 'run');
  }
});

test('releasing the direction in mid-air preserves jump momentum until landing', () => {
  const p = { ...spawn(), vx: 275, mode: 'run' };
  tick(p, { right: true, jump: true, jumpHeld: true });
  const origin = p.x;
  tick(p, { jumpHeld: true }, 25);
  assert.equal(p.grounded, false);
  assert.equal(p.vx, 275);
  assert.ok(p.x > origin + 55);
});
