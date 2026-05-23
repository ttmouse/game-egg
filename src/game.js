import { g, saveGame, loadRawSave, initTransCanvases, transOldCtx, transNewCtx, transOldCanvas, transNewCanvas, petSpriteCache } from './state.js';
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
import { drawIsoGround, isoToScreen, screenToIso, drawSunMoonToCtx } from './render/ground.js';
import { drawIncubator, drawIncubatorToCtx, drawEgg, drawEggToCtx, drawHatchingAnim, drawHatchingAnimToCtx } from './render/egg.js';
import { drawPetSprite } from './render/pet_sprite.js';

// ─── 游戏状态变量（从原始版恢复） ───

let ballGame = null

let volleyGame = null

let battlePetTeam = {}

let battleState = null

let toolParticles = []; // 道具粒子效果

function getPetSpriteCanvas(pet) {
  if (!pet) return null;
  const cacheKey = pet.id;
  const cached = petSpriteCache.get(cacheKey);
  // 缓存10秒，超时重新绘制
  if (cached && Date.now() - cached.timestamp < 10000) {
    return cached.canvas;
  }
  // 创建新的精灵 canvas
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 48;
  drawPetSprite(canvas, pet, 0);
  petSpriteCache.set(cacheKey, { canvas, timestamp: Date.now() });
  return canvas;
}

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
  const Y1 = 8, Y2 = 38;

  // ── 第一行：时间 · 孵化 · 温度 · 电量 · 宠物 ──
  // 时间图标
  const timeIcon = g.isDay ? '☀' : '🌙';
  const rem = g.isDay ? DAY_SEC - g.time : NGT_SEC - (g.time - DAY_SEC);
  drawText(`${timeIcon} ${Math.floor(rem/60)}:${String(Math.floor(rem%60)).padStart(2,'0')}`, 8, Y1, P.txt, 1);

  // 孵化进度
  drawText('🥚', 104, Y1, P.txt, 1);
  ctx.fillStyle = P.barBg;
  ctx.fillRect(122, Y1 + 4, 80, 8);
  const hatchColor = g.hatchPct > 80 ? P.happy : (g.hatchPct > 50 ? P.warn : '#aaa');
  ctx.fillStyle = hatchColor;
  ctx.fillRect(122, Y1 + 4, Math.floor(80 * g.hatchPct / 100), 8);
  drawText(`${Math.floor(g.hatchPct)}%`, 206, Y1, hatchColor, 1);

  // 温度
  const inOpt = g.temp >= TEMP_OPT_MIN && g.temp <= TEMP_OPT_MAX;
  const tempColor = g.temp > 40 ? P.danger : (g.temp < 30 ? P.tempCold : (inOpt ? P.happy : P.warn));
  drawText(`🌡${g.temp.toFixed(0)}°`, 254, Y1, tempColor, 1);

  // 电量
  const pColor = g.power < 20 ? P.danger : (g.power < 40 ? P.warn : '#4CAF50');
  drawText(`⚡${Math.floor(g.power)}`, 340, Y1, pColor, 1);

  // 宠物总数
  drawText(`🐾${g.pets.length}`, 420, Y1, P.dim, 1);

  // ── 第二行：天数 · 饥饿 · 加热状态 ──
  drawText(`📅${g.dayCount}天`, 8, Y2, P.dim, 1);

  if (g.currentPet) {
    const hungerColor = g.hunger < 30 ? P.danger : (g.hunger < 60 ? P.warn : '#4CAF50');
    drawText('🍖', 76, Y2, P.dim, 1);
    ctx.fillStyle = P.barBg;
    ctx.fillRect(96, Y2 + 4, 80, 8);
    ctx.fillStyle = hungerColor;
    ctx.fillRect(96, Y2 + 4, Math.floor(80 * g.hunger / 100), 8);
    drawText(`${Math.floor(g.hunger)}`, 180, Y2, hungerColor, 1);
  }

  // 加热/冰袋状态
  let heatIcon = '', heatClr = P.dim;
  if (g.heatOn && g.power > 0) { heatIcon = '🔥加热'; heatClr = P.danger; }
  else if (g.heatOn) { heatIcon = '🔥无电'; heatClr = P.dim; }
  else if (g.iceOn) { heatIcon = '🧊冰敷'; heatClr = '#00BFFF'; }
  else { heatIcon = '❄关'; heatClr = P.dim; }
  drawText(heatIcon, 620, Y1, heatClr, 1);
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
window.showToast = showToast; // 暴露到全局，供 HTML onclick 使用

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
    const petTypeIdx = getPetType(p);
    return `<div class="breed-pet-item" id="breed_item_${i}" onclick="toggleSynthSelect(${i})" style="display:flex;align-items:center;gap:10px;padding:8px;border-bottom:1px solid #333;cursor:pointer">
      <canvas id="breed_canvas_${i}" width="48" height="48" style="image-rendering:pixelated"></canvas>
      <div>
        <div style="color:${STAR_COLORS[p.star]}">${PET_EMOJI[petTypeIdx]||'🐾'} ${p.name} ${starStr}</div>
        <div style="color:#aaa;font-size:11px">${PET_TYPE_NAMES[petTypeIdx]||''} · F${p.generation} · ${geneStr} · Lv.${p.level}</div>
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
      <button onclick="autoSynth()" style="flex:1;padding:8px;background:#2a1a1a;border:2px solid #f55;color:#f88;cursor:pointer">自动合成</button>
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

// 自动合成：从最低星开始，自动批处理所有可合成组合
window.autoSynth = function() {
  let totalCount = 0;
  while (true) {
    // 按星级分组
    const groups = {};
    g.pets.forEach((p, i) => {
      if (!groups[p.star]) groups[p.star] = [];
      groups[p.star].push(i);
    });

    // 计算每种类型的宠物数量（用于优先保留稀有品种）
    const typeCounts = {};
    g.pets.forEach(p => {
      const t = getPetType(p);
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    });

    // 找最低星且 ≥3 只且 <5 星的组合
    const sortedStars = Object.keys(groups).map(Number).sort((a, b) => a - b);
    let found = false;
    for (const star of sortedStars) {
      if (star >= 5) continue;
      if (groups[star].length >= 3) {
        // 选 3 只同星宠物，按品种稀有度排序（稀有品种作为主合成体 petA）
        const candidates = groups[star].map(idx => ({
          idx,
          typeCount: typeCounts[getPetType(g.pets[idx])] || 999,
          pet: g.pets[idx]
        }));
        candidates.sort((a, b) => a.typeCount - b.typeCount);
        // 稀有品种做 petA（名字/基因继承给它），其余两个做 petB/petC
        const idxs = [candidates[0].idx, candidates[1].idx, candidates[2].idx];
        finalizeSynth(g.pets[idxs[0]], idxs[0], g.pets[idxs[1]], idxs[1], g.pets[idxs[2]], idxs[2]);
        totalCount++;
        found = true;
        break;
      }
    }
    if (!found) break;
  }
  closeOverlay();
  if (totalCount > 0) {
    showToast(`✅ 自动合成完成，共合成 ${totalCount} 次`);
  } else {
    showToast('没有可合成的组合（需要至少3只同星级宠物）');
  }
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
  const childName = petA.name;
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
    hp: newStar * 25, maxHp: newStar * 25, restUntil: 0,
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

  // 统计各类型数量
  const typeCounts = {};
  g.pets.forEach(p => {
    const t = getPetType(p);
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });

  let typeHtml = '<div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;justify-content:center">';
  for (let i = 0; i < 8; i++) {
    const discovered = g.discoveredTypes.includes(i);
    const name = PET_TYPE_NAMES[i];
    const emoji = PET_EMOJI[i];
    const count = typeCounts[i] || 0;
    if (discovered) {
      typeHtml += `<div style="flex:0 0 calc(50% - 6px);max-width:160px;background:#1a1a2e;border:2px solid #555;border-radius:8px;padding:6px;text-align:center;display:flex;align-items:center;gap:8px">
        <span style="font-size:28px">${emoji}</span>
        <div style="text-align:left"><div style="color:#FFD700;font-size:12px">${name}</div><div style="color:#4CAF50;font-size:10px">${count}只 ✓</div></div></div>`;
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

  const detailPetTypeIdx = getPetType(pet);
  msg.innerHTML = `<div class="title">${starStr}</div>
    <canvas id="${canvasId}" width="96" height="96" style="image-rendering:pixelated;margin:6px auto;display:block"></canvas>
    <div style="color:${STAR_COLORS[pet.star]};font-size:20px">${PET_EMOJI[detailPetTypeIdx]||'🐾'} ${pet.name}</div>
    <div style="color:#aaa;font-size:12px">${PET_TYPE_NAMES[detailPetTypeIdx]||''} · ${geneStr} · F${pet.generation}</div>
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

  // 随机事件
  g.eventCooldown -= dt;
  if (g.eventCooldown <= 0 && !g.eventMsg) {
    triggerRandomEvent();
  }
  if (g.eventTimer > 0) {
    g.eventTimer -= dt;
    if (g.eventTimer <= 0) {
      g.eventMsg = null;
      const el = document.getElementById('evt');
      if (el) el.classList.remove('show');
    }
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
  updateInteractBtn();
  updateToolParticles(dt);
  if (g.interactGame === 'ball' && ballGame) updateBallGame(dt);
  if (g.interactGame === 'volleyball' && volleyGame) updateVolleyball(dt);
  if (g.interactGame === 'battle' && battleState) updateBattle(dt);
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
    hp: star * 25, maxHp: star * 25, restUntil: 0,
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

  // ─── 互动游戏更新 & 渲染 ───
  if (g.interactGame === 'ball' && ballGame) {
    updateBallGame(dt);
    drawBallGame(ctx);
    requestAnimationFrame(loop);
    return;
  }
  if (g.interactGame === 'volleyball' && volleyGame) {
    updateVolleyball(dt);
    drawVolleyballGame(ctx);
    requestAnimationFrame(loop);
    return;
  }

  // ─── 宠物战斗渲染 ───
  if (battleState !== null) {
    updateBattle(dt);
    drawBattle(ctx);
    requestAnimationFrame(loop);
    return;
  }

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
    drawSunMoonToCtx(transOldCtx);
    if (g.sceneTransition.from === 'incubator') {
      drawIncubatorToCtx(transOldCtx);
      if (g.isHatching) drawHatchingAnimToCtx(transOldCtx);
      else drawEggToCtx(transOldCtx);
    } else {
      const sortedPets = [...g.pets].sort((a, b) => (a.isoCol||0)+(a.isoRow||0) - ((b.isoCol||0)+(b.isoRow||0)));
      sortedPets.forEach(pet => {
        if (pet.scenePos) drawPetToCtx(transOldCtx, pet, pet.scenePos.x, pet.scenePos.y - TILE_H / 2, {});
      });
    }
    ctx.drawImage(transOldCanvas, oldOffset, 0);

    // Render new scene
    drawIsoGroundToCtx(transNewCtx);
    drawSunMoonToCtx(transNewCtx);
    if (g.sceneTransition.to === 'incubator') {
      drawIncubatorToCtx(transNewCtx);
      if (g.isHatching) drawHatchingAnimToCtx(transNewCtx);
      else drawEggToCtx(transNewCtx);
    } else {
      const sortedPets = [...g.pets].sort((a, b) => (a.isoCol||0)+(a.isoRow||0) - ((b.isoCol||0)+(b.isoRow||0)));
      sortedPets.forEach(pet => {
        if (pet.scenePos) drawPetToCtx(transNewCtx, pet, pet.scenePos.x, pet.scenePos.y - TILE_H / 2, {});
      });
    }
    ctx.drawImage(transNewCanvas, newOffset, 0);
  } else if (g.interactGame === 'battle' && battleState) {
    drawBattle(ctx);
  } else if (g.interactGame === 'ball' && ballGame) {
    drawBallGame(ctx);
  } else if (g.interactGame === 'volleyball' && volleyGame) {
    drawVolleyballGame(ctx);
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
      if (p.hp === undefined || p.maxHp === undefined) { p.maxHp = p.star * 25; p.hp = p.maxHp; }
      if (p.restUntil === undefined) p.restUntil = 0;
      // 清理旧名数字后缀：如 "小球42" → "小球"
      if (typeof p.name === 'string') p.name = p.name.replace(/[\d]+$/g, '').replace(/·进化$/, '');
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

    // 小游戏结束后点击退出
    if (g.interactGame === 'ball' && ballGame && ballGame.state === 'done') {
      endBallGame(); return;
    }
    if (g.interactGame === 'volleyball' && volleyGame && volleyGame.state === 'done') {
      endVolleyballGame(); return;
    }

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

    // 战斗点击处理
    if (g.interactGame === 'battle' && battleState) {
      // 技能选择
      if (battleState.animPhase === 'skillSelect' && battleState.skillBtns) {
        for (const btn of battleState.skillBtns) {
          if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
            doBattleSkill(btn.skillKey);
            return;
          }
        }
      }
      // 目标选择
      if (battleState.animPhase === 'targeting' && battleState.targetBtns) {
        for (const btn of battleState.targetBtns) {
          if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
            doBattleTarget(btn.petId);
            return;
          }
        }
      }
      // 结果按钮
      if (battleState.animPhase === 'result' && window._battleResultBtns) {
        for (const btn of window._battleResultBtns) {
          if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
            btn.onclick();
            return;
          }
        }
      }
      return;
    }
  });

  canvasEl.addEventListener('mousedown', (e) => {
    if (g.sceneTransition.active) return;
    const { x, y } = getCoords(e);
    // 排球拖拽发球
    if (g.interactGame === 'volleyball') { onVolleyDragStart(x, y); return; }
    // 扔球拖拽
    if (g.interactGame === 'ball' && ballGame && ballGame.state === 'aim') {
      ballGame.dragStart = { x, y };
      ballGame.dragEnd = { x, y };
      return;
    }
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
    const { x, y } = getCoords(e);
    // 排球拖拽移动
    if (g.interactGame === 'volleyball') { onVolleyDragMove(x, y); return; }
    // 扔球拖拽移动
    if (g.interactGame === 'ball' && ballGame && ballGame.dragStart) {
      ballGame.dragEnd = { x, y };
      return;
    }
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
    // 排球拖拽结束
    if (g.interactGame === 'volleyball') { onVolleyDragEnd(); return; }
    // 扔球拖拽结束
    if (g.interactGame === 'ball' && ballGame && ballGame.dragStart) {
      const ds = ballGame.dragStart, de = ballGame.dragEnd;
      if (ds && de) {
        const dx = de.x - ds.x, dy = de.y - ds.y;
        const power = Math.min(Math.sqrt(dx*dx + dy*dy) * 2.5, 500);
        const angle = Math.atan2(dy, dx);
        ballGame.ball.vx = Math.cos(angle) * power;
        ballGame.ball.vy = Math.sin(angle) * power;
        ballGame.ball.thrown = true;
        ballGame.state = 'throw';
        playSound('pet');
      }
      ballGame.dragStart = null;
      ballGame.dragEnd = null;
      return;
    }
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
    // 排球拖拽
    if (g.interactGame === 'volleyball') { onVolleyDragStart(x, y); return; }
    // 扔球拖拽
    if (g.interactGame === 'ball' && ballGame && ballGame.state === 'aim') {
      ballGame.dragStart = { x, y };
      ballGame.dragEnd = { x, y };
      return;
    }
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
    const touch = e.touches[0];
    const rect = canvasEl.getBoundingClientRect();
    const x = (touch.clientX - rect.left) * (720 / rect.width);
    const y = (touch.clientY - rect.top) * (576 / rect.height);
    if (g.interactGame === 'volleyball') { onVolleyDragMove(x, y); return; }
    if (g.interactGame === 'ball' && ballGame && ballGame.dragStart) {
      ballGame.dragEnd = { x, y };
      return;
    }
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
    // 小游戏结束触摸退出
    if (g.interactGame === 'ball' && ballGame && ballGame.state === 'done') { endBallGame(); return; }
    if (g.interactGame === 'volleyball' && volleyGame && volleyGame.state === 'done') { endVolleyballGame(); return; }
    if (g.interactGame === 'volleyball') { onVolleyDragEnd(); return; }
    if (g.interactGame === 'ball' && ballGame && ballGame.dragStart) {
      const ds = ballGame.dragStart, de = ballGame.dragEnd;
      if (ds && de) {
        const dx = de.x - ds.x, dy = de.y - ds.y;
        const power = Math.min(Math.sqrt(dx*dx + dy*dy) * 2.5, 500);
        const angle = Math.atan2(dy, dx);
        ballGame.ball.vx = Math.cos(angle) * power;
        ballGame.ball.vy = Math.sin(angle) * power;
        ballGame.ball.thrown = true;
        ballGame.state = 'throw';
        playSound('pet');
      }
      ballGame.dragStart = null;
      ballGame.dragEnd = null;
      return;
    }
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
// 可选参数: spawnPet(0~7) 指定类型 (0猫 1狗 2兔子 3狐狸 4鼠 5龙 6鸟 7熊)
window.spawnPet = function(typeIdx) {
  const namePool = ['小球','毛球','豆豆','噗噗','咪咪','爪爪','果冻','棉花','糖糖','泡泡',
    '小云','小雪','小星','小月','小花','小果','小糖','小乖','小团','小圆',
    '大毛','大胖','大耳','大尾','绒球','豆花','糖豆','奶糖','奶茶',
    '云朵','星星','月亮','雪球','冰糕','可乐','布丁','麻薯','年糕',
    '小毛球','大耳朵','圆滚滚','胖嘟嘟','毛茸茸','软绵绵','甜丝丝',
    '小豆子','小团子','小汤圆','小布丁','花卷','包子','饺子','汤圆',
    '糯米','豆沙','咕噜','噜噜','哈哈','嘻嘻','呼噜',
    '嗡嗡','叮咚','嘎嘎','啾啾','咕咕','咪呜'];
  const petTypeNames = ['猫', '狗', '兔子', '狐狸', '鼠', '龙', '鸟', '熊'];
  const traits = ['活泼', '害羞', '贪吃', '懒散', '好奇', '忠诚', '倔强', '温柔'];
  const randomGene = () => Object.keys(GENES)[Math.floor(Math.random() * Object.keys(GENES).length)];
  // 如果指定了类型，反复生成名字直到哈希匹配
  const genName = () => namePool[Math.floor(Math.random() * namePool.length)];
  let name = genName();
  if (typeIdx !== undefined) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xFFFF;
    while (h % 8 !== typeIdx) { name = genName(); h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xFFFF; }
  }
  const star = Math.random() < 0.7 ? 1 : (Math.random() < 0.7 ? 2 : 3);
  const pet = {
    id: 'pet_' + Date.now(),
    name,
    type: 'normal',
    genes: [randomGene(), randomGene(), randomGene()],
    star,
    level: 1,
    exp: 0,
    eggDays: 0,
    state: 'idle',
    sprite: '🐾',
    scenePos: { x: 280 + Math.random() * 160, y: 310 + Math.random() * 80 },
    facingRight: true,
    clickReaction: null, petMood: 'normal',
    moodBubble: { show: false, timer: 0 },
    wanderTarget: null, wanderTimer: 2+Math.random()*3,
    wanderSpeed: 0.3+Math.random()*0.5, wanderIdle: 0,
    trait: traits[Math.floor(Math.random() * traits.length)],
    hunger: 80,
    intimacy: 50,
    temp: 25,
    health: 100,
    sleepDebt: 0,
    happy: 80,
    lastSleep: Date.now(),
    lastFeed: Date.now(),
    hp: star * 25, maxHp: star * 25, restUntil: 0,
  };
  g.pets.push(pet);
  saveGame();
  const petTypeIdx = (() => { let h=0; for(let i=0;i<name.length;i++) h=(h*31+name.charCodeAt(i))&0xFFFF; return h%8; })();
  console.log('✅ 新宠物 "' + name + '" [' + petTypeNames[petTypeIdx] + '] 基因:', pet.genes.join(''), '星星:', pet.star + '★', '总宠物数:', g.pets.length);
  showToast('🥚 新宠物 "' + name + '"（' + petTypeNames[petTypeIdx] + '）！');
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
    html += `<button onclick="showBattleSelect()" style="background:#3a1a1a;border:3px solid #E53935;color:#fff;padding:12px 16px;font-family:monospace;font-size:13px;cursor:pointer;min-width:110px;border-radius:6px">
      ⚔️ 对战</button>`;
  }

  html += '</div>';
  html += '<button onclick="closeOverlay()" style="margin-top:16px;background:#333;border:3px solid #666;color:#fff;padding:10px 24px;font-family:monospace;font-size:14px;cursor:pointer">返回</button>';

  const overlay = document.getElementById('overlay');
  const msg = document.getElementById('overlayMsg');
  msg.innerHTML = html;
  msg.style.maxWidth = '400px';
  overlay.classList.add('show');
}


