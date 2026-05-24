import { ctx, canvas } from '../canvas.js';
import { g, petSpriteCache, saveGame } from '../state.js';
import { P, STAR_COLORS, GENES, EXP_TABLE, TEMP_OPT_MAX } from '../config.js';
import { drawIsoGround } from './ground.js';
import { drawText, drawTextToCtx } from '../utils.js';

// ─── Egg & Incubator Drawing ────────────────────────────────────

export function drawIncubator() {
  const bx = 234, by = 290, bw = 252, bh = 100;

  ctx.fillStyle = P.incBase;
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = P.incLight;
  ctx.fillRect(bx + 6, by + 6, bw - 12, 16);

  ctx.fillStyle = '#660000';
  ctx.fillRect(bx + 12, by + 22, bw - 24, 10);
  ctx.fillStyle = P.incLight;
  ctx.fillRect(bx + 18, by + 24, bw - 36, 5);

  if (g.heatOn && g.power > 0) {
    const t = Date.now() / 150;
    const flameY = by + bh - 16;
    ctx.fillStyle = P.flame[0];
    ctx.fillRect(bx + 60 + Math.sin(t) * 6, flameY - 12, 10, 16);
    ctx.fillRect(bx + 84 + Math.sin(t * 1.3) * 6, flameY - 16, 10, 22);
    ctx.fillRect(bx + 108 + Math.sin(t * 0.8) * 6, flameY - 8, 10, 12);
    ctx.fillStyle = P.flame[2];
    ctx.fillRect(bx + 66 + Math.sin(t) * 6, flameY - 8, 5, 7);
    ctx.fillRect(bx + 90 + Math.sin(t * 1.3) * 6, flameY - 12, 5, 10);
  } else {
    ctx.fillStyle = '#444';
    ctx.fillRect(bx + 66, by + bh - 12, 6, 5);
    ctx.fillRect(bx + 90, by + bh - 14, 6, 7);
  }

  if (g.iceOn) {
    const iceX = bx - 56, iceY = by + 10;
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(iceX, iceY, 40, 50);
    ctx.fillStyle = '#ADD8E6';
    ctx.fillRect(iceX + 3, iceY + 3, 12, 16);
    ctx.fillStyle = '#E0FFFF';
    ctx.fillRect(iceX + 20, iceY + 20, 10, 10);
    ctx.fillRect(iceX + 6, iceY + 36, 12, 12);
    ctx.fillStyle = '#fff';
    ctx.fillRect(iceX + 6, iceY + 6, 6, 6);
    ctx.fillRect(iceX + 28, iceY + 12, 6, 6);
  }

  drawText('INCUBATOR', bx + 66, by + bh - 16, '#888', 1);
}

export function drawIncubatorToCtx(targetCtx) {
  const bx = 234, by = 290, bw = 252, bh = 100;
  targetCtx.fillStyle = P.incBase;
  targetCtx.fillRect(bx, by, bw, bh);
  targetCtx.fillStyle = P.incLight;
  targetCtx.fillRect(bx + 6, by + 6, bw - 12, 16);
  targetCtx.fillStyle = '#660000';
  targetCtx.fillRect(bx + 12, by + 22, bw - 24, 10);
  targetCtx.fillStyle = P.incLight;
  targetCtx.fillRect(bx + 18, by + 24, bw - 36, 5);
  drawTextToCtx(targetCtx, bx + 66, by + bh - 16, 'INCUBATOR', '#888', 1);
}

