import { g, saveGame, loadRawSave, initTransCanvases, transOldCtx, transNewCtx, transOldCanvas, transNewCanvas } from './state.js';
import { ctx, canvas, initCanvas } from './canvas.js';
import {
  DAY_SEC, NGT_SEC, CYCLE, TEMP_MIN, TEMP_MAX, TEMP_OPT_MIN, TEMP_OPT_MAX,
  POWER_MAX, HEAT_DRAIN, POWER_DAY_REGEN, POWER_NGT_REGEN, HATCH_RATE, HATCH_RATE_COLD, HATCH_RATE_HOT,
  PET_COOLDOWN, FEED_COOLDOWN, FORAGE_COOLDOWN, INV_MAX, PET_MAX,
  ISO_COLS, ISO_ROWS, TILE_W, TILE_H, OX, OY, CONTENT_OFFSET,
  GENES, TOOLS, SKILLS, STAR_COLORS, EXP_TABLE, P,
  PET_TYPE_NAMES, PET_EMOJI, FOOD_GAINS, FOOD_HATCH_GAINS,
} from './config.js';
import { initAudio, playSound, soundSynth } from './audio.js';
import { drawText, drawTextToCtx } from './utils.js';
import { drawIsoGround, isoToScreen, screenToIso } from './render/ground.js';
import { drawIncubator, drawIncubatorToCtx, drawEgg, drawEggToCtx, drawHatchingAnim } from './render/egg.js';
import { drawPetSprite } from './render/pet_sprite.js';

// ═══════════════════════════════════════════════════════════════════
// 渲染函数
// ═══════════════════════════════════════════════════════════════════

// ─── 太阳/月亮 ───
function drawSunMoon() {
  // Simplified - just draw a static sun icon
  const sx = 640 + CONTENT_OFFSET, sy = 60;
  ctx.fillStyle = 'rgba(255,200,80,0.15)';
  ctx.fillRect(sx - 40, sy - 40, 80, 80);
  ctx.fillStyle = '#FFD700';
  ctx.fillRect(sx - 24, sy - 24, 48, 48);
  ctx.fillStyle = '#FFFACD';
  ctx.fillRect(sx - 18, sy - 18, 36, 36);
}

// ─── 绘制宠物 ───
function drawPet(pet, x, y, options = {}) {
  if (!pet) return;
  const basePx = x, basePy = y;
  let scale = 1.33;
  const isDragging = options.isDragging || false;
  const clickReaction = options.clickReaction || null;
  const petMood = options.petMood || 'normal';
  const moodBubble = options.moodBubble || { show: false };

  if (isDragging) scale = 1.33 * 1.15;
  let offsetY = 0;
  if (clickReaction) {
    const tm = clickReaction.time;
    const type = clickReaction.type;
    if (type === 'jump') offsetY = -Math.sin(tm * Math.PI) * 30;
    else if (type === 'bounce') {
      const bounce = Math.abs(Math.sin(tm * Math.PI * 3)) * (1 - tm);
      offsetY = -bounce * 20;
    } else if (type === 'spin') scale = 1.33 * (1 + Math.sin(tm * Math.PI * 4) * 0.1);
    else if (type === 'heart') offsetY = Math.sin(tm * Math.PI * 4) * 5;
  }

  // Shadow
  if (!isDragging) {
    const shadowW = 50 * scale * 0.5;
    const shadowH = 8 * scale * 0.5;
    const shadowY = basePy + 20;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(basePx, shadowY, shadowW, shadowH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  let walkBob = 0;
  if (pet.wanderTarget) walkBob = Math.sin(g.lastTs / 120) * 2;

  const petCanvas = document.createElement('canvas');
  petCanvas.width = 48;
  petCanvas.height = 48;
  drawPetSprite(petCanvas, pet, g.lastTs / 1000);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(petCanvas, basePx - 24 * scale, basePy - 24 * scale + offsetY + walkBob, 48 * scale, 48 * scale);
  ctx.restore();

  // Mood bubble
  if (moodBubble.show) {
    const bubbleX = basePx + 30, bubbleY = basePy - 45;
    const bw = 80, bh = 24, r = 8;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.roundRect(bubbleX - bw/2, bubbleY - bh/2, bw, bh, r);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bubbleX - 6, bubbleY + bh/2 - 2);
    ctx.lineTo(bubbleX, bubbleY + bh/2 + 8);
    ctx.lineTo(bubbleX + 6, bubbleY + bh/2 - 2);
    ctx.closePath();
    ctx.fill();
    const bubbleText = moodBubble.text || '摸摸我~';
    drawText(bubbleText, bubbleX - 32, bubbleY - 10, '#FF69B4', 1);
  }

  // Labels above pet
  drawText(pet.name, basePx - 25, basePy - 48, STAR_COLORS[pet.star] || '#aaa', 1);
  const geneStr = (pet.genes || []).map(gk => (GENES[gk] || {}).icon || '').join('');
  const extra = geneStr ? ` ${geneStr}` : '';
  drawText(`${pet.star}★ Lv${pet.level}${extra}`, basePx - 25, basePy - 70, '#aaa', 0.5);

  // Hunger warning
  if (g.hunger < 30) drawText('饿了!', basePx + 45, basePy - 20, P.danger, 1.5);

  // Exp bar
  const expNext = EXP_TABLE[pet.level] || EXP_TABLE[10];
  const expCur = pet.level > 1 ? EXP_TABLE[pet.level - 1] : 0;
  const expProg = Math.max(0, Math.min(1, (pet.exp - expCur) / (expNext - expCur)));
  const barW = 50;
  ctx.fillStyle = P.barBg;
  ctx.fillRect(basePx - barW / 2, basePy - 56, barW, 4);
  ctx.fillStyle = '#90EE90';
  ctx.fillRect(basePx - barW / 2, basePy - 56, Math.floor(barW * expProg), 4);
}

function drawPetToCtx(targetCtx, pet, x, y, options = {}) {
  if (!pet) return;
  const basePx = x, basePy = y;
  const scale = 1.33;
  const isDragging = options.isDragging || false;
  const moodBubble = options.moodBubble || { show: false };

  // Shadow
  if (!isDragging) {
    const shadowW = 50 * scale * 0.5;
    const shadowH = 8 * scale * 0.5;
    const shadowY = basePy + 20;
    targetCtx.save();
    targetCtx.fillStyle = 'rgba(0,0,0,0.15)';
    targetCtx.beginPath();
    targetCtx.ellipse(basePx, shadowY, shadowW, shadowH, 0, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.restore();
  }

  const petCanvas = document.createElement('canvas');
  petCanvas.width = 48;
  petCanvas.height = 48;
  drawPetSprite(petCanvas, pet, g.lastTs / 1000);

  targetCtx.save();
  targetCtx.imageSmoothingEnabled = false;
  targetCtx.drawImage(petCanvas, basePx - 24 * scale, basePy - 24 * scale, 48 * scale, 48 * scale);
  targetCtx.restore();

  // Labels
  drawTextToCtx(targetCtx, basePx - 25, basePy - 48, pet.name, STAR_COLORS[pet.star] || '#aaa', 1);
  const geneStr = (pet.genes || []).map(gk => (GENES[gk] || {}).icon || '').join('');
  const extra = geneStr ? ` ${geneStr}` : '';
  drawTextToCtx(targetCtx, basePx - 25, basePy - 70, `${pet.star}★ Lv${pet.level}${extra}`, '#aaa', 0.5);

  const expNext = EXP_TABLE[pet.level] || EXP_TABLE[10];
  const expCur = pet.level > 1 ? EXP_TABLE[pet.level - 1] : 0;
  const expProg = Math.max(0, Math.min(1, (pet.exp - expCur) / (expNext - expCur)));
  targetCtx.fillStyle = P.barBg;
  targetCtx.fillRect(basePx - 25, basePy - 56, 50, 4);
  targetCtx.fillStyle = '#90EE90';
  targetCtx.fillRect(basePx - 25, basePy - 56, Math.floor(50 * expProg), 4);
}

// ─── 食物绘制 ───
export const FOOD_ICONS = {
  worm: (x, y) => { ctx.fillStyle = '#8B4513'; ctx.fillRect(x-4, y-2, 8, 4); ctx.fillStyle = '#A0522D'; ctx.fillRect(x-2, y-1, 4, 2); },
  fruit: (x, y) => { ctx.fillStyle = '#FF6B35'; ctx.fillRect(x-4, y-4, 8, 8); ctx.fillStyle = '#4CAF50'; ctx.fillRect(x-1, y-6, 2, 3); },
  treat: (x, y) => { ctx.fillStyle = '#FFD700'; ctx.fillRect(x-3, y-5, 6, 10); ctx.fillStyle = '#FFF'; ctx.fillRect(x-1, y-3, 2, 2); },
};

function drawDroppedFood() {
  g.droppedFood.forEach(f => {
    const alpha = Math.min(1, f.timer / 10);
    ctx.globalAlpha = alpha;
    const drawY = f.y + f.offY;
    if (f.offY > -10) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(f.x - 6, f.y + 2, 12, 4);
    }
    const draw = FOOD_ICONS[f.type];
    if (draw) draw(f.x, drawY);
    ctx.globalAlpha = 1;
  });
}

// ─── HUD ───
function drawHUD() {
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, canvas.width, 80);
  const Y1 = 8, Y2 = 40;

  if (g.isDay) {
    ctx.fillStyle = P.sun;
    ctx.fillRect(8, Y1, 20, 20);
    ctx.fillRect(4, Y1 + 4, 4, 4);
    ctx.fillRect(28, Y1 + 4, 4, 4);
  } else {
    ctx.fillStyle = P.moon;
    ctx.fillRect(8, Y1, 20, 20);
  }
  const rem = g.isDay ? DAY_SEC - g.time : NGT_SEC - (g.time - DAY_SEC);
  drawText(`${Math.floor(rem/60)}:${String(Math.floor(rem%60)).padStart(2,'0')}`, 36, Y1, P.txt, 1);

  drawText('孵化', 80, Y1, P.txt, 1);
  ctx.fillStyle = P.barBg;
  ctx.fillRect(80, Y1 + 16, 140, 10);
  ctx.fillStyle = g.hatchPct > 80 ? P.happy : (g.hatchPct > 50 ? P.warn : '#aaa');
  ctx.fillRect(80, Y1 + 16, Math.floor(140 * g.hatchPct / 100), 10);
  drawText(`${Math.floor(g.hatchPct)}%`, 226, Y1, P.txt, 1);

  drawText('温度', 300, Y1, P.dim, 1);
  const inOpt = g.temp >= TEMP_OPT_MIN && g.temp <= TEMP_OPT_MAX;
  const tempColor = g.temp > 40 ? P.danger : (g.temp < 30 ? P.tempCold : (inOpt ? P.happy : P.warn));
  drawText(`${g.temp.toFixed(1)}°`, 300, Y1 + 16, tempColor, 1);

  drawText('电量', 400, Y1, P.dim, 1);
  const pColor = g.power < 20 ? P.danger : (g.power < 40 ? P.warn : '#4CAF50');
  drawText(`${Math.floor(g.power)}`, 400, Y1 + 16, pColor, 1);

  drawText(`第${g.dayCount}天`, 8, Y2, P.dim, 1);
  drawText('亲密', 100, Y2, P.dim, 1);
  const hearts = g.currentPet ? Math.floor(g.intimacy / 20) : 0;
  ctx.fillStyle = P.heart;
  for (let i = 0; i < hearts; i++) {
    ctx.fillRect(100 + i * 18, Y2 + 16, 10, 10);
    ctx.fillRect(98 + i * 18, Y2 + 18, 14, 8);
  }

  if (g.currentPet) {
    const hungerColor = g.hunger < 30 ? P.danger : (g.hunger < 60 ? P.warn : '#4CAF50');
    drawText('饥饿', 250, Y2, P.dim, 1);
    ctx.fillStyle = P.barBg;
    ctx.fillRect(300, Y2 + 16, 100, 10);
    ctx.fillStyle = hungerColor;
    ctx.fillRect(300, Y2 + 16, Math.floor(100 * g.hunger / 100), 10);
    drawText(`${Math.floor(g.hunger)}`, 406, Y2, hungerColor, 1);
  }
}