// ─── 宠物叫声 ────────────────────────────────────────────────────
const PET_SOUNDS = ['dog', 'cat', 'rabbit', 'fox', 'mouse', 'dragon', 'bird', 'bear'];
const PET_SOUND_NAMES = { dog:'汪汪！', cat:'喵~', rabbit:'尖叫！', fox:'尖啸！', mouse:'吱吱！', dragon:'低吼！', bird:'啾啾！', bear:'吼！' };

function playPetSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    if (type === 'dog') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.1);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.2);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now); osc.stop(now + 0.3);
    } else if (type === 'cat') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
      osc.frequency.exponentialRampToValueAtTime(500, now + 0.25);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now); osc.stop(now + 0.3);
    } else if (type === 'rabbit') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.2);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.start(now); osc.stop(now + 0.25);
    } else if (type === 'fox') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.15);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.3);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.start(now); osc.stop(now + 0.35);
    } else if (type === 'mouse') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(1000, now + 0.1);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.start(now); osc.stop(now + 0.15);
    } else if (type === 'dragon') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.3);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now); osc.stop(now + 0.4);
    } else if (type === 'bird') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, now);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'bear') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now); osc.stop(now + 0.4);
    }
    setTimeout(() => ctx.close(), 500);
  } catch(e) {}
}