export function drawEgg() {
  const ex = 360, ey = 230;
  const eggW = 60, eggH = 82;

  if (g.hatchPct >= 100 || g.isHatching) { drawHatchingAnim(); return; }

  if (g.dayCount < g.nextHatchDay) {
    const daysLeft = g.nextHatchDay - g.dayCount;
    ctx.globalAlpha = 0.5;
    for (let py = -eggH / 2; py < eggH / 2; py++) {
      const prog = py / (eggH / 2);
      let w = py < 0
        ? Math.floor(eggW / 2 * Math.sqrt(1 - prog * prog * 0.85))
        : Math.floor(eggW / 2 * Math.sqrt(1 - prog * prog * 0.95));
      let col;
      if (py < -eggH / 4) col = '#f8f0e0';
      else if (py < 0) col = '#f5e6c8';
      else if (py < eggH / 4) col = '#eed8a8';
      else col = '#e8d098';
      ctx.fillStyle = col;
      ctx.fillRect(ex - w, ey + py, w * 2, 1);
    }
    ctx.globalAlpha = 0.7;
    drawText(`等待第${g.nextHatchDay}天`, ex - 75, ey + eggH / 2 + 35, P.warn, 2);
    drawText(`(${daysLeft}天后)`, ex - 64, ey + eggH / 2 + 55, P.dim, 2);
    ctx.globalAlpha = 1;
    return;
  }

  // 孵化光晕（按温度）
  if (g.incubating) {
    const glow = (Math.sin(Date.now() / 500) + 1) * 0.12;
    ctx.fillStyle = `rgba(255, 200, 100, ${glow})`;
    ctx.fillRect(ex - eggW/2 - 8, ey - eggH/2 - 10, eggW + 16, eggH + 20);
  } else if (g.temp > TEMP_OPT_MAX) {
    const glow = (Math.sin(Date.now() / 300) + 1) * 0.08;
    ctx.fillStyle = `rgba(255, 50, 50, ${glow})`;
    ctx.fillRect(ex - eggW/2 - 8, ey - eggH/2 - 10, eggW + 16, eggH + 20);
  }

  const stage = Math.floor(g.hatchPct / 20);

  // Draw egg body
  for (let py = -eggH / 2; py < eggH / 2; py++) {
    const prog = py / (eggH / 2);
    let w = py < 0
      ? Math.floor(eggW / 2 * Math.sqrt(1 - prog * prog * 0.85))
      : Math.floor(eggW / 2 * Math.sqrt(1 - prog * prog * 0.95));
    let col;
    if (py < -eggH / 4) col = '#f8f0e0';
    else if (py < 0) col = '#f5e6c8';
    else if (py < eggH / 4) col = '#eed8a8';
    else col = '#e8d098';
    ctx.fillStyle = col;
    ctx.fillRect(ex - w, ey + py, w * 2, 1);
  }

  // 花纹（蛋壳斑点）
  ctx.fillStyle = 'rgba(180, 140, 80, 0.35)';
  const spots = [[-15, -25], [10, -15], [-5, 5], [18, -5], [-20, 10], [12, 20]];
  spots.forEach(([dx, dy]) => {
    const spotW = 5 + Math.abs(dx) % 3;
    ctx.fillRect(ex + dx - spotW / 2, ey + dy - spotW / 2, spotW, spotW);
  });

  // 高光（顶部白色反光）
  ctx.fillStyle = 'rgba(255, 255, 240, 0.6)';
  ctx.fillRect(ex - 12, ey - eggH / 2 + 12, 6, 10);

  // 底部阴影
  ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
  ctx.fillRect(ex - eggW / 2 + 5, ey + eggH / 2 - 6, eggW - 10, 4);

  // 裂纹阶段 1
  if (stage >= 1) {
    ctx.fillStyle = P.eggCrack;
    ctx.fillRect(ex - 8, ey - 18, 6, 8);
    ctx.fillRect(ex + 2, ey - 12, 8, 6);
  }
  // 裂纹阶段 2
  if (stage >= 2) {
    ctx.fillRect(ex - 18, ey, 10, 6);
    ctx.fillRect(ex + 8, ey + 6, 8, 8);
    ctx.fillRect(ex - 6, ey + 14, 6, 6);
  }
  // 裂纹阶段 3
  if (stage >= 3) {
    ctx.fillRect(ex - 24, ey - 6, 8, 6);
    ctx.fillRect(ex + 14, ey - 10, 6, 12);
    ctx.fillRect(ex - 12, ey + 20, 12, 6);
    ctx.fillRect(ex + 2, ey - 24, 8, 6);
  }
  // 裂纹阶段 4 - 蛋壳裂开，显示内部
  if (stage >= 4) {
    ctx.fillStyle = P.eggInt;
    ctx.fillRect(ex - 14, ey - 10, 28, 32);
    ctx.fillStyle = P.eggCrack;
    for (let i = 0; i < 6; i++) {
      const cx = ex - 24 + Math.floor(Math.random() * 48);
      const cy = ey - 24 + Math.floor(Math.random() * 54);
      ctx.fillRect(cx, cy, 6, 6);
    }
    ctx.fillStyle = '#D4A574';
    ctx.fillRect(ex - 8, ey - 6, 16, 24);
    // 眼睛探出
    ctx.fillStyle = '#000';
    ctx.fillRect(ex - 3, ey, 6, 6);
    ctx.fillStyle = '#fff';
    ctx.fillRect(ex, ey, 2, 2);
  }

  drawText(`孵化 ${Math.floor(g.hatchPct)}%`, ex - 50, ey + eggH / 2 + 35, P.dim, 1.5);
  ctx.fillStyle = P.barBg;
  ctx.fillRect(ex - 40, ey + eggH / 2 + 52, 80, 6);
  ctx.fillStyle = g.hatchPct > 80 ? P.happy : (g.hatchPct > 50 ? P.warn : '#aaa');
  ctx.fillRect(ex - 40, ey + eggH / 2 + 52, Math.floor(80 * g.hatchPct / 100), 6);
}