function drawFeedInventory() {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, canvas.height - 56, canvas.width, 56);
  drawText('道具', 8, canvas.height - 46, P.dim, 1);
  drawText(`虫${g.inventory.worm}`, 76, canvas.height - 46, g.inventory.worm > 0 ? P.txt : P.dim, 1);
  drawText(`果${g.inventory.fruit}`, 144, canvas.height - 46, g.inventory.fruit > 0 ? P.txt : P.dim, 1);
  drawText(`饲${g.inventory.treat}`, 212, canvas.height - 46, g.inventory.treat > 0 ? P.heart : P.dim, 1);
  const heatStr = g.heatOn ? (g.power > 0 ? '加热中' : '无电量') : (g.iceOn ? '冰敷中' : '加热关');
  const hColor = g.heatOn ? (g.power > 0 ? P.danger : P.dim) : (g.iceOn ? '#00BFFF' : P.dim);
  drawText(heatStr, 600, canvas.height - 46, hColor, 1);
}

// ═══════════════════════════════════════════════════════════════════
// 游戏系统
// ═══════════════════════════════════════════════════════════════════

// ─── 图鉴记录 ───
function getPetType(pet) {
  let h = 0;
  for (let i = 0; i < pet.name.length; i++) h = (h * 31 + pet.name.charCodeAt(i)) & 0xFFFF;
  return h % 8;
}

function recordDiscovery(pet) {
  const typeIdx = getPetType(pet);
  if (!g.discoveredTypes.includes(typeIdx)) g.discoveredTypes.push(typeIdx);
  (pet.genes || []).forEach(gene => {
    if (!g.discoveredGenes.includes(gene)) g.discoveredGenes.push(gene);
  });
}

// ─── 网格排列 ───
function arrangePetsIso() {
  g.pets.forEach((pet, idx) => {
    if (!pet.scenePos) pet.scenePos = { x: 0, y: 0 };
    const col = idx % ISO_COLS;
    const row = Math.floor(idx / ISO_COLS);
    const pos = isoToScreen(col, row);
    pet.scenePos.x = pos.x;
    pet.scenePos.y = pos.y;
    pet.isoCol = col;
    pet.isoRow = row;
  });
}

function snapPetToIsoGrid(pet) {
  if (!pet || !pet.scenePos) return;
  const { col, row } = screenToIso(pet.scenePos.x, pet.scenePos.y);
  const clampedCol = Math.max(0, Math.min(ISO_COLS - 1, col));
  const clampedRow = Math.max(0, Math.min(ISO_ROWS - 1, row));
  const pos = isoToScreen(clampedCol, clampedRow);
  pet.scenePos.x = pos.x;
  pet.scenePos.y = pos.y;
  pet.isoCol = clampedCol;
  pet.isoRow = clampedRow;
}

// ─── 添加经验 ───
function addExp(pet, amount) {
  if (!pet) return;
  pet.exp += amount;
  while (pet.level < 10 && pet.exp >= EXP_TABLE[pet.level]) {
    pet.level++;
    if (pet.expireDay !== undefined) pet.expireDay += 3;
    initAudio();
    playSound('levelUp');
    showToast(`🎉 ${pet.name} 升级了！Lv.${pet.level}`);
  }
}

// ─── Toast 提示 ───
let toastTimer = null;
function showToast(msg, duration = 2) {
  const el = document.getElementById('evt');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = 'none'; }, duration * 1000);
}

// ─── 合成系统 ───
let synthSelect = [];

