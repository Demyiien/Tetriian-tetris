import { Tetris, COLORS, SHAPES, cells } from './engine.js';

const $ = id => document.getElementById(id);
const canvas = $('board');
const ctx = canvas.getContext('2d');
const fx = $('particles').getContext('2d');
const SIZE = 60;
const storage = { get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }, set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage may be unavailable in private browsing. */ } } };
let sound = storage.get('afterglow.sound', true);
let theme = storage.get('afterglow.theme', 'dark') === 'light' ? 'light' : 'dark';
let effects = storage.get('afterglow.effects', !matchMedia('(prefers-reduced-motion: reduce)').matches);
let best = Number(storage.get('afterglow.best', 0)) || 0;
let audioContext;
let particles = [];
let trails = [];
let flashes = [];
let announcementTimer;
let restartConfirm = false;
const held = new Map();

function tone(frequency, duration = .08, type = 'sine', volume = .035, delay = 0) {
  if (!sound) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const start = audioContext.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + .006);
    gain.gain.exponentialRampToValueAtTime(.001, start + duration);
    oscillator.connect(gain); gain.connect(audioContext.destination);
    oscillator.start(start); oscillator.stop(start + duration + .02);
  } catch { /* Gameplay remains available when Web Audio is unavailable. */ }
}
function melody(notes, step = .07) { notes.forEach((note, i) => tone(note, .2, 'sine', .055, i * step)); }
function announce(text) {
  clearTimeout(announcementTimer);
  $('announcement').textContent = text;
  $('announcement').classList.remove('show');
  void $('announcement').offsetWidth;
  $('announcement').classList.add('show');
  announcementTimer = setTimeout(() => $('announcement').classList.remove('show'), 1100);
}
function spark(x, y, color, count = 8) {
  if (!effects) return;
  for (let i = 0; i < count; i++) particles.push({ x, y, vx: (Math.random() - .5) * 360, vy: -Math.random() * 260 - 40, life: .35 + Math.random() * .45, max: .8, size: 2 + Math.random() * 5, color });
}
function event(e) {
  if (e.type === 'move') tone(160, .035, 'sine', .018);
  if (e.type === 'soft') tone(115, .025, 'sine', .008);
  if (e.type === 'rotate') tone(380, .07, 'triangle', .025);
  if (e.type === 'hold') melody([330, 440]);
  if (e.type === 'sonic') tone(210, .14, 'triangle', .04);
  if (e.type === 'drop') {
    tone(90, .2, 'triangle', .08); tone(45, .24, 'sine', .08);
    if (effects) {
      trails.push(...e.cells.map(cell => ({ x: cell.x, y: cell.y, distance: e.distance, life: .18, color: e.color })));
      $('board-wrap').classList.remove('bump'); void $('board-wrap').offsetWidth; $('board-wrap').classList.add('bump');
      e.cells.forEach(({ x, y }) => spark((x + .5) * SIZE, (y + 1) * SIZE, e.color));
    }
  }
  if (e.type === 'lock') tone(125, .06, 'triangle', .025);
  if (e.type === 'clear') {
    const names = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS'];
    const name = e.spin ? `T-SPIN${e.count ? ' ' + names[e.count] : ''}` : names[e.count];
    $('score-event').textContent = `${name} +${e.points.toLocaleString()}${e.combo > 0 ? ` · ${e.combo} COMBO` : ''}${e.backToBack ? ' · B2B' : ''}`;
    announce(name + (e.count === 4 ? '!' : ''));
    melody(e.count === 4 ? [392, 494, 587, 784] : [440, 554, 659]);
    if (effects) e.rows.forEach(y => {
      flashes.push({ y, life: .32 });
      for (let x = 0; x < 10; x++) spark((x + .5) * SIZE, (y + .5) * SIZE, '#b69aff', 12);
    });
  }
  if (e.type === 'level') { melody([523, 659, 784, 1047], .11); $('score-event').textContent = `LEVEL ${game.level} · Pick up the pace.`; }
  if (e.type === 'over') { held.clear(); melody([330, 294, 220, 165], .13); updateBest(); syncOverlay(); }
  if (e.type === 'start') { melody([262, 330, 392, 523]); $('score-event').textContent = ''; }
}
const game = new Tetris({ onEvent: event });

