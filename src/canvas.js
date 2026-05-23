// Canvas 引用（由 main.js 初始化）
export let canvas = null;
export let ctx = null;

export function initCanvas(c, c2d) {
  canvas = c;
  ctx = c2d;
}