function doSynthesize() {
  if (g.pets.length < 3) { showToast('需要至少3只宠物才能合成'); return; }
  synthSelect = [];
  const overlay = document.getElementById('overlay');
  const msg = document.getElementById('overlayMsg');

  const starGroups = {};
  g.pets.forEach((p, i) => {
    if (!starGroups[p.star]) starGroups[p.star] = [];
    starGroups[p.star].push(i);
  });
  const starHint = Object.entries(starGroups)
    .filter(([_, arr]) => arr.length >= 3)
    .map(([s]) => `${s}星×${starGroups[s].length}`).join(' ') || '无可用组合';

  const listHtml = g.pets.map((p, i) => {
    const starStr = '★'.repeat(p.star || 1) + '☆'.repeat(5 - (p.star || 1));
    const geneStr = (p.genes || []).map(gk => (GENES[gk] || {}).icon || '').join('') || '无';
    return `<div class="breed-pet-item" id="breed_item_${i}" onclick="toggleSynthSelect(${i})" style="display:flex;align-items:center;gap:10px;padding:8px;border-bottom:1px solid #333;cursor:pointer">
      <canvas id="breed_canvas_${i}" width="48" height="48" style="image-rendering:pixelated"></canvas>
      <div>
        <div style="color:${STAR_COLORS[p.star]}">${p.name} ${starStr}</div>
        <div style="color:#aaa;font-size:11px">F${p.generation} · ${geneStr} · Lv.${p.level}</div>
      </div>
      <div id="breed_check_${i}" style="margin-left:auto;color:#444;font-size:20px">○</div>
    </div>`;
  }).join('');

  msg.innerHTML = `<div class="title">⚗️ 宠物合成</div>
    <div style="color:#aaa;font-size:12px;margin-bottom:4px">选择3只<b style="color:#FFD700">同星级</b>宠物合成1只<b style="color:#FFD700">+1星</b>宠物</div>
    <div style="color:#666;font-size:11px;margin-bottom:8px">可选：${starHint} &nbsp; <span style="color:#f55">副宠物将被消耗</span></div>
    <div id="breed_list" style="max-height:60vh;overflow-y:auto">${listHtml}</div>
    <div id="breed_error" style="color:#f55;font-size:12px;margin-top:6px;display:none">请选择3只同星级的宠物</div>
    <div style="display:flex;gap:8px;margin-top:10px">
      <button onclick="confirmSynth()" style="flex:1;padding:8px;background:#222;border:2px solid #555;color:#fff;cursor:pointer">合成</button>
      <button onclick="closeOverlay()" style="flex:1;padding:8px;background:#222;border:2px solid #555;color:#fff;cursor:pointer">取消</button>
    </div>`;
  overlay.classList.add('show');
  g.pets.forEach((p, i) => {
    setTimeout(() => {
      const c = document.getElementById(`breed_canvas_${i}`);
      if (c) drawPetSprite(c, p);
    }, 30);
  });
}
window.doSynthesize = doSynthesize;

window.toggleSynthSelect = function(idx) {
  const alreadyIdx = synthSelect.indexOf(idx);
  if (alreadyIdx >= 0) synthSelect.splice(alreadyIdx, 1);
  else if (synthSelect.length < 3) synthSelect.push(idx);
  g.pets.forEach((_, i) => {
    const el = document.getElementById(`breed_check_${i}`);
    const item = document.getElementById(`breed_item_${i}`);
    if (el) el.textContent = synthSelect.includes(i) ? '◉' : '○';
    if (item) item.style.background = synthSelect.includes(i) ? '#2a2a4a' : 'transparent';
  });
  document.getElementById('breed_error').style.display = 'none';
};

window.confirmSynth = function() {
  if (synthSelect.length !== 3) {
    document.getElementById('breed_error').style.display = 'block';
    document.getElementById('breed_error').textContent = '请选择3只宠物';
    return;
  }
  const [idxA, idxB, idxC] = synthSelect;
  const petA = g.pets[idxA], petB = g.pets[idxB], petC = g.pets[idxC];
  if (petA.star !== petB.star || petB.star !== petC.star) {
    document.getElementById('breed_error').style.display = 'block';
    document.getElementById('breed_error').textContent = '必须选择3只同星级的宠物';
    return;
  }
  if (petA.star >= 5) {
    document.getElementById('breed_error').style.display = 'block';
    document.getElementById('breed_error').textContent = '五星宠物已达上限';
    return;
  }
  closeOverlay();
  finalizeSynth(petA, idxA, petB, idxB, petC, idxC);
};

function finalizeSynth(petA, idxA, petB, idxB, petC, idxC) {
  initAudio();
  const newStar = petA.star + 1;
  const allGenes = [...petA.genes, ...petB.genes, ...petC.genes];
  const unique = [...new Set(allGenes)];
  let childGenes = unique.slice(0, 2);
  if (Math.random() < 0.15 && childGenes.length < 2) {
    const parentGeneSet = new Set(allGenes);
    const allGeneKeys = Object.keys(GENES).filter(k => !parentGeneSet.has(k));
    if (allGeneKeys.length > 0) childGenes.push(allGeneKeys[Math.floor(Math.random() * allGeneKeys.length)]);
  }
  const childGen = Math.max(petA.generation, petB.generation, petC.generation) + 1;
  const childName = petA.name + '·进化';
  const allTraits = [...petA.traits, ...petB.traits, ...petC.traits];
  const childTraits = [...new Set(allTraits)].slice(0, 2);

  const removeIdxs = [idxB, idxC, idxA].sort((a, b) => b - a);
  removeIdxs.forEach(idx => g.pets.splice(idx, 1));

  const child = {
    id: Date.now(), name: childName, traits: childTraits, star: newStar,
    level: 1, exp: 0, genes: childGenes, generation: childGen,
    father: petA.name, mother: petB.name, day: g.dayCount,
    expireDay: g.dayCount + 10, breedCount: 0,
    scenePos: { x: 0, y: 0 }, clickReaction: null,
    petMood: 'normal', moodBubble: { show: false, timer: 0 },
    wanderTarget: null, wanderTimer: 2 + Math.random() * 3,
    wanderSpeed: 0.3 + Math.random() * 0.5, facingRight: true,
  };
  recordDiscovery(child);
  g.pets.push(child);
  arrangePetsIso();
  g.currentPet = child;
  g.currentScene = 'pets';
  g.hunger = 100;
  const mutation = childGenes.length > Math.max(petA.genes.length, petB.genes.length, petC.genes.length);
  soundSynth(mutation);
  showToast(mutation ? `🧬 ${childName} 基因突变！` : `✨ ${childName} 合成成功！`);
  saveGame();
}

// ─── 图鉴 ───
function showAlbum() {
  const overlay = document.getElementById('overlay');
  const msg = document.getElementById('overlayMsg');
  g.pets.forEach(p => recordDiscovery(p));

  let typeHtml = '<div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;justify-content:center">';
  for (let i = 0; i < 8; i++) {
    const discovered = g.discoveredTypes.includes(i);
    const name = PET_TYPE_NAMES[i];
    const emoji = PET_EMOJI[i];
    if (discovered) {
      typeHtml += `<div style="flex:0 0 calc(50% - 6px);max-width:160px;background:#1a1a2e;border:2px solid #555;border-radius:8px;padding:6px;text-align:center;display:flex;align-items:center;gap:8px">
        <span style="font-size:28px">${emoji}</span>
        <div style="text-align:left"><div style="color:#FFD700;font-size:12px">${name}</div><div style="color:#4CAF50;font-size:10px">✓ 已发现</div></div></div>`;
    } else {
      typeHtml += `<div style="flex:0 0 calc(50% - 6px);max-width:160px;background:#111;border:2px solid #333;border-radius:8px;padding:6px;text-align:center;opacity:0.5;display:flex;align-items:center;gap:8px">
        <span style="font-size:28px;color:#555">❓</span>
        <div style="text-align:left"><div style="color:#666;font-size:12px">???</div><div style="color:#555;font-size:10px">未发现</div></div></div>`;
    }
  }
  typeHtml += '</div>';

  let geneHtml = '';
  if (g.discoveredGenes.length > 0) {
    geneHtml = '<div style="color:#aaa;font-size:11px;margin:8px 0">已发现基因：' +
      g.discoveredGenes.map(gk => (GENES[gk] || {}).icon || gk).join(' ') + '</div>';
  }
  msg.innerHTML = `<div class="title">📖 图鉴 (${g.discoveredTypes.length}/8)</div>${typeHtml}${geneHtml}`;
  overlay.classList.add('show');
}