export function drawEggToCtx(targetCtx) {
  const ex = 360, ey = 230;
  const eggW = 60, eggH = 82;
  if (g.dayCount < g.nextHatchDay) {
    const daysLeft = g.nextHatchDay - g.dayCount;
    drawTextToCtx(targetCtx, ex - 64, ey + eggH / 2 + 35, `等待第${g.nextHatchDay}天`, P.dim, 2);
    if (daysLeft > 0) drawTextToCtx(targetCtx, ex - 64, ey + eggH / 2 + 55, `还剩${daysLeft}天`, P.dim, 2);
    return;
  }
  const stage = Math.floor(g.hatchPct / 20);
  for (let py = -eggH / 2; py < eggH / 2; py++) {
    const prog = py / (eggH / 2);
    let w = py < 0 ? Math.floor(eggW / 2 * Math.sqrt(1 - prog * prog * 0.85)) : Math.floor(eggW / 2 * Math.sqrt(1 - prog * prog * 0.95));
    targetCtx.fillStyle = '#f5e6c8';
    targetCtx.fillRect(ex - w, ey + py, w * 2, 1);
  }
  // 花纹
  targetCtx.fillStyle = 'rgba(180, 140, 80, 0.35)';
  const spots = [[-15, -25], [10, -15], [-5, 5], [18, -5], [-20, 10], [12, 20]];
  spots.forEach(([dx, dy]) => {
    const spotW = 5 + Math.abs(dx) % 3;
    targetCtx.fillRect(ex + dx - spotW / 2, ey + dy - spotW / 2, spotW, spotW);
  });
  // 高光
  targetCtx.fillStyle = 'rgba(255, 255, 240, 0.6)';
  targetCtx.fillRect(ex - 12, ey - eggH / 2 + 12, 6, 10);
  // 裂纹
  if (stage >= 1) {
    targetCtx.fillStyle = P.eggCrack;
    targetCtx.fillRect(ex - 8, ey - 18, 6, 8);
    targetCtx.fillRect(ex + 2, ey - 12, 8, 6);
  }
  if (stage >= 2) {
    targetCtx.fillRect(ex - 18, ey, 10, 6);
    targetCtx.fillRect(ex + 8, ey + 6, 8, 8);
    targetCtx.fillRect(ex - 6, ey + 14, 6, 6);
  }
  if (stage >= 3) {
    targetCtx.fillRect(ex - 24, ey - 6, 8, 6);
    targetCtx.fillRect(ex + 14, ey - 10, 6, 12);
    targetCtx.fillRect(ex - 12, ey + 20, 12, 6);
    targetCtx.fillRect(ex + 2, ey - 24, 8, 6);
  }
  if (stage >= 4) {
    targetCtx.fillStyle = P.eggInt;
    targetCtx.fillRect(ex - 14, ey - 10, 28, 32);
  }
  targetCtx.fillStyle = P.barBg;
  targetCtx.fillRect(ex - 40, ey + eggH / 2 + 52, 80, 6);
  targetCtx.fillStyle = g.hatchPct > 80 ? P.happy : (g.hatchPct > 50 ? P.warn : '#aaa');
  targetCtx.fillRect(ex - 40, ey + eggH / 2 + 52, Math.floor(80 * g.hatchPct / 100), 6);
  drawTextToCtx(targetCtx, ex - 50, ey + eggH / 2 + 35, `孵化 ${Math.floor(g.hatchPct)}%`, P.dim, 1.5);
  // daysLeft 已在上方等待分支处理，此路径不会走到
}

