// ─── Constants ──────────────────────────────────────────────────
export const DAY_SEC = 600, NGT_SEC = 300, CYCLE = DAY_SEC + NGT_SEC;
export const TEMP_MIN = 20, TEMP_MAX = 45, TEMP_OPT_MIN = 36.5, TEMP_OPT_MAX = 38.5;
export const POWER_MAX = 100, HEAT_DRAIN = 2, POWER_DAY_REGEN = 150, POWER_NGT_REGEN = 75;
export const HATCH_RATE = 1.5, HATCH_RATE_COLD = 0.5, HATCH_RATE_HOT = -1.0;
export const PET_COOLDOWN = 5, FEED_COOLDOWN = 120, FORAGE_COOLDOWN = 30;
export const INV_MAX = 10;
export const PET_MAX = 20;

// 等轴测网格
export const ISO_COLS = 5, ISO_ROWS = 3;
export const TILE_W = 80, TILE_H = 40;
export const OX = 360, OY = 150;

// 内容区偏移（宽屏居中）
export const CONTENT_OFFSET = 280;

// 基因类型
export const GENES = {
  fire:   { name: '火', color: '#FF4500', icon: '🔥' },
  water:  { name: '水', color: '#1E90FF', icon: '💧' },
  grass:  { name: '草', color: '#32CD32', icon: '🌿' },
  electric:{ name: '电', color: '#FFD700', icon: '⚡' },
  ice:    { name: '冰', color: '#87CEEB', icon: '❄' },
  dark:   { name: '暗', color: '#4B0082', icon: '🌑' },
  light:  { name: '光', color: '#FFFACD', icon: '☀' },
  wind:   { name: '风', color: '#98FB98', icon: '🌀' },
  earth:  { name: '土', color: '#8B4513', icon: '🪨' },
  metal:  { name: '金', color: '#C0C0C0', icon: '⚙️' },
};

// 道具系统
export const TOOLS = {
  waterBucket: { name:'水桶',  icon:'💧', gene:'water',    desc:'泼水' },
  torch:       { name:'火把',  icon:'🔥', gene:'fire',     desc:'点火' },
  flashlight:  { name:'手电筒',icon:'🔦', gene:'light',     desc:'照光' },
  icePack:     { name:'冰袋',  icon:'❄️', gene:'ice',      desc:'降温' },
  fan:         { name:'吹风机',icon:'💨', gene:'wind',     desc:'吹风' },
  soil:        { name:'土壤',  icon:'🪨', gene:'earth',    desc:'松土' },
  gem:         { name:'宝石',  icon:'💎', gene:'metal',    desc:'闪耀' },
  bone:        { name:'骨头',  icon:'🦴', gene:null,       desc:'通用' },
  musicBox:    { name:'音乐盒',icon:'🎵', gene:null,       desc:'通用' },
  brush:       { name:'梳子',  icon:'🪥', gene:null,       desc:'通用' },
  blanket:     { name:'毯子',  icon:'🛏️', gene:'dark',     desc:'保暖' },
};

// 宠物战斗技能系统
export const SKILLS = {
  tackle:     { name:'撞击',   icon:'💥', power:30, category:'attack' },
  waterBlast: { name:'水炮',   icon:'🌊', power:50, category:'element', element:'water' },
  fireFang:   { name:'火焰牙', icon:'🔥', power:50, category:'element', element:'fire' },
  grassWhip:  { name:'藤鞭',   icon:'🌿', power:50, category:'element', element:'grass' },
  thunderBolt:{ name:'雷电',   icon:'⚡', power:50, category:'element', element:'electric' },
  iceShard:   { name:'冰息',   icon:'❄️', power:50, category:'element', element:'ice' },
  darkBall:   { name:'暗影球', icon:'🌑', power:50, category:'element', element:'dark' },
  lightRay:   { name:'光弹',   icon:'☀', power:50, category:'element', element:'light' },
  windBlade:  { name:'风刃',   icon:'🌀', power:50, category:'element', element:'wind' },
  rockFall:   { name:'落石',   icon:'🪨', power:50, category:'element', element:'earth' },
  metalStorm: { name:'铁壁',   icon:'⚙️', power:50, category:'element', element:'metal' },
  heal:        { name:'治愈',   icon:'💚', power:0,  category:'heal' },
};

// 星级颜色
export const STAR_COLORS = ['', '#AAAAAA', '#DDDDDD', '#FFD700', '#FF69B4', '#FF4500'];

// 经验表
export const EXP_TABLE = [0, 100, 250, 500, 900, 1500, 2300, 3500, 5000, 7000, 10000];

// Palette
export const P = {
  skyDay: '#87CEEB', skyNgt: '#0d1b2a',
  sun: '#FFD700', moon: '#E0E0E0', star: '#FFFFFF',
  ground: '#8B4513',
  eggLight: '#FFF8DC', eggShd: '#D4A574', eggCrack: '#8B7355',
  incBase: '#8B0000', incLight: '#CD5C5C', flame: ['#FF4500','#FF8C00','#FFD700'],
  heart: '#FF69B4',
  tempHot: '#FF4500', tempCold: '#00BFFF',
  barBg: '#333', barFill: '#555',
  white: '#FFFFFF', black: '#000000',
  txt: '#FFFFFF', dim: '#AAAAAA',
  happy: '#90EE90', warn: '#FFA500', danger: '#FF4444',
  eggInt: '#FFE4B5',
  grassLight: '#7CFC00', grassDark: '#228B22',
  cloud: '#FFFFFF',
  starFull: '#FFD700', starEmpty: '#444444',
};

// 宠物类型名称
export const PET_TYPE_NAMES = ['猫', '狗', '兔子', '狐狸', '鼠', '龙', '鸟', '熊'];
export const PET_EMOJI = ['🐱', '🐶', '🐰', '🦊', '🐭', '🐉', '🐦', '🐻'];

// 食物属性
export const FOOD_GAINS = { worm: 15, fruit: 25, treat: 40 };
export const FOOD_HATCH_GAINS = { worm: 0.5, fruit: 1, treat: 2 };

// 语音识别 API
export const VOICE_API_URL = 'http://127.0.0.1:8765/api/transcribe';