// ─── 宠物详情 ───
function showPetDetail(idx) {
  const pet = g.pets[idx];
  if (!pet) return;
  const overlay = document.getElementById('overlay');
  const msg = document.getElementById('overlayMsg');
  const canvasId = 'pet_detail_canvas';
  const starStr = '★'.repeat(pet.star || 1) + '☆'.repeat(5 - (pet.star || 1));
  const geneStr = (pet.genes || []).map(gk => `${(GENES[gk] || {}).icon || ''}${(GENES[gk] || {}).name || ''}`).join(' ');
  const expNext = EXP_TABLE[pet.level] || EXP_TABLE[10];
  const expCur = pet.level > 1 ? EXP_TABLE[pet.level - 1] : 0;
  const expProg = Math.floor(((pet.exp - expCur) / (expNext - expCur)) * 100);
  const daysLeft = pet.expireDay - g.dayCount;

  msg.innerHTML = `<div class="title">${starStr}</div>
    <canvas id="${canvasId}" width="96" height="96" style="image-rendering:pixelated;margin:6px auto;display:block"></canvas>
    <div style="color:${STAR_COLORS[pet.star]};font-size:20px">${pet.name}</div>
    <div style="color:#aaa;font-size:12px">${geneStr} · F${pet.generation}</div>
    <div style="color:#aaa;font-size:12px"><span style="color:${STAR_COLORS[pet.star]}">Lv.${pet.level}</span></div>
    <div style="margin-top:4px;font-size:11px;color:#666">经验 <span style="color:#aaa">${pet.exp}</span> / ${expNext}</div>
    <div style="background:#333;height:6px;border-radius:3px;margin:4px 0"><div style="background:#90EE90;height:6px;border-radius:3px;width:${expProg}%"></div></div>
    <div style="color:#666;font-size:11px">${pet.traits.join('、')}</div>
    <div style="margin-top:6px;font-size:11px;color:#666">剩余 <span style="color:${daysLeft <= 3 ? '#f55' : '#aaa'}">${daysLeft}天</span> · 已繁殖${pet.breedCount}次</div>
    ${pet.father ? `<div style="font-size:11px;color:#666;margin-top:2px">父:${pet.father} 母:${pet.mother}</div>` : ''}
    <div style="display:flex;gap:8px;margin-top:10px">
      <button onclick="setCurrentPet(${idx})" style="flex:1;padding:8px;background:#1a2a1a;border:2px solid #5f5;color:#8f8;cursor:pointer">选中</button>
      <button onclick="closeOverlay()" style="flex:1;padding:8px;background:#222;border:2px solid #555;color:#fff;cursor:pointer">关闭</button>
    </div>`;
  overlay.classList.add('show');
  setTimeout(() => {
    const c = document.getElementById(canvasId);
    if (c) drawPetSprite(c, pet);
  }, 50);
}
window.showAlbum = showAlbum;

window.setCurrentPet = function(idx) {
  g.currentPet = g.pets[idx];
  closeOverlay();
  saveGame();
};

window.closeOverlay = function() {
  document.getElementById('overlay').classList.remove('show');
};

// ─── 场景切换 ───
window.doSceneSwitch = function(targetScene) {
  if (g.sceneTransition.active) return;
  if (targetScene === 'pets' && g.pets.length === 0) { showToast('还没有宠物'); return; }
  initAudio();
  playSound('sceneSwitch');
  g.sceneTransition = { active: true, progress: 0, from: g.currentScene, to: targetScene };
};

// 场景切换封装（供 HTML onclick 使用，避免暴露 g）
window.toggleScene = function() {
  console.log('toggleScene called, currentScene:', g.currentScene);
  window.doSceneSwitch(g.currentScene === 'pets' ? 'incubator' : 'pets');
};

// ─── 更新函数 ───
function updateDroppedFood(dt) {
  g.droppedFood = g.droppedFood.filter(f => {
    f.timer -= dt;
    if (f.claimedBy !== undefined && f.timer < 50) {
      const hasClaimer = g.pets.some(p =>
        p.wanderTarget &&
        Math.abs(p.wanderTarget.x - f.x) < 5 &&
        Math.abs(p.wanderTarget.y - f.y) < 5
      );
      if (!hasClaimer) f.claimedBy = undefined;
    }
    if (f.phase === 'fly') {
      f.offY += f.vY * dt;
      f.vY += 400 * dt;
      if (f.offY >= 0) { f.offY = 0; f.vY = -f.vY * 0.35; f.phase = Math.abs(f.vY) < 15 ? 'idle' : 'bounce'; }
    } else if (f.phase === 'bounce') {
      f.offY += f.vY * dt;
      f.vY += 400 * dt;
      if (f.offY >= 0) { f.offY = 0; f.vY = -f.vY * 0.35; if (Math.abs(f.vY) < 15) { f.vY = 0; f.phase = 'idle'; } }
    }
    return f.timer > 0;
  });
}

function seekFood(pet) {
  if (g.droppedFood.length === 0 || (pet.interactAnim && pet.interactAnim.time > 0)) return;
  let nearest = null, nearDist = Infinity;
  g.droppedFood.forEach(f => {
    if (f.claimedBy !== undefined && f.claimedBy !== pet.id) return;
    const dx = f.x - pet.scenePos.x, dy = f.y - pet.scenePos.y;
    const d = dx * dx + dy * dy;
    if (d < nearDist) { nearDist = d; nearest = f; }
  });
  if (!nearest) return;
  const dist = Math.sqrt(nearDist);

  if (dist < 20) {
    const foodType = nearest.type;
    g.hunger = Math.min(100, g.hunger + (FOOD_GAINS[foodType] || 15));
    g.hatchPct = Math.min(100, g.hatchPct + (FOOD_HATCH_GAINS[foodType] || 0));
    g.intimacy = Math.min(100, g.intimacy + (foodType === 'treat' ? 3 : foodType === 'fruit' ? 2 : 1));
    g.droppedFood = g.droppedFood.filter(f => f !== nearest);
    pet.clickReaction = { type: 'heart', time: 0 };
    showToast(`${pet.name} 吃了${foodType === 'worm' ? '虫子' : foodType === 'fruit' ? '水果' : '饲料'}！`);
    pet.wanderTarget = null;
    pet.wanderIdle = 1 + Math.random() * 2;
    pet.wanderTimer = pet.wanderIdle;
    saveGame();
    return;
  }

  nearest.claimedBy = pet.id;
  pet.wanderTarget = { x: nearest.x, y: nearest.y };
  pet.wanderSpeed = 1.2;
  pet.wanderTimer = 999;
  if (nearest.x < pet.scenePos.x) pet.facingRight = false;
  else pet.facingRight = true;
}

function updatePetWander(dt) {
  g.pets.forEach(pet => {
    if (!pet.scenePos || g.draggingPetId === pet.id || g.hoveredPetId === pet.id) return;
    if (pet.interactAnim && pet.interactAnim.time > 0) return;
    seekFood(pet);
    pet.wanderTimer -= dt;
    if (pet.wanderTimer <= 0) {
      if (Math.random() < 0.6) {
        pet.wanderTarget = { x: 80 + Math.random() * 560, y: 310 + Math.random() * 180 };
        pet.wanderSpeed = 0.4 + Math.random() * 0.8;
        pet.wanderIdle = 0;
        if (pet.wanderTarget.x < pet.scenePos.x) pet.facingRight = false;
        else pet.facingRight = true;
      } else {
        pet.wanderTarget = null;
        pet.wanderIdle = 1 + Math.random() * 3;
      }
      pet.wanderTimer = pet.wanderTarget ? 3 + Math.random() * 4 : pet.wanderIdle;
    }
    if (pet.wanderTarget && !pet.interactAnim) {
      const dx = pet.wanderTarget.x - pet.scenePos.x;
      const dy = pet.wanderTarget.y - pet.scenePos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 3) {
        pet.wanderTarget = null;
        pet.wanderIdle = 1 + Math.random() * 3;
        pet.wanderTimer = pet.wanderIdle;
      } else {
        const speed = pet.wanderSpeed * 60 * dt;
        const moveX = (dx / dist) * speed;
        const moveY = (dy / dist) * speed;
        pet.scenePos.x += moveX;
        pet.scenePos.y += moveY;
        pet.scenePos.x = Math.max(50, Math.min(670, pet.scenePos.x));
        pet.scenePos.y = Math.max(290, Math.min(500, pet.scenePos.y));
        if (moveX < -0.1) pet.facingRight = false;
        else if (moveX > 0.1) pet.facingRight = true;
        const { col, row } = screenToIso(pet.scenePos.x, pet.scenePos.y);
        pet.isoCol = Math.max(0, Math.min(4, col));
        pet.isoRow = Math.max(0, Math.min(2, row));
      }
    }
  });
}

function updatePetInteractions(dt) {
  g.pets.forEach(pet => {
    if (pet._moodResetTimer > 0) {
      pet._moodResetTimer -= dt;
      if (pet._moodResetTimer <= 0 && pet.petMood === 'happy') pet.petMood = 'normal';
    }
  });
  g.heartParticles = g.heartParticles.filter(p => {
    p.x += p.vx; p.y += p.vy; p.vy += 0.05;
    p.life -= dt * 1.5;
    return p.life > 0;
  });
}

