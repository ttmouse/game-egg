import { ctx, canvas } from '../canvas.js';
import { g, petSpriteCache, saveGame } from '../state.js';
import { P, STAR_COLORS, GENES, EXP_TABLE, TEMP_OPT_MIN, TEMP_OPT_MAX } from '../config.js';
import { drawIsoGround } from './ground.js';
import { drawText, drawTextToCtx } from '../utils.js';

// ─── Egg & Incubator Drawing ────────────────────────────────────

export function drawIncubator() {
  ctx.save();
  // 等距 3D 孵化器盒子
  // 顶部菱形中心在 iso 网格 col=2, row=1 → (400, 210)
  const cx = 360, cy = 285;
  const hw = 64, hh = 32;
  const bh = 36;

  // ── 右侧面（最暗） ──
  ctx.fillStyle = '#3a1010';
  ctx.beginPath();
  ctx.moveTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx, cy + hh + bh);
  ctx.lineTo(cx + hw, cy + bh);
  ctx.closePath();
  ctx.fill();
  // 右侧面装饰线
  ctx.fillStyle = '#2a0808';
  ctx.fillRect(cx + hw - 16, cy + 8, 2, bh - 4);
  ctx.fillRect(cx + hw - 8, cy + 12, 2, bh - 8);

  // ── 左侧面（中间色） ──
  ctx.fillStyle = '#5a1a1a';
  ctx.beginPath();
  ctx.moveTo(cx - hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx, cy + hh + bh);
  ctx.lineTo(cx - hw, cy + bh);
  ctx.closePath();
  ctx.fill();

  // ── 顶面（最亮） ──
  ctx.fillStyle = P.incBase;
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
  ctx.fill();

  // ── 顶面边框 ──
  ctx.strokeStyle = '#7a3030';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
  ctx.stroke();

  // 顶面内部（暗色，玻璃罩将在外部绘制覆盖蛋）
  ctx.fillStyle = '#4a1515';
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh + 8);
  ctx.lineTo(cx + hw - 12, cy);
  ctx.lineTo(cx, cy + hh - 8);
  ctx.lineTo(cx - hw + 12, cy);
  ctx.closePath();
  ctx.fill();
  // 顶面已在正面面板显示温度，此处不重复

  // ── 顶面 LED 指示灯 ──
  let ledColor = '#444';
  if (g.heatOn && g.power > 0) ledColor = '#FF4500';
  else if (g.iceOn) ledColor = '#00BFFF';
  ctx.fillStyle = ledColor;
  ctx.fillRect(cx - 22, cy - 4, 6, 6);
  if (ledColor !== '#444') {
    ctx.fillStyle = ledColor + '66';
    ctx.fillRect(cx - 26, cy - 8, 14, 14);
  }

  // ── 前侧温度显示（跟随等距透视） ──
  const tempColor = g.temp > 40 ? P.danger : (g.temp < 30 ? '#4FC3F7' : (g.temp >= TEMP_OPT_MIN ? '#4CAF50' : '#FFC107'));
  ctx.save();
  // 平移到左侧面起点，应用剪切变换（每右移1px，Y降0.5px，匹配面斜率）
  ctx.translate(cx - hw + 5, cy + hh - 24);
  ctx.transform(1, 0.5, 0, 1, 0, 0);
  // 卡片背景（在变换空间中为矩形，画布上呈现为平行四边形）
  ctx.fillStyle = '#1a0a0a';
  ctx.fillRect(0, 0, 52, 18);
  ctx.fillStyle = '#2a1010';
  ctx.fillRect(2, 2, 48, 14);
  ctx.fillStyle = tempColor;
  ctx.font = '11px monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText(`🌡${g.temp.toFixed(0)}°C`, 2, 9);
  ctx.restore();
  // 温度单位指示条（同样跟随透视）
  ctx.save();
  ctx.translate(cx - hw + 7, cy + hh - 2);
  ctx.transform(1, 0.5, 0, 1, 0, 0);
  const barW = Math.floor(34 * (g.temp - 20) / 25);
  ctx.fillStyle = tempColor;
  ctx.fillRect(0, 0, Math.max(0, Math.min(34, barW)), 3);
  ctx.restore();

  // ── 加热火焰/冷却冰袋 ──
  if (g.heatOn && g.power > 0) {
    // 暖色灯光：底座内部发出暖光，层积在蛋下面
    const t = Date.now() / 800;
    const glow = 0.4 + Math.sin(t) * 0.2;
    // 顶面内部暖光（蛋的下层）
    ctx.fillStyle = `rgba(255, 200, 80, ${glow})`;
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh + 8);
    ctx.lineTo(cx + hw - 12, cy);
    ctx.lineTo(cx, cy + hh - 8);
    ctx.lineTo(cx - hw + 12, cy);
    ctx.closePath();
    ctx.fill();
  }

  if (g.iceOn) {
    const ix = cx - hw - 20, iy = cy - 10;
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(ix, iy, 18, 36);
    ctx.fillStyle = '#ADD8E6';
    ctx.fillRect(ix + 2, iy + 3, 6, 10);
    ctx.fillStyle = '#E0FFFF';
    ctx.fillRect(ix + 10, iy + 12, 5, 8);
    ctx.fillRect(ix + 2, iy + 26, 7, 7);
    ctx.fillStyle = '#fff';
    ctx.fillRect(ix + 3, iy + 5, 3, 3);
    ctx.fillRect(ix + 13, iy + 8, 3, 3);
    ctx.fillStyle = 'rgba(135, 206, 250, 0.3)';
    ctx.fillRect(ix - 2, iy - 4, 4, 6);
    ctx.fillRect(ix + 8, iy - 6, 4, 6);
  }
  ctx.restore();
}

