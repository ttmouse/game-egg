import { ctx } from './canvas.js';

export function drawText(text, x, y, color, scale = 1) {
  if (text == null) return;
  ctx.fillStyle = color;
  const fontSize = Math.max(10, Math.floor(14 * scale));
  ctx.font = `${fontSize}px "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif`;
  ctx.textBaseline = 'top';
  ctx.fillText(text, Math.floor(x), Math.floor(y));
}

export function drawTextToCtx(targetCtx, x, y, text, color, scale) {
  if (text == null) return;
  targetCtx.fillStyle = color;
  const fontSize = Math.max(10, Math.floor(14 * scale));
  targetCtx.font = `${fontSize}px "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif`;
  targetCtx.textBaseline = 'top';
  targetCtx.fillText(text, Math.floor(x), Math.floor(y));
}