function update(dt) {
  g.time += dt;
  if (g.time >= CYCLE) { g.time = 0; g.isDay = true; g.dayCount++; }
  else if (g.time >= DAY_SEC && g.isDay) g.isDay = false;

  g.powerRegenTimer += dt;
  if (g.powerRegenTimer >= 15) {
    g.powerRegenTimer = 0;
    const regen = g.isDay ? Math.floor(POWER_DAY_REGEN / 2) : Math.floor(POWER_NGT_REGEN / 2);
    g.power = Math.min(POWER_MAX, g.power + regen);
  }

  if (g.currentPet && g.dayCount > g.currentPet.expireDay) {
    initAudio(); playSound('petLeave');
    const petName = g.currentPet.name;
    g.pets = g.pets.filter(p => p !== g.currentPet);
    showToast(`${petName}离开了...`);
    g.currentPet = g.pets.length > 0 ? g.pets[g.pets.length - 1] : null;
    saveGame();
  }

  updateDroppedFood(dt);
  if (g.foodDropCd > 0) g.foodDropCd = Math.max(0, g.foodDropCd - dt);
  if (g.petCdLeft > 0) g.petCdLeft = Math.max(0, g.petCdLeft - dt);
  if (g.feedCdLeft > 0) g.feedCdLeft = Math.max(0, g.feedCdLeft - dt);
  if (g.forageCdLeft > 0) g.forageCdLeft = Math.max(0, g.forageCdLeft - dt);

  if (g.heatOn && g.power > 0) {
    g.temp = Math.min(TEMP_MAX, g.temp + 0.3 * dt);
    g.power = Math.max(0, g.power - HEAT_DRAIN * dt);
    if (g.power <= 0) { g.heatOn = false; initAudio(); playSound('warning'); }
  } else if (g.iceOn) {
    g.temp = Math.max(TEMP_MIN, g.temp - 3 * dt);
  } else {
    const roomTemp = 25;
    if (Math.abs(g.temp - roomTemp) > 0.5) g.temp += (roomTemp - g.temp) * 0.02 * dt;
  }

  let rate = HATCH_RATE;
  if (g.temp < TEMP_OPT_MIN) { rate = HATCH_RATE_COLD; if (g.temp < 30) g.intimacy = Math.max(0, g.intimacy - 0.05 * dt); }
  else if (g.temp > TEMP_OPT_MAX) rate = HATCH_RATE_HOT;
  rate *= (1 + (g.intimacy / 100) * 0.5);

  if (!g.heatOn && !g.iceOn) {
    g.passiveHatchTimer = (g.passiveHatchTimer || 0) + dt;
    if (g.passiveHatchTimer >= 30) { g.passiveHatchTimer = 0; g.hatchPct = Math.min(100, g.hatchPct + 1); }
  } else g.passiveHatchTimer = 0;

  if (g.currentPet) g.hunger = Math.max(0, g.hunger - 0.01 * dt);

  g.hatchPct = Math.min(100, Math.max(0, g.hatchPct + rate * dt));

  const newStage = Math.floor(g.hatchPct / 20);
  if (newStage > g.crackStage && g.crackStage < 4) {
    g.crackStage = newStage;
    initAudio(); playSound('crack');
    showToast('🔍 蛋壳出现裂纹...');
  }

  if (g.hatchPct >= 100 && !g.isHatching) startHatch();
  if (g.isHatching) {
    g.hatchAnim += dt * 60;
    if (g.hatchAnim > 120) finalizeHatch();
  }

  g.pets.forEach(pet => {
    if (pet.clickReaction && typeof pet.clickReaction.time === 'number') {
      pet.clickReaction.time += dt;
      if (pet.clickReaction.time > 0.8) pet.clickReaction = null;
    }
    if (pet.moodBubble && typeof pet.moodBubble.timer === 'number' && pet.moodBubble.timer > 0) {
      pet.moodBubble.timer -= dt;
      if (pet.moodBubble.timer <= 0) { pet.moodBubble.show = false; pet.moodBubble.timer = 0; }
    }
  });

  updatePetWander(dt);
  updatePetInteractions(dt);
}

function startHatch() {
  g.isHatching = true;
  g.hatchAnim = 0;
  initAudio(); playSound('crack');
}

function finalizeHatch() {
  initAudio(); playSound('hatch');
  g.isHatching = false; g.hatchPct = 0;
  const traits = [];
  if (g.intimacy >= 80) traits.push('亲人');
  if (g.intimacy >= 60) traits.push('活泼');
  if (g.inventory.worm >= 3) traits.push('贪吃');
  if (g.intimacy < 30) traits.push('调皮');
  if (traits.length === 0) traits.push('普通');
  const names = ['小火', '毛球', '蛋蛋', '小灰', '绒绒', '豆芽', '噗噗', '糖豆'];
  const petName = names[Math.floor(Math.random() * names.length)];
  const geneKeys = Object.keys(GENES);
  const numGenes = Math.random() < 0.3 ? 2 : 1;
  const petGenes = [];
  const shuffled = geneKeys.sort(() => Math.random() - 0.5);
  for (let i = 0; i < numGenes; i++) petGenes.push(shuffled[i]);
  const starRoll = Math.random();
  const star = starRoll < 0.5 ? 1 : (starRoll < 0.8 ? 2 : 3);
  const newPet = {
    id: Date.now(), name: petName, traits: [...traits], star,
    level: 1, exp: 0, genes: petGenes, generation: 1,
    father: null, mother: null, day: g.dayCount,
    expireDay: g.dayCount + 10, breedCount: 0,
    scenePos: { x: 0, y: 0 }, clickReaction: null,
    petMood: 'normal', moodBubble: { show: false, timer: 0 },
    wanderTarget: null, wanderTimer: 2 + Math.random() * 3,
    wanderSpeed: 0.3 + Math.random() * 0.5, facingRight: true,
  };
  recordDiscovery(newPet);
  g.pets.push(newPet);
  arrangePetsIso();
  g.currentPet = g.pets[g.pets.length - 1];
  g.currentScene = 'pets';
  g.hunger = 100;
  showToast(`🎉 ${petName} 孵化成功！`);
  saveGame();
}

// ─── 外部按钮事件 ───
window.toggleHeat = function() {
  initAudio();
  if (g.power <= 0 && !g.heatOn) { playSound('warning'); showToast('电量不足！'); return; }
  g.heatOn = !g.heatOn;
  if (g.heatOn) { g.iceOn = false; playSound('heatOn'); showToast('🔥 加热开启'); }
  else showToast('🔥 加热关闭');
  updateBtnUI();
};

window.toggleIce = function() {
  initAudio();
  g.iceOn = !g.iceOn;
  if (g.iceOn) { g.heatOn = false; playSound('iceOn'); showToast('🧊 冰袋启用'); }
  else showToast('🧊 冰袋关闭');
  updateBtnUI();
};

window.doForage = function() {
  if (g.forageCdLeft > 0) { showToast(`冷却中 ${Math.ceil(g.forageCdLeft)}秒`); return; }
  initAudio(); playSound('forage');
  const roll = Math.random();
  let type, msg;
  if (roll < 0.5) { type = 'worm'; msg = '🐛 找到虫子！'; }
  else if (roll < 0.8) { type = 'fruit'; msg = '🍎 发现野果！'; }
  else { type = 'treat'; msg = '🍪 找到零食！'; }
  if (g.inventory[type] < INV_MAX) g.inventory[type]++;
  else showToast('背包已满！');
  g.forageCdLeft = FORAGE_COOLDOWN;
  showToast(msg);
  updateBtnUI(); saveGame();
};

window.doPet = function() {
  if (!g.currentPet) return;
  if (g.petCdLeft > 0) { showToast(`冷却中 ${Math.ceil(g.petCdLeft)}秒`); return; }
  initAudio(); playSound('pet');
  g.intimacy = Math.min(100, g.intimacy + 3);
  g.petCdLeft = PET_COOLDOWN;
  if (g.currentPet) addExp(g.currentPet, 5);
  showToast('🫂 抚摸 +3 亲密度');
  updateBtnUI(); saveGame();
};

