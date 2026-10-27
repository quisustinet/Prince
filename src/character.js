// A small articulated figure rather than a sprite being translated across the
// screen. Poses provide hand/foot targets; two-bone IK bends every elbow/knee.
const TAU = Math.PI * 2;
const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const point = (x, y) => ({ x, y });
const add = (a, x, y) => point(a.x + x, a.y + y);
const blend = (a, b, t) => point(lerp(a.x, b.x, t), lerp(a.y, b.y, t));
const palette = {
  ink: '#202b34', skin: '#d7a27d', skinShade: '#a97459', skinLight: '#ebbc91',
  shirt: '#e6d9b8', shirtLight: '#f5ebd2', shirtShade: '#b6aa91',
  trousers: '#3a4e58', trousersShade: '#2c3b46', trousersLight: '#5e7379',
  sash: '#bb4641', sashShade: '#7d2b33', gold: '#d6b878', hair: '#24252c', shoe: '#25272c',
};

/** Returns a reachable endpoint as well as the knee/elbow: lengths never stretch. */
export function solveLimb(root, target, upper, lower, bend = -1) {
  const dx = target.x - root.x, dy = target.y - root.y;
  const distance = Math.hypot(dx, dy);
  const reach = clamp(distance, Math.abs(upper - lower) + 0.001, upper + lower - 0.001);
  const angle = Math.atan2(dy, dx);
  const offset = Math.acos(clamp((upper * upper + reach * reach - lower * lower) / (2 * upper * reach), -1, 1));
  return {
    joint: add(root, Math.cos(angle + bend * offset) * upper, Math.sin(angle + bend * offset) * upper),
    end: add(root, Math.cos(angle) * reach, Math.sin(angle) * reach),
  };
}

function gaitFoot(phase, energy) {
  phase = ((phase % 1) + 1) % 1;
  // 58% stance: a foot sweeps backwards by precisely the distance the body
  // travels during contact. The remaining phase lifts the foot over the floor.
  // A 33.6px step slows the cadence without letting the planted foot slide:
  // its travel matches the 58px gait cycle during the stance phase.
  if (phase < 0.58) return point(lerp(16.82, -16.82, phase / 0.58) * energy, 63);
  const t = (phase - 0.58) / 0.42;
  return point(lerp(-16.82, 16.82, smooth(t)) * energy, 63 - Math.sin(Math.PI * t) * 16 * energy);
}

