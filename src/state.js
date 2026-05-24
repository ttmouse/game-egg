// 游戏全局状态（纯数据，无函数依赖）
export let g = {
  temp: 25, hatchPct: 0, intimacy: 50, power: 80,
  heatOn: false, iceOn: false, time: 0, isDay: true,
  petCdLeft: 0, feedCdLeft: 0, forageCdLeft: 0,
  hunger: 100, lastTs: Date.now(),
  inventory: { worm: 2, fruit: 1, treat: 0, tools: {} },
  droppedFood: [], foodDropCd: 0,
  discoveredTypes: [], discoveredGenes: [],
  eggs: [{ id: 1, temp: 25, hatch: 0, intimacy: 50 }],
  pets: [], nextHatchDay: 0,
  eventCooldown: 0, eventMsg: '', eventTimer: 0,
  crackStage: 0, babyName: '', babyTraits: [],
  isHatching: false, hatchAnim: 0,
  powerRegenTimer: 0, feedTimer: 0,
  dayCount: 0, touchedToday: false,
  currentPet: null, currentScene: 'incubator',
  sceneTransition: { active: false, progress: 0, from: 'incubator', to: 'pets' },
  heartParticles: [],
  toolMode: null, toolHold: null,
  draggingPetId: null, dragMoved: false,
  dragOffsetX: 0, dragOffsetY: 0,
  hoveredPetId: null,
  interactMode: null, selectedInteractPet: null, interactGame: null,
};

// 过渡 Canvas
export let transOldCanvas = null;
export let transNewCanvas = null;
export let transOldCtx = null;
export let transNewCtx = null;

export function initTransCanvases() {
  if (!transOldCanvas) {
    transOldCanvas = document.createElement('canvas');
    // 使用逻辑尺寸 720×576，与主画布的坐标系一致
    transOldCanvas.width = 720;
    transOldCanvas.height = 576;
    transOldCtx = transOldCanvas.getContext('2d');
    transOldCtx.imageSmoothingEnabled = false;
  }
  if (!transNewCanvas) {
    transNewCanvas = document.createElement('canvas');
    transNewCanvas.width = 720;
    transNewCanvas.height = 576;
    transNewCtx = transNewCanvas.getContext('2d');
    transNewCtx.imageSmoothingEnabled = false;
  }
}

// 宠物精灵缓存
export const petSpriteCache = new Map();

// 基础 save/load（无函数依赖）
export function saveGame() {
  const data = {
    temp: g.temp, hatchPct: g.hatchPct, intimacy: g.intimacy,
    power: g.power, heatOn: g.heatOn, iceOn: g.iceOn, time: g.time,
    isDay: g.isDay, inventory: g.inventory, pets: g.pets,
    petCdLeft: g.petCdLeft, feedCdLeft: g.feedCdLeft, forageCdLeft: g.forageCdLeft,
    hunger: g.hunger, currentPet: g.currentPet,
    dayCount: g.dayCount, nextHatchDay: g.nextHatchDay,
    discoveredTypes: g.discoveredTypes, discoveredGenes: g.discoveredGenes,
    lastSave: Date.now()
  };
  try { localStorage.setItem('hatchgame_save', JSON.stringify(data)); } catch(e) {}
}

// 加载原始数据（返回 data 供 main.js 后续处理）
export function loadRawSave() {
  try {
    const raw = localStorage.getItem('hatchgame_save');
    if (!raw) return null;
    const data = JSON.parse(raw);
    Object.assign(g, data);
    return data;
  } catch(e) { return null; }
}