export function drawIncubatorToCtx(targetCtx) {
  const cx = 360, cy = 285;
  const hw = 64, hh = 32, bh = 36;
  targetCtx.fillStyle = '#3a1010';
  targetCtx.beginPath();
  targetCtx.moveTo(cx + hw, cy);
  targetCtx.lineTo(cx, cy + hh);
  targetCtx.lineTo(cx, cy + hh + bh);
  targetCtx.lineTo(cx + hw, cy + bh);
  targetCtx.closePath();
  targetCtx.fill();
  targetCtx.fillStyle = '#5a1a1a';
  targetCtx.beginPath();
  targetCtx.moveTo(cx - hw, cy);
  targetCtx.lineTo(cx, cy + hh);
  targetCtx.lineTo(cx, cy + hh + bh);
  targetCtx.lineTo(cx - hw, cy + bh);
  targetCtx.closePath();
  targetCtx.fill();
  targetCtx.fillStyle = P.incBase;
  targetCtx.beginPath();
  targetCtx.moveTo(cx, cy - hh);
  targetCtx.lineTo(cx + hw, cy);
  targetCtx.lineTo(cx, cy + hh);
  targetCtx.lineTo(cx - hw, cy);
  targetCtx.closePath();
  targetCtx.fill();
  // 前侧标签已移除
}