/** Pure pose data in facing-relative coordinates, origin at player's top centre. */
export function computePose(p, time = 0) {
  const speed = Math.abs(p.vx || 0), energy = clamp(speed / 210);
  const mode = p.mode || (p.grounded ? (speed > 10 ? 'run' : 'idle') : (p.vy < 0 ? 'rise' : 'fall'));
  // One gait cycle covers a 58px step. Together with gaitFoot this means a
  // planted foot stays in world space while the hips pass over it.
  const phase = (p.gait || 0) / 58;
  const breath = Math.sin(time * 2.7) * 0.55;
  const bounce = p.grounded ? Math.cos(phase * TAU * 2) * 0.85 * energy : 0;
  const compression = mode === 'land'
    ? Math.sin(clamp((p.animTime || 0) / 0.13) * Math.PI) * (3 + clamp(p.landImpact || 0) * 5) : 0;
  // The hip sits high enough that the support leg is close to straight. A
  // small bend remains for weight and impact, rather than a permanent squat.
  let hip = point(-1, 22 + bounce + compression);
  let shoulder = point(lerp(-0.5, 5, energy), 3 + bounce + compression + breath * (1 - energy));
  let frontFoot = gaitFoot(phase, energy), backFoot = gaitFoot(phase + 0.5, energy);
  let frontHand, backHand;
  // In facing-relative coordinates a relaxed elbow sits behind the arm's
  // shoulder→wrist line, opposite to a knee. Overhead reaches use the other
  // branch so the elbows remain outside a wall while the hands grip its lip.
  let frontBend = 1, backBend = 1;
  const swing = Math.sin(phase * TAU) * energy;
  frontHand = point(3 - swing * 16, 39 - Math.abs(swing) * 6);
  backHand = point(-2 + swing * 15, 39 - Math.abs(swing) * 6);
  if (speed < 18) {
    frontFoot = point(5, 63); backFoot = point(-5, 63);
    frontHand = point(5 + breath * 0.6, 41); backHand = point(-3, 40);
  }
  if (mode === 'brake') {
    // Keep taking recovery steps as momentum decays. Freezing both feet here
    // makes a moving body look as though it is sliding across the stone.
    shoulder.x = lerp(-0.5, -5, energy);
    hip.x = lerp(-1, -2, energy);
    const recoveryStride = clamp(speed / 60);
    frontFoot = gaitFoot(phase, recoveryStride);
    backFoot = gaitFoot(phase + 0.5, recoveryStride);
    frontHand = point(lerp(5, 12, energy), lerp(41, 29, energy));
    backHand = point(lerp(-3, -12, energy), lerp(40, 25, energy));
  }
  if (mode === 'rise') {
    const tuck = clamp(-(p.vy || 0) / 550);
    hip = point(-2, 32);
    shoulder = point(4, 13);
    // The lead knee is driven up while the trailing leg finishes its push.
    frontFoot = point(14, lerp(57, 45, tuck));
    backFoot = point(-13, lerp(61, 52, tuck));
    frontHand = point(16, 9); backHand = point(-13, 29);
    // During a jump the elbow folds down toward the torso; the old pole put
    // it above the shoulder and made the reach look dislocated.
    frontBend = backBend = 1;
  }
  if (mode === 'fall') {
    const falling = clamp((p.vy || 0) / 450);
    shoulder = point(4, 13);
    hip = point(-1, 31);
    frontFoot = point(8, 60 - falling * 2);
    backFoot = point(-9, 57 + falling * 4);
    frontHand = point(19, lerp(11, 2, falling));
    backHand = point(-11, lerp(16, 6, falling));
    // Keep each airborne elbow below its shoulder/wrist line instead of
    // pointing skyward during the reach.
    frontBend = 1; backBend = -1;
  }
  if (mode === 'land') {
    frontFoot = point(11, 63); backFoot = point(-10, 63);
    shoulder.x = 5 + compression * 0.4;
    frontHand = point(13, 34 + compression); backHand = point(-13, 29 + compression * 0.5);
  }
  const anchors = (mode === 'hang' || mode === 'climb') && p.ledge;
  if (anchors) {
    const edge = point((p.ledge.x - (p.x + p.w / 2)) * p.facing, p.ledge.y - p.y);
    if (mode === 'hang') {
      // A supported hanging body uses near-straight arms.  There is only a
      // tiny natural flex, so no elbow reads as bending above the hands.
      frontBend = backBend = 1;
      const sway = Math.sin(time * 2.6) * 1.5;
      shoulder = add(edge, -7, 24);
      hip = add(edge, -15 + sway, 43);
      frontFoot = add(edge, -7 + sway, 71);
      backFoot = add(edge, -19 + sway, 67);
      frontHand = add(edge, 0, 0); backHand = add(edge, -6, 0);
    } else {
      const t = clamp(p.climbProgress || 0);
      const pull = smooth(t / 0.67), stand = smooth((t - 0.67) / 0.33);
      // Start from the exact hanging pose, then pull the torso over the lip.
      const bodyX = lerp(-10, 22, smooth((t - 0.25) / 0.75));
      const shoulderY = lerp(24, -20, pull) - 41 * stand;
      shoulder = add(edge, bodyX + lerp(3, 0, stand), shoulderY);
      hip = add(shoulder, lerp(-8, -1, stand), 19);
      const kneePlant = smooth((t - 0.18) / 0.47);
      frontFoot = add(edge, lerp(-7, 27, kneePlant), lerp(71, -1, kneePlant));
      backFoot = add(edge, lerp(-19, 16, smooth((t - 0.40) / 0.48)), lerp(67, -1, smooth((t - 0.40) / 0.48)));
      const release = smooth((t - 0.66) / 0.25);
      frontHand = blend(add(edge, 0, 0), add(shoulder, 5, 24), release);
      backHand = blend(add(edge, -6, 0), add(shoulder, -3, 23), release);
      // Both arms become almost straight during the final push. Change IK
      // branch there, before releasing the hands, without an elbow popping
      // through the body when returning to the relaxed standing pose.
      if (t >= 0.76) frontBend = backBend = 1;
    }
  }
  const frontShoulder = add(shoulder, 2.5, 1), backShoulder = add(shoulder, -2.5, 0);
  const frontHip = add(hip, 2, 0), backHip = add(hip, -2, 0);
  const frontLeg = solveLimb(frontHip, frontFoot, 22, 22, -1);
  const backLeg = solveLimb(backHip, backFoot, 22, 22, -1);
  const frontArm = solveLimb(frontShoulder, frontHand, 13, 12.5, frontBend);
  const backArm = solveLimb(backShoulder, backHand, 13, 12.5, backBend);
  return {
    mode, hip, shoulder, head: add(shoulder, 1.5, -11),
    frontHip, backHip, frontShoulder, backShoulder,
    frontKnee: frontLeg.joint, frontFoot: frontLeg.end,
    backKnee: backLeg.joint, backFoot: backLeg.end,
    frontElbow: frontArm.joint, frontHand: frontArm.end,
    backElbow: backArm.joint, backHand: backArm.end,
    anchors: Boolean(anchors), frontArmBend: frontBend, backArmBend: backBend,
  };
}

