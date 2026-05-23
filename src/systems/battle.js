import { g } from '../state.js';
import { GENES, SKILLS, STAR_COLORS, EXP_TABLE } from '../config.js';
import { saveGame } from '../state.js';

// ─── 战斗状态 ───
let battleState = null;
let battlePetTeam = {};  // petId -> 'A' | 'B'
export let _battleResultBtns = [];

export function getBattleState() { return battleState; }

function countAlive(pets) {
  return pets.filter(p => p.hp > 0).length;
}

function getHpColor(ratio) {
  if (ratio > 0.6) return '#4CAF50';
  if (ratio > 0.3) return '#FFC107';
  return '#E53935';
}

// 基因相克
function getTypeMultiplier(attackElement, defendElement) {
  const chart = {
    fire: { grass:2, water:0.5, fire:1, ice:2, dark:1, light:1 },
    water: { fire:2, grass:0.5, water:1, earth:2, electric:0.5 },
    grass: { water:2, fire:0.5, grass:1, poison:0.5 },
    electric: { water:2, earth:0, grass:0.5, electric:1, metal:2 },
    ice: { grass:2, water:0.5, ice:1, fire:0.5, earth:0.5 },
    dark: { light:2, dark:0.5, dark:1, ghost:2, neutral:1 },
    light: { dark:2, light:0.5, light:1, ghost:0.5, neutral:1 },
    wind: { fire:0.5, grass:2, earth:0, wind:1, bird:2 },
    earth: { fire:2, water:0.5, grass:0.5, electric:2, earth:1, metal:0.5 },
    metal: { earth:2, fire:0.5, metal:1, ice:2, electric:2 },
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
  const defenderGene = (defender.genes && defender.genes.length > 0) ? defender.genes[0] : null;
  const multiplier = getTypeMultiplier(skill.element, defenderGene);
  const variance = 0.9 + Math.random() * 0.2;
  return Math.max(1, Math.round(base * multiplier * variance));
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
}

// ─── 战斗UI（HTML overlay） ───

function updateBattleTeamUI() {
  const teamA = Object.keys(battlePetTeam).filter(id => battlePetTeam[id] === 'A').map(id => g.pets.find(p => p.id == id)).filter(Boolean);
  const teamB = Object.keys(battlePetTeam).filter(id => battlePetTeam[id] === 'B').map(id => g.pets.find(p => p.id == id)).filter(Boolean);

  const elAcount = document.getElementById('teamAcount');
  const elBcount = document.getElementById('teamBcount');
  const elAlist = document.getElementById('teamAlist');
  const elBlist = document.getElementById('teamBlist');
  if (elAcount) elAcount.textContent = teamA.length;
  if (elBcount) elBcount.textContent = teamB.length;
  if (elAlist) elAlist.textContent = teamA.map(p => p.name).join('、') || '空';
  if (elBlist) elBlist.textContent = teamB.map(p => p.name).join('、') || '空';

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

window.toggleBattlePet = function(petId, silent) {
  const pet = g.pets.find(p => p.id === petId);
  if (!pet || pet.restUntil > Date.now()) return;
  const current = battlePetTeam[petId];
  if (!current) battlePetTeam[petId] = 'A';
  else if (current === 'A') battlePetTeam[petId] = 'B';
  else delete battlePetTeam[petId];
  if (!silent) updateBattleTeamUI();
};

window.cancelBattleSelect = function() {
  battlePetTeam = {};
  battleState = null;
  const msg = document.getElementById('overlayMsg');
  if (msg) msg.style.maxWidth = '360px';
  window.closeOverlay();
};

export function showBattleSelect() {
  if (!window.closeOverlay) return;
  window.closeOverlay();

  const availablePets = g.pets.filter(p => !p.restUntil || p.restUntil <= Date.now());

  let html = '<div style="font-size:13px;margin-bottom:6px;text-align:center">⚔️ 宠物战斗 — 分配队伍</div>';
  html += '<div style="font-size:11px;color:#aaa;margin-bottom:8px;text-align:center">点击宠物切换队伍（蓝=A队 / 红=B队）</div>';
  html += '<div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:11px">';
  html += '<span style="color:#64B5F6">🔵 A队：<b id="teamAcount">0</b>只</span>';
  html += '<span style="color:#EF5350">🔴 B队：<b id="teamBcount">0</b>只</span></div>';
  html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;max-height:300px;overflow-y:auto;margin-bottom:10px;" id="battlePetGrid">';

  g.pets.forEach(pet => {
    const isResting = pet.restUntil > Date.now();
    const hpRatio = (pet.hp || 1) / (pet.maxHp || 1);
    const hpColor = getHpColor(hpRatio);
    const geneStr = (pet.genes||[]).map(gk=>(GENES[gk]||{}).icon||'').join('');
    const restLeft = isResting ? Math.max(0, Math.ceil((pet.restUntil - Date.now())/1000)) : 0;

    html += `<div data-petid="${pet.id}" onclick="toggleBattlePet(${pet.id})" style="
      background:#1a1a2e;border:2px solid #444;border-radius:8px;padding:6px;cursor:pointer;text-align:center;
      min-height:80px;display:flex;flex-direction:column;align-items:center;gap:2px;opacity:${isResting?'0.4':'1'};position:relative;
    ">
      <span style="font-size:12px;font-weight:bold;color:#fff">${pet.name}</span>
      <span style="font-size:9px;color:#aaa">${pet.star}★ Lv${pet.level}</span>
      <span style="font-size:10px">${geneStr}</span>
      <div style="width:90%;height:6px;background:#333;border-radius:3px;overflow:hidden;margin:2px 0">
        <div style="width:${Math.round(hpRatio*100)}%;height:100%;background:${hpColor};transition:width 0.3s"></div>
      </div>
      <span style="font-size:9px;color:${hpColor}">HP ${pet.hp}/${pet.maxHp}</span>
      ${isResting ? `<span style="font-size:9px;color:#f55">休息 ${restLeft}s</span>` : ''}
      <span class="team-badge" data-petid="${pet.id}" style="display:none;font-size:9px;padding:1px 4px;border-radius:3px;position:absolute;top:2px;right:2px;"></span>
    </div>`;
  });

  html += '</div>';
  html += '<div style="display:flex;gap:8px;margin-bottom:10px;">';
  html += '<div style="flex:1;background:#0d1b2a;border:2px solid #64B5F6;border-radius:6px;padding:6px;min-height:50px" id="teamASlot">';
  html += '<div style="font-size:10px;color:#64B5F6;margin-bottom:4px">🔵 A队</div>';
  html += '<div id="teamAlist" style="font-size:10px;color:#aaa;min-height:20px"></div></div>';
  html += '<div style="flex:1;background:#2a0d0d;border:2px solid #EF5350;border-radius:6px;padding:6px;min-height:50px" id="teamBSlot">';
  html += '<div style="font-size:10px;color:#EF5350;margin-bottom:4px">🔴 B队</div>';
  html += '<div id="teamBlist" style="font-size:10px;color:#aaa;min-height:20px"></div></div>';
  html += '</div>';
  html += '<div style="display:flex;gap:8px;justify-content:center;">';
  html += '<button id="battleStartBtn" onclick="startBattle()" disabled style="background:#333;border:2px solid #555;color:#555;padding:10px 20px;font-family:monospace;font-size:13px;cursor:not-allowed">开始战斗</button>';
  html += '<button onclick="cancelBattleSelect()" style="background:#333;border:2px solid #666;color:#fff;padding:10px 20px;font-family:monospace;font-size:13px;cursor:pointer">返回</button>';
  html += '</div>';

  const overlay = document.getElementById('overlay');
  const msg = document.getElementById('overlayMsg');
  if (!overlay || !msg) return;
  msg.innerHTML = html;
  msg.style.maxWidth = '520px';
  overlay.classList.add('show');
  updateBattleTeamUI();
}

// ─── 开始战斗 ───
window.startBattle = function() {
  const teamA = Object.keys(battlePetTeam).filter(id => battlePetTeam[id] === 'A').map(id => g.pets.find(p => p.id == id)).filter(Boolean);
  const teamB = Object.keys(battlePetTeam).filter(id => battlePetTeam[id] === 'B').map(id => g.pets.find(p => p.id == id)).filter(Boolean);
  if (teamA.length === 0 || teamB.length === 0) return;

  const allPets = [...teamA, ...teamB];
  allPets.forEach(p => {
    p._origHp = p.hp;
    if (!p.maxHp) p.maxHp = p.star * 25;
    if (!p.hp || p.hp <= 0) p.hp = p.maxHp;
  });

  allPets.sort((a, b) => (b.level + b.star) - (a.level + a.star));

  const teamAPetIds = new Set(teamA.map(p => p.id));
  const turnOrder = [...allPets];

  battleState = {
    state: 'battle',
    teamA, teamB, teamAPetIds, turnOrder,
    turnIndex: 0,
    round: 1,
    log: [],
    winner: null,
    animPhase: 'skillSelect',
    turnTimer: 0,
    curAttacker: null,
    curSkill: null,
    curTarget: null,
    damageDisplay: null,
    resultMsg: '',
    skillBtns: [],
    targetBtns: [],
  };

  nextBattleTurn();
  window.closeOverlay();
  g.interactGame = 'battle';
};

function nextBattleTurn() {
  const alive = battleState.turnOrder.filter(p => p.hp > 0);
  if (alive.length <= 1 || countAlive(battleState.teamA) === 0 || countAlive(battleState.teamB) === 0) {
    endBattle();
    return;
  }

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
  executeBattleAction();
}

function executeBattleAction() {
  const attacker = battleState.curAttacker;
  const skill = battleState.curSkill;
  const target = battleState.curTarget;
  if (!attacker || !skill || !target) { nextBattleTurn(); return; }

  let logText = '', logColor = '#fff';

  if (skill.type === 'heal') {
    const healAmt = Math.round(attacker.maxHp * 0.3);
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmt);
    logText = `${attacker.name} 使用了${skill.name}，回复了 ${healAmt} HP！`;
    logColor = '#4CAF50';
    battleState.damageDisplay = { x: 360, y: 200, text: `+${healAmt}`, color: '#4CAF50', timer: 0 };
  } else {
    const dmg = calcDamage(skill, attacker, target);
    target.hp = Math.max(0, target.hp - dmg);
    attacker.exp = (attacker.exp || 0) + 2;
    const isEffective = getTypeMultiplier(skill.element, (target.genes&&target.genes[0])) > 1;
    logText = `${attacker.name} 对 ${target.name} 使用了${skill.name}，造成了 ${dmg} 点伤害！${isEffective?' 效果拔群！':''}`;
    logColor = isEffective ? '#FF9800' : '#fff';
    battleState.damageDisplay = { x: 360, y: 180, text: `-${dmg}`, color: '#E53935', timer: 0 };
  }

  battleState.log.unshift({ text: logText, color: logColor });
  if (battleState.log.length > 5) battleState.log.pop();

  if (target.hp <= 0 && target !== attacker) {
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
    battleState.teamA.forEach(p => {
      if (p.hp > 0) { addExp(p, 20); g.intimacy = Math.min(100, g.intimacy + 10); }
      else { p.hp = 0; p.restUntil = Date.now() + 3600 * 1000; }
    });
    battleState.teamB.forEach(p => { p.hp = 0; p.restUntil = Date.now() + 3600 * 1000; });
  } else if (aliveB > 0 && aliveA === 0) {
    battleState.winner = 'B';
    battleState.resultMsg = '🔴 B队获胜！';
    battleState.teamB.forEach(p => {
      if (p.hp > 0) { addExp(p, 20); g.intimacy = Math.min(100, g.intimacy + 10); }
      else { p.hp = 0; p.restUntil = Date.now() + 3600 * 1000; }
    });
    battleState.teamA.forEach(p => { p.hp = 0; p.restUntil = Date.now() + 3600 * 1000; });
  } else {
    battleState.winner = 'draw';
    battleState.resultMsg = '🤝 平局！';
  }
  saveGame();
}

function addExp(pet, amount) {
  pet.exp = (pet.exp || 0) + amount;
  const oldLevel = pet.level;
  while (pet.level < 10 && pet.exp >= EXP_TABLE[pet.level]) {
    pet.exp -= EXP_TABLE[pet.level];
    pet.level++;
  }
  if (pet.level > oldLevel) {
    window.showToast && window.showToast(`🎉 ${pet.name} 升级到 Lv.${pet.level}`);
  }
}

function exitBattle() {
  battleState = null;
  battlePetTeam = {};
  g.interactGame = null;
}

// ─── 每帧更新 ───
export function updateBattle(dt) {
  if (!battleState) return;
  if (battleState.damageDisplay) {
    battleState.damageDisplay.timer += dt;
    if (battleState.damageDisplay.timer > 1.5) battleState.damageDisplay = null;
  }
  if (battleState.animPhase === 'waiting') {
    battleState.turnTimer += dt;
    if (battleState.turnTimer >= 1.0) nextBattleTurn();
  }
}

// ─── 渲染 ───
export function drawBattle(ctx) {
  if (!battleState) return;

  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, 720, 576);

  // Exit button (top-right, always visible except on result screen)
  if (battleState.animPhase !== 'result') {
    const exitX = 688, exitY = 4, exitSize = 28;
    ctx.fillStyle = 'rgba(60,20,20,0.9)';
    ctx.strokeStyle = '#f55';
    ctx.lineWidth = 2;
    roundRect(ctx, exitX, exitY, exitSize, exitSize, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '16px monospace';
    ctx.fillText('✕', exitX + 7, exitY + 20);
    battleState._exitBtn = { x: exitX, y: exitY, w: exitSize, h: exitSize };
  }
  ctx.fillStyle = '#1a2a1a';
  ctx.fillRect(0, 480, 720, 576 - 480);
  ctx.strokeStyle = '#2a3a2a';
  ctx.lineWidth = 1;
  for (let x = 0; x < 720; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 480); ctx.lineTo(x + 20, 576); ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.setLineDash([8,8]);
  ctx.beginPath(); ctx.moveTo(360, 60); ctx.lineTo(360, 470); ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#64B5F6';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('🔵 A队', 20, 30);
  ctx.fillStyle = '#EF5350';
  ctx.fillText('🔴 B队', 620, 30);
  ctx.fillStyle = '#fff';
  ctx.font = '11px monospace';
  ctx.fillText(`第 ${battleState.round} 回合`, 320, 30);

  const drawPetCard = (pet, x, y, isLeft, isActive) => {
    if (!pet) return;
    const alive = pet.hp > 0;
    const hpRatio = alive ? pet.hp / pet.maxHp : 0;
    const hpColor = getHpColor(hpRatio);
    const borderColor = isActive ? '#FFD700' : alive ? (battleState.teamAPetIds.has(pet.id) ? '#64B5F6' : '#EF5350') : '#333';

    ctx.fillStyle = alive ? 'rgba(26,26,46,0.95)' : 'rgba(20,20,20,0.8)';
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = isActive ? 3 : 2;
    roundRect(ctx, x, y, 140, 100, 8);
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = alive ? '#fff' : '#666';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(pet.name, x + 8, y + 18);

    ctx.fillStyle = STAR_COLORS[pet.star] || '#aaa';
    ctx.font = '11px monospace';
    ctx.fillText('★'.repeat(pet.star), x + 8, y + 34);

    const geneStr = (pet.genes||[]).map(gk=>(GENES[gk]||{}).icon||'').join('');
    ctx.fillStyle = '#aaa';
    ctx.font = '12px monospace';
    ctx.fillText(geneStr, x + 8, y + 50);

    ctx.fillStyle = '#333';
    ctx.fillRect(x + 8, y + 56, 124, 10);
    ctx.fillStyle = hpColor;
    ctx.fillRect(x + 8, y + 56, Math.round(124 * hpRatio), 10);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 8, y + 56, 124, 10);

    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.fillText(`${pet.hp} / ${pet.maxHp}`, x + 8, y + 78);

    if (!alive) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x, y, 140, 100);
      ctx.fillStyle = '#f55';
      ctx.font = 'bold 16px monospace';
      ctx.fillText('倒下', x + 40, y + 55);
    }
  };

  battleState.teamA.forEach((pet, i) => {
    drawPetCard(pet, 10, 50 + i * 115, true, battleState.curAttacker && battleState.curAttacker.id === pet.id);
  });
  battleState.teamB.forEach((pet, i) => {
    drawPetCard(pet, 570, 50 + i * 115, false, battleState.curAttacker && battleState.curAttacker.id === pet.id);
  });

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

  drawBattleSkillUI(ctx);

  if (battleState.animPhase === 'result') {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, 720, 576);
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 32px monospace';
    ctx.fillText(battleState.resultMsg, 360 - ctx.measureText(battleState.resultMsg).width / 2, 250);
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.fillText('奖励已发放！败者休息1小时', 360 - 110, 285);
    _battleResultBtns = [];
    drawBattleResultBtn(ctx, '🔄 再来一局', 280, 320, () => { exitBattle(); battlePetTeam = {}; setTimeout(() => showBattleSelect(), 100); });
    drawBattleResultBtn(ctx, '🚪 退出', 420, 320, () => { exitBattle(); battlePetTeam = {}; });
  }
}