function block(context, x, y, size, color, ghost = false) {
  const pad = size * .055;
  if (ghost) {
    context.fillStyle = color + '0c'; context.fillRect(x + pad, y + pad, size - pad * 2, size - pad * 2);
    context.strokeStyle = color + '65'; context.lineWidth = Math.max(1, size * .025);
    context.strokeRect(x + pad + 1, y + pad + 1, size - pad * 2 - 2, size - pad * 2 - 2);
    return;
  }
  context.fillStyle = color;
  context.beginPath(); context.roundRect(x + pad, y + pad, size - pad * 2, size - pad * 2, size * .075); context.fill();
  context.fillStyle = '#ffffff2a'; context.fillRect(x + pad + 3, y + pad + 2, size - pad * 2 - 6, size * .045);
  context.fillStyle = '#00000013'; context.fillRect(x + pad + 2, y + size - pad - size * .12, size - pad * 2 - 4, size * .08);
  context.strokeStyle = '#ffffff0e'; context.lineWidth = 1; context.strokeRect(x + size * .22, y + size * .22, size * .56, size * .56);
}
function preview(id, type, muted = false) {
  const canvas = $(id), context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!type) return;
  const shape = cells({ matrix: SHAPES[type], x: 0, y: 0 });
  const minX = Math.min(...shape.map(c => c.x)), maxX = Math.max(...shape.map(c => c.x));
  const minY = Math.min(...shape.map(c => c.y)), maxY = Math.max(...shape.map(c => c.y));
  const size = 29;
  const left = (canvas.width - (maxX - minX + 1) * size) / 2;
  const top = (canvas.height - (maxY - minY + 1) * size) / 2;
  context.globalAlpha = muted ? .35 : 1;
  shape.forEach(c => block(context, left + (c.x - minX) * size, top + (c.y - minY) * size, size, COLORS[type]));
  context.globalAlpha = 1;
}
function draw() {
  ctx.clearRect(0, 0, 600, 1200);
  ctx.strokeStyle = theme === 'light' ? '#cbd0e080' : '#33354b60'; ctx.lineWidth = 1;
  for (let x = 0; x <= 10; x++) { ctx.beginPath(); ctx.moveTo(x * SIZE, 0); ctx.lineTo(x * SIZE, 1200); ctx.stroke(); }
  for (let y = 0; y <= 20; y++) { ctx.beginPath(); ctx.moveTo(0, y * SIZE); ctx.lineTo(600, y * SIZE); ctx.stroke(); }
  game.board.forEach((row, y) => row.forEach((type, x) => { if (type) block(ctx, x * SIZE, y * SIZE, SIZE, COLORS[type]); }));
  if (game.active && game.state !== 'over') {
    const ghost = game.ghost();
    cells(ghost).forEach(({ x, y }) => block(ctx, x * SIZE, y * SIZE, SIZE, COLORS[ghost.type], true));
    cells(game.active).forEach(({ x, y }) => block(ctx, x * SIZE, y * SIZE, SIZE, COLORS[game.active.type]));
    if (effects && game.grounded()) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(.26, game.lockTime / 650 * .26)})`;
      cells(game.active).forEach(({ x, y }) => ctx.fillRect(x * SIZE + 4, y * SIZE + 4, SIZE - 8, SIZE - 8));
    }
  }
}
let previousUI = '';
function updateBest() { if (game.score > best) { best = game.score; storage.set('afterglow.best', best); } }
function updateUI() {
  const key = [game.score, game.lines, game.level, game.hold, game.holdUsed, game.queue.slice(0,5).join(''), best].join('|');
  if (key === previousUI) return;
  previousUI = key;
  $('score').textContent = String(game.score).padStart(6, '0');
  $('lines').textContent = String(game.lines).padStart(2, '0');
  $('level').textContent = $('tempo').textContent = String(game.level).padStart(2, '0');
  $('best').textContent = Math.max(best, game.score).toLocaleString();
  $('level-progress').style.width = `${game.lines % 10 * 10}%`;
  $('level-remaining').textContent = `${10 - game.lines % 10} lines`;
  $('hold-empty').hidden = !!game.hold;
  $('hold-hint').textContent = game.holdUsed ? 'Used' : '';
  preview('hold', game.hold, game.holdUsed);
  game.queue.slice(0, 5).forEach((type, i) => preview(`next-${i}`, type));
}
function updateParticles(dt) {
  fx.clearRect(0, 0, 600, 1200);
  if (!effects) return;
  for (const trail of trails) { trail.life -= dt; fx.globalAlpha = Math.max(0, trail.life / .18) * .16; fx.fillStyle = trail.color; fx.fillRect(trail.x * SIZE + 5, (trail.y - trail.distance) * SIZE, SIZE - 10, trail.distance * SIZE); }
  for (const flash of flashes) { flash.life -= dt; fx.globalAlpha = Math.max(0, flash.life / .32) * .65; fx.fillStyle = '#b69aff'; fx.fillRect(0, flash.y * SIZE, 600, SIZE); }
  for (const p of particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 550 * dt; fx.globalAlpha = Math.max(0, p.life / p.max); fx.fillStyle = p.color; fx.fillRect(p.x, p.y, p.size, p.size); }
  fx.globalAlpha = 1;
  particles = particles.filter(p => p.life > 0); trails = trails.filter(p => p.life > 0); flashes = flashes.filter(p => p.life > 0);
}
function syncOverlay() {
  const state = game.state;
  $('overlay').hidden = state === 'playing';
  $('pause').disabled = state === 'ready' || state === 'over';
  $('pause').textContent = state === 'paused' ? '▷' : 'Ⅱ';
  $('pause').setAttribute('aria-label', state === 'paused' ? 'Resume game' : 'Pause game');
  $('status').textContent = { ready: 'READY', playing: 'PLAYING', paused: 'PAUSED', over: 'GAME OVER' }[state];
  if (state === 'playing') return;
  $('overlay-label').textContent = restartConfirm ? 'A FRESH START?' : { ready: 'LET THE WORLD WAIT', paused: 'ROOM TO BREATHE', over: 'THERE’S ALWAYS ANOTHER ROUND' }[state];
  $('overlay-title').textContent = restartConfirm ? 'Start over?' : { ready: 'Tetris', paused: 'Paused', over: 'Game over' }[state];
  $('overlay-description').innerHTML = restartConfirm ? `Your score is ${game.score.toLocaleString()}.<br>Press Escape to keep playing.` : state === 'over' ? `${game.score.toLocaleString()} points · ${game.lines} lines<br>${game.score >= best && game.score > 0 ? 'A personal best. Nicely done.' : 'Breathe in. Try again.'}` : state === 'paused' ? 'Your next move can wait.<br>Come back when you’re ready.' : 'A familiar game.<br>A fresh state of mind.';
  $('play').innerHTML = `${restartConfirm ? 'Start fresh' : state === 'paused' ? 'Resume' : state === 'over' ? 'Play again' : 'Play'} <span>↗</span>`;
  $('overlay-hint').textContent = 'or press Enter';
}
function startOrResume() {
  held.clear();
  if (game.state === 'paused' && !restartConfirm) game.pause();
  else { updateBest(); particles = []; trails = []; flashes = []; game.start(); }
  restartConfirm = false; syncOverlay();
}
function pause() {
  held.clear();
  if (restartConfirm) { restartConfirm = false; if (game.state === 'paused') game.pause(); }
  else game.pause();
  syncOverlay();
}
function requestRestart() {
  if (game.state === 'ready' || game.state === 'over') { startOrResume(); return; }
  updateBest(); held.clear();
  if (game.state === 'playing') game.pause();
  restartConfirm = true; syncOverlay();
}
function action(name) {
  if (game.state !== 'playing') return;
  ({ left: () => game.move(-1), right: () => game.move(1), soft: () => game.move(0, 1, true), rotate: () => game.rotate(1), ccw: () => game.rotate(-1), hard: () => game.drop(true), sonic: () => game.drop(false), hold: () => game.swap() })[name]?.();
}
const bindings = { ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'soft', ArrowUp: 'rotate', KeyX: 'rotate', KeyZ: 'ccw', Space: 'hard', ShiftLeft: 'sonic', ShiftRight: 'sonic', KeyC: 'hold' };
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target instanceof HTMLElement && e.target.matches('button,a,input,select,textarea') && (e.code === 'Space' || e.code === 'Enter')) return;
  if (bindings[e.code] || ['KeyP','Escape','Enter','KeyR'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'Enter' && game.state !== 'playing') { startOrResume(); return; }
  if (e.code === 'KeyP' || e.code === 'Escape') { pause(); return; }
  if (e.code === 'KeyR') { requestRestart(); return; }
  const name = bindings[e.code];
  if (name && game.state === 'playing') {
    action(name);
    if (['left','right','soft'].includes(name)) held.set(e.code, { name, time: 0, next: name === 'soft' ? 40 : 150 });
  }
});
document.addEventListener('keyup', e => held.delete(e.code));
window.addEventListener('blur', () => { held.clear(); if (game.state === 'playing') { game.pause(); syncOverlay(); } updateBest(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { held.clear(); if (game.state === 'playing') { game.pause(); syncOverlay(); } updateBest(); } });
window.addEventListener('pagehide', updateBest);
$('play').addEventListener('click', () => { startOrResume(); $('play').blur(); });
$('pause').addEventListener('click', () => { pause(); $('pause').blur(); });
$('restart').addEventListener('click', () => { requestRestart(); $('restart').blur(); });
function syncSettings() {
  document.documentElement.dataset.theme = theme;
  $('theme-toggle').setAttribute('aria-checked', String(theme === 'light'));
  document.querySelector('meta[name="theme-color"]').content = theme === 'light' ? '#f1f2fa' : '#0c0c14';
  $('sound-toggle').setAttribute('aria-checked', String(sound));
  $('effects-toggle').setAttribute('aria-checked', String(effects));
  document.body.classList.toggle('effects-off', !effects);
}
$('theme-toggle').addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; storage.set('afterglow.theme', theme); syncSettings(); $('theme-toggle').blur(); });
$('sound-toggle').addEventListener('click', () => { sound = !sound; storage.set('afterglow.sound', sound); if (sound) tone(523, .12); else audioContext?.suspend().catch(() => {}); syncSettings(); $('sound-toggle').blur(); });
$('effects-toggle').addEventListener('click', () => { effects = !effects; storage.set('afterglow.effects', effects); particles = []; trails = []; flashes = []; syncSettings(); $('effects-toggle').blur(); });
document.querySelectorAll('[data-action]').forEach(button => {
  button.addEventListener('pointerdown', e => {
    e.preventDefault(); button.setPointerCapture(e.pointerId);
    const name = button.dataset.action; action(name);
    if (game.state === 'playing' && ['left','right','soft'].includes(name)) held.set(`touch-${e.pointerId}`, { name, time: 0, next: name === 'soft' ? 40 : 150 });
  });
  for (const type of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(type, e => held.delete(`touch-${e.pointerId}`));
  button.addEventListener('click', e => { if (e.detail === 0) action(button.dataset.action); });
});
let previousTime = performance.now();
function frame(now) {
  const dt = Math.min(now - previousTime, 50); previousTime = now;
  if (game.state === 'playing') {
    for (const key of held.values()) { key.time += dt; while (key.time >= key.next) { action(key.name); key.next += key.name === 'soft' ? 35 : 45; } }
    game.tick(dt);
  }
  draw(); updateUI(); updateParticles(dt / 1000);
  requestAnimationFrame(frame);
}
syncSettings(); syncOverlay(); updateUI(); requestAnimationFrame(frame);