window.resetGame = function() {
  if (!confirm('确定要重置所有进度吗？')) return;
  localStorage.removeItem('hatchgame_save');
  location.reload();
};

// ─── 画布显示翻转（拉伸 ↔ 原生比例） ───
window._canvasFlipped = false;
window.toggleCanvasFlip = function() {
  window._canvasFlipped = !window._canvasFlipped;
  const canvas = document.getElementById('c');
  const btn = document.getElementById('btnFlip');
  if (!canvas) return;
  if (window._canvasFlipped) {
    // 原生比例 720x576
    canvas.style.width = 'min(720px, 100vw)';
    canvas.style.aspectRatio = '720 / 576';
    if (btn) btn.innerHTML = '🔳 宽屏';
  } else {
    // 宽屏拉伸 1280x800
    canvas.style.width = 'min(1280px, 100vw)';
    canvas.style.aspectRatio = '1280 / 800';
    if (btn) btn.innerHTML = '🔲 翻转';
  }
};

function updateBtnUI() {
  const heatBtn = document.getElementById('btnHeat');
  if (heatBtn) {
    heatBtn.className = 'bt' + (g.heatOn ? ' off' : '');
    document.getElementById('heatStatus').textContent = g.heatOn ? '开启中' : (g.power > 0 ? '开启' : '无电');
  }
  document.getElementById('btnPet').style.display = g.currentPet ? 'inline-block' : 'none';
  document.getElementById('btnFeed').style.display = g.currentPet ? 'inline-block' : 'none';
  const totalFood = g.inventory.worm + g.inventory.fruit + g.inventory.treat;
  document.getElementById('feedStatus').textContent = totalFood > 0 ? (g.feedCdLeft > 0 ? `${Math.ceil(g.feedCdLeft)}秒` : '可用') : '无食物';
  document.getElementById('petCd').textContent = g.petCdLeft > 0 ? `${Math.ceil(g.petCdLeft)}秒` : '可用';
  document.getElementById('forageCd').textContent = g.forageCdLeft > 0 ? `${Math.ceil(g.forageCdLeft)}秒` : '可用';
}

