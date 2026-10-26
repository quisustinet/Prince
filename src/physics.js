// All simulation values are in world pixels and seconds. Rendering is independent
// of frame rate; the game advances this module in fixed 1/120 s steps.
export const platforms = [
  { x: 0, y: 420, w: 390, h: 180 },
  { x: 470, y: 300, w: 320, h: 300 },
  { x: 870, y: 355, w: 250, h: 245 },
  { x: 1200, y: 265, w: 200, h: 335 },
  { x: 1480, y: 420, w: 330, h: 180 },
  { x: 1890, y: 315, w: 260, h: 285 },
  { x: 2240, y: 420, w: 500, h: 180 },
];
export const spikes = [
  { x: 660, y: 300, w: 60 },
  { x: 1590, y: 420, w: 75 },
  { x: 2020, y: 315, w: 60 },
];
export const gemLocations = [
  { x: 550, y: 238 }, { x: 1290, y: 203 }, { x: 1940, y: 253 },
];
export const checkpoints = [
  { x: 90, y: 356 }, { x: 500, y: 236 },
  { x: 1510, y: 356 }, { x: 1910, y: 251 },
];
export const movement = Object.freeze({
  speed: 275, acceleration: 1900, braking: 2500, friction: 1750,
  airAcceleration: 680, gravity: 1500, jumpSpeed: 550,
  coyoteTime: 0.11, jumpBuffer: 0.14, climbDuration: 0.62,
});

export const spawn = () => ({
  x: 90, y: 356, vx: 0, vy: 0, w: 24, h: 64,
  grounded: true, coyote: movement.coyoteTime, buffer: 0, facing: 1,
  mode: 'idle', animTime: 0, gait: 0, landImpact: 0, landTimer: 0,
  ledge: null, climbProgress: 0, climbFrom: null, climbTo: null,
  grabCooldown: 0, jumpCut: false,
});

const approach = (value, target, amount) => value < target
  ? Math.min(value + amount, target) : Math.max(value - amount, target);
const overlaps = (a, b) => a.x < b.x + b.w - 0.01
  && a.x + a.w > b.x + 0.01 && a.y < b.y + b.h - 0.01
  && a.y + a.h > b.y + 0.01;
const smooth = t => t * t * (3 - 2 * t);
function mode(p, next) {
  if (p.mode !== next) { p.mode = next; p.animTime = 0; }
}
function hazard(p, hazards) {
  return p.y > 650 || hazards.some(s => p.x + p.w > s.x + 4
    && p.x < s.x + s.w - 4 && p.y + p.h > s.y - 18 && p.y < s.y + 8);
}
function canClimb(p, solids) {
  const side = p.ledge.side;
  const target = { x: p.ledge.x + (side === 1 ? 10 : -p.w - 10),
    y: p.ledge.y - p.h, w: p.w, h: p.h };
  // Check both the final stance and space above the lip. A low ceiling must
  // never turn climbing into a teleport through solid geometry.
  const upperBody = { x: Math.min(p.x, target.x), y: target.y - 10,
    w: Math.abs(target.x - p.x) + p.w, h: p.h + 8 };
  return !solids.some(b => overlaps(target, b) || overlaps(upperBody, b));
}
function beginClimb(p) {
  p.climbFrom = { x: p.x, y: p.y };
  p.climbTo = { x: p.ledge.x + (p.ledge.side === 1 ? 10 : -p.w - 10), y: p.ledge.y - p.h };
  p.climbProgress = 0;
  mode(p, 'climb');
}
function catchLedge(p, previousY, direction, solids) {
  if (p.grabCooldown > 0 || p.vy < 0 || p.grounded) return false;
  for (const b of solids) {
    for (const side of [1, -1]) {
      if (p.facing !== side || direction === -side) continue;
      const edge = side === 1 ? b.x : b.x + b.w;
      const handX = side === 1 ? p.x + p.w : p.x;
      const handY = p.y + 8;
      if (Math.abs(handX - edge) > 15 || handY < b.y - 12 || handY > b.y + 14 || previousY + 8 > b.y + 14) continue;
      // There has to be air outside this wall and above the lip.
      const grip = { x: edge - 3, y: b.y - 12, w: 6, h: 11 };
      const body = { x: side === 1 ? edge - p.w : edge, y: b.y + 8, w: p.w, h: p.h };
      if (solids.some(other => other !== b && (overlaps(body, other) || overlaps(grip, other)))) continue;
      p.x = body.x; p.y = body.y; p.vx = 0; p.vy = 0;
      p.ledge = { x: edge, y: b.y, side };
      p.grounded = false; p.coyote = 0; p.buffer = 0;
      mode(p, 'hang');
      return true;
    }
  }
  return false;
}