const histories = new WeakMap();
export function computeAnimatedPose(p, time) {
  const target = computePose(p, time);
  const old = histories.get(p);
  const dt = old ? clamp(time - old.time, 0, 0.05) : 1;
  // Keep contact constraints exact. Locomotion blends the torso and hands;
  // feet remain exact gait targets, preventing interpolation-induced skating.
  const amount = 1 - Math.exp(-20 * dt);
  if (old && !target.anchors && !old.pose.anchors) {
    for (const key of ['hip', 'shoulder', 'head', 'frontHand', 'backHand']) {
      target[key] = blend(old.pose[key], target[key], amount);
    }
    target.frontHip = add(target.hip, 2, 0); target.backHip = add(target.hip, -2, 0);
    target.frontShoulder = add(target.shoulder, 2.5, 1); target.backShoulder = add(target.shoulder, -2.5, 0);
    const frontLeg = solveLimb(target.frontHip, target.frontFoot, 22, 22);
    const backLeg = solveLimb(target.backHip, target.backFoot, 22, 22);
    const frontArm = solveLimb(target.frontShoulder, target.frontHand, 13, 12.5, target.frontArmBend);
    const backArm = solveLimb(target.backShoulder, target.backHand, 13, 12.5, target.backArmBend);
    target.frontKnee = frontLeg.joint; target.frontFoot = frontLeg.end;
    target.backKnee = backLeg.joint; target.backFoot = backLeg.end;
    target.frontElbow = frontArm.joint; target.frontHand = frontArm.end;
    target.backElbow = backArm.joint; target.backHand = backArm.end;
  }
  histories.set(p, { time, pose: target });
  return target;
}

