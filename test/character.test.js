import test from 'node:test';
import assert from 'node:assert/strict';
import { computePose, computeAnimatedPose } from '../src/character.js';
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
        near(distance(pose[`${side}Hip`], pose[`${side}Knee`]), 22);
        near(distance(pose[`${side}Knee`], pose[`${side}Foot`]), 22);
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
  const second = computePose({ ...p, gait: 37 }, 0);
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
  // The front foot remains in its 58% stance phase for this interval.
  for (let distanceMoved = 1; distanceMoved <= 15; distanceMoved++) {
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

test('idle and planted running legs are nearly extended rather than permanently crouched', () => {
  const idle = computePose(spawn());
  assert.ok(distance(idle.frontHip, idle.frontFoot) > 41);
  assert.ok(distance(idle.backHip, idle.backFoot) > 41);
  // At the middle of a planted step the leg still retains a light knee bend.
  const running = computePose({ ...spawn(), mode: 'run', vx: 240, gait: 10 });
  assert.ok(distance(running.frontHip, running.frontFoot) > 41);
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


// Canvas Y grows downwards. Opposite cross-product signs distinguish a
// backward-pointing elbow from a forward-pointing knee after either mirror.
const bendSide = (root, joint, end) => (end.x - root.x) * (joint.y - root.y)
  - (end.y - root.y) * (joint.x - root.x);
function checkRelaxedBends(p, pose) {
  for (const side of ['front', 'back']) {
    const elbowBend = bendSide(world(p, pose[`${side}Shoulder`]), world(p, pose[`${side}Elbow`]), world(p, pose[`${side}Hand`])) * p.facing;
    const kneeBend = bendSide(world(p, pose[`${side}Hip`]), world(p, pose[`${side}Knee`]), world(p, pose[`${side}Foot`])) * p.facing;
    assert.ok(elbowBend > 0, `${pose.mode}: ${side} elbow bends backwards`);
    assert.ok(kneeBend < 0, `${pose.mode}: ${side} knee bends forwards`);
  }
}

test('relaxed and running elbows bend opposite to knees in either facing direction', () => {
  for (const facing of [-1, 1]) {
    for (const mode of ['idle', 'run', 'brake', 'land']) {
      for (let gait = 0; gait < 76; gait += 4) {
        const p = { ...spawn(), mode, facing, vx: mode === 'idle' ? 0 : facing * 240,
          gait, animTime: 0.06, landImpact: 0.7 };
        checkRelaxedBends(p, computePose(p, 0));
      }
    }
  }
});

test('render-frame smoothing preserves the corrected elbow bend branch', () => {
  for (const facing of [-1, 1]) {
    const p = { ...spawn(), mode: 'run', facing, vx: facing * 240 };
    for (let frame = 0; frame < 90; frame++) {
      p.gait = frame * 4;
      if (frame > 45) p.mode = 'brake';
      checkRelaxedBends(p, computeAnimatedPose(p, frame / 60));
    }
  }
});

test('overhead elbows stay outside the wall and relax only after the climb push', () => {
  for (const facing of [-1, 1]) {
    const p = hanging(facing);
    const pose = computePose(p);
    for (const side of ['front', 'back']) {
      const elbow = world(p, pose[`${side}Elbow`]);
      assert.ok((elbow.x - p.ledge.x) * facing < 0, 'elbow must not penetrate wall');
      near(world(p, pose[`${side}Hand`]).y, p.ledge.y);
    }
    const before = computePose({ ...p, mode: 'climb', climbProgress: 0.7599 });
    const after = computePose({ ...p, mode: 'climb', climbProgress: 0.7601 });
    for (const side of ['front', 'back']) {
      assert.ok(distance(before[`${side}Elbow`], after[`${side}Elbow`]) < 0.5, 'almost-straight push avoids a pole flip pop');
    }
    const final = computePose({ ...p, mode: 'climb', climbProgress: 1 });
    assert.equal(final.frontArmBend, 1);
    assert.equal(final.backArmBend, 1);
  }
});

test('braking uses recovery steps instead of frozen sliding feet', () => {
  const p = { ...spawn(), mode: 'brake', vx: 240, gait: 4 };
  const first = computePose(p), next = computePose({ ...p, gait: 20 });
  assert.ok(first.shoulder.x < first.hip.x, 'the torso leans back against travel');
  assert.ok(distance(first.frontFoot, next.frontFoot) > 10);
  const planted = world(p, first.frontFoot);
  const later = { ...p, x: p.x + 12, gait: p.gait + 12, vx: 190 };
  const foot = world(later, computePose(later).frontFoot);
  near(foot.x, planted.x, 0.07);
  near(foot.y, planted.y);
});