// ─── 主循环 ───
function loop() {
  const now = Date.now();
  const dt = Math.min((now - g.lastTs) / 1000, 1);
  g.lastTs = now;
  update(dt);

  // Transition
  if (g.sceneTransition.active) {
    g.sceneTransition.progress += dt / 0.3;
    if (g.sceneTransition.progress >= 1) {
      g.sceneTransition.progress = 1;
      g.sceneTransition.active = false;
      g.currentScene = g.sceneTransition.to;
      saveGame();
    }
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Scene transition rendering
  if (g.sceneTransition.active) {
    console.log('[transition] rendering, progress:', g.sceneTransition.progress.toFixed(2), 'from:', g.sceneTransition.from, 'to:', g.sceneTransition.to);
    initTransCanvases(canvas);
    const p = g.sceneTransition.progress;
    const ease = 1 - Math.pow(1 - p, 3);
    const toPets = g.sceneTransition.to === 'pets';
    const oldOffset = Math.round((toPets ? ease : -ease) * canvas.width);
    const newOffset = Math.round((toPets ? (1 - ease) : -(1 - ease)) * canvas.width);

    // Render old scene
    drawIsoGroundToCtx(transOldCtx);
    if (g.sceneTransition.from === 'incubator') {
      drawIncubatorToCtx(transOldCtx);
      drawEggToCtx(transOldCtx);
    } else {
      const sortedPets = [...g.pets].sort((a, b) => (a.isoCol||0)+(a.isoRow||0) - ((b.isoCol||0)+(b.isoRow||0)));
      sortedPets.forEach(pet => {
        if (pet.scenePos) drawPetToCtx(transOldCtx, pet, pet.scenePos.x, pet.scenePos.y - TILE_H / 2, {});
      });
    }
    ctx.drawImage(transOldCanvas, oldOffset, 0);

    // Render new scene
    drawIsoGroundToCtx(transNewCtx);
    if (g.sceneTransition.to === 'incubator') {
      drawIncubatorToCtx(transNewCtx);
      drawEggToCtx(transNewCtx);
    } else {
      const sortedPets = [...g.pets].sort((a, b) => (a.isoCol||0)+(a.isoRow||0) - ((b.isoCol||0)+(b.isoRow||0)));
      sortedPets.forEach(pet => {
        if (pet.scenePos) drawPetToCtx(transNewCtx, pet, pet.scenePos.x, pet.scenePos.y - TILE_H / 2, {});
      });
    }
    ctx.drawImage(transNewCanvas, newOffset, 0);
  } else {
    // Normal rendering
    drawIsoGround();
    drawDroppedFood();

    if (g.currentScene === 'incubator') {
      drawIncubator();
      if (g.isHatching) drawHatchingAnim();
      else drawEgg();
    } else {
      if (g.pets.length > 0) {
        g.heartParticles.forEach(p => {
          ctx.fillStyle = `rgba(255, 105, 180, ${p.life})`;
          const hx = Math.floor(p.x), hy = Math.floor(p.y), hs = Math.floor(p.size);
          ctx.fillRect(hx - hs/2, hy - hs/4, hs/2, hs/4);
          ctx.fillRect(hx, hy - hs/4, hs/2, hs/4);
          ctx.fillRect(hx - hs/4, hy, hs/2, hs/2);
          ctx.fillRect(hx, hy, hs/2, hs/2);
        });
        const sortedPets = [...g.pets].sort((a, b) => (a.isoCol||0)+(a.isoRow||0) - ((b.isoCol||0)+(b.isoRow||0)));
        sortedPets.forEach(pet => {
          if (pet.scenePos) {
            const feetY = pet.scenePos.y - TILE_H / 2;
            drawPet(pet, pet.scenePos.x, feetY, {
              isDragging: g.draggingPetId === pet.id,
              clickReaction: pet.clickReaction || null,
              petMood: pet.petMood || 'normal',
              moodBubble: pet.moodBubble || { show: false },
            });
          }
        });
      } else {
        drawText('还没有宠物', 300, 260, P.dim, 2);
        drawText('去孵蛋室孵化吧', 290, 290, P.dim, 1);
      }
    }
  }

  drawText(g.currentScene === 'incubator' ? '🥚 孵蛋室' : '🫂 宠物间', 590, 8, '#aaa', 1);
  drawHUD();
  drawFeedInventory();
  updateBtnUI();
  requestAnimationFrame(loop);
}

// ═══════════════════════════════════════════════════════════════════
// 初始化
// ═══════════════════════════════════════════════════════════════════
export function init(c, c2d) {
  initCanvas(c, c2d);
  const data = loadRawSave();
  if (data) {
    if (data.lastSave) {
      const offline = (Date.now() - data.lastSave) / 1000;
      const offlineMins = Math.min(offline / 60, 10);
      g.temp = Math.max(TEMP_MIN, g.temp - offlineMins * 0.02);
      g.hatchPct = Math.min(100, g.hatchPct + offlineMins * 0.05);
      if (g.hunger !== undefined) g.hunger = Math.max(0, g.hunger - offlineMins * 0.5);
    }

    // 旧存档兼容：补全缺失字段
    if (g.sceneTransition === undefined || g.sceneTransition === null) {
      g.sceneTransition = { active: false, progress: 0, from: 'incubator', to: 'pets' };
    }
    if (g.nextHatchDay === undefined) g.nextHatchDay = 0;
    if (g.draggingPetId === undefined) g.draggingPetId = null;
    if (g.heartParticles === undefined) g.heartParticles = [];
    if (g.droppedFood === undefined) g.droppedFood = [];

    // 补全宠物字段
    g.pets.forEach(p => {
      if (!p.scenePos) p.scenePos = { x: 0, y: 0 };
      if (p.clickReaction === undefined) p.clickReaction = null;
      if (p.petMood === undefined) p.petMood = 'normal';
      if (!p.moodBubble || typeof p.moodBubble.timer !== 'number') {
        p.moodBubble = { show: false, timer: 0 };
      }
      if (p.wanderTarget === undefined) p.wanderTarget = null;
      if (p.wanderTimer === undefined) p.wanderTimer = 2 + Math.random() * 3;
      if (p.wanderSpeed === undefined) p.wanderSpeed = 0.3 + Math.random() * 0.5;
      if (p.facingRight === undefined) p.facingRight = true;
      if (p.genes === undefined) p.genes = [];
      if (p.traits === undefined) p.traits = ['普通'];
    });

    // 修复 currentPet 引用（JSON 反序列化后是副本，不是 pets 数组中的引用）
    if (g.currentPet && g.pets.length > 0) {
      const cp = g.pets.find(p => p.name === g.currentPet.name && p.day === g.currentPet.day);
      if (cp) g.currentPet = cp;
      else g.currentPet = g.pets[0];
    }

    g.pets.forEach(p => recordDiscovery(p));
    arrangePetsIso();
  }

  // Input handlers
  setupInput(c);

  updateBtnUI();
  g.lastTs = Date.now();
  loop();
  setInterval(saveGame, 30000);
}

// ═══════════════════════════════════════════════════════════════════
// 输入处理
// ═══════════════════════════════════════════════════════════════════
function setupInput(canvasEl) {
  const getCoords = (e) => {
    const rect = canvasEl.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (720 / rect.width), y: (e.clientY - rect.top) * (576 / rect.height) };
  };

  canvasEl.addEventListener('click', (e) => {
    const { x: mx, y: my } = getCoords(e);

    if (!g.sceneTransition.active && g.draggingPetId === null && !g.dragMoved) {
      for (const pet of g.pets) {
        if (!pet.scenePos) continue;
        const dx = mx - pet.scenePos.x, dy = my - (pet.scenePos.y - TILE_H/2);
        if (dx*dx + dy*dy <= 70*70) {
          initAudio(); playSound('pet');
          g.intimacy = Math.min(100, g.intimacy + 3);
          const reactions = ['jump', 'heart', 'spin', 'bounce'];
          pet.clickReaction = { type: reactions[Math.floor(Math.random() * reactions.length)], time: 0 };
          for (let i = 0; i < 5; i++) g.heartParticles.push({
            x: pet.scenePos.x + (Math.random()-0.5)*40, y: (pet.scenePos.y - TILE_H/2) - 20 + (Math.random()-0.5)*40,
            vx: (Math.random()-0.5)*2, vy: -Math.random()*2-1, life: 1, size: 4+Math.random()*4
          });
          pet.petMood = 'happy';
          pet.moodBubble = { show: true, timer: 2 };
          addExp(pet, 3);
          updateBtnUI(); saveGame();
          return;
        }
      }
    }

    // Food drop on empty ground (pets scene only)
    if (g.currentScene === 'pets' && g.pets.length > 0 && !g.sceneTransition.active && g.foodDropCd <= 0) {
      const types = ['worm', 'worm', 'worm', 'fruit', 'treat'];
      const targetY = Math.max(300, Math.min(500, my));
      g.droppedFood.push({
        x: Math.max(80, Math.min(640, mx)), y: targetY,
        type: types[Math.floor(Math.random()*types.length)],
        timer: 60, offY: my - targetY, vY: -150, phase: 'fly'
      });
      g.foodDropCd = 3;
      initAudio(); playSound('forage');
      saveGame();
    }
  });

  canvasEl.addEventListener('mousedown', (e) => {
    if (g.sceneTransition.active) return;
    const { x, y } = getCoords(e);
    for (const pet of g.pets) {
      if (!pet.scenePos) continue;
      const dx = x - pet.scenePos.x, dy = y - (pet.scenePos.y - TILE_H/2);
      if (dx*dx + dy*dy <= 70*70) {
        g.draggingPetId = pet.id;
        g.dragMoved = false;
        g.dragOffsetX = dx;
        g.dragOffsetY = dy;
        canvasEl.style.cursor = 'grabbing';
        break;
      }
    }
  });

  canvasEl.addEventListener('mousemove', (e) => {
    if (g.draggingPetId !== null) {
      const { x, y } = getCoords(e);
      const pet = g.pets.find(p => p.id === g.draggingPetId);
      if (pet && pet.scenePos) {
        pet.scenePos.x = Math.max(40, Math.min(680, x - g.dragOffsetX));
        pet.scenePos.y = Math.max(40, Math.min(480, y - g.dragOffsetY));
        g.dragMoved = true;
      }
      return;
    }
    if (!g.sceneTransition.active) {
      const { x, y } = getCoords(e);
      let isOverPet = false;
      g.hoveredPetId = null;
      for (const pet of g.pets) {
        if (!pet.scenePos) continue;
        const dx = x - pet.scenePos.x, dy = y - (pet.scenePos.y - TILE_H/2);
        if (dx*dx + dy*dy <= 70*70) { isOverPet = true; g.hoveredPetId = pet.id; break; }
      }
      if (isOverPet) canvasEl.style.cursor = 'grab';
      else if (g.currentScene === 'pets' && g.pets.length > 0) canvasEl.style.cursor = g.foodDropCd > 0 ? 'not-allowed' : 'crosshair';
      else canvasEl.style.cursor = 'default';
    }
  });

  canvasEl.addEventListener('mouseup', () => {
    if (g.draggingPetId !== null) {
      const pet = g.pets.find(p => p.id === g.draggingPetId);
      if (pet && g.dragMoved) {
        pet.clickReaction = { type: 'bounce', time: 0 };
        pet.wanderTarget = null;
        pet.wanderIdle = 2 + Math.random() * 3;
        pet.wanderTimer = pet.wanderIdle;
        saveGame();
      }
      g.draggingPetId = null;
      canvasEl.style.cursor = 'default';
    }
  });

  canvasEl.addEventListener('mouseleave', () => {
    g.hoveredPetId = null;
    if (g.draggingPetId !== null) { g.draggingPetId = null; canvasEl.style.cursor = 'default'; }
  });

  // Touch support
  canvasEl.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvasEl.getBoundingClientRect();
    const x = (touch.clientX - rect.left) * (720 / rect.width);
    const y = (touch.clientY - rect.top) * (576 / rect.height);
    for (const pet of g.pets) {
      if (!pet.scenePos) continue;
      const dx = x - pet.scenePos.x, dy = y - (pet.scenePos.y - TILE_H/2);
      if (dx*dx + dy*dy <= 70*70) {
        g.draggingPetId = pet.id;
        g.dragMoved = false;
        g.dragOffsetX = dx;
        g.dragOffsetY = dy;
        break;
      }
    }
  }, { passive: false });

  canvasEl.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (g.draggingPetId !== null) {
      const touch = e.touches[0];
      const rect = canvasEl.getBoundingClientRect();
      const x = (touch.clientX - rect.left) * (720 / rect.width);
      const y = (touch.clientY - rect.top) * (576 / rect.height);
      const pet = g.pets.find(p => p.id === g.draggingPetId);
      if (pet && pet.scenePos) {
        pet.scenePos.x = Math.max(40, Math.min(680, x - g.dragOffsetX));
        pet.scenePos.y = Math.max(40, Math.min(480, y - g.dragOffsetY));
        g.dragMoved = true;
      }
    }
  }, { passive: false });

  canvasEl.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (g.draggingPetId !== null) {
      const pet = g.pets.find(p => p.id === g.draggingPetId);
      if (pet && g.dragMoved) {
        pet.clickReaction = { type: 'bounce', time: 0 };
        pet.wanderTarget = null;
        pet.wanderIdle = 2 + Math.random() * 3;
        pet.wanderTimer = pet.wanderIdle;
        saveGame();
      }
      g.draggingPetId = null;
    } else {
      // Treat as click
      const touch = e.changedTouches[0];
      const rect = canvasEl.getBoundingClientRect();
      const mx = (touch.clientX - rect.left) * (720 / rect.width);
      const my = (touch.clientY - rect.top) * (576 / rect.height);
      // Trigger click logic
      if (g.currentScene === 'pets' && g.pets.length > 0 && !g.sceneTransition.active && g.foodDropCd <= 0) {
        const types = ['worm', 'worm', 'worm', 'fruit', 'treat'];
        const targetY = Math.max(300, Math.min(500, my));
        g.droppedFood.push({
          x: Math.max(80, Math.min(640, mx)), y: targetY,
          type: types[Math.floor(Math.random()*types.length)],
          timer: 60, offY: my - targetY, vY: -150, phase: 'fly'
        });
        g.foodDropCd = 3;
        initAudio(); playSound('forage');
        saveGame();
      }
    }
  }, { passive: false });
}

