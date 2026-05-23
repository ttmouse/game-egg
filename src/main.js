import { init } from './game.js';

// 等待 DOM 加载后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}

function fitCanvas(canvas) {
  const wrap = document.getElementById('wrap');
  const btns = document.getElementById('btns');
  if (!wrap || !btns) return;
  const wrapW = wrap.clientWidth;
  const wrapH = wrap.clientHeight;
  const btnH = btns.offsetHeight || 60;
  const availW = wrapW - 8;
  const availH = wrapH - btnH - 12;
  const ratio = 720 / 576;
  let w, h;
  if (availW / availH > ratio) {
    h = availH;
    w = h * ratio;
  } else {
    w = availW;
    h = w / ratio;
  }
  canvas.style.width = Math.floor(w) + 'px';
  canvas.style.height = Math.floor(h) + 'px';
}

function start() {
  const canvas = document.getElementById('c');
  if (!canvas) { console.error('Canvas not found'); return; }
  const dpr = window.devicePixelRatio || 1;
  canvas.width = 720 * dpr;
  canvas.height = 576 * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.imageSmoothingEnabled = false;
  fitCanvas(canvas);
  window.addEventListener('resize', () => fitCanvas(canvas));
  init(canvas, ctx);
}
