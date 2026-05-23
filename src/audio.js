import { g } from './state.js';

export let audioCtx = null;
export let soundEnabled = true;

export function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playTone(freq, duration, type = 'sine', volume = 0.3, startTime = 0) {
  if (!soundEnabled || !audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = volume;
  gain.gain.setValueAtTime(volume, audioCtx.currentTime + startTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + startTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(audioCtx.currentTime + startTime);
  osc.stop(audioCtx.currentTime + startTime + duration);
}

function playChord(freqs, duration, type = 'sine', volume = 0.2) {
  if (!soundEnabled || !audioCtx) return;
  freqs.forEach(f => playTone(f, duration, type, volume));
}

export function playSound(name) {
  if (!soundEnabled) return;
  initAudio();
  const t = audioCtx.currentTime;

  switch (name) {
    case 'pet': case 'close':
      playTone(600, 0.1, 'sine', 0.2); break;
    case 'sceneSwitch':
      playTone(400, 0.15, 'sine', 0.15);
      setTimeout(() => playTone(600, 0.15, 'sine', 0.15), 100); break;
    case 'forage':
      playTone(700, 0.08, 'sine', 0.2);
      setTimeout(() => playTone(900, 0.08, 'sine', 0.2), 80); break;
    case 'levelUp':
      playTone(523, 0.15, 'sine', 0.2);
      playTone(659, 0.15, 'sine', 0.2, 0.12);
      playTone(784, 0.2, 'sine', 0.2, 0.24); break;
    case 'warning':
      playTone(800, 0.1, 'square', 0.15);
      setTimeout(() => playTone(600, 0.1, 'square', 0.15), 150);
      setTimeout(() => playTone(800, 0.1, 'square', 0.15), 300); break;
    case 'hatch':
      playChord([523, 659, 784], 0.5, 'triangle', 0.2);
      setTimeout(() => playChord([659, 784, 1047], 0.5, 'triangle', 0.2), 300); break;
    case 'crack':
      playTone(200, 0.05, 'square', 0.15);
      setTimeout(() => playTone(150, 0.08, 'square', 0.12), 50); break;
    case 'synth':
      playChord([400, 500, 600], 0.3, 'sine', 0.15);
      setTimeout(() => playChord([500, 600, 800], 0.4, 'sine', 0.15), 250); break;
    case 'synthMutation':
      playChord([400, 500, 600], 0.3, 'sine', 0.15);
      setTimeout(() => {
        playChord([600, 800, 1000], 0.4, 'triangle', 0.2);
        playChord([800, 1000, 1200], 0.3, 'triangle', 0.15, 0.2);
      }, 250); break;
    case 'petLeave':
      playTone(400, 0.3, 'sine', 0.15);
      setTimeout(() => playTone(300, 0.3, 'sine', 0.12), 200);
      setTimeout(() => playTone(200, 0.4, 'sine', 0.1), 400); break;
    case 'event':
      playChord([500, 700, 900], 0.3, 'triangle', 0.15); break;
    case 'heatOn':
      playTone(800, 0.15, 'triangle', 0.2);
      setTimeout(() => playTone(1000, 0.15, 'triangle', 0.2), 100); break;
    case 'iceOn':
      playTone(1200, 0.15, 'triangle', 0.2);
      setTimeout(() => playTone(800, 0.15, 'triangle', 0.2), 100); break;
    case 'feedWorm':
      playTone(500, 0.1, 'sine', 0.15);
      setTimeout(() => playTone(700, 0.1, 'sine', 0.15), 80); break;
    case 'feedFruit':
      playTone(600, 0.1, 'sine', 0.15);
      setTimeout(() => playTone(800, 0.1, 'sine', 0.15), 80);
      setTimeout(() => playTone(1000, 0.1, 'sine', 0.15), 160); break;
    case 'feedTreat':
      playChord([600, 800, 1000], 0.3, 'triangle', 0.2); break;
    default: break;
  }
}

// 合成成功音效
export function soundSynth(mutation = false) {
  initAudio();
  if (mutation) {
    playChord([900, 1120, 1350], 0.3, 'triangle', 0.15, 0.25);
  } else {
    playTone(523, 0.15, 'sine', 0.2);
    playTone(659, 0.15, 'sine', 0.2, 0.12);
  }
}