// ─── 文字/语音指令解析 ────────────────────────────────────────────
function executeVoiceCommand(text) {
  const t = text.trim();
  if (!t) return;

  // 叫名字反应：喊 "[名字]" → 该宠物叫
  const nameMatch = t.match(/^(.+?)[\s,，.。!！?？]?$/);
  if (nameMatch) {
    const calledName = nameMatch[1].trim();
    if (['所有宠物排队', '所有宠物'].includes(calledName)) {
      // 排队指令，下面处理
    } else {
      const pet = g.pets.find(p => p.name === calledName);
      if (pet) {
        const typeIdx = getPetType(pet);
        const soundType = PET_SOUNDS[typeIdx];
        playPetSound(soundType);
        showToast(pet.name + '：' + (PET_SOUND_NAMES[soundType] || '叫了一声'));
        pet.petMood = 'happy';
        pet.moodBubble = { show: true, timer: 2.5, text: PET_SOUND_NAMES[soundType] || '叫了' };
        pet.clickReaction = { type: 'bounce', time: 0 };
        return;
      }
    }
  }

  // "[名字]，过来" → 宠物跑到中间
  const comeMatch = t.match(/^(.+?)[,，]\s*过来$/);
  if (comeMatch) {
    const petName = comeMatch[1].trim();
    const pet = g.pets.find(p => p.name === petName);
    if (pet) {
      if (!pet.scenePos) pet.scenePos = { x: 360, y: 300 };
      pet.scenePos.x = 360;
      pet.scenePos.y = 300;
      pet.petMood = 'happy';
      pet.moodBubble = { show: true, timer: 2, text: '来啦！' };
      pet.clickReaction = { type: 'bounce', time: 0 };
      showToast(pet.name + '跑过来了！');
      playPetSound(PET_SOUNDS[getPetType(pet)]);
      return;
    } else {
      showToast('没找到叫「' + petName + '」的宠物');
      return;
    }
  }

  // ─── 队形指令 ───────────────────────────────────────────────────
  const setPetsPositions = (positions, holdSeconds = 8) => {
    g.pets.forEach((pet, i) => {
      if (!pet.scenePos) pet.scenePos = { x: 360, y: 300 };
      if (positions[i]) {
        pet.scenePos.x = positions[i].x;
        pet.scenePos.y = positions[i].y;
      }
      pet.wanderTarget = null;
      pet.wanderTimer = holdSeconds + Math.random() * 3;
      pet.wanderIdle = 0;
      pet.petMood = 'happy';
      pet.moodBubble = { show: true, timer: holdSeconds, text: '到！' };
    });
  };

  // 一排（横排）
  if (t.includes('一排') || t.includes('横排') || t.includes('排成一排') || t.includes('站好') || t.includes('立正')) {
    if (g.pets.length === 0) { showToast('还没有宠物！'); return; }
    const count = g.pets.length;
    const spacing = Math.min(80, 700 / count);
    const startX = 360 - (count - 1) * spacing / 2;
    const positions = g.pets.map((_, i) => ({ x: startX + i * spacing, y: 300 }));
    setPetsPositions(positions);
    showToast('🐾 ' + count + '只宠物排成一排！');
    return;
  }

  // 两排
  if (t.includes('两排') || t.includes('两行') || t.includes('排成两排') || t.includes('排成两行')) {
    if (g.pets.length === 0) { showToast('还没有宠物！'); return; }
    const count = g.pets.length;
    const half = Math.ceil(count / 2);
    const spacing = Math.min(80, 500 / half);
    const startX = 360 - (half - 1) * spacing / 2;
    const positions = g.pets.map((_, i) => ({
      x: startX + (i % half) * spacing,
      y: i < half ? 240 : 360
    }));
    setPetsPositions(positions);
    showToast('🐾 ' + count + '只宠物排成两排！');
    return;
  }

  // 三排
  if (t.includes('三排') || t.includes('三行') || t.includes('排成三排') || t.includes('排成三行')) {
    if (g.pets.length === 0) { showToast('还没有宠物！'); return; }
    const count = g.pets.length;
    const cols = Math.ceil(count / 3);
    const spacingX = Math.min(80, 600 / cols);
    const spacingY = 70;
    const startX = 360 - (cols - 1) * spacingX / 2;
    const positions = g.pets.map((_, i) => ({
      x: startX + (i % cols) * spacingX,
      y: 200 + Math.floor(i / cols) * spacingY
    }));
    setPetsPositions(positions);
    showToast('🐾 ' + count + '只宠物排成三排！');
    return;
  }

  // 圆圈 / 围圈
  if (t.includes('圆圈') || t.includes('围成圈') || t.includes('围圈') || t.includes('站成一圈') || t.includes('围成圆')) {
    if (g.pets.length === 0) { showToast('还没有宠物！'); return; }
    const count = g.pets.length;
    const radius = Math.min(160, 80 * count);
    const cx = 360, cy = 300;
    const positions = g.pets.map((_, i) => {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
    });
    setPetsPositions(positions);
    showToast('🐾 ' + count + '只宠物围成一圈！');
    return;
  }

  // 方阵
  if (t.includes('方阵') || t.includes('方队') || t.includes('排成方阵')) {
    if (g.pets.length === 0) { showToast('还没有宠物！'); return; }
    const count = g.pets.length;
    const cols = Math.ceil(Math.sqrt(count));
    const spacing = 75;
    const startX = 360 - (cols - 1) * spacing / 2;
    const startY = 300 - (cols - 1) * spacing / 2;
    const positions = g.pets.map((_, i) => ({
      x: startX + (i % cols) * spacing,
      y: startY + Math.floor(i / cols) * spacing
    }));
    setPetsPositions(positions);
    showToast('🐾 ' + count + '只宠物排成方阵！');
    return;
  }

  // 散开 / 分散
  if (t.includes('散开') || t.includes('分散') || t.includes('自由活动')) {
    if (g.pets.length === 0) { showToast('还没有宠物！'); return; }
    const positions = g.pets.map(() => ({
      x: 100 + Math.random() * 520,
      y: 150 + Math.random() * 250
    }));
    setPetsPositions(positions);
    showToast('🐾 ' + g.pets.length + '只宠物散开自由活动！');
    return;
  }

  // 报数
  if (t.includes('报数')) {
    if (g.pets.length === 0) { showToast('还没有宠物！'); return; }
    const count = g.pets.length;
    const spacing = 80;
    const startX = 360 - (count - 1) * spacing / 2;
    const positions = g.pets.map((_, i) => ({ x: startX + i * spacing, y: 300 }));
    setPetsPositions(positions, 15);
    g.pets.forEach((pet, i) => {
      setTimeout(() => {
        pet.petMood = 'happy';
        pet.moodBubble = { show: true, timer: 3, text: '第' + (i + 1) + '！' };
        pet.clickReaction = { type: 'bounce', time: 0 };
        playPetSound(PET_SOUNDS[getPetType(pet)]);
        showToast(pet.name + '：第' + (i + 1) + '！', 2);
      }, i * 180);
    });
    showToast('🐾 ' + count + '只宠物报数！');
    return;
  }

  // 集中 / 聚拢 / 集合
  if (t.includes('集中') || t.includes('聚拢') || t.includes('集合') || t.includes('过来集合')) {
    if (g.pets.length === 0) { showToast('还没有宠物！'); return; }
    const positions = g.pets.map((_, i) => {
      const angle = (i / g.pets.length) * Math.PI * 2;
      return { x: 360 + Math.cos(angle) * 60, y: 300 + Math.sin(angle) * 40 };
    });
    setPetsPositions(positions);
    showToast('🐾 ' + g.pets.length + '只宠物集合！');
    return;
  }

  // 排队（默认一排）
  if (t === '排队' || t === '排队列' || t.includes('排队')) {
    if (g.pets.length === 0) { showToast('还没有宠物！'); return; }
    const count = g.pets.length;
    const spacing = Math.min(60, 600 / count);
    const startX = 360 - (count - 1) * spacing / 2;
    const positions = g.pets.map((_, i) => ({ x: startX + i * spacing, y: 300 }));
    setPetsPositions(positions);
    showToast('🐾 ' + count + '只宠物排成一排！');
    return;
  }

  // 所有宠物（默认一排）
  if (t.includes('所有宠物') || t.includes('全部宠物') || t === '来') {
    if (g.pets.length === 0) { showToast('还没有宠物！'); return; }
    const count = g.pets.length;
    const spacing = Math.min(60, 600 / count);
    const startX = 360 - (count - 1) * spacing / 2;
    const positions = g.pets.map((_, i) => ({ x: startX + i * spacing, y: 300 }));
    setPetsPositions(positions);
    showToast('🐾 ' + count + '只宠物排成一排！');
    return;
  }

  showToast('听不懂：「' + t + '」');
}

// ─── 文字指令输入 ─────────────────────────────────────────────────
window.executeTextCommand = function() {
  const input = document.getElementById('voiceTextInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  executeVoiceCommand(text);
};

// ─── 本地语音识别 ─────────────────────────────────────────────────
let voiceActive = false;
let mediaRecorder = null;
let audioChunks = [];

window.startVoiceCommand = async function() {
  if (voiceActive) {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
    voiceActive = false;
    document.getElementById('voiceStatus').textContent = '可用';
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
  } catch (e) {
    if (e.name === 'NotAllowedError') {
      showToast('🎤 麦克风权限被拒绝，请在浏览器设置中允许');
    } else {
      showToast('🎤 无法访问麦克风');
    }
    return;
  }

  voiceActive = true;
  audioChunks = [];
  document.getElementById('voiceStatus').textContent = '聆听中...';
  showToast('🎤 请说话（喊名字、名字+过来、所有宠物排队）', 4);

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/webm';

    mediaRecorder = new MediaRecorder(stream, { mimeType });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(track => track.stop());

      if (audioChunks.length === 0) {
        voiceActive = false;
        document.getElementById('voiceStatus').textContent = '可用';
        return;
      }

      document.getElementById('voiceStatus').textContent = '识别中...';

      const audioBlob = new Blob(audioChunks, { type: mimeType });
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result.split(',')[1];

        try {
          const response = await fetch('http://127.0.0.1:8765/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio: base64, language: 'zh' }),
          });

          if (!response.ok) {
            throw new Error('API错误: ' + response.status);
          }

          const result = await response.json();
          const text = result.text || '';

          if (text) {
            showToast('你说：「' + text + '」', 3);
            executeVoiceCommand(text);
          } else {
            showToast('🎤 没听清楚，请再说一次');
          }
        } catch (e) {
          console.error('语音识别失败:', e);
          if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
            showToast('🎤 本地识别服务未启动，请运行: python voice_server.py', 5);
          } else {
            showToast('🎤 识别失败: ' + e.message);
          }
        }

        voiceActive = false;
        document.getElementById('voiceStatus').textContent = '可用';
      };
      reader.readAsDataURL(audioBlob);
    };

    mediaRecorder.onerror = (e) => {
      console.error('MediaRecorder错误:', e);
      stream.getTracks().forEach(track => track.stop());
      voiceActive = false;
      document.getElementById('voiceStatus').textContent = '可用';
      showToast('🎤 录音出错');
    };

    mediaRecorder.start();
    setTimeout(() => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    }, 10000);

  } catch (e) {
    console.error('录音错误:', e);
    voiceActive = false;
    document.getElementById('voiceStatus').textContent = '可用';
    if (e.name === 'NotAllowedError') {
      showToast('🎤 麦克风权限被拒绝');
    } else {
      showToast('🎤 录音失败: ' + e.message);
    }
  }
};

// Other stubs
// ─── 扔球游戏 ───

window.startBallGame = function() {
  closeOverlay();
  if (selectedInteractPets.length === 0) return;
  initAudio();
  playSound('pet');

  const pet = g.pets.find(p => p.id === selectedInteractPets[0]);
  if (!pet) return;
  // 找宠物当前位置作为起点
  const petX = pet.scenePos ? pet.scenePos.x : 360;
  const petY = pet.scenePos ? pet.scenePos.y : 350;

  ballGame = {
    pet: pet,
    petX: petX,
    petY: petY,
    petTargetX: petX,
    petTargetY: petY,
    ball: { x: petX, y: petY - 30, vx: 0, vy: 0, thrown: false, landed: false, landX: 0, landY: 0 },
    state: 'aim',  // 'aim' | 'throw' | 'chase' | 'catch' | 'miss' | 'done'
    score: 0,
    throwsLeft: 5,
    dragStart: null,
    dragEnd: null,
    catchTimer: 0,
    missTimer: 0,
    resultTimer: 0,
    caught: false,
  };
  g.interactGame = 'ball';
}

function updateBallGame(dt) {
  if (!ballGame) return;
  const bg = ballGame;

  if (bg.state === 'aim') {
    // 等待拖拽
  } else if (bg.state === 'throw') {
    // 球飞行
    const b = bg.ball;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.vy += 600 * dt; // 重力
    // 地面碰撞
    const groundY = bg.petY;
    if (b.y >= groundY - 10) {
      b.y = groundY - 10;
      b.landed = true;
      b.landX = b.x;
      b.landY = b.y;
      bg.state = 'chase';
      bg.petTargetX = b.x;
      bg.petTargetY = b.y;
      playSound('pet');
    }
    // 出界
    if (b.x < 50 || b.x > 670 || b.y > 580) {
      bg.state = 'miss';
      bg.missTimer = 1.5;
    }
  } else if (bg.state === 'chase') {
    // 宠物追球
    const speed = 180;
    const dx = bg.petTargetX - bg.petX;
    const dy = bg.petTargetY - bg.petY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 5) {
      bg.petX += (dx / dist) * speed * dt;
      bg.petY += (dy / dist) * speed * dt;
      // 宠物朝向
      bg.pet.facingRight = dx > 0;
    } else {
      // 到达球位置
      if (bg.ball.landed) {
        // 球已落地，错过接球机会
        bg.state = 'miss';
        bg.missTimer = 1.0;
        bg.throwsLeft--;
        showToast(`球已落地，没接住... ${bg.throwsLeft}次机会`);
        playSound('warning');
        if (bg.throwsLeft <= 0) {
          bg.state = 'done';
          bg.resultTimer = 2.0;
        }
      } else {
        // 空中接住
        bg.state = 'catch';
        bg.catchTimer = 1.0;
        bg.caught = Math.random() < 0.85; // 85% 概率接住
      }
    }
  } else if (bg.state === 'catch') {
    bg.catchTimer -= dt;
    if (bg.catchTimer <= 0) {
      if (bg.caught) {
        bg.score++;
        bg.throwsLeft--;
        showToast(`接住了！${bg.throwsLeft}次机会`);
        playSound('levelUp');
      } else {
        bg.throwsLeft--;
        showToast(`没接住... ${bg.throwsLeft}次机会`);
        playSound('warning');
      }
      if (bg.throwsLeft <= 0) {
        bg.state = 'done';
        bg.resultTimer = 2.0;
      } else {
        // 重置到aim
        bg.ball.thrown = false;
        bg.ball.landed = false;
        bg.ball.x = bg.petX;
        bg.ball.y = bg.petY - 30;
        bg.state = 'aim';
      }
    }
  } else if (bg.state === 'miss') {
    bg.missTimer -= dt;
    if (bg.missTimer <= 0) {
      bg.throwsLeft--;
      showToast(`出界了... ${bg.throwsLeft}次机会`);
      if (bg.throwsLeft <= 0) {
        bg.state = 'done';
        bg.resultTimer = 2.0;
      } else {
        bg.ball.thrown = false;
        bg.ball.landed = false;
        bg.ball.x = bg.petX;
        bg.ball.y = bg.petY - 30;
        bg.state = 'aim';
      }
    }
  } else if (bg.state === 'done') {
    bg.resultTimer -= dt;
    if (bg.resultTimer <= 0) {
      endBallGame();
    }
  }
}

function endBallGame() {
  const bg = ballGame;
  if (!bg) return;
  // 结算奖励
  const bonus = bg.score * 2;
  const intimacyGain = bg.score * 10;
  g.intimacy = Math.min(100, g.intimacy + intimacyGain);
  addExp(bg.pet, bg.score * 5);
  g.hunger = Math.max(0, g.hunger - bg.score);
  showToast(`${bg.pet.name} 扔球结束！接住 ${bg.score} 个，亲密+${intimacyGain}`);
  playSound('levelUp');
  saveGame();
  ballGame = null;
  g.interactGame = null;
  selectedInteractPets = [];
}