function drawBattleSkillUI(ctx) {
  if (battleState.animPhase === 'result') return;
  if (!battleState.curAttacker) return;

  const attacker = battleState.curAttacker;
  const alive = attacker.hp > 0;

  ctx.fillStyle = 'rgba(15,15,30,0.95)';
  ctx.fillRect(0, 400, 720, 176);
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 400); ctx.lineTo(720, 400); ctx.stroke();

  if (battleState.animPhase === 'skillSelect' && alive) {
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
      ctx.fill(); ctx.stroke();

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

    const opponents = battleState.turnOrder.filter(p => p.hp > 0 && p.id !== attacker.id);
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
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(pet.name, sx + 8, sy + 18);
      ctx.font = '10px monospace';
      ctx.fillStyle = hpColor;
      ctx.fillText(`HP ${pet.hp}/${pet.maxHp}`, sx + 8, sy + 36);

      ctx.fillStyle = '#333';
      ctx.fillRect(sx + 8, sy + 42, 140, 8);
      ctx.fillStyle = hpColor;
      ctx.fillRect(sx + 8, sy + 42, Math.round(140 * hpRatio), 8);

      battleState.targetBtns.push({ petId: pet.id, x: sx, y: sy, w: 165, h: 60 });
    });
  } else if (battleState.animPhase === 'animating' || battleState.animPhase === 'waiting') {
    ctx.fillStyle = '#aaa';
    ctx.font = '13px monospace';
    if (battleState.curSkill && battleState.curTarget) {
      ctx.fillText(`${attacker.name} 对 ${battleState.curTarget.name} 使用了 ${battleState.curSkill.name}...`, 20, 425);
    }
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
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = '13px monospace';
  ctx.fillText(text, x + 8, y + 26);
  _battleResultBtns.push({ x, y, w, h, onclick });
}

// ─── 点击处理 ───
export function handleBattleClick(mx, my) {
  if (!battleState) return false;

  // Exit button (top-right ✕)
  if (battleState._exitBtn) {
    const eb = battleState._exitBtn;
    if (mx >= eb.x && mx <= eb.x + eb.w && my >= eb.y && my <= eb.y + eb.h) {
      exitBattle();
      return true;
    }
  }

  // 结果按钮
  if (battleState.animPhase === 'result') {
    for (const btn of _battleResultBtns) {
      if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
        btn.onclick();
        return true;
      }
    }
    return true;
  }

  // 技能选择
  if (battleState.animPhase === 'skillSelect' && battleState.skillBtns) {
    for (const btn of battleState.skillBtns) {
      if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
        doBattleSkill(btn.skillKey);
        return true;
      }
    }
  }

  // 目标选择
  if (battleState.animPhase === 'targeting' && battleState.targetBtns) {
    for (const btn of battleState.targetBtns) {
      if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
        doBattleTarget(btn.petId);
        return true;
      }
    }
  }

  return true; // 战斗中所有点击都由战斗处理
}