// ═══════════════════════════════════════════════════════════════════
// 控制台调试指令
// ═══════════════════════════════════════════════════════════════════
// 在浏览器控制台运行 spawnPet() 即可新增一只随机宠物
window.spawnPet = function() {
  const nameList = ['小球', '毛球', '豆豆', '噗噗', '咪咪', '爪爪', '果冻', '棉花', '糖糖', '泡泡'];
  const traits = ['活泼', '害羞', '贪吃', '懒散', '好奇', '忠诚', '倔强', '温柔'];
  const randomGene = () => Object.keys(GENES)[Math.floor(Math.random() * Object.keys(GENES).length)];
  const name = nameList[Math.floor(Math.random() * nameList.length)] + Math.floor(Math.random() * 99);
  const pet = {
    id: 'pet_' + Date.now(),
    name,
    type: 'normal',
    genes: [randomGene(), randomGene(), randomGene()],
    star: Math.random() < 0.7 ? 1 : (Math.random() < 0.7 ? 2 : 3),
    level: 1,
    exp: 0,
    eggDays: 0,
    state: 'idle',
    sprite: '🐾',
    x: 280 + Math.random() * 160,
    y: 310 + Math.random() * 80,
    facing: 1,
    trait: traits[Math.floor(Math.random() * traits.length)],
    hunger: 80,
    intimacy: 50,
    temp: 25,
    health: 100,
    sleepDebt: 0,
    happy: 80,
    lastSleep: Date.now(),
    lastFeed: Date.now()
  };
  g.pets.push(pet);
  saveGame();
  console.log('✅ 新宠物 "' + name + '" 生成！基因:', pet.genes.join(''), '星星:', pet.star + '★', '总宠物数:', g.pets.length);
  showToast('🥚 新宠物 "' + name + '"！');
};

// ═══════════════════════════════════════════════════════════════════
// 过渡场景渲染辅助
// ═══════════════════════════════════════════════════════════════════
function drawIsoGroundToCtx(targetCtx) {
  if (g.isDay) {
    targetCtx.fillStyle = '#3d8b37';
    targetCtx.fillRect(0, 0, 720, 576);
    targetCtx.fillStyle = '#1a4515';
    targetCtx.fillRect(0, 566, 720, 10);
  } else {
    targetCtx.fillStyle = '#1f4a1f';
    targetCtx.fillRect(0, 0, 720, 576);
    targetCtx.fillStyle = '#0a120a';
    targetCtx.fillRect(0, 566, 720, 10);
  }
}

// ═══════════════════════════════════════════════════════════════════
// 互动选宠系统
// ═══════════════════════════════════════════════════════════════════
let selectedInteractPets = [];

window.showInteractSelect = function() {
  if (g.pets.length === 0) { showToast('还没有宠物'); return; }
  selectedInteractPets = [];

  let html = '<div style="font-size:14px;margin-bottom:8px">🎮 选择要互动的宠物（可多选）</div>';
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;max-height:280px;overflow-y:auto;">';

  g.pets.forEach((pet) => {
    const geneStr = (pet.genes || []).map(gk => (GENES[gk] || {}).icon || '').join('');
    html += `<button id="ivt_pet_${pet.id}" onclick="toggleInteractPet(${pet.id})" style="background:#222;border:3px solid #555;color:#fff;padding:8px 10px;font-family:monospace;font-size:11px;cursor:pointer;min-width:80px;display:flex;flex-direction:column;align-items:center;gap:2px">
      <span style="font-size:15px">${pet.name}</span>
      <span style="color:#aaa;font-size:9px">${pet.star}★ Lv${pet.level}</span>
      <span style="font-size:10px">${geneStr}</span>
    </button>`;
  });

  html += '</div>';
  html += '<div id="ivt_hint" style="font-size:12px;color:#aaa;margin-top:8px">已选择 0 只</div>';
  html += '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;justify-content:center;">';
  html += '<button onclick="confirmInteractPets()" style="background:#1a4a1a;border:3px solid #4CAF50;color:#fff;padding:10px 20px;font-family:monospace;font-size:13px;cursor:pointer">确认选择</button>';
  html += '<button onclick="closeOverlay()" style="background:#333;border:3px solid #666;color:#fff;padding:10px 20px;font-family:monospace;font-size:13px;cursor:pointer">返回</button>';
  html += '</div>';

  const overlay = document.getElementById('overlay');
  const msg = document.getElementById('overlayMsg');
  msg.innerHTML = html;
  msg.style.maxWidth = '400px';
  overlay.classList.add('show');
};

window.toggleInteractPet = function(petId) {
  const idx = selectedInteractPets.indexOf(petId);
  if (idx >= 0) {
    selectedInteractPets.splice(idx, 1);
  } else {
    selectedInteractPets.push(petId);
  }
  const btn = document.getElementById('ivt_pet_' + petId);
  if (btn) {
    btn.style.background = selectedInteractPets.indexOf(petId) >= 0 ? '#1a3a1a' : '#222';
    btn.style.borderColor = selectedInteractPets.indexOf(petId) >= 0 ? '#4CAF50' : '#555';
  }
  const hint = document.getElementById('ivt_hint');
  if (hint) hint.textContent = `已选择 ${selectedInteractPets.length} 只`;
};

window.confirmInteractPets = function() {
  if (selectedInteractPets.length === 0) { showToast('请至少选择一只宠物'); return; }
  closeOverlay();
  setTimeout(() => showGameSelect(), 50);
};

function showGameSelect() {
  if (selectedInteractPets.length === 0) return;
  initAudio();

  const petNames = selectedInteractPets.map(id => {
    const pet = g.pets.find(p => p.id === id);
    return pet ? pet.name : '';
  }).join('、');

  let html = `<div style="font-size:14px;margin-bottom:8px">🎯 <span style="color:#FF69B4">${petNames}</span> 一起玩什么？</div>`;
  html += '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;">';

  // 扔球游戏（1只以上）
  html += `<button onclick="startBallGame()" style="background:#1a3a1a;border:3px solid #4CAF50;color:#fff;padding:12px 16px;font-family:monospace;font-size:13px;cursor:pointer;min-width:110px;display:flex;flex-direction:column;align-items:center;gap:4px">
    <span style="font-size:22px">⚽</span><span>扔球游戏</span><span style="color:#4CAF50;font-size:10px">快乐+10 亲密+5</span>
  </button>`;

  // 排球（2只）
  if (selectedInteractPets.length === 2) {
    html += `<button onclick="startVolleyballGame()" style="background:#1a1a4a;border:3px solid #6B5B95;color:#fff;padding:12px 16px;font-family:monospace;font-size:13px;cursor:pointer;min-width:110px;display:flex;flex-direction:column;align-items:center;gap:4px">
      <span style="font-size:22px">🏐</span><span>排球</span><span style="color:#6B5B95;font-size:10px">获胜+20 经验</span>
    </button>`;
  }

  // 战斗（暂未实现）
  if (selectedInteractPets.length >= 2) {
    html += `<button onclick="showToast('战斗系统开发中')" style="background:#3a1a1a;border:3px solid #E53935;color:#fff;padding:12px 16px;font-family:monospace;font-size:13px;cursor:pointer;min-width:110px;border-radius:6px">
      ⚔️ 对战（开发中）</button>`;
  }

  html += '</div>';
  html += '<button onclick="closeOverlay()" style="margin-top:16px;background:#333;border:3px solid #666;color:#fff;padding:10px 24px;font-family:monospace;font-size:14px;cursor:pointer">返回</button>';

  const overlay = document.getElementById('overlay');
  const msg = document.getElementById('overlayMsg');
  msg.innerHTML = html;
  msg.style.maxWidth = '400px';
  overlay.classList.add('show');
}

window.startBallGame = function() { showToast('⚽ 扔球游戏开发中'); closeOverlay(); };
window.startVolleyballGame = function() { showToast('🏐 排球游戏开发中'); closeOverlay(); };

// Other stubs
window.showFeedSelect = function() { showToast('🍖 喂食功能开发中'); };
window.exitInteractMode = function() { showToast('已退出互动模式'); };
window.startVoiceCommand = function() { showToast('🎤 语音功能需要运行 voice_server.py'); };
window.executeTextCommand = function() { showToast('📝 文字指令功能开发中'); };
window.showToolSelect = function() { showToast('🧰 道具功能开发中'); };
window.cancelToolMode = function() { showToast('已取消'); };
window.openShop = function() { showToast('🛒 商店功能开发中'); };
window.buyTool = function() { showToast('购买功能开发中'); };