function drawBallGame(ctx) {
  if (!ballGame) return;
  const bg = ballGame;

  // 背景
  ctx.fillStyle = '#1a2a1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 草地
  ctx.fillStyle = '#2a4a2a';
  ctx.fillRect(0, 350, canvas.width, canvas.height - 350);
  ctx.fillStyle = '#3a5a3a';
  ctx.fillRect(0, 350, canvas.width, 6);

  // 标题
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(`⚾ 扔球游戏  剩余 ${bg.throwsLeft} 次  接住 ${bg.score} 个`, 200, 30);

  // 指示文字
  if (bg.state === 'aim') {
    ctx.fillStyle = '#aaa';
    ctx.font = '14px monospace';
    ctx.fillText('拖动抛球！松开后球会飞向拖动方向', 220, 60);
    // 画拖拽预览线
    if (bg.dragStart && bg.dragEnd) {
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(bg.dragStart.x, bg.dragStart.y);
      ctx.lineTo(bg.dragEnd.x, bg.dragEnd.y);
      ctx.stroke();
      ctx.setLineDash([]);
      // 箭头方向
      const dx = bg.dragEnd.x - bg.dragStart.x;
      const dy = bg.dragEnd.y - bg.dragStart.y;
      ctx.fillStyle = '#FF4500';
      ctx.beginPath();
      ctx.arc(bg.dragEnd.x, bg.dragEnd.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 画宠物（简化版）
  const petCanvas = getPetSpriteCanvas(bg.pet);
  if (petCanvas) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(petCanvas, bg.petX - 24, bg.petY - 48, 48, 48);
    ctx.restore();
  }

  // 画球
  if (bg.ball.thrown || bg.ball.landed) {
    ctx.fillStyle = '#FF4500';
    ctx.beginPath();
    ctx.arc(bg.ball.x, bg.ball.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(bg.ball.x - 3, bg.ball.y - 3, 3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // 球在宠物手里
    ctx.fillStyle = '#FF4500';
    ctx.beginPath();
    ctx.arc(bg.petX + 20, bg.petY - 40, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // 结果提示
  if (bg.state === 'catch') {
    ctx.fillStyle = bg.caught ? '#4CAF50' : '#FF4500';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(bg.caught ? '🎉 接住了！' : '😢 没接住...', 280, 300);
  } else if (bg.state === 'done') {
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 28px monospace';
    ctx.fillText(`🏆 游戏结束！接住 ${bg.score} 个`, 200, 280);
    ctx.font = '16px monospace';
    ctx.fillStyle = '#aaa';
    ctx.fillText('点击任意处继续...', 280, 320);
  }
}

function predictBallAt(ball, t, gravity, netX, netTop, groundY) {
  let x = ball.x, y = ball.y;
  let vx = ball.vx, vy = ball.vy;
  const dt = 0.03;
  for (let i = 0; i < Math.ceil(t / dt); i++) {
    vy += gravity * dt;
    x += vx * dt;
    y += vy * dt;
    // 天花板
    if (y < 30) { y = 30; vy = Math.abs(vy) * 0.6; }
    // 地面
    if (y > groundY - 12) { y = groundY - 12; vy = -Math.abs(vy) * 0.65; vx *= 0.75; }
    // 出界
    if (x < 15 || x > 705) break;
    // 触网
    if (x > netX - 12 && x < netX + 12 && y > netTop) break;
  }
  return { x, y };
}

// ─── 排球游戏 ───

window.startVolleyballGame = function() {
  closeOverlay();
  if (selectedInteractPets.length !== 2) return;
  initAudio();
  playSound('pet');

  const pet1 = g.pets.find(p => p.id === selectedInteractPets[0]);
  const pet2 = g.pets.find(p => p.id === selectedInteractPets[1]);
  if (!pet1 || !pet2) return;

  volleyGame = {
    pets: [pet1, pet2],
    pos: [
      { x: 120, y: 420 },
      { x: 600, y: 420 }
    ],
    ball: { x: 120, y: 380, vx: 0, vy: 0, dragging: false },
    state: 'serve',
    scores: [0, 0],
    serveSide: 0, // 0=左半场先发
    rallyCount: 0,
    winner: null,
    dragStart: null,
    dragEnd: null,
    gravity: 600,
    netX: 360,
    netTop: 340,
    groundY: 470,
    winScore: 5,
  };
  g.interactGame = 'volleyball';
  resetBallToServer();
}

function resetBallToServer() {
  const vg = volleyGame;
  const server = vg.serveSide;
  const sx = server === 0 ? 120 : 600;
  vg.pos[server].x = sx;
  vg.pos[server].y = 420;
  vg.pos[1 - server].x = server === 0 ? 600 : 120;
  vg.pos[1 - server].y = 420;
  vg.ball.x = sx;
  vg.ball.y = 380;
  vg.ball.vx = 0;
  vg.ball.vy = 0;
  vg.ball.dragging = false;
  vg.state = 'serve';
  vg.dragStart = null;
  vg.dragEnd = null;
}

function updateVolleyball(dt) {
  if (!volleyGame) return;
  const vg = volleyGame;

  if (vg.state === 'done') return;

  // ── 智能接球目标：当球飞行时，预测拦截点 ──
  if ((vg.state === 'fly' || vg.state === 'hit') && !vg.ball.dragging) {
    const receiver = 1 - vg.serveSide;
    const rp = vg.pos[receiver];
    // 宠物到达 ball 位置的预估时间（按移动速度 200px/s）
    const distToBall = Math.sqrt((vg.ball.x - rp.x) ** 2 + (vg.ball.y - rp.y) ** 2);
    const timeToReach = Math.max(0.2, distToBall / 220);
    const predicted = predictBallAt(vg.ball, timeToReach, vg.gravity, vg.netX, vg.netTop, vg.groundY);
    // 接球目标：预测球位置，但 y 不低于 200（宠物能跳起来接）
    vg.catchTarget = vg.catchTarget || [null, null];
    vg.catchTarget[receiver] = {
      x: predicted.x,
      y: Math.max(200, Math.min(vg.groundY - 30, predicted.y))
    };
  }

  // 宠物自动移动到接球目标
  for (let i = 0; i < 2; i++) {
    const p = vg.pos[i];
    const target = vg.catchTarget && vg.catchTarget[i] ? vg.catchTarget[i] : null;
    if (target) {
      const dx = target.x - p.x;
      if (Math.abs(dx) > 5) {
        p.x += (dx > 0 ? 1 : -1) * Math.min(Math.abs(dx), 200 * dt);
      }
      const dy = target.y - p.y;
      if (Math.abs(dy) > 5) {
        p.y += (dy > 0 ? 1 : -1) * Math.min(Math.abs(dy), 150 * dt);
      }
      // 边界
      if (i === 0) {
        p.x = Math.max(50, Math.min(vg.netX - 40, p.x));
      } else {
        p.x = Math.max(vg.netX + 40, Math.min(670, p.x));
      }
      // 宠物可跳起接球：y 下限从 350 改为 200（数值越小跳得越高）
      p.y = Math.max(200, Math.min(vg.groundY - 30, p.y));
    }
  }

  if (vg.state === 'serve') {
    // 等待拖拽发球
  } else if (vg.state === 'fly') {
    const b = vg.ball;
    b.vy += vg.gravity * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // 地面反弹
    if (b.y >= vg.groundY - 12) {
      b.y = vg.groundY - 12;
      b.vy = -Math.abs(b.vy) * 0.65;
      b.vx *= 0.75;
      playSound('pet');
      if (Math.abs(b.vy) < 60) {
        // 球停了，对方得分
        vg.state = 'miss';
        const loser = b.x < vg.netX ? 0 : 1;
        setTimeout(() => scorePointVolley(1 - loser), 800);
        return;
      }
    }

    // 天花板
    if (b.y < 30) {
      b.y = 30;
      b.vy = Math.abs(b.vy) * 0.6;
    }

    // 出界
    if (b.x < 15 || b.x > 705) {
      vg.state = 'miss';
      const loser = b.x < vg.netX ? 0 : 1;
      setTimeout(() => scorePointVolley(1 - loser), 800);
      return;
    }

    // 触网
    if (b.x > vg.netX - 12 && b.x < vg.netX + 12 && b.y > vg.netTop) {
      vg.state = 'miss';
      const loser = b.x < vg.netX ? 0 : 1;
      setTimeout(() => scorePointVolley(1 - loser), 800);
      return;
    }

    // 对方宠物接球检测
    const receiver = 1 - vg.serveSide;
    const rp = vg.pos[receiver];
    const dx = b.x - rp.x;
    const dy = b.y - (rp.y - 15);
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 38 && b.vy > -50) {
      // 接住了！反弹回去
      vg.state = 'hit';
      vg.rallyCount++;
      playSound('pet');
      // 计算反弹方向：向对方半场打
      const targetX = receiver === 0 ? 550 : 170;
      const angle = Math.atan2(-200, (targetX - rp.x));
      const speed = 250 + Math.random() * 80;
      b.vx = Math.cos(angle) * speed * (receiver === 0 ? 1 : -1);
      b.vy = Math.sin(angle) * speed;
      // 交换发球方
      vg.serveSide = receiver;
      vg.state = 'fly';
      // 设定接球目标为发球方（接完球要去接下一次）
      vg.catchTarget = [null, null];
      vg.catchTarget[vg.serveSide] = { x: vg.serveSide === 0 ? 120 : 600, y: 400 };
      vg.catchTarget[1 - vg.serveSide] = { x: vg.serveSide === 0 ? 550 : 170, y: 380 + Math.random() * 60 };
    }

    // 自己接自己的球？（漏接）
    const server = vg.serveSide;
    const sp = vg.pos[server];
    const sdx = b.x - sp.x;
    const sdy = b.y - (sp.y - 15);
    const sdist = Math.sqrt(sdx * sdx + sdy * sdy);
    if (sdist < 38 && b.vy > -50 && vg.rallyCount === 0) {
      // 发球失误，直接丢分
      vg.state = 'miss';
      setTimeout(() => scorePointVolley(1 - server), 800);
    }
  } else if (vg.state === 'hit') {
    // 球飞行中，等待下一次接球或得分
    const b = vg.ball;
    b.vy += vg.gravity * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    if (b.y >= vg.groundY - 12) {
      b.y = vg.groundY - 12;
      b.vy = -Math.abs(b.vy) * 0.65;
      b.vx *= 0.75;
      playSound('pet');
      if (Math.abs(b.vy) < 60) {
        vg.state = 'miss';
        const loser = b.x < vg.netX ? 0 : 1;
        setTimeout(() => scorePointVolley(1 - loser), 800);
        return;
      }
    }
    if (b.y < 30) { b.y = 30; b.vy = Math.abs(b.vy) * 0.6; }
    if (b.x < 15 || b.x > 705) {
      vg.state = 'miss';
      const loser = b.x < vg.netX ? 0 : 1;
      setTimeout(() => scorePointVolley(1 - loser), 800);
      return;
    }
    if (b.x > vg.netX - 12 && b.x < vg.netX + 12 && b.y > vg.netTop) {
      vg.state = 'miss';
      const loser = b.x < vg.netX ? 0 : 1;
      setTimeout(() => scorePointVolley(1 - loser), 800);
      return;
    }

    // 接球检测
    const receiver = 1 - vg.serveSide;
    const rp = vg.pos[receiver];
    const dx = b.x - rp.x;
    const dy = b.y - (rp.y - 15);
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 38 && b.vy > -50) {
      vg.state = 'hit';
      vg.rallyCount++;
      playSound('pet');
      const targetX = receiver === 0 ? 550 : 170;
      const angle = Math.atan2(-200, (targetX - rp.x));
      const speed = 280 + Math.random() * 80;
      b.vx = Math.cos(angle) * speed * (receiver === 0 ? 1 : -1);
      b.vy = Math.sin(angle) * speed;
      vg.serveSide = receiver;
      vg.catchTarget = [null, null];
      vg.catchTarget[vg.serveSide] = { x: vg.serveSide === 0 ? 120 : 600, y: 400 };
      vg.catchTarget[1 - vg.serveSide] = { x: vg.serveSide === 0 ? 550 : 170, y: 380 + Math.random() * 60 };
    }
  }
}

function scorePointVolley(winnerIdx) {
  const vg = volleyGame;
  if (!vg || vg.state === 'done') return;
  vg.scores[winnerIdx]++;
  playSound('warning');

  if (vg.scores[winnerIdx] >= vg.winScore) {
    vg.winner = winnerIdx;
    vg.state = 'done';
    showToast(`🏆 ${vg.pets[winnerIdx].name} 获胜！`);
    addExp(vg.pets[winnerIdx], 20);
    addExp(vg.pets[1 - winnerIdx], 8);
    saveGame();
  } else {
    showToast(`${vg.pets[winnerIdx].name} 得一分！${vg.scores[0]}-${vg.scores[1]}`);
    // 丢分方发球
    vg.serveSide = 1 - winnerIdx;
    vg.rallyCount = 0;
    vg.catchTarget = [null, null];
    setTimeout(() => {
      if (volleyGame) resetBallToServer();
    }, 1000);
  }
}

function endVolleyballGame() {
  volleyGame = null;
  g.interactGame = null;
  selectedInteractPets = [];
}

function drawVolleyballGame(ctx) {
  if (!volleyGame) return;
  const vg = volleyGame;

  // 天空
  ctx.fillStyle = '#1a2a4a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 地面
  ctx.fillStyle = '#2a6a2a';
  ctx.fillRect(0, vg.groundY, canvas.width, canvas.height - vg.groundY);
  ctx.fillStyle = '#3a8a3a';
  ctx.fillRect(0, vg.groundY, canvas.width, 6);

  // 场地线
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(20, vg.groundY + 5, 680, 96);

  // 网
  ctx.fillStyle = '#bbb';
  ctx.fillRect(vg.netX - 2, vg.netTop - 5, 4, vg.groundY - vg.netTop + 5);
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  for (let ny = vg.netTop; ny < vg.groundY; ny += 18) {
    ctx.beginPath();
    ctx.moveTo(vg.netX - 18, ny);
    ctx.lineTo(vg.netX + 18, ny);
    ctx.stroke();
  }

  // 分数
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(`${vg.pets[0].name}: ${vg.scores[0]}`, 40, 38);
  ctx.fillText(`${vg.pets[1].name}: ${vg.scores[1]}`, 480, 38);
  ctx.font = '13px monospace';
  ctx.fillStyle = '#aaa';
  ctx.fillText(`回合 ${vg.rallyCount}`, 310, 38);

  // 发球提示
  if (vg.state === 'serve') {
    const server = vg.serveSide;
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`拖动球发球 →`, vg.pos[server].x - 50, vg.pos[server].y - 65);
  }

  // 拖拽预览轨迹
  if (vg.dragStart && vg.dragEnd && vg.state === 'serve') {
    const ds = vg.dragStart;
    const de = vg.dragEnd;
    const dx = de.x - ds.x;
    const dy = de.y - ds.y;
    const power = Math.min(Math.sqrt(dx * dx + dy * dy) * 2.5, 500);
    const angle = Math.atan2(dy, dx);

    // 预测轨迹点
    ctx.strokeStyle = 'rgba(255,200,0,0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    let px = vg.ball.x, py = vg.ball.y;
    let pvx = Math.cos(angle) * power;
    let pvy = Math.sin(angle) * power;
    ctx.moveTo(px, py);
    for (let t = 0; t < 40; t++) {
      pvy += vg.gravity * 0.03;
      px += pvx * 0.03;
      py += pvy * 0.03;
      if (py > vg.groundY - 12) break;
      if (px < 10 || px > 710) break;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // 箭头
    ctx.fillStyle = '#FF6600';
    ctx.beginPath();
    ctx.arc(de.x, de.y, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  // 宠物
  for (let i = 0; i < 2; i++) {
    const petCanvas = getPetSpriteCanvas(vg.pets[i]);
    if (petCanvas) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(petCanvas, vg.pos[i].x - 24, vg.pos[i].y - 48, 48, 48);
      ctx.restore();
    }
    ctx.fillStyle = STAR_COLORS[vg.pets[i].star] || '#aaa';
    ctx.font = '11px monospace';
    ctx.fillText(vg.pets[i].name, vg.pos[i].x - 22, vg.pos[i].y - 52);
  }

  // 排球
  const b = vg.ball;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(b.x, b.y, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(b.x - 12, b.y);
  ctx.lineTo(b.x + 12, b.y);
  ctx.moveTo(b.x, b.y - 12);
  ctx.lineTo(b.x, b.y + 12);
  ctx.stroke();

  // 提示
  if (vg.state === 'done') {
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 28px monospace';
    ctx.fillText(`🏆 ${vg.pets[vg.winner].name} 获胜！`, 180, 260);
    ctx.font = '15px monospace';
    ctx.fillStyle = '#aaa';
    ctx.fillText('点击任意处结束', 280, 300);
  }
}

function onVolleyDragStart(x, y) {
  if (!volleyGame || volleyGame.state !== 'serve') return;
  const vg = volleyGame;
  const b = vg.ball;
  const dx = x - b.x, dy = y - b.y;
  if (Math.sqrt(dx * dx + dy * dy) < 35) {
    vg.ball.dragging = true;
    vg.dragStart = { x, y };
    vg.dragEnd = { x, y };
  }
}

function onVolleyDragMove(x, y) {
  if (!volleyGame || !volleyGame.ball.dragging) return;
  volleyGame.dragEnd = { x, y };
}

function onVolleyDragEnd() {
  if (!volleyGame || !volleyGame.ball.dragging) return;
  const vg = volleyGame;
  const ds = vg.dragStart;
  const de = vg.dragEnd;
  if (ds && de) {
    const dx = de.x - ds.x;
    const dy = de.y - ds.y;
    const power = Math.min(Math.sqrt(dx * dx + dy * dy) * 2.5, 500);
    const angle = Math.atan2(dy, dx);
    vg.ball.vx = Math.cos(angle) * power;
    vg.ball.vy = Math.sin(angle) * power;
    vg.state = 'fly';
    // 设定接球目标
    const receiver = 1 - vg.serveSide;
    vg.catchTarget = [null, null];
    vg.catchTarget[receiver] = { x: receiver === 0 ? 200 + Math.random() * 200 : 320 + Math.random() * 200, y: 380 + Math.random() * 60 };
    playSound('pet');
  }
  vg.ball.dragging = false;
  vg.dragStart = null;
  vg.dragEnd = null;
}

// ─── 战斗系统 ───

window.showBattleSelect = function showBattleSelect() {
  closeOverlay();
  initAudio();

  const availablePets = g.pets.filter(p => !p.restUntil || p.restUntil <= Date.now());

  let html = '<div style="font-size:13px;margin-bottom:6px;text-align:center">⚔️ 宠物战斗 — 分配队伍</div>';
  html += '<div style="font-size:11px;color:#aaa;margin-bottom:8px;text-align:center">点击宠物切换队伍（蓝=A队 / 红=B队）</div>';

  // 顶部：队伍信息
  html += '<div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:11px">';
  html += '<span style="color:#64B5F6">🔵 A队：<b id="teamAcount">0</b>只</span>';
  html += '<span style="color:#EF5350">🔴 B队：<b id="teamBcount">0</b>只</span>';
  html += '</div>';

  // 宠物网格
  html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;max-height:300px;overflow-y:auto;margin-bottom:10px;" id="battlePetGrid">';

  g.pets.forEach(pet => {
    if (!pet.maxHp) pet.maxHp = pet.star * 25;
    if (pet.hp === undefined || pet.hp === null) pet.hp = pet.maxHp;
    const isResting = pet.restUntil > Date.now();
    const hpRatio = Math.max(0, Math.min(1, pet.hp / pet.maxHp));
    const hpColor = getHpColor(hpRatio);
    const geneStr = (pet.genes||[]).map(gk=>(GENES[gk]||{}).icon||'').join('');
    const restLeft = isResting ? Math.max(0, Math.ceil((pet.restUntil - Date.now())/1000)) : 0;

    html += `<div data-petid="${pet.id}" onclick="toggleBattlePet('${pet.id}')" style="
      background:#1a1a2e;border:2px solid #444;border-radius:8px;padding:6px;cursor:pointer;text-align:center;
      min-height:80px;display:flex;flex-direction:column;align-items:center;gap:2px;opacity:${isResting?'0.4':'1'};
      position:relative;
    ">
      <span style="font-size:12px;font-weight:bold;color:#fff">${pet.name}</span>
      <span style="font-size:9px;color:#aaa">${pet.star}★ Lv${pet.level}</span>
      <span style="font-size:10px">${geneStr}</span>
      <div style="width:90%;height:6px;background:#333;border-radius:3px;overflow:hidden;margin:2px 0">
        <div style="width:${Math.round(hpRatio*100)}%;height:100%;background:${hpColor};transition:width 0.3s"></div>
      </div>
      <span style="font-size:9px;color:${hpColor}">HP ${pet.hp||0}/${pet.maxHp||0}</span>
      ${isResting ? `<span style="font-size:9px;color:#f55">休息 ${restLeft}s</span>` : ''}
      <span class="team-badge" data-petid="${pet.id}" style="display:none;font-size:9px;padding:1px 4px;border-radius:3px;position:absolute;top:2px;right:2px;"></span>
    </div>`;
  });

  html += '</div>';

  // 队伍分配区
  html += '<div style="display:flex;gap:8px;margin-bottom:10px;">';
  html += '<div style="flex:1;background:#0d1b2a;border:2px solid #64B5F6;border-radius:6px;padding:6px;min-height:50px" id="teamASlot">';
  html += '<div style="font-size:10px;color:#64B5F6;margin-bottom:4px">🔵 A队</div>';
  html += '<div id="teamAlist" style="font-size:10px;color:#aaa;min-height:20px"></div></div>';
  html += '<div style="flex:1;background:#2a0d0d;border:2px solid #EF5350;border-radius:6px;padding:6px;min-height:50px" id="teamBSlot">';
  html += '<div style="font-size:10px;color:#EF5350;margin-bottom:4px">🔴 B队</div>';
  html += '<div id="teamBlist" style="font-size:10px;color:#aaa;min-height:20px"></div></div>';
  html += '</div>';

  // 按钮
  html += '<div style="display:flex;gap:8px;justify-content:center;">';
  html += '<button id="battleStartBtn" onclick="startBattle()" disabled style="background:#333;border:2px solid #555;color:#555;padding:10px 20px;font-family:monospace;font-size:13px;cursor:not-allowed">开始战斗</button>';
  html += '<button onclick="cancelBattle()" style="background:#333;border:2px solid #666;color:#fff;padding:10px 20px;font-family:monospace;font-size:13px;cursor:pointer">返回</button>';
  html += '</div>';

  const overlay = document.getElementById('overlay');
  const msg = document.getElementById('overlayMsg');
  msg.innerHTML = html;
  msg.style.maxWidth = '520px';
  overlay.classList.add('show');

  // 初始化选中状态（如果battleState有数据）
  if (battleState && battleState.preselected) {
    battleState.preselected.forEach(id => toggleBattlePet(id, true));
    battleState.preselected = null;
  }

  updateBattleTeamUI();
}

window.toggleBattlePet = function(petId, silent) {
  const pet = g.pets.find(p => p.id == petId);
  if (!pet || pet.restUntil > Date.now()) return;

  const current = battlePetTeam[petId];
  if (!current) {
    battlePetTeam[petId] = 'A';
  } else if (current === 'A') {
    battlePetTeam[petId] = 'B';
  } else {
    delete battlePetTeam[petId];
  }

  if (!silent) updateBattleTeamUI();
}

function updateBattleTeamUI() {
  const teamA = Object.keys(battlePetTeam).filter(id => battlePetTeam[id] === 'A').map(id => g.pets.find(p => p.id == id)).filter(Boolean);
  const teamB = Object.keys(battlePetTeam).filter(id => battlePetTeam[id] === 'B').map(id => g.pets.find(p => p.id == id)).filter(Boolean);

  document.getElementById('teamAcount').textContent = teamA.length;
  document.getElementById('teamBcount').textContent = teamB.length;
  document.getElementById('teamAlist').textContent = teamA.map(p => p.name).join('、') || '空';
  document.getElementById('teamBlist').textContent = teamB.map(p => p.name).join('、') || '空';

  // 更新卡片样式
  g.pets.forEach(pet => {
    const card = document.querySelector(`[data-petid="${pet.id}"]`);
    if (!card) return;
    const team = battlePetTeam[pet.id];
    card.style.borderColor = team === 'A' ? '#64B5F6' : team === 'B' ? '#EF5350' : '#444';
    card.style.background = team === 'A' ? '#0d1b2a' : team === 'B' ? '#2a0d0d' : '#1a1a2e';

    const badge = card.querySelector('.team-badge');
    if (badge) {
      if (team) {
        badge.style.display = 'block';
        badge.style.background = team === 'A' ? '#64B5F6' : '#EF5350';
        badge.textContent = team;
      } else {
        badge.style.display = 'none';
      }
    }
  });

  // 更新开始按钮
  const btn = document.getElementById('battleStartBtn');
  if (btn) {
    const canStart = teamA.length >= 1 && teamB.length >= 1 && (teamA.length + teamB.length) <= 4;
    btn.disabled = !canStart;
    btn.style.background = canStart ? '#1a3a1a' : '#333';
    btn.style.borderColor = canStart ? '#4CAF50' : '#555';
    btn.style.color = canStart ? '#fff' : '#555';
    btn.style.cursor = canStart ? 'pointer' : 'not-allowed';
  }
}

window.cancelBattle = function() {
  battlePetTeam = {};
  battleState = null;
  document.getElementById('overlayMsg').style.maxWidth = '360px';
  closeOverlay();
  setTimeout(() => showGameSelect(), 50);
}

window.startBattle = function() {
  const teamA = Object.keys(battlePetTeam).filter(id => battlePetTeam[id] === 'A').map(id => g.pets.find(p => p.id == id)).filter(Boolean);
  const teamB = Object.keys(battlePetTeam).filter(id => battlePetTeam[id] === 'B').map(id => g.pets.find(p => p.id == id)).filter(Boolean);

  if (teamA.length === 0 || teamB.length === 0) return;

  // 重置HP（从当前HP开始，允许战斗内回复）
  const allPets = [...teamA, ...teamB];
  allPets.forEach(p => {
    p._origHp = p.hp; // 记录战斗前HP
  });

  // 初始HP赋值（如果未初始化）
  allPets.forEach(p => { if (!p.maxHp) p.maxHp = p.star * 25; if (!p.hp || p.hp <= 0) p.hp = p.maxHp; });

  // 按速度排序（level+star高的先）
  allPets.sort((a, b) => (b.level + b.star) - (a.level + a.star));

  const teamAPetIds = new Set(teamA.map(p => p.id));
  const turnOrder = [...allPets];

  battleState = {
    state: 'battle',     // battle | anim | result
    teamA,
    teamB,
    teamAPetIds,
    turnOrder,
    turnIndex: 0,        // 当前行动宠物在turnOrder中的索引
    round: 1,
    log: [],              // 战斗日志 [{text, color}]
    winner: null,
    // 动画状态
    animPhase: 'skillSelect',  // skillSelect | targeting | anim | nextTurn | result
    turnTimer: 0,
    curAttacker: null,
    curSkill: null,
    curTarget: null,
    damageDisplay: null,  // { x, y, text, timer, color }
    resultMsg: '',
    skillBtns: [],       // [{ skillKey, x, y, w, h }]
    targetBtns: [],      // [{ petId, x, y, w, h }]
  };

  nextBattleTurn();
  document.getElementById('overlayMsg').style.maxWidth = '360px';
  closeOverlay();
  g.interactGame = 'battle';
}

function nextBattleTurn() {
  const alive = battleState.turnOrder.filter(p => p.hp > 0);
  if (alive.length <= 1) {
    endBattle();
    return;
  }

  // 找到下一个存活的宠物
  let attempts = 0;
  while (attempts < battleState.turnOrder.length) {
    const pet = battleState.turnOrder[battleState.turnIndex];
    battleState.turnIndex = (battleState.turnIndex + 1) % battleState.turnOrder.length;
    attempts++;
    if (pet && pet.hp > 0) {
      battleState.curAttacker = pet;
      battleState.curSkill = null;
      battleState.curTarget = null;
      battleState.animPhase = 'skillSelect';
      battleState.turnTimer = 0;
      return;
    }
  }

  // 所有宠物都死了 → 下一轮
  battleState.round++;
  battleState.turnIndex = 0;
  nextBattleTurn();
}

function doBattleSkill(skillKey) {
  const attacker = battleState.curAttacker;
  if (!attacker || battleState.animPhase !== 'skillSelect') return;

  const skills = getPetSkills(attacker);
  const skill = skills.find(s => s.key === skillKey) || skills[0];
  battleState.curSkill = skill;
  battleState.animPhase = 'targeting';
}

function doBattleTarget(targetPetId) {
  if (battleState.animPhase !== 'targeting') return;
  const target = battleState.turnOrder.find(p => p.id === targetPetId);
  if (!target || target.hp <= 0) return;

  battleState.curTarget = target;
  battleState.animPhase = 'animating';
  battleState.turnTimer = 0;

  // 立即执行技能效果
  executeBattleAction();
}

function executeBattleAction() {
  const attacker = battleState.curAttacker;
  const skill = battleState.curSkill;
  const target = battleState.curTarget;
  if (!attacker || !skill || !target) { nextBattleTurn(); return; }

  let logText = '';
  let logColor = '#fff';

  if (skill.type === 'heal') {
    const healAmt = Math.round(attacker.maxHp * 0.3);
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmt);
    logText = `${attacker.name} 使用了${skill.name}，回复了 ${healAmt} HP！`;
    logColor = '#4CAF50';
    battleState.damageDisplay = { x: 360, y: 200, text: `+${healAmt}`, color: '#4CAF50', timer: 0 };
  } else {
    const dmg = calcDamage(skill, attacker, target);
    target.hp = Math.max(0, target.hp - dmg);
    attacker.exp = (attacker.exp || 0) + 2; // 回合经验

    const isEffective = getTypeMultiplier(skill.element, (target.genes&&target.genes[0])) > 1;
    logText = `${attacker.name} 对 ${target.name} 使用了${skill.name}，造成了 ${dmg} 点伤害！${isEffective?' 效果拔群！':''}`;
    logColor = isEffective ? '#FF9800' : '#fff';
    battleState.damageDisplay = { x: 360, y: 180, text: `-${dmg}`, color: '#E53935', timer: 0 };
  }

  battleState.log.unshift({ text: logText, color: logColor });
  if (battleState.log.length > 5) battleState.log.pop();

  // 检查目标是否倒下
  if (target.hp <= 0) {
    battleState.log.unshift({ text: `${target.name} 倒下了！`, color: '#f55' });
  }

  battleState.animPhase = 'waiting';
  battleState.turnTimer = 0;
}

function endBattle() {
  battleState.animPhase = 'result';

  const aliveA = countAlive(battleState.teamA);
  const aliveB = countAlive(battleState.teamB);

  if (aliveA > 0 && aliveB === 0) {
    battleState.winner = 'A';
    battleState.resultMsg = '🔵 A队获胜！';
    // 奖励
    battleState.teamA.forEach(p => {
      if (p.hp > 0) {
        addExp(p, 20);
        g.intimacy = Math.min(100, g.intimacy + 10);
      } else {
        p.hp = 0;
        p.restUntil = Date.now() + 3600 * 1000;
      }
    });
    battleState.teamB.forEach(p => {
      p.hp = 0;
      p.restUntil = Date.now() + 3600 * 1000;
    });
  } else if (aliveB > 0 && aliveA === 0) {
    battleState.winner = 'B';
    battleState.resultMsg = '🔴 B队获胜！';
    battleState.teamB.forEach(p => {
      if (p.hp > 0) {
        addExp(p, 20);
        g.intimacy = Math.min(100, g.intimacy + 10);
      } else {
        p.hp = 0;
        p.restUntil = Date.now() + 3600 * 1000;
      }
    });
    battleState.teamA.forEach(p => {
      p.hp = 0;
      p.restUntil = Date.now() + 3600 * 1000;
    });
  } else {
    battleState.winner = 'draw';
    battleState.resultMsg = '🤝 平局！';
  }

  saveGame();
}

function exitBattle() {
  battleState = null;
  battlePetTeam = {};
  g.interactGame = null;
}

function updateBattle(dt) {
  if (!battleState) return;

  // 伤害数字飘字
  if (battleState.damageDisplay) {
    battleState.damageDisplay.timer += dt;
    if (battleState.damageDisplay.timer > 1.5) {
      battleState.damageDisplay = null;
    }
  }

  // 等待动画结束后自动切换下一回合
  if (battleState.animPhase === 'waiting') {
    battleState.turnTimer += dt;
    if (battleState.turnTimer >= 1.0) {
      nextBattleTurn();
    }
  }
}

function drawBattle(ctx) {
  if (!battleState) return;

  // 背景
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 地面装饰
  ctx.fillStyle = '#1a2a1a';
  ctx.fillRect(0, 480, canvas.width, canvas.height - 480);
  ctx.strokeStyle = '#2a3a2a';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 480); ctx.lineTo(x + 20, canvas.height); ctx.stroke();
  }

  // 中央分隔线
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.setLineDash([8,8]);
  ctx.beginPath(); ctx.moveTo(360, 60); ctx.lineTo(360, 470); ctx.stroke();
  ctx.setLineDash([]);

  // 队伍标签
  ctx.fillStyle = '#64B5F6';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('🔵 A队', 20, 30);
  ctx.fillStyle = '#EF5350';
  ctx.fillText('🔴 B队', 620, 30);
  ctx.fillStyle = '#fff';
  ctx.font = '11px monospace';
  ctx.fillText(`第 ${battleState.round} 回合`, 320, 30);

  // 绘制宠物（两侧）
  const drawPetCard = (pet, x, y, isLeft, isActive) => {
    if (!pet) return;

    const alive = pet.hp > 0;
    const hpRatio = alive ? pet.hp / pet.maxHp : 0;
    const hpColor = getHpColor(hpRatio);
    const borderColor = isActive ? '#FFD700' : alive ? (battleState.teamAPetIds.has(pet.id) ? '#64B5F6' : '#EF5350') : '#333';

    // 卡片背景
    ctx.fillStyle = alive ? 'rgba(26,26,46,0.95)' : 'rgba(20,20,20,0.8)';
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = isActive ? 3 : 2;
    roundRect(ctx, x, y, 140, 100, 8);
    ctx.fill();
    ctx.stroke();

    // 名字
    ctx.fillStyle = alive ? '#fff' : '#666';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(pet.name, x + 8, y + 18);

    // 星级
    ctx.fillStyle = STAR_COLORS[pet.star] || '#aaa';
    ctx.font = '11px monospace';
    ctx.fillText('★'.repeat(pet.star), x + 8, y + 34);

    // 基因图标
    const geneStr = (pet.genes||[]).map(gk=>(GENES[gk]||{}).icon||'').join('');
    ctx.fillStyle = '#aaa';
    ctx.font = '12px monospace';
    ctx.fillText(geneStr, x + 8, y + 50);

    // HP条
    ctx.fillStyle = '#333';
    ctx.fillRect(x + 8, y + 56, 124, 10);
    ctx.fillStyle = hpColor;
    ctx.fillRect(x + 8, y + 56, Math.round(124 * hpRatio), 10);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 8, y + 56, 124, 10);

    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.fillText(`${pet.hp||0} / ${pet.maxHp||0}`, x + 8, y + 78);

    // 死亡标记
    if (!alive) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x, y, 140, 100);
      ctx.fillStyle = '#f55';
      ctx.font = 'bold 16px monospace';
      ctx.fillText('倒下', x + 40, y + 55);
    }

    // 存活指示点
    if (alive) {
      ctx.fillStyle = '#4CAF50';
      ctx.beginPath();
      ctx.arc(isLeft ? x + 8 : x + 132, y + 90, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // A队（左侧，x=10开始）
  battleState.teamA.forEach((pet, i) => {
    drawPetCard(pet, 10, 50 + i * 115, true, battleState.curAttacker && battleState.curAttacker.id === pet.id);
  });
  // B队（右侧，x=570开始）
  battleState.teamB.forEach((pet, i) => {
    drawPetCard(pet, 570, 50 + i * 115, false, battleState.curAttacker && battleState.curAttacker.id === pet.id);
  });

  // 伤害飘字
  if (battleState.damageDisplay) {
    const dd = battleState.damageDisplay;
    const alpha = Math.max(0, 1 - dd.timer / 1.5);
    const offsetY = -dd.timer * 40;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = dd.color;
    ctx.font = 'bold 28px monospace';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText(dd.text, dd.x - 30, dd.y + offsetY);
    ctx.fillText(dd.text, dd.x - 30, dd.y + offsetY);
    ctx.globalAlpha = 1;
  }

  // 战斗日志（右侧）
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(460, 200, 250, 150);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.strokeRect(460, 200, 250, 150);
  battleState.log.forEach((entry, i) => {
    ctx.fillStyle = entry.color;
    ctx.font = '11px monospace';
    ctx.fillText(entry.text, 468, 218 + i * 22);
  });

  // 技能选择UI（底部）
  drawBattleSkillUI(ctx);

  // 结果界面
  if (battleState.animPhase === 'result') {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 32px monospace';
    ctx.fillText(battleState.resultMsg, 360 - ctx.measureText(battleState.resultMsg).width / 2, 250);
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.fillText('奖励已发放！败者休息1小时', 360 - 110, 285);

    // 按钮
    drawBattleResultBtn(ctx, '🔄 再来一局', 280, 320, () => { exitBattle(); battlePetTeam = {}; setTimeout(() => showBattleSelect(), 100); });
    drawBattleResultBtn(ctx, '🚪 退出', 420, 320, () => { exitBattle(); battlePetTeam = {}; });
  }
}

function drawBattleSkillUI(ctx) {
  if (battleState.animPhase === 'result') return;
  if (!battleState.curAttacker) return;

  const attacker = battleState.curAttacker;
  const alive = attacker.hp > 0;

  // 底部面板
  ctx.fillStyle = 'rgba(15,15,30,0.95)';
  ctx.fillRect(0, 400, canvas.width, canvas.height - 400);
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 400); ctx.lineTo(canvas.width, 400); ctx.stroke();

  if (battleState.animPhase === 'skillSelect' && alive) {
    // 显示当前行动宠物
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`${attacker.name} 的回合！选择技能：`, 20, 425);

    const skills = getPetSkills(attacker);
    battleState.skillBtns = [];
    skills.forEach((skill, i) => {
      const sx = 20 + i * 175;
      const sy = 435;
      const sw = 165;
      const sh = 60;

      ctx.fillStyle = skill.type === 'heal' ? '#1a3a1a' : '#1a1a3a';
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 2;
      roundRect(ctx, sx, sy, sw, sh, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = '16px monospace';
      ctx.fillText(skill.icon, sx + 8, sy + 22);
      ctx.font = 'bold 12px monospace';
      ctx.fillText(skill.name, sx + 36, sy + 18);
      ctx.fillStyle = '#aaa';
      ctx.font = '10px monospace';
      ctx.fillText(skill.desc, sx + 36, sy + 34);
      ctx.fillStyle = skill.type === 'heal' ? '#4CAF50' : '#FF9800';
      ctx.fillText(skill.type === 'heal' ? `回复30%` : `威力${skill.power}`, sx + 36, sy + 50);

      battleState.skillBtns.push({ skillKey: skill.key, x: sx, y: sy, w: sw, h: sh });
    });
  } else if (battleState.animPhase === 'targeting' && battleState.curSkill) {
  const skill = battleState.curSkill;
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(`选择目标（${attacker.name} 使用 ${skill.name}）：`, 20, 425);

  // 显示可 targeting 的宠物（对方存活的）
  const opponents = battleState.turnOrder.filter(p =>
    p.hp > 0 && p.id !== attacker.id
  );
  battleState.targetBtns = [];
  opponents.forEach((pet, i) => {
    const sx = 20 + i * 175;
    const sy = 435;
    const hpRatio = pet.hp / pet.maxHp;
    const hpColor = getHpColor(hpRatio);

    ctx.fillStyle = '#1a1a3a';
    ctx.strokeStyle = '#E53935';
    ctx.lineWidth = 2;
    roundRect(ctx, sx, sy, 165, 60, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(pet.name, sx + 8, sy + 18);
    ctx.font = '10px monospace';
    ctx.fillStyle = hpColor;
    ctx.fillText(`HP ${pet.hp}/${pet.maxHp}`, sx + 8, sy + 36);

      // HP条
      ctx.fillStyle = '#333';
      ctx.fillRect(sx + 8, sy + 42, 140, 8);
      ctx.fillStyle = hpColor;
      ctx.fillRect(sx + 8, sy + 42, Math.round(140 * hpRatio), 8);

      battleState.targetBtns.push({ petId: pet.id, x: sx, y: sy, w: 165, h: 60 });
    });
  } else if (battleState.animPhase === 'animating' || battleState.animPhase === 'waiting') {
    ctx.fillStyle = '#aaa';
    ctx.font = '13px monospace';
    const skill = battleState.curSkill;
    const target = battleState.curTarget;
    if (skill && target) {
      ctx.fillText(`${attacker.name} 对 ${target.name} 使用了 ${skill.name}...`, 20, 425);
    }
    // 进度条
    const prog = Math.min(1, battleState.turnTimer / 1.0);
    ctx.fillStyle = '#333';
    ctx.fillRect(20, 435, 680, 12);
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(20, 435, Math.round(680 * prog), 12);
  }
}

function drawBattleResultBtn(ctx, text, x, y, onclick) {
  const w = 100, h = 40;
  ctx.fillStyle = '#1a3a1a';
  ctx.strokeStyle = '#4CAF50';
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = '13px monospace';
  ctx.fillText(text, x + 8, y + 26);
  // 存储按钮区域（供点击用）
  if (!window._battleResultBtns) window._battleResultBtns = [];
  window._battleResultBtns.push({ x, y, w, h, onclick });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function getElementSkillForGene(gene) {
  const map = {
    water:   { name:'水炮',   icon:'🌊', power:50, element:'water' },
    fire:    { name:'火焰牙', icon:'🔥', power:50, element:'fire' },
    grass:   { name:'藤鞭',   icon:'🌿', power:50, element:'grass' },
    electric:{ name:'雷电',   icon:'⚡', power:50, element:'electric' },
    ice:     { name:'冰息',   icon:'❄️', power:50, element:'ice' },
    dark:    { name:'暗影球', icon:'🌑', power:50, element:'dark' },
    light:   { name:'光弹',   icon:'☀', power:50, element:'light' },
    wind:    { name:'风刃',   icon:'🌀', power:50, element:'wind' },
    earth:   { name:'落石',   icon:'🪨', power:50, element:'earth' },
    metal:   { name:'铁壁',   icon:'⚙️', power:50, element:'metal' },
  };
  return map[gene] || null;
}

function getPetSkills(pet) {
  const gene = (pet.genes && pet.genes.length > 0) ? pet.genes[0] : null;
  const ele = getElementSkillForGene(gene);
  return [
    { key:'tackle', name:'撞击', icon:'💥', power:30, type:'attack', desc:'基础攻击' },
    ele ? { key:gene+'Skill', name:ele.name, icon:ele.icon, power:ele.power, type:'attack', element:ele.element, desc:gene+'系技能' }
      : { key:'slash', name:'利爪', icon:'🪓', power:40, type:'attack', desc:'物理攻击' },
    { key:'heal', name:'治愈', icon:'💚', power:0, type:'heal', desc:'回复30%HP' },
  ];
}

function getTypeMultiplier(attackElement, defendElement) {
  const chart = {
    fire:    { grass:2, water:0.5, fire:1, ice:2, dark:1, light:1 },
    water:   { fire:2, grass:0.5, water:1, earth:2, electric:0.5 },
    grass:   { water:2, fire:0.5, grass:1, poison:0.5, fire:0.5 },
    electric:{ water:2, earth:0, grass:0.5, electric:1, metal:2 },
    ice:     { grass:2, water:0.5, ice:1, fire:0.5, earth:0.5 },
    dark:    { light:2, dark:0.5, dark:1, ghost:2, neutral:1 },
    light:   { dark:2, light:0.5, light:1, ghost:0.5, neutral:1 },
    wind:    { fire:0.5, grass:2, earth:0, wind:1, bird:2 },
    earth:   { fire:2, water:0.5, grass:0.5, electric:2, earth:1, metal:0.5 },
    metal:   { earth:2, fire:0.5, metal:1, ice:2, electric:2 },
  };
  if (attackElement && defendElement) {
    const row = chart[attackElement];
    if (row && row[defendElement] !== undefined) return row[defendElement];
  }
  return 1;
}

function calcDamage(skill, attacker, defender) {
  const basePower = skill.power || 30;
  const levelBonus = 1 + attacker.level * 0.2;
  const starBonus = 1 + (attacker.star - 1) * 0.3;
  const base = Math.round(basePower * levelBonus * starBonus);

  // 元素倍率（defender基因取第一个作为防御属性）
  const defenderGene = (defender.genes && defender.genes.length > 0) ? defender.genes[0] : null;
  const multiplier = getTypeMultiplier(skill.element, defenderGene);

  // 随机波动 ±10%
  const variance = 0.9 + Math.random() * 0.2;
  return Math.max(1, Math.round(base * multiplier * variance));
}

function countAlive(pets) {
  return pets.filter(p => p.hp > 0).length;
}

function getHpColor(ratio) {
  if (ratio > 0.6) return '#4CAF50';
  if (ratio > 0.3) return '#FFC107';
  return '#E53935';
}

// ─── 道具/工具系统 ───

function showToolSelect() {
  initAudio();
  closeOverlay();
  const tools = g.inventory.tools || {};
  let html = '<div style="font-size:14px;margin-bottom:10px">选择要使用的道具（长按目标宠物使用）：</div>';
  html += '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;max-width:500px;margin-bottom:12px;" id="toolSelectGrid">';

  Object.entries(TOOLS).forEach(([key, t]) => {
    const count = tools[key] || 0;
    const disabled = count <= 0;
    const borderColor = disabled ? '#333' : '#555';
    html += `<button data-tool="${key}" style="background:#222;border:2px solid ${borderColor};color:${disabled?'#555':'#fff'};padding:8px 4px;font-family:monospace;font-size:11px;min-width:70px;display:flex;flex-direction:column;align-items:center;gap:2px;border-radius:6px;${disabled?'opacity:0.4;cursor:not-allowed':'cursor:pointer'}">
      <span style="font-size:20px">${t.icon}</span>
      <span style="font-size:11px">${t.name}</span>
      <span style="color:#aaa;font-size:10px">×${count}</span>
    </button>`;
  });

  html += '</div>';
  html += '<div style="font-size:11px;color:#888;max-width:500px;text-align:left;line-height:1.7;margin-bottom:8px;">';
  html += '<b>💧💨❄️🔥🔦🛏️</b> 基因道具 → 贴紧对应基因宠物使用，长按0.5秒触发<br>';
  html += '<b>🦴🎵🪥</b> 通用道具 → 对任何宠物长按0.5秒触发<br>';
  html += '<b>所有道具5次性</b>，用完可去商店购买<br>';
  html += '</div>';
  html += '<button onclick="closeOverlay()" style="background:#444;border:2px solid #666;color:#fff;padding:8px 20px;font-family:monospace;font-size:13px;cursor:pointer">关闭</button>';

  document.getElementById('overlayMsg').innerHTML = html;
  document.getElementById('overlay').classList.add('show');

  // 事件委托：道具选择按钮点击
  const tgrid = document.getElementById('toolSelectGrid');
  if (tgrid) {
    tgrid.onclick = null;
    tgrid.onclick = (e) => {
      const btn = e.target.closest('button[data-tool]');
      if (!btn) return;
      const key = btn.dataset.tool;
      const count = (g.inventory.tools || {})[key] || 0;
      if (count <= 0) { showToast('这个道具用完了！'); return; }
      enterToolMode(key);
    };
  }
}
window.showToolSelect = showToolSelect;

function enterToolMode(toolKey) {
  const count = (g.inventory.tools || {})[toolKey] || 0;
  if (count <= 0) { showToast('这个道具用完了！'); return; }
  closeOverlay();
  g.toolMode = { toolKey, uses: count, maxUses: 5 };
  document.getElementById('toolAimHint').textContent = `${TOOLS[toolKey].icon} 将${TOOLS[toolKey].name}贴紧宠物，长按使用`;
  document.getElementById('toolAimHint').style.display = 'block';
  document.getElementById('toolCancelBtn').style.display = 'block';
  showToast(`已选择 ${TOOLS[toolKey].icon} ${TOOLS[toolKey].name}，剩余 ${count} 次`, 3);
  saveGame();
}

function exitToolMode() {
  cancelToolMode();
}

function applyToolToPet(pet) {
  if (!g.toolMode) return;
  const { toolKey } = g.toolMode;
  const t = TOOLS[toolKey];
  const petPos = pet.scenePos || { x: 360, y: 300 };
  const hasGene = pet.genes && pet.genes.includes(t.gene);

  // 消耗1次
  g.toolMode.uses--;
  g.inventory.tools[toolKey] = g.toolMode.uses;

  if (t.gene === null) {
    // 通用道具
    if (toolKey === 'bone') {
      g.intimacy = Math.min(100, g.intimacy + 5);
      showToast(`${pet.name}很开心！🦴 亲密+5`);
    } else if (toolKey === 'musicBox') {
      pet.petMood = 'happy';
      pet.moodBubble = { show: true, timer: 3, text: '好开心~♪' };
      pet.clickReaction = { type: 'spin', time: 0 };
      showToast(`${pet.name}心情愉悦！🎵`);
    } else if (toolKey === 'brush') {
      g.intimacy = Math.min(100, g.intimacy + 3);
      pet.petMood = 'happy';
      pet.moodBubble = { show: true, timer: 2, text: '舒服~' };
      showToast(`${pet.name}很舒服！🪥 亲密+3`);
    }
    spawnToolParticles(petPos, 'love');
    playSound('pet');
  } else if (hasGene) {
    addExp(pet, 8);
    pet.petMood = 'happy';
    const goodTexts = {
      waterBucket: '好凉快！💧', torch: '好暖和~🔥', flashlight: '好舒服~🔦',
      icePack: '好清爽！❄️', fan: '好凉快~💨', soil: '好舒服~🪨', gem: '闪闪发光！💎',
      blanket: '好温暖~🛏️',
    };
    pet.moodBubble = { show: true, timer: 3, text: goodTexts[toolKey] || '很舒服！' };
    pet.clickReaction = { type: 'jump', time: 0 };
    if (toolKey === 'blanket') {
      g.intimacy = Math.min(100, g.intimacy + 5);
      showToast(`${pet.name}很享受！${t.icon} +8经验 +5亲密`);
    } else {
      showToast(`${pet.name}很享受！${t.icon} +8经验`);
    }
    spawnToolParticles(petPos, 'love');
    playSound('levelUp');
  } else if (toolKey === 'flashlight') {
    // 手电筒只对光系有效
    pet.moodBubble = { show: true, timer: 2, text: '不适合...' };
    showToast(`${pet.name}不是光系宠物，手电筒没有效果`);
    spawnToolParticles(petPos, 'neutral');
  } else if (toolKey === 'blanket') {
    // 毯子只对暗系有效
    pet.moodBubble = { show: true, timer: 2, text: '不适合...' };
    showToast(`${pet.name}不是暗系宠物，毯子没有效果`);
    spawnToolParticles(petPos, 'neutral');
  } else {
    addExp(pet, 1);
    pet.moodBubble = { show: true, timer: 1.5, text: '还好吧' };
    showToast(`${pet.name}没什么特别反应`);
    spawnToolParticles(petPos, 'neutral');
  }

  // 检查是否用完
  if (g.toolMode.uses <= 0) {
    cancelToolMode();
    showToast(`${t.icon} ${t.name} 已用完！`);
  } else {
    document.getElementById('toolAimHint').textContent = `${t.icon} 剩余 ${g.toolMode.uses} 次`;
  }

  updateBtnUI();
  saveGame();
}

function spawnToolParticles(pos, type) {
  const colors = type === 'love'
    ? ['#FF69B4','#FF1493','#FF6EB4','#FFD700']
    : ['#CCCCCC','#AAAAAA','#888888'];
  const count = type === 'love' ? 12 : 6;
  for (let i = 0; i < count; i++) {
    toolParticles.push({
      x: pos.x + (Math.random() - 0.5) * 60,
      y: pos.y - 20 + (Math.random() - 0.5) * 40,
      vx: (Math.random() - 0.5) * 3,
      vy: -Math.random() * 3 - 1,
      life: 1,
      size: 4 + Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)]
    });
  }
}

function updateToolParticles(dt) {
  toolParticles = toolParticles.filter(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.05;
    p.life -= dt * 1.5;
    return p.life > 0;
  });
}

function cancelToolMode() {
  g.toolMode = null;
  g.toolHold = null;
  document.getElementById('toolAimHint').style.display = 'none';
  document.getElementById('toolCancelBtn').style.display = 'none';
  canvas.style.cursor = 'default';
  showToast('已取消道具模式');
}
window.cancelToolMode = cancelToolMode;

// ─── 商店系统 ───

function openShop() {
  initAudio();
  const tools = g.inventory.tools || {};
  const pet = g.currentPet || (g.pets.length > 0 ? g.pets[0] : null);
  // 计算玩家资源：取当前展示宠物主人的亲密+经验作为货币
  const intimacy = g.intimacy || 0;
  const petExp = pet ? (pet.exp || 0) : 0;
  const currency = intimacy + petExp;

  let html = '<div style="font-size:15px;margin-bottom:12px;text-align:center">🛒 道具商店</div>';
  html += `<div style="text-align:center;font-size:12px;color:#aaa;margin-bottom:14px">💰 资产：<b style="color:#FFD700">${currency}</b>（亲密+经验）</div>`;
  html += '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;max-width:500px;margin-bottom:14px;" id="shopGrid">';

  Object.entries(TOOLS).forEach(([key, t]) => {
    const price = 50 + (t.gene ? 20 : 0); // 基因道具更贵
    const canBuy = currency >= price;
    const borderColor = canBuy ? '#4CAF50' : '#333';
    html += `<button data-tool="${key}" data-price="${price}" style="background:#1a2a1a;border:2px solid ${borderColor};color:${canBuy?'#fff':'#555'};padding:8px 4px;font-family:monospace;font-size:11px;min-width:70px;display:flex;flex-direction:column;align-items:center;gap:2px;border-radius:6px;${canBuy?'':'opacity:0.5;cursor:not-allowed'}">
      <span style="font-size:20px">${t.icon}</span>
      <span style="font-size:11px">${t.name}</span>
      <span style="color:#FFD700;font-size:10px">💰${price}</span>
      <span style="color:#aaa;font-size:10px">库存×${tools[key]||0}</span>
    </button>`;
  });

  html += '</div>';
  html += '<div style="font-size:11px;color:#888;line-height:1.7;text-align:left;max-width:500px;">';
  html += '💡 购买消耗<b style="color:#FFD700">亲密+经验</b>之和，每件道具5次使用次数<br>';
  html += '💡 相克组合无效时仍消耗次数，建议对准基因使用<br>';
  html += '</div>';
  html += '<button onclick="closeOverlay()" style="margin-top:10px;background:#444;border:2px solid #666;color:#fff;padding:8px 24px;font-family:monospace;font-size:13px;cursor:pointer">关闭</button>';

  document.getElementById('overlayMsg').innerHTML = html;
  document.getElementById('overlay').classList.add('show');

  // 事件委托：商店按钮点击
  const grid = document.getElementById('shopGrid');
  if (grid) {
    grid.onclick = null;
    grid.onclick = (e) => {
      const btn = e.target.closest('button[data-tool]');
      if (!btn) return;
      buyTool(btn.dataset.tool, parseInt(btn.dataset.price, 10));
    };
  }
}

function buyTool(toolKey, price) {
  const pet = g.currentPet || (g.pets.length > 0 ? g.pets[0] : null);
  const intimacy = g.intimacy || 0;
  const petExp = pet ? (pet.exp || 0) : 0;
  const currency = intimacy + petExp;
  if (currency < price) { showToast('资产不足！'); return; }
  // 扣除资产（优先扣经验，再扣亲密）
  let remain = price;
  if (petExp >= remain) {
    if (pet) pet.exp = Math.max(0, pet.exp - remain);
  } else {
    if (pet) pet.exp = 0;
    remain -= petExp;
    g.intimacy = Math.max(0, g.intimacy - remain);
  }
  // 增加道具
  if (!g.inventory.tools) g.inventory.tools = {};
  g.inventory.tools[toolKey] = (g.inventory.tools[toolKey] || 0) + 1;
  showToast(`购买成功！${TOOLS[toolKey].icon} ${TOOLS[toolKey].name} ×1`);
  playSound('levelUp');
  updateBtnUI();
  saveGame();
  openShop(); // 刷新商店
}
window.openShop = openShop;

// ─── 喂食系统 ───

function showFeedSelect() {
  initAudio();
  if (g.feedCdLeft > 0) {
    showToast(`喂食冷却 ${Math.ceil(g.feedCdLeft)}秒`);
    return;
  }
  const w = g.inventory.worm, f = g.inventory.fruit, t = g.inventory.treat;
  if (w + f + t === 0) {
    showToast('没有食物了！');
    return;
  }

  // 构建选择界面
  let html = '<div style="font-size:14px;margin-bottom:12px">选择要喂的食物：</div>';
  html += '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;">';

  // 零食选项
  if (t > 0) {
    html += `<button onclick="doFeedItem('treat')" style="background:#222;border:3px solid #555;color:#fff;padding:10px 14px;font-family:monospace;font-size:13px;cursor:pointer;min-width:85px;display:flex;flex-direction:column;align-items:center;gap:2px">
      🦴 神秘饲料<br><span style="color:#aaa;font-size:11px">剩余 ${t} 个</span><br><span style="color:#4CAF50;font-size:10px">饥饿+40 亲密+15</span>
    </button>`;
  }
  // 水果选项
  if (f > 0) {
    html += `<button onclick="doFeedItem('fruit')" style="background:#222;border:3px solid #555;color:#fff;padding:10px 14px;font-family:monospace;font-size:13px;cursor:pointer;min-width:85px;display:flex;flex-direction:column;align-items:center;gap:2px">
      🍎 水果<br><span style="color:#aaa;font-size:11px">剩余 ${f} 个</span><br><span style="color:#4CAF50;font-size:10px">饥饿+25 亲密+8</span>
    </button>`;
  }
  // 虫子选项
  if (w > 0) {
    html += `<button onclick="doFeedItem('worm')" style="background:#222;border:3px solid #555;color:#fff;padding:10px 14px;font-family:monospace;font-size:13px;cursor:pointer;min-width:85px;display:flex;flex-direction:column;align-items:center;gap:2px">
      🐛 虫子<br><span style="color:#aaa;font-size:11px">剩余 ${w} 个</span><br><span style="color:#4CAF50;font-size:10px">饥饿+15 亲密+4</span>
    </button>`;
  }

  html += '</div>';
  html += '<button onclick="closeOverlay()" style="margin-top:16px;background:#333;border:3px solid #666;color:#fff;padding:10px 24px;font-family:monospace;font-size:14px;cursor:pointer">取消</button>';

  const overlay = document.getElementById('overlay');
  const msg = document.getElementById('overlayMsg');
  msg.innerHTML = html;
  overlay.classList.add('show');
}

function doFeedItem(type) {
  // type: 'treat', 'fruit', 'worm'
  if (g.feedCdLeft > 0) {
    showToast(`喂食冷却 ${Math.ceil(g.feedCdLeft)}秒`);
    return;
  }

  if (type === 'treat') {
    if (g.inventory.treat <= 0) {
      showToast('没有神秘饲料了！');
      return;
    }
    g.inventory.treat--;
    g.hunger = Math.min(100, g.hunger + 40);
    g.intimacy = Math.min(100, g.intimacy + 15);
    g.hatchPct = Math.min(100, g.hatchPct + 5);
    playSound('feedTreat');
    showToast('神秘饲料！饥饿+40 亲密度+15');
  } else if (type === 'fruit') {
    if (g.inventory.fruit <= 0) {
      showToast('没有水果了！');
      return;
    }
    g.inventory.fruit--;
    g.hunger = Math.min(100, g.hunger + 25);
    g.intimacy = Math.min(100, g.intimacy + 8);
    g.hatchPct = Math.min(100, g.hatchPct + 2);
    playSound('feedFruit');
    showToast('水果！饥饿+25 亲密度+8');
  } else if (type === 'worm') {
    if (g.inventory.worm <= 0) {
      showToast('没有虫子了！');
      return;
    }
    g.inventory.worm--;
    g.hunger = Math.min(100, g.hunger + 15);
    g.intimacy = Math.min(100, g.intimacy + 4);
    playSound('feedWorm');
    showToast('虫子！饥饿+15 亲密度+4');
  }

  if (g.currentPet) addExp(g.currentPet, 8);
  g.feedCdLeft = FEED_COOLDOWN;
  updateBtnUI();
  saveGame();
}
window.doFeedItem = doFeedItem;
window.showFeedSelect = showFeedSelect;

// ─── 互动/其他 ───

function exitInteractMode() {
  if (g.interactGame === 'volleyball') {
    volleyGame = null;
    g.interactGame = null;
    selectedInteractPets = [];
  } else if (g.interactGame === 'ball') {
    ballGame = null;
    g.interactGame = null;
    selectedInteractPets = [];
  } else if (g.interactGame === 'battle') {
    battleState = null;
    battlePetTeam = {};
    g.interactGame = null;
  }
  document.getElementById('exitInteractBtn').style.display = 'none';
  showToast('已退出互动模式');
}
window.exitInteractMode = exitInteractMode;

function cancelInteract() {
  selectedInteractPets = [];
  g.selectedInteractPet = null;
  g.interactGame = null;
  closeOverlay();
  setTimeout(() => showInteractSelect(), 50);
}

function triggerPetInteraction(petA, petB) {
  const types = ['play', 'nuzzle', 'dance'];
  const type = types[Math.floor(Math.random() * types.length)];
  const duration = 1.5 + Math.random();

  petA.interactAnim = { type, time: duration };
  petB.interactAnim = { type, time: duration };
  petA.interactPartner = petB.id;
  petB.interactPartner = petA.id;
  petA.interactCooldown = 8 + Math.random() * 7;
  petB.interactCooldown = 8 + Math.random() * 7;

  const mx = (petA.scenePos.x + petB.scenePos.x) / 2;
  const my = (petA.scenePos.y + petB.scenePos.y) / 2;
  for (let i = 0; i < 5; i++) {
    g.heartParticles.push({
      x: mx + (Math.random() - 0.5) * 30,
      y: my - 10 - Math.random() * 20,
      vx: (Math.random() - 0.5) * 1.5,
      vy: -2 - Math.random() * 2,
      life: 1.5 + Math.random(),
    });
  }

  const bubbles = ['一起玩!', '蹭蹭~', '♪♪♪'];
  petA.moodBubble = { show: true, timer: 2, text: bubbles[Math.floor(Math.random() * bubbles.length)] };
  petB.moodBubble = { show: true, timer: 2, text: '♡' };
  petA.petMood = 'happy';
  petB.petMood = 'happy';
  petA._moodResetTimer = 3;
  petB._moodResetTimer = 3;
}

function triggerRandomEvent() {
  initAudio();
  playSound('event');
  const dayEvents = [
    { text: '晴空万里！孵化+5%', effect: () => { g.hatchPct = Math.min(100, g.hatchPct + 5); } },
    { text: '小虫靠近！获得虫子×1', effect: () => { g.inventory.worm = Math.min(INV_MAX, g.inventory.worm + 1); } },
    { text: '发现野果！获得水果×1', effect: () => { g.inventory.fruit = Math.min(INV_MAX, g.inventory.fruit + 1); } },
    { text: '热浪来袭！温度+3°C', effect: () => { g.temp = Math.min(TEMP_MAX, g.temp + 3); } },
    { text: '蚊虫骚扰！亲密度-5', effect: () => { g.intimacy = Math.max(0, g.intimacy - 5); } },
  ];
  const nightEvents = [
    { text: '月色温柔...亲密度+10', effect: () => { g.intimacy = Math.min(100, g.intimacy + 10); } },
    { text: '流星划过！孵化+8%', effect: () => { g.hatchPct = Math.min(100, g.hatchPct + 8); } },
    { text: '找到零食！获得饲料×1', effect: () => { g.inventory.treat = Math.min(INV_MAX, g.inventory.treat + 1); } },
    { text: '寒流来袭！温度-5°C', effect: () => { g.temp = Math.max(TEMP_MIN, g.temp - 5); } },
    { text: '做了噩梦...亲密度-5', effect: () => { g.intimacy = Math.max(0, g.intimacy - 5); } },
  ];

  const pool = g.isDay ? dayEvents : nightEvents;
  const ev = pool[Math.floor(Math.random() * pool.length)];
  g.eventMsg = ev.text;
  g.eventTimer = 5;
  ev.effect();
  g.eventCooldown = g.isDay ? 120 : 90;

  // Show event in DOM
  const el = document.getElementById('evt');
  el.textContent = ev.text;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 5000);
}

function updateInteractBtn() {
  const btn = document.getElementById('exitInteractBtn');
  if (!btn) return;
  if (g.interactGame === 'volleyball' || g.interactGame === 'ball') {
    btn.style.display = 'block';
  } else {
    btn.style.display = 'none';
  }
}

function getGeneDesc(gk) {
  const descs = {
    fire: '孵化加速',
    water: '成长加速',
    grass: '抗寒增强',
    electric: '充电加速',
    ice: '抗热增强',
    dark: '夜间加成',
    light: '白天加成',
    wind: '移动加速',
    earth: '防御增强',
    metal: '寿命延长',
  };
  return descs[gk] || '未知';
}

function releasePet(idx) {
  const pet = g.pets[idx];
  if (!pet) return;
  showToast(`${pet.name} 回到了大自然...`);
  g.pets.splice(idx, 1);
  if (g.currentPet === pet) {
    g.currentPet = g.pets.length > 0 ? g.pets[g.pets.length - 1] : null;
  }
  closeOverlay();
  saveGame();
}
