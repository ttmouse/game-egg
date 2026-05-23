import { init } from './game.js';

// 等待 DOM 加载后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}

function start() {
  const canvas = document.getElementById('c');
  if (!canvas) { console.error('Canvas not found'); return; }
  canvas.width = 720;
  canvas.height = 576;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  init(canvas, ctx);
}
