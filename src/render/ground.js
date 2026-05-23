import { g } from '../state.js';
import { ctx, canvas } from '../canvas.js';
import { OX, OY, CYCLE } from '../config.js';

export function drawIsoGround() {
  if (g.isDay) {
    ctx.fillStyle = '#3d8b37';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#1a4515';
    ctx.fillRect(0, canvas.height - 10, canvas.width, 10);
  } else {
    ctx.fillStyle = '#1f4a1f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0a120a';
    ctx.fillRect(0, canvas.height - 10, canvas.width, 10);
  }
}

export function drawBg() {
  drawIsoGround();
}

export function isoToScreen(col, row) {
  return {
    x: (col - row) * 40 + OX,
    y: (col + row) * 20 + OY,
  };
}

export function screenToIso(sx, sy) {
  const x = sx - OX;
  const y = sy - OY;
  const col = Math.round((x / 40 + y / 20) / 2);
  const row = Math.round((y / 20 - x / 40) / 2);
  return { col, row };
}

// 太阳/月亮渲染（用于场景过渡画布）
export function drawSunMoonToCtx(targetCtx) {
  const isDay = g.isDay;
  const t = g.time;
  if (isDay) {
    const sunX = 100 + (t / CYCLE) * 520;
    const sunY = 80 - Math.sin((t / CYCLE) * Math.PI) * 30;
    targetCtx.fillStyle = '#FFD700';
    targetCtx.beginPath(); targetCtx.arc(sunX, sunY, 22, 0, Math.PI * 2); targetCtx.fill();
    targetCtx.fillStyle = '#FFA500';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + (g.lastTs || Date.now()) / 2000;
      targetCtx.fillRect(sunX + Math.cos(a) * 28 - 1, sunY + Math.sin(a) * 28 - 6, 3, 12);
    }
    if (sunX > 300) {
      const cloudX = sunX - 80, cloudY = sunY - 20;
      targetCtx.fillStyle = 'rgba(255,255,255,0.8)';
      [[cloudX, cloudY, 24], [cloudX + 18, cloudY - 8, 18], [cloudX + 30, cloudY + 2, 16]].forEach(([cx, cy, cr]) => {
        targetCtx.beginPath(); targetCtx.arc(cx, cy, cr, 0, Math.PI * 2); targetCtx.fill();
      });
    }
  } else {
    targetCtx.fillStyle = '#FFFACD';
    targetCtx.beginPath(); targetCtx.arc(620, 70, 28, 0, Math.PI * 2); targetCtx.fill();
    targetCtx.fillStyle = '#E8E4B8';
    [[608, 60, 5], [628, 75, 4], [618, 82, 3], [632, 58, 3]].forEach(([mx, my, mr]) => {
      targetCtx.beginPath(); targetCtx.arc(mx, my, mr, 0, Math.PI * 2); targetCtx.fill();
    });
    targetCtx.strokeStyle = '#D4C896'; targetCtx.lineWidth = 2;
    targetCtx.beginPath(); targetCtx.arc(608, 65, 10, 0, Math.PI * 2); targetCtx.stroke();
  }
}