export function drawHatchingAnimToCtx(targetCtx) {
  const t = Date.now() / 200;
  const cx = 360, cy = 300;
  targetCtx.fillStyle = P.eggLight;
  for (let i = 0; i < 6; i++) {
    const px = cx - 60 + i * 24 + Math.sin(t + i) * 12;
    const py = cy - 40 + (i % 3) * 20 + Math.floor(t + i) % 20;
    targetCtx.fillRect(Math.floor(px), Math.floor(py), 16, 16);
  }
  const glow = (Math.sin(t * 2) + 1) * 0.5;
  targetCtx.fillStyle = `rgba(255, 200, 100, ${glow * 0.8})`;
  targetCtx.fillRect(cx - 40, cy - 40, 80, 80);
  if (g.hatchAnim > 10) {
    const peek = Math.min(1, (g.hatchAnim - 10) / 20);
    targetCtx.fillStyle = '#FFE4B5';
    targetCtx.fillRect(cx - 30 * peek, cy - 30 * peek, 60 * peek, 60 * peek);
    targetCtx.fillStyle = '#000';
    targetCtx.fillRect(cx - 18, cy - 10, 10, 10);
    targetCtx.fillRect(cx + 8, cy - 10, 10, 10);
    targetCtx.fillStyle = '#fff';
    targetCtx.fillRect(cx - 16, cy - 8, 4, 4);
    targetCtx.fillRect(cx + 10, cy - 8, 4, 4);
  }
}

export function drawHatchingAnim() {
  const t = Date.now() / 200;
  const cx = 360, cy = 300;
  ctx.fillStyle = P.eggLight;
  for (let i = 0; i < 6; i++) {
    const px = cx - 60 + i * 24 + Math.sin(t + i) * 12;
    const py = cy - 40 + (i % 3) * 20 + Math.floor(t + i) % 20;
    ctx.fillRect(Math.floor(px), Math.floor(py), 16, 16);
  }
  const glow = (Math.sin(t * 2) + 1) * 0.5;
  ctx.fillStyle = `rgba(255, 200, 100, ${glow * 0.8})`;
  ctx.fillRect(cx - 40, cy - 40, 80, 80);
  if (g.hatchAnim > 10) {
    const peek = Math.min(1, (g.hatchAnim - 10) / 20);
    ctx.fillStyle = '#FFE4B5';
    ctx.fillRect(cx - 30 * peek, cy - 30 * peek, 60 * peek, 60 * peek);
    ctx.fillStyle = '#000';
    ctx.fillRect(cx - 18, cy - 10, 10, 10);
    ctx.fillRect(cx + 8, cy - 10, 10, 10);
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx - 16, cy - 8, 4, 4);
    ctx.fillRect(cx + 10, cy - 8, 4, 4);
  }
}
