import { ctx, canvas } from '../canvas.js';
import { g, petSpriteCache, saveGame } from '../state.js';
import { P, STAR_COLORS, GENES, EXP_TABLE } from '../config.js';
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
    drawText(`等待第${g.nextHatchDay}天`, ex - 75, ey + eggH / 2 + 15, P.warn, 2);
    drawText(`(${daysLeft}天后)`, ex - 64, ey + eggH / 2 + 35, P.dim, 2);
    ctx.globalAlpha = 1;
    return;
  }

  const crack = Math.floor(g.hatchPct / 20);
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

  if (crack >= 1) {
    ctx.fillStyle = P.eggCrack;
    ctx.fillRect(ex - 6, ey - 20, 4, 12); ctx.fillRect(ex + 2, ey - 16, 3, 8);
    ctx.fillRect(ex - 8, ey + 5, 5, 10);
    ctx.fillStyle = P.eggShd;
    ctx.fillRect(ex + 1, ey - 18, 2, 6); ctx.fillRect(ex - 6, ey + 8, 3, 4);
  }
  if (crack >= 2) {
    ctx.fillStyle = P.eggCrack;
    ctx.fillRect(ex + 8, ey - 10, 4, 8); ctx.fillRect(ex - 12, ey - 5, 5, 6);
    ctx.fillRect(ex + 5, ey + 15, 3, 7);
  }
  if (crack >= 3) {
    ctx.fillStyle = P.eggCrack;
    ctx.fillRect(ex - 4, ey + 25, 8, 5); ctx.fillRect(ex + 12, ey + 8, 4, 5);
    ctx.fillRect(ex - 18, ey + 12, 4, 4);
  }
  if (crack >= 4) {
    ctx.fillStyle = P.eggCrack;
    ctx.fillRect(ex - 8, ey + 30, 16, 4); ctx.fillRect(ex + 6, ey + 20, 5, 8);
    ctx.fillRect(ex - 4, ey - 24, 8, 4);
  }

  drawText(`孵化 ${Math.floor(g.hatchPct)}%`, ex - 50, ey + eggH / 2 + 8, P.dim, 1.5);
  ctx.fillStyle = P.barBg;
  ctx.fillRect(ex - 40, ey + eggH / 2 + 28, 80, 6);
  ctx.fillStyle = g.hatchPct > 80 ? P.happy : (g.hatchPct > 50 ? P.warn : '#aaa');
  ctx.fillRect(ex - 40, ey + eggH / 2 + 28, Math.floor(80 * g.hatchPct / 100), 6);
}

export function drawEggToCtx(targetCtx) {
  const ex = 360, ey = 230;
  const eggW = 60, eggH = 82;
  if (g.dayCount < g.nextHatchDay) {
    const daysLeft = g.nextHatchDay - g.dayCount;
    drawTextToCtx(targetCtx, ex - 64, ey + eggH / 2 + 30, `等待第${g.nextHatchDay}天`, P.dim, 2);
    return;
  }
  for (let py = -eggH / 2; py < eggH / 2; py++) {
    const prog = py / (eggH / 2);
    let w = py < 0 ? Math.floor(eggW / 2 * Math.sqrt(1 - prog * prog * 0.85)) : Math.floor(eggW / 2 * Math.sqrt(1 - prog * prog * 0.95));
    targetCtx.fillStyle = '#f5e6c8';
    targetCtx.fillRect(ex - w, ey + py, w * 2, 1);
  }
  targetCtx.fillStyle = P.barBg;
  targetCtx.fillRect(ex - 40, ey + eggH / 2 + 8, 80, 6);
  targetCtx.fillStyle = g.hatchPct > 80 ? P.happy : (g.hatchPct > 50 ? P.warn : '#aaa');
  targetCtx.fillRect(ex - 40, ey + eggH / 2 + 8, Math.floor(80 * g.hatchPct / 100), 6);
  drawTextToCtx(targetCtx, ex - 50, ey + eggH / 2 + 20, `孵化 ${Math.floor(g.hatchPct)}%`, P.dim, 1.5);
  if (g.nextHatchDay > 0) {
    const daysLeft = g.nextHatchDay - g.dayCount;
    if (daysLeft > 0) drawTextToCtx(targetCtx, ex - 75, ey + eggH / 2 + 40, `还剩${daysLeft}天`, P.warn, 2);
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
