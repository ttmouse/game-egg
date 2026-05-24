import { GENES } from '../config.js';

export function drawPetSprite(canvas, pet, animTime, speedFactor = 0, walkPhase = 0) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 48, 48);

  const t = animTime || 0;
  const breathe = Math.sin(t * 2.5) * 1.5;
  const tailSwing = Math.sin(t * 3.5) * 2;
  const earWiggle = Math.sin(t * 5) * 1.5;
  const blinkCycle = t % 4;
  const isBlinking = blinkCycle > 3.85;

  const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h*31 + s.charCodeAt(i)) & 0xFFFF; return h; };
  const h = hash(pet.name);
  const petType = h % 8;
  const hue = (h * 7) % 360;

  let geneHue = hue, geneSat = 55;
  if (pet.genes && pet.genes.length > 0) {
    const geneHues = pet.genes.map(gk => {
      if (gk === 'fire') return 15; if (gk === 'water') return 210; if (gk === 'grass') return 120;
      if (gk === 'electric') return 50; if (gk === 'ice') return 190; if (gk === 'dark') return 270;
      if (gk === 'light') return 50; if (gk === 'wind') return 150; if (gk === 'earth') return 35;
      if (gk === 'metal') return 200; return 0;
    });
    geneHue = geneHues[0];
    if (pet.genes.length > 1) geneSat = 70;
  }

  const bodyColor = `hsl(${geneHue},${geneSat}%,55%)`;
  const darkColor = `hsl(${geneHue},${geneSat}%,35%)`;
  const lightColor = `hsl(${geneHue},${geneSat}%,75%)`;
  const bodySway = speedFactor > 0.1 ? Math.sin(walkPhase) * speedFactor * 0.6 : 0;
  const walkLift = speedFactor > 0.1 ? Math.sin(walkPhase) * 1.8 : 0;
  const cx = 24 + bodySway, cy = 26 + breathe;
  const tailOff = Math.round(tailSwing);

  // ─── 尾巴 ───
  if (petType === 0) { // 猫
    ctx.fillStyle = bodyColor;
    ctx.fillRect(cx + 10 + tailOff, cy + 2, 4, 6);
    ctx.fillRect(cx + 12 + tailOff, cy - 2, 4, 6);
    ctx.fillRect(cx + 14 + tailOff, cy - 6, 3, 5);
    ctx.fillStyle = lightColor;
    ctx.fillRect(cx + 15 + tailOff, cy - 4, 2, 3);
  } else if (petType === 1) { // 狗
    ctx.fillStyle = bodyColor;
    ctx.fillRect(cx + 8 + tailOff, cy - 2, 5, 4);
    ctx.fillRect(cx + 11 + tailOff, cy - 5, 4, 4);
    ctx.fillStyle = lightColor; ctx.fillRect(cx + 13 + tailOff, cy - 4, 2, 3);
  } else if (petType === 2) { // 兔子
    ctx.fillStyle = '#fff'; ctx.fillRect(cx + 10 + tailOff, cy + 6, 6, 6);
    ctx.fillStyle = bodyColor; ctx.fillRect(cx + 11 + tailOff, cy + 7, 4, 4);
  } else if (petType === 3) { // 狐狸
    ctx.fillStyle = bodyColor;
    ctx.fillRect(cx + 8 + tailOff, cy, 6, 8); ctx.fillRect(cx + 12 + tailOff, cy - 4, 6, 6);
    ctx.fillRect(cx + 16 + tailOff, cy - 8, 4, 6);
    ctx.fillStyle = lightColor; ctx.fillRect(cx + 18 + tailOff, cy - 6, 3, 4);
    ctx.fillStyle = '#fff'; ctx.fillRect(cx + 17 + tailOff, cy - 4, 2, 3);
  } else if (petType === 4) { // 鼠
    ctx.fillStyle = bodyColor;
    ctx.fillRect(cx + 10 + tailOff * 2, cy + 3, 2, 8);
    ctx.fillRect(cx + 12 + tailOff * 2, cy + 1, 2, 6);
    ctx.fillStyle = lightColor; ctx.fillRect(cx + 14 + tailOff * 2, cy + 1, 1, 4);
  } else if (petType === 5) { // 龙
    ctx.fillStyle = bodyColor;
    ctx.fillRect(cx + 10 + tailOff, cy + 2, 4, 8); ctx.fillRect(cx + 12 + tailOff, cy - 2, 4, 6);
    ctx.fillStyle = lightColor; ctx.fillRect(cx + 14 + tailOff, cy - 4, 3, 5); ctx.fillRect(cx + 15 + tailOff, cy - 5, 2, 2);
    ctx.fillStyle = darkColor; ctx.fillRect(cx + 16 + tailOff, cy - 6, 2, 3);
  } else if (petType === 6) { // 鸟
    ctx.fillStyle = bodyColor;
    ctx.fillRect(cx + 14, cy + 2, 4, 6); ctx.fillRect(cx + 16, cy + 1, 4, 5); ctx.fillRect(cx + 18, cy, 3, 5);
    ctx.fillStyle = lightColor; ctx.fillRect(cx + 17, cy + 2, 2, 3);
  } else { // 熊
    ctx.fillStyle = darkColor; ctx.fillRect(cx + 10 + tailOff, cy + 4, 6, 5);
    ctx.fillStyle = bodyColor; ctx.fillRect(cx + 11 + tailOff, cy + 5, 4, 3);
  }

  // ─── 身体 ───
  const bodyFns = [
    () => { for (let y = -10; y <= 10; y++) { const w = Math.floor(10 * (1 - y*y/110)); ctx.fillStyle = bodyColor; ctx.fillRect(cx-w, cy+y, w*2, 1); } ctx.fillStyle = lightColor; ctx.fillRect(cx-4, cy+2, 8, 5); },
    () => { for (let y = -10; y <= 10; y++) { const w = Math.floor(11 * (1 - y*y/115)); ctx.fillStyle = bodyColor; ctx.fillRect(cx-w, cy+y, w*2, 1); } ctx.fillStyle = lightColor; ctx.fillRect(cx-5, cy+3, 10, 5); },
    () => { for (let y = -11; y <= 11; y++) { const w = Math.floor(12 * (1 - y*y/130)); ctx.fillStyle = bodyColor; ctx.fillRect(cx-w, cy+y, w*2, 1); } ctx.fillStyle = lightColor; ctx.fillRect(cx-5, cy+4, 10, 5); },
    () => { for (let y = -10; y <= 10; y++) { const w = Math.floor(10 * (1 - y*y/115)); ctx.fillStyle = bodyColor; ctx.fillRect(cx-w, cy+y, w*2, 1); } ctx.fillStyle = lightColor; ctx.fillRect(cx-4, cy+2, 8, 6); },
    () => { for (let y = -7; y <= 7; y++) { const w = Math.floor(7 * (1 - y*y/55)); ctx.fillStyle = bodyColor; ctx.fillRect(cx-w, cy+y, w*2, 1); } ctx.fillStyle = lightColor; ctx.fillRect(cx-3, cy+2, 6, 4); },
    () => { for (let y = -9; y <= 9; y++) { const w = Math.floor(12 * (1 - y*y/90)); ctx.fillStyle = bodyColor; ctx.fillRect(cx-w, cy+y, w*2, 1); } ctx.fillStyle = lightColor; ctx.fillRect(cx-5, cy+2, 10, 5); ctx.fillStyle = darkColor; ctx.fillRect(cx-2, cy-4, 4, 2); ctx.fillRect(cx-4, cy, 4, 2); ctx.fillRect(cx, cy+4, 4, 2); },
    () => { for (let y = -8; y <= 9; y++) { const w = Math.floor(7 * (1 - y*y/80)); ctx.fillStyle = bodyColor; ctx.fillRect(cx-w, cy+y, w*2, 1); } ctx.fillStyle = lightColor; ctx.fillRect(cx-3, cy+2, 6, 5); },
    () => { for (let y = -12; y <= 12; y++) { const w = Math.floor(13 * (1 - y*y/160)); ctx.fillStyle = bodyColor; ctx.fillRect(cx-w, cy+y, w*2, 1); } ctx.fillStyle = lightColor; ctx.fillRect(cx-5, cy+3, 10, 6); },
  ];
  bodyFns[petType]();

  // ─── 手 ───
  const handFns = [
    () => { ctx.fillStyle = darkColor; ctx.fillRect(cx-13, cy+4, 4, 6); ctx.fillRect(cx+9, cy+4, 4, 6); },
    () => { ctx.fillStyle = darkColor; ctx.fillRect(cx-13, cy+4, 4, 6); ctx.fillRect(cx+9, cy+4, 4, 6); },
    () => { ctx.fillStyle = darkColor; ctx.fillRect(cx-14, cy+2, 5, 5); ctx.fillRect(cx+9, cy+2, 5, 5); },
    () => { ctx.fillStyle = darkColor; ctx.fillRect(cx-13, cy+4, 4, 6); ctx.fillRect(cx+9, cy+4, 4, 6); },
    () => { ctx.fillStyle = darkColor; ctx.fillRect(cx-10, cy+3, 3, 4); ctx.fillRect(cx+7, cy+3, 3, 4); },
    () => { ctx.fillStyle = darkColor; ctx.fillRect(cx-15, cy+3, 5, 5); ctx.fillRect(cx+10, cy+3, 5, 5); ctx.fillStyle = lightColor; ctx.fillRect(cx-14, cy+5, 2, 1); ctx.fillRect(cx+13, cy+5, 2, 1); },
    () => { ctx.fillStyle = bodyColor; ctx.fillRect(cx-13, cy-2, 4, 6); ctx.fillRect(cx+9, cy-2, 4, 6); ctx.fillStyle = lightColor; ctx.fillRect(cx-12, cy-1, 2, 4); ctx.fillRect(cx+10, cy-1, 2, 4); },
    () => { ctx.fillStyle = darkColor; ctx.fillRect(cx-15, cy+2, 6, 6); ctx.fillRect(cx+9, cy+2, 6, 6); ctx.fillStyle = lightColor; ctx.fillRect(cx-13, cy+4, 2, 2); ctx.fillRect(cx+12, cy+4, 2, 2); },
  ];
  handFns[petType]();

  // ─── 脚 ───
  const footFns = [
    () => { ctx.fillStyle = darkColor; ctx.fillRect(cx-8, cy+10 - walkLift, 5, 4); ctx.fillRect(cx+3, cy+10 + walkLift, 5, 4); },
    () => { ctx.fillStyle = darkColor; ctx.fillRect(cx-8, cy+10 - walkLift, 5, 4); ctx.fillRect(cx+3, cy+10 + walkLift, 5, 4); },
    () => { ctx.fillStyle = darkColor; ctx.fillRect(cx-9, cy+10 - walkLift, 7, 5); ctx.fillRect(cx+2, cy+10 + walkLift, 7, 5); },
    () => { ctx.fillStyle = darkColor; ctx.fillRect(cx-8, cy+10 - walkLift, 5, 4); ctx.fillRect(cx+3, cy+10 + walkLift, 5, 4); },
    () => { ctx.fillStyle = darkColor; ctx.fillRect(cx-6, cy+10 - walkLift, 4, 3); ctx.fillRect(cx+2, cy+10 + walkLift, 4, 3); },
    () => { ctx.fillStyle = darkColor; ctx.fillRect(cx-9, cy+10 - walkLift, 6, 4); ctx.fillRect(cx+3, cy+10 + walkLift, 6, 4); ctx.fillStyle = lightColor; ctx.fillRect(cx-8, cy+11 - walkLift, 2, 1); ctx.fillRect(cx+6, cy+11 + walkLift, 2, 1); },
    () => { ctx.fillStyle = darkColor; ctx.fillRect(cx-6, cy+11 - walkLift, 3, 3); ctx.fillRect(cx+3, cy+11 + walkLift, 3, 3); },
    () => { ctx.fillStyle = darkColor; ctx.fillRect(cx-10, cy+10 - walkLift, 8, 5); ctx.fillRect(cx+2, cy+10 + walkLift, 8, 5); ctx.fillStyle = lightColor; ctx.fillRect(cx-8, cy+12 - walkLift, 4, 2); ctx.fillRect(cx+4, cy+12 + walkLift, 4, 2); },
  ];
  footFns[petType]();

  // ─── 头 ───
  const headY = cy - 12;
  const headFns = [
    () => { // 猫
      for (let y = -8; y <= 6; y++) { const w = Math.floor(10 * (1 - y*y/70)); ctx.fillStyle = bodyColor; ctx.fillRect(cx-w, headY+y, w*2, 1); }
      ctx.fillStyle = bodyColor; ctx.fillRect(cx-12, headY-6, 5, 8); ctx.fillRect(cx-9, headY-10, 4, 5);
      ctx.fillRect(cx+7, headY-6, 5, 8); ctx.fillRect(cx+5, headY-10, 4, 5);
      ctx.fillStyle = '#FFB6C1'; ctx.fillRect(cx-11, headY-4, 3, 4); ctx.fillRect(cx+8, headY-4, 3, 4);
    },
    () => { // 狗
      for (let y = -8; y <= 6; y++) { const w = Math.floor(10 * (1 - y*y/70)); ctx.fillStyle = bodyColor; ctx.fillRect(cx-w, headY+y, w*2, 1); }
      ctx.fillStyle = darkColor; ctx.fillRect(cx-13, headY-2, 6, 10); ctx.fillRect(cx+7, headY-2, 6, 10);
      ctx.fillStyle = '#FFB6C1'; ctx.fillRect(cx-12, headY, 4, 6); ctx.fillRect(cx+8, headY, 4, 6);
    },
    () => { // 兔
      for (let y = -7; y <= 6; y++) { const w = Math.floor(10 * (1 - y*y/60)); ctx.fillStyle = bodyColor; ctx.fillRect(cx-w, headY+y, w*2, 1); }
      const earOff = Math.round(earWiggle);
      ctx.fillStyle = bodyColor; ctx.fillRect(cx-10+earOff, headY-20, 4, 18); ctx.fillRect(cx+6-earOff, headY-20, 4, 18);
      ctx.fillStyle = '#FFB6C1'; ctx.fillRect(cx-9+earOff, headY-18, 2, 14); ctx.fillRect(cx+7-earOff, headY-18, 2, 14);
    },
    () => { // 狐
      for (let y = -8; y <= 5; y++) { const w = Math.floor(9 * (1 - y*y/75)); ctx.fillStyle = bodyColor; ctx.fillRect(cx-w, headY+y, w*2, 1); }
      ctx.fillStyle = bodyColor; ctx.fillRect(cx-12, headY-8, 5, 10); ctx.fillRect(cx-9, headY-12, 4, 5);
      ctx.fillRect(cx+7, headY-8, 5, 10); ctx.fillRect(cx+5, headY-12, 4, 5);
      ctx.fillStyle = darkColor; ctx.fillRect(cx-11, headY-6, 3, 6); ctx.fillRect(cx+8, headY-6, 3, 6);
    },
    () => { // 鼠
      for (let y = -6; y <= 5; y++) { const w = Math.floor(7 * (1 - y*y/40)); ctx.fillStyle = bodyColor; ctx.fillRect(cx-w, headY+y, w*2, 1); }
      ctx.fillStyle = bodyColor; ctx.fillRect(cx-12, headY-4, 6, 8); ctx.fillRect(cx+6, headY-4, 6, 8);
      ctx.fillStyle = '#FFB6C1'; ctx.fillRect(cx-11, headY-2, 4, 5); ctx.fillRect(cx+7, headY-2, 4, 5);
      ctx.fillStyle = darkColor; ctx.fillRect(cx-15, headY+2, 4, 1); ctx.fillRect(cx-15, headY+4, 6, 1);
      ctx.fillRect(cx+11, headY+2, 4, 1); ctx.fillRect(cx+9, headY+4, 6, 1);
    },
    () => { // 龙
      for (let y = -7; y <= 6; y++) { const w = Math.floor(10 * (1 - y*y/55)); ctx.fillStyle = bodyColor; ctx.fillRect(cx-w, headY+y, w*2, 1); }
      ctx.fillStyle = darkColor; ctx.fillRect(cx-11, headY-12, 3, 10); ctx.fillRect(cx+8, headY-12, 3, 10);
      ctx.fillStyle = lightColor; ctx.fillRect(cx-10, headY-10, 2, 6); ctx.fillRect(cx+8, headY-10, 2, 6);
      ctx.fillStyle = bodyColor; ctx.fillRect(cx-18, headY-2, 5, 4); ctx.fillRect(cx-20, headY-4, 3, 3);
      ctx.fillRect(cx+13, headY-2, 5, 4); ctx.fillRect(cx+17, headY-4, 3, 3);
    },
    () => { // 鸟
      for (let y = -6; y <= 5; y++) { const w = Math.floor(8 * (1 - y*y/45)); ctx.fillStyle = bodyColor; ctx.fillRect(cx-w, headY+y, w*2, 1); }
      ctx.fillStyle = bodyColor; ctx.fillRect(cx-1, headY-10, 3, 6); ctx.fillRect(cx+1, headY-12, 2, 5);
      ctx.fillStyle = lightColor; ctx.fillRect(cx, headY-9, 1, 4);
      ctx.fillStyle = '#FFA500'; ctx.fillRect(cx+8, headY+1, 4, 3); ctx.fillRect(cx+10, headY+2, 2, 1);
    },
    () => { // 熊
      for (let y = -8; y <= 7; y++) { const w = Math.floor(11 * (1 - y*y/75)); ctx.fillStyle = bodyColor; ctx.fillRect(cx-w, headY+y, w*2, 1); }
      ctx.fillStyle = darkColor; ctx.fillRect(cx-11, headY-6, 5, 5); ctx.fillRect(cx+6, headY-6, 5, 5);
      ctx.fillStyle = '#FFB6C1'; ctx.fillRect(cx-10, headY-5, 3, 3); ctx.fillRect(cx+7, headY-5, 3, 3);
    },
  ];
  headFns[petType]();

  // ─── 眼睛 ───
  const mood = pet.petMood || 'normal';
  if (isBlinking) {
    ctx.fillStyle = '#222'; ctx.fillRect(cx-7, headY-1, 6, 2); ctx.fillRect(cx+1, headY-1, 6, 2);
  } else if (mood === 'happy') {
    ctx.fillStyle = '#222'; ctx.fillRect(cx-8, headY-2, 6, 3); ctx.fillRect(cx+2, headY-2, 6, 3);
    ctx.fillStyle = '#90EE90'; ctx.fillRect(cx-8, headY-2, 6, 3); ctx.fillRect(cx+2, headY-2, 6, 3);
    ctx.fillStyle = '#222'; ctx.fillRect(cx-6, headY, 4, 2); ctx.fillRect(cx+2, headY, 4, 2);
    ctx.fillRect(cx-8, headY+1, 2, 1); ctx.fillRect(cx+6, headY+1, 2, 1);
  } else {
    if (petType === 0) {
      // 猫 — 小圆绿眼
      ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(cx-6, headY, 4, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx+6, headY, 4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#7CFC00'; ctx.beginPath(); ctx.arc(cx-6, headY, 3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx+6, headY, 3, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(cx-6, headY+0.5, 2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx+6, headY+0.5, 2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(cx-5, headY-1, 1.3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx+7, headY-1, 1.3, 0, Math.PI*2); ctx.fill();
    } else if (petType === 1) {
      // 狗 — 圆棕眼
      ctx.fillStyle = '#3E2723'; ctx.beginPath(); ctx.arc(cx-6, headY, 4, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx+6, headY, 4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(cx-6, headY, 2.5, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx+6, headY, 2.5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(cx-5, headY-1, 1.2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx+7, headY-1, 1.2, 0, Math.PI*2); ctx.fill();
    } else if (petType === 2) {
      // 兔 — 大红方眼
      ctx.fillRect(cx-7, headY-2, 6, 6); ctx.fillRect(cx+1, headY-2, 6, 6);
      ctx.fillStyle = '#FF4444'; ctx.fillRect(cx-7, headY-2, 6, 6); ctx.fillRect(cx+1, headY-2, 6, 6);
      ctx.fillStyle = '#800'; ctx.fillRect(cx-6, headY-1, 2, 2); ctx.fillRect(cx+2, headY-1, 2, 2);
    } else if (petType === 3) {
      // 狐 — 细长眯眼
      ctx.fillStyle = '#222'; ctx.fillRect(cx-9, headY-1, 6, 2); ctx.fillRect(cx+3, headY-1, 6, 2);
      ctx.fillStyle = '#fff'; ctx.fillRect(cx-8, headY, 2, 1); ctx.fillRect(cx+6, headY, 2, 1);
    } else if (petType === 4) {
      // 鼠 — 小黑点眼
      ctx.fillStyle = '#111'; ctx.fillRect(cx-5, headY, 3, 3); ctx.fillRect(cx+2, headY, 3, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(cx-4, headY, 1, 1); ctx.fillRect(cx+3, headY, 1, 1);
    } else if (petType === 5) {
      // 龙 — 竖瞳爬行眼
      ctx.fillStyle = '#FF8C00'; ctx.fillRect(cx-8, headY-2, 5, 6); ctx.fillRect(cx+3, headY-2, 5, 6);
      ctx.fillStyle = '#111'; ctx.fillRect(cx-7, headY-1, 3, 4); ctx.fillRect(cx+4, headY-1, 3, 4);
      ctx.fillStyle = '#fff'; ctx.fillRect(cx-6, headY-3, 1, 1); ctx.fillRect(cx+5, headY-3, 1, 1);
    } else if (petType === 6) {
      // 鸟 — 小圆珠眼
      ctx.fillStyle = '#222'; ctx.fillRect(cx-5, headY-1, 3, 4); ctx.fillRect(cx+2, headY-1, 3, 4);
      ctx.fillStyle = '#fff'; ctx.fillRect(cx-4, headY-1, 1, 1); ctx.fillRect(cx+3, headY-1, 1, 1);
    } else {
      // 熊 — 小圆点眼
      ctx.fillStyle = '#111'; ctx.fillRect(cx-5, headY, 3, 3); ctx.fillRect(cx+2, headY, 3, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(cx-4, headY, 1, 1); ctx.fillRect(cx+3, headY, 1, 1);
    }
  }

  // ─── 鼻子/嘴 ───
  if (petType === 5) {
    ctx.fillStyle = darkColor; ctx.fillRect(cx-2, headY+3, 4, 3);
    ctx.fillRect(cx-8, headY+5, 4, 2); ctx.fillRect(cx+4, headY+5, 4, 2);
    ctx.fillStyle = '#FFB6C1'; ctx.fillRect(cx-1, headY+6, 2, 2);
  } else if (petType === 7) {
    ctx.fillStyle = '#222'; ctx.fillRect(cx-2, headY+3, 4, 3);
    ctx.fillStyle = lightColor; ctx.fillRect(cx-1, headY+4, 2, 1);
  } else if (petType === 4) {
    ctx.fillStyle = '#FFB6C1'; ctx.fillRect(cx-1, headY+4, 2, 2);
    ctx.fillStyle = darkColor; ctx.fillRect(cx-2, headY+6, 1, 2); ctx.fillRect(cx+1, headY+6, 1, 2);
  } else {
    ctx.fillStyle = '#FFB6C1'; ctx.fillRect(cx-1, headY+4, 2, 2);
  }

  // 腮红
  ctx.fillStyle = 'rgba(255,182,193,0.5)';
  ctx.fillRect(cx-11, headY+1, 3, 2); ctx.fillRect(cx+8, headY+1, 3, 2);
}