export function drawEgg() {
  const ex = 360, ey = 248;
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

  // Draw egg body（优化圆弧：顶部收尖、底部圆润）
  for (let py = -eggH / 2; py < eggH / 2; py++) {
    const prog = py / (eggH / 2);
    const factor = py < 0 ? 0.97 : 0.82;
    const raw = eggW / 2 * Math.sqrt(Math.max(0, 1 - prog * prog * factor));
    let w = Math.round(raw);
    let col;
    if (py < -eggH / 4) col = '#f8f0e0';
    else if (py < 0) col = '#f5e6c8';
    else if (py < eggH / 4) col = '#eed8a8';
    else col = '#e8d098';
    ctx.fillStyle = col;
    ctx.fillRect(ex - w, ey + py, w * 2, 1);
  }
  // 顶部圆弧高光
  ctx.fillStyle = 'rgba(255, 255, 240, 0.15)';
  for (let py = -eggH / 2; py < -eggH / 4; py++) {
    const prog = py / (eggH / 2);
    const w = Math.round(eggW / 2 * Math.sqrt(Math.max(0, 1 - prog * prog * 0.97)));
    ctx.fillRect(ex - w + 4, ey + py, 2, 1);
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

}

export function drawEggToCtx(targetCtx) {
  const ex = 360, ey = 248;
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
    const factor = py < 0 ? 0.97 : 0.82;
    const w = Math.round(eggW / 2 * Math.sqrt(Math.max(0, 1 - prog * prog * factor)));
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

export function drawGlassDome() {
  // 透明方形玻璃罩，层积：底座→蛋→玻璃罩（最上层）
  const cx = 360, cy = 285;     // 底座菱形中心
  const hw = 64, hh = 32;       // 底座半宽/半高
  const cy2 = 208;              // 顶面菱形中心 Y（抬升高度）
  const hw2 = 56, hh2 = 28;     // 顶面半宽/半高（略小于底座，透视效果）

  ctx.save();

  // 渐变：顶部稍深、底部渐透
  const gradR = ctx.createLinearGradient(cx, cy2 - hh2, cx, cy + hh);
  gradR.addColorStop(0, 'rgba(180, 220, 255, 0.12)');
  gradR.addColorStop(0.5, 'rgba(180, 220, 255, 0.06)');
  gradR.addColorStop(1, 'rgba(200, 230, 255, 0.02)');

  const gradL = ctx.createLinearGradient(cx, cy2 - hh2, cx, cy + hh);
  gradL.addColorStop(0, 'rgba(180, 220, 255, 0.10)');
  gradL.addColorStop(0.5, 'rgba(180, 220, 255, 0.05)');
  gradL.addColorStop(1, 'rgba(200, 230, 255, 0.02)');

  // 右侧面
  ctx.fillStyle = gradR;
  ctx.strokeStyle = 'rgba(180, 220, 255, 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx + hw, cy);       // 底座右点
  ctx.lineTo(cx, cy + hh);       // 底座下点
  ctx.lineTo(cx, cy2 + hh2);     // 顶面下点
  ctx.lineTo(cx + hw2, cy2);     // 顶面右点
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 左侧面
  ctx.fillStyle = gradL;
  ctx.beginPath();
  ctx.moveTo(cx - hw, cy);       // 底座左点
  ctx.lineTo(cx, cy + hh);       // 底座下点
  ctx.lineTo(cx, cy2 + hh2);     // 顶面下点
  ctx.lineTo(cx - hw2, cy2);     // 顶面左点
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 顶面
  const gradT = ctx.createLinearGradient(cx, cy2 - hh2, cx, cy2 + hh2);
  gradT.addColorStop(0, 'rgba(180, 220, 255, 0.15)');
  gradT.addColorStop(0.5, 'rgba(180, 220, 255, 0.05)');
  gradT.addColorStop(1, 'rgba(180, 220, 255, 0.10)');
  ctx.fillStyle = gradT;
  ctx.beginPath();
  ctx.moveTo(cx, cy2 - hh2);
  ctx.lineTo(cx + hw2, cy2);
  ctx.lineTo(cx, cy2 + hh2);
  ctx.lineTo(cx - hw2, cy2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // ── 顶面黑色方框边框 ──
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy2 - hh2 + 3);
  ctx.lineTo(cx + hw2 - 3, cy2);
  ctx.lineTo(cx, cy2 + hh2 - 3);
  ctx.lineTo(cx - hw2 + 3, cy2);
  ctx.closePath();
  ctx.stroke();

  // ── 棱边加强（立体感） ──
  ctx.strokeStyle = 'rgba(200, 230, 255, 0.25)';
  ctx.lineWidth = 1;
  // 前中竖棱
  ctx.beginPath();
  ctx.moveTo(cx, cy + hh);
  ctx.lineTo(cx, cy2 + hh2);
  ctx.stroke();
  // 左前竖棱
  ctx.beginPath();
  ctx.moveTo(cx - hw, cy);
  ctx.lineTo(cx - hw2, cy2);
  ctx.stroke();
  // 右前竖棱
  ctx.beginPath();
  ctx.moveTo(cx + hw, cy);
  ctx.lineTo(cx + hw2, cy2);
  ctx.stroke();
  // 背面竖棱（上部清晰，越往下越淡，像消失在背景中）
  const backGrad = ctx.createLinearGradient(cx, cy2 - hh2, cx, cy2 - hh2 + 55);
  backGrad.addColorStop(0, 'rgba(180, 220, 255, 0.14)');
  backGrad.addColorStop(0.5, 'rgba(180, 220, 255, 0.06)');
  backGrad.addColorStop(1, 'rgba(180, 220, 255, 0)');
  ctx.strokeStyle = backGrad;
  ctx.beginPath();
  ctx.moveTo(cx, cy2 - hh2 + 55);
  ctx.lineTo(cx, cy2 - hh2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(200, 230, 255, 0.25)';
  // 左上斜棱（顶面左前棱）
  ctx.beginPath();
  ctx.moveTo(cx - hw2, cy2);
  ctx.lineTo(cx, cy2 + hh2);
  ctx.stroke();
  // 右上斜棱（顶面右前棱）
  ctx.beginPath();
  ctx.moveTo(cx + hw2, cy2);
  ctx.lineTo(cx, cy2 + hh2);
  ctx.stroke();
  // 底座左前棱
  ctx.beginPath();
  ctx.moveTo(cx - hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.stroke();
  // 底座右前棱
  ctx.beginPath();
  ctx.moveTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.stroke();

  ctx.restore();
}
