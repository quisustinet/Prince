import test from 'node:test';
import assert from 'node:assert/strict';
import { computePose } from '../src/character.js';
import { spawn } from '../src/physics.js';

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const world = (p, point) => ({ x: p.x + p.w / 2 + point.x * p.facing, y: p.y + point.y });
const near = (actual, expected, epsilon = 1e-6) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} differs from ${expected}`);
function hanging(facing = 1) {
  return { ...spawn(), mode: 'hang', grounded: false, facing, vx: 0, vy: 0,
    x: facing === 1 ? 446 : 470, y: 308, ledge: { x: 470, y: 300, side: facing } };
}

test('all poses keep human limb lengths without stretching or non-finite coordinates', () => {
  for (const mode of ['idle', 'run', 'brake', 'rise', 'fall', 'land', 'hang', 'climb']) {
    for (let i = 0; i <= 30; i++) {
      const p = { ...hanging(), mode, gait: i * 3, climbProgress: i / 30,
        animTime: i / 30 * 0.13, landImpact: 0.9, vx: 275, vy: mode === 'rise' ? -400 : 250 };
      const pose = computePose(p, i / 30);
      for (const node of Object.values(pose).filter(value => typeof value === 'object')) {
        assert.ok(Number.isFinite(node.x) && Number.isFinite(node.y), `${mode}: invalid joint`);
      }
      for (const side of ['front', 'back']) {
        near(distance(pose[`${side}Hip`], pose[`${side}Knee`]), 17.5);
        near(distance(pose[`${side}Knee`], pose[`${side}Foot`]), 17.5);
        near(distance(pose[`${side}Shoulder`], pose[`${side}Elbow`]), 13);
        near(distance(pose[`${side}Elbow`], pose[`${side}Hand`]), 12.5);
      }
    }
  }
});

test('both facing directions anchor hands to the stone lip throughout hanging sway', () => {
  for (const side of [-1, 1]) {
    const p = hanging(side);
    for (const time of [0, 0.4, 1, 1.7, 2.4]) {
      const pose = computePose(p, time);
      near(world(p, pose.frontHand).x, p.ledge.x);
      near(world(p, pose.frontHand).y, p.ledge.y);
      near(world(p, pose.backHand).x, p.ledge.x - 6 * side);
      near(world(p, pose.backHand).y, p.ledge.y);
    }
  }
});

test('running bends knees and elbows in opposing phases instead of translating rigid limbs', () => {
  const p = { ...spawn(), mode: 'run', vx: 275 };
  const first = computePose({ ...p, gait: 8 }, 0);
  const second = computePose({ ...p, gait: 46 }, 0);
  assert.ok(distance(first.frontKnee, second.frontKnee) > 5);
  assert.ok(distance(first.frontElbow, second.frontElbow) > 5);
  assert.ok(first.frontFoot.x > first.backFoot.x);
  assert.ok(second.frontFoot.x < second.backFoot.x);
  assert.ok(first.frontHand.x < first.backHand.x);
  assert.ok(second.frontHand.x > second.backHand.x);
});

test('the stance foot stays planted in world coordinates as the body advances', () => {
  const p = { ...spawn(), mode: 'run', vx: 275, gait: 4 };
  const initial = world(p, computePose(p, 0).frontFoot);
  for (let distanceMoved = 1; distanceMoved <= 28; distanceMoved++) {
    const next = { ...p, x: p.x + distanceMoved, gait: p.gait + distanceMoved };
    const foot = world(next, computePose(next, 0).frontFoot);
    near(foot.x, initial.x, 0.07);
    near(foot.y, initial.y);
  }
});

test('a heavier landing compresses the body more while feet remain on the floor', () => {
  const p = { ...spawn(), mode: 'land', animTime: 0.065 };
  const light = computePose({ ...p, landImpact: 0.2 });
  const heavy = computePose({ ...p, landImpact: 1 });
  assert.ok(heavy.hip.y > light.hip.y + 3);
  near(heavy.frontFoot.y, 63);
  near(heavy.backFoot.y, 63);
});

test('climbing starts continuously from the hanging pose and finishes near standing', () => {
  for (const facing of [-1, 1]) {
    const p = hanging(facing);
    const hang = computePose(p, 0);
    const initial = computePose({ ...p, mode: 'climb', climbProgress: 0 }, 0);
    for (const key of ['hip', 'shoulder', 'frontHand', 'backHand', 'frontFoot', 'backFoot']) {
      assert.ok(distance(world(p, hang[key]), world(p, initial[key])) < 1.1, `${key}: climb entry snap`);
    }
    const end = { ...p, x: p.ledge.x + (facing === 1 ? 10 : -34), y: p.ledge.y - 64 };
    const final = computePose({ ...end, mode: 'climb', climbProgress: 1 }, 0);
    const standing = computePose({ ...end, mode: 'idle', grounded: true, ledge: null }, 0);
    for (const key of ['hip', 'shoulder', 'head', 'frontHand', 'backHand', 'frontFoot', 'backFoot']) {
      assert.ok(distance(world(end, final[key]), world(end, standing[key])) < 6, `${key}: climb exit snap`);
    }
  }
});