// An optional world makes collision regression tests independent of level art.
export function step(p, dt, input = {}, world = { platforms, spikes }) {
  const solids = world.platforms, hazards = world.spikes ?? [];
  const direction = Number(Boolean(input.right)) - Number(Boolean(input.left));
  p.animTime += dt;
  p.landImpact = Math.max(0, p.landImpact - dt * 3.5);
  p.landTimer = Math.max(0, p.landTimer - dt);
  p.grabCooldown = Math.max(0, p.grabCooldown - dt);
  if (p.mode === 'dead') return true;

  if (p.mode === 'hang') {
    if (hazard(p, hazards)) { mode(p, 'dead'); return true; }
    if (input.down) {
      p.x -= p.ledge.side * 5;
      p.vx = -p.ledge.side * 45; p.vy = 45;
      p.ledge = null; p.grabCooldown = 0.42;
      mode(p, 'fall');
    } else if ((input.up || input.jump) && canClimb(p, solids)) {
      beginClimb(p);
    }
    return false;
  }
  if (p.mode === 'climb') {
    p.climbProgress = Math.min(1, p.climbProgress + dt / movement.climbDuration);
    const t = p.climbProgress;
    const lift = smooth(Math.min(1, t / 0.7));
    const across = smooth(Math.max(0, (t - 0.35) / 0.65));
    p.x = p.climbFrom.x + (p.climbTo.x - p.climbFrom.x) * across;
    p.y = p.climbFrom.y + (p.climbTo.y - p.climbFrom.y) * lift - Math.sin(Math.PI * t) * 10;
    if (hazard(p, hazards)) { mode(p, 'dead'); return true; }
    if (t === 1) {
      p.x = p.climbTo.x; p.y = p.climbTo.y;
      p.ledge = null; p.grounded = true; p.vx = 0; p.vy = 0;
      p.landImpact = 0.25; p.landTimer = 0.08;
      p.coyote = movement.coyoteTime;
      mode(p, 'land');
      if (hazard(p, hazards)) { mode(p, 'dead'); return true; }
    }
    return false;
  }

  const wasGrounded = p.grounded;
  if (wasGrounded) p.coyote = movement.coyoteTime;
  else p.coyote = Math.max(0, p.coyote - dt);
  p.buffer = input.jump ? movement.jumpBuffer : Math.max(0, p.buffer - dt);

  const braking = direction && Math.sign(p.vx) && Math.sign(p.vx) !== direction && Math.abs(p.vx) > 45;
  if (wasGrounded) {
    const acceleration = direction ? (braking ? movement.braking : movement.acceleration) : movement.friction;
    p.vx = approach(p.vx, direction * movement.speed, acceleration * dt);
  } else if (direction) {
    p.vx = approach(p.vx, direction * movement.speed, movement.airAcceleration * dt);
  }
  if (direction) p.facing = direction;
  if (p.buffer > 0 && p.coyote > 0) {
    p.vy = -movement.jumpSpeed; p.grounded = false;
    p.coyote = 0; p.buffer = 0; p.jumpCut = false;
    p.landTimer = 0; mode(p, 'rise');
  }
  if (input.jumpHeld === false && p.vy < -230 && !p.jumpCut) {
    p.vy = -230; p.jumpCut = true;
  }
  p.vy = Math.min(900, p.vy + movement.gravity * dt);

  const oldX = p.x, oldY = p.y;
  p.x = Math.max(0, Math.min(2716, p.x + p.vx * dt));
  for (const b of solids) {
    if (p.y + p.h <= b.y + 0.01 || p.y >= b.y + b.h - 0.01) continue;
    if (p.x + p.w > b.x && p.x < b.x + b.w) {
      if (p.vx > 0 && oldX + p.w <= b.x + 0.01) p.x = b.x - p.w;
      else if (p.vx < 0 && oldX >= b.x + b.w - 0.01) p.x = b.x + b.w;
      else continue;
      p.vx = 0;
    }
  }
  p.gait += Math.abs(p.x - oldX);
  p.y += p.vy * dt;
  p.grounded = false;
  for (const b of solids) {
    if (p.x + p.w <= b.x + 0.01 || p.x >= b.x + b.w - 0.01) continue;
    if (p.vy >= 0 && oldY + p.h <= b.y + 0.01 && p.y + p.h >= b.y) {
      if (!wasGrounded && p.vy > 80) {
        p.landImpact = Math.min(1, p.vy / 750); p.landTimer = 0.13;
      }
      p.y = b.y - p.h; p.vy = 0; p.grounded = true;
    } else if (p.vy < 0 && oldY >= b.y + b.h - 0.01 && p.y <= b.y + b.h) {
      p.y = b.y + b.h; p.vy = 0; p.jumpCut = true;
    }
  }

  if (catchLedge(p, oldY, direction, solids)) return false;
  if (hazard(p, hazards)) { mode(p, 'dead'); return true; }
  mode(p, p.grounded
    ? (p.landTimer > 0 ? 'land' : braking ? 'brake' : Math.abs(p.vx) > 12 ? 'run' : 'idle')
    : (p.vy < 0 ? 'rise' : 'fall'));
  return false;
}