function stroke(ctx, a, b, width, color) {
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.stroke();
}
function bone(ctx, a, b, width, color, highlight) {
  stroke(ctx, a, b, width + 1.4, palette.ink);
  stroke(ctx, a, b, width, color);
  if (highlight) stroke(ctx, add(a, -0.7, 0), add(b, -0.7, 0), width * 0.28, highlight);
}
function leg(ctx, hip, knee, foot, near) {
  bone(ctx, hip, knee, 7.5, near ? palette.trousers : palette.trousersShade, near ? palette.trousersLight : null);
  bone(ctx, knee, foot, 5.3, near ? palette.trousers : palette.trousersShade);
  const wrap = blend(knee, foot, 0.65);
  stroke(ctx, wrap, foot, 5.4, near ? '#c2b398' : '#958d7e');
  stroke(ctx, blend(knee, foot, 0.79), blend(knee, foot, 0.84), 5.7, '#756e62');
  // The heel and toe rotate upward during swing, rather than remaining rigid.
  const toe = add(foot, 5.1, -0.7);
  bone(ctx, add(foot, -1.2, -0.2), toe, 4.6, palette.shoe);
  stroke(ctx, add(foot, -1.7, 1.7), add(toe, 0.5, 1.5), 1.3, '#b09a75');
}
function arm(ctx, shoulder, elbow, hand, near) {
  const skin = near ? palette.skin : palette.skinShade;
  bone(ctx, shoulder, elbow, 4.8, skin, near ? palette.skinLight : null);
  bone(ctx, elbow, hand, 4.2, skin, near ? palette.skinLight : null);
  bone(ctx, shoulder, blend(shoulder, elbow, 0.39), 7, near ? palette.shirt : palette.shirtShade);
  const cuff = blend(elbow, hand, 0.72);
  stroke(ctx, cuff, blend(elbow, hand, 0.87), 5, near ? palette.sash : palette.sashShade);
  ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(hand.x, hand.y, 2.7, 2.2, 0, 0, TAU); ctx.fill();
}
function torso(ctx, pose) {
  const s = pose.shoulder, h = pose.hip;
  ctx.fillStyle = palette.shirt; ctx.strokeStyle = palette.ink; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(s.x - 5.5, s.y - 1);
  ctx.quadraticCurveTo(s.x + 1, s.y - 4, s.x + 7, s.y + 1);
  ctx.lineTo(h.x + 7, h.y + 2); ctx.quadraticCurveTo(h.x, h.y + 5, h.x - 7, h.y + 1);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = palette.shirtShade; ctx.beginPath();ctx.moveTo(s.x - 5, s.y + 2);ctx.lineTo(h.x - 1, h.y - 3);ctx.lineTo(h.x - 6, h.y);ctx.closePath();ctx.fill();
  stroke(ctx, add(s, 2.5, 4), add(h, 2, -4), 1, palette.shirtLight);
  ctx.fillStyle = '#9d816a';ctx.beginPath();ctx.moveTo(s.x - 1, s.y - 2);ctx.lineTo(s.x + 5, s.y - 1);ctx.lineTo(s.x + 1, s.y + 7);ctx.closePath();ctx.fill();
  bone(ctx, add(h, -6, -0.5), add(h, 6, -0.5), 5.5, palette.sash);
  ctx.fillStyle=palette.gold;ctx.fillRect(h.x+3,h.y-3,3,4);
}
function head(ctx, pose) {
  const h = pose.head;
  bone(ctx, add(pose.shoulder, 0, -1), add(h, 0, 3.5), 5, palette.skinShade);
  ctx.save();ctx.translate(h.x,h.y);
  ctx.fillStyle=palette.hair;ctx.beginPath();ctx.ellipse(-1,0,6.4,8.2,-0.08,0,TAU);ctx.fill();
  ctx.fillStyle=palette.skin;ctx.beginPath();ctx.moveTo(-2,-5);ctx.quadraticCurveTo(4,-7,5.2,-2);ctx.lineTo(7.1,0.5);ctx.lineTo(5.1,1.8);ctx.quadraticCurveTo(5.4,6.7,0.5,7);ctx.lineTo(-2,3);ctx.closePath();ctx.fill();
  ctx.fillStyle=palette.hair;ctx.beginPath();ctx.moveTo(-6,0);ctx.quadraticCurveTo(-9,-7,-1,-8.5);ctx.quadraticCurveTo(5,-9,6,-4);ctx.lineTo(2,-3);ctx.lineTo(-1,-5);ctx.lineTo(-3,1);ctx.lineTo(-4,6);ctx.lineTo(-6,7);ctx.closePath();ctx.fill();
  stroke(ctx,point(-4,-3),point(4.5,-3.3),1.4,palette.gold);
  ctx.fillStyle=palette.skinLight;ctx.beginPath();ctx.ellipse(-2,1,1.7,2.5,0,0,TAU);ctx.fill();
  stroke(ctx,point(2.5,-.6),point(4.5,-.8),.9,palette.hair);
  ctx.fillStyle=palette.ink;ctx.fillRect(4,0,1,1);
  stroke(ctx,point(4,4.3),point(5,4.1),.7,'#9b5f4e');
  ctx.restore();
}
function sashTail(ctx, pose, p, time) {
  const h=pose.hip, strength=clamp(Math.abs(p.vx||0)/180);
  const wave=Math.sin(time*11)*2.4;
  ctx.fillStyle=palette.sashShade;ctx.beginPath();ctx.moveTo(h.x-4,h.y-2);
  ctx.bezierCurveTo(h.x-13,h.y-2-wave,h.x-15-strength*13,h.y+8+wave,h.x-25-strength*8,h.y+3+wave);
  ctx.lineTo(h.x-18-strength*9,h.y+10+wave);ctx.quadraticCurveTo(h.x-8,h.y+8,h.x-4,h.y+2);ctx.fill();
  stroke(ctx,add(h,-5,0),point(h.x-18-strength*7,h.y+5+wave),1,palette.sash);
}

/** Draw at world coordinates. Call after applying the world camera transform. */
export function drawCharacter(ctx, p, time = 0) {
  const pose=computeAnimatedPose(p,time);
  ctx.save();ctx.translate(p.x+p.w/2,p.y);ctx.scale(p.facing||1,1);
  ctx.lineJoin='round';
  // Ground contact shadow is deliberately subtle and absent during a ledge hang.
  if(p.grounded){ctx.fillStyle='#10172050';ctx.beginPath();ctx.ellipse(0,65,16,2.5,0,0,TAU);ctx.fill();}
  sashTail(ctx,pose,p,time);
  leg(ctx,pose.backHip,pose.backKnee,pose.backFoot,false);
  arm(ctx,pose.backShoulder,pose.backElbow,pose.backHand,false);
  leg(ctx,pose.frontHip,pose.frontKnee,pose.frontFoot,true);
  torso(ctx,pose);head(ctx,pose);
  arm(ctx,pose.frontShoulder,pose.frontElbow,pose.frontHand,true);
  if(p.mode==='hang'||p.mode==='climb'){
    // Small finger marks make the grip visibly sit on top of the stone lip.
    for(const hand of [pose.backHand,pose.frontHand]){stroke(ctx,add(hand,-1,-1),add(hand,2,-1),1,palette.skinLight);}
  }
  ctx.restore();
}
