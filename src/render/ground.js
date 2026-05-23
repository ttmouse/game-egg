import { g } from '../state.js';
import { OX, OY } from '../config.js';

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
