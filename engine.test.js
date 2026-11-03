import test from 'node:test';
import assert from 'node:assert/strict';
import { Tetris, SHAPES, cells, rotateMatrix } from './engine.js';

const newGame = () => { const game = new Tetris({ random: () => .42 }); game.start(); return game; };
const use = (game, type, x = 3, y = 0) => { game.active = { type, matrix: SHAPES[type].map(row => [...row]), rotation: 0, x, y }; };
const count = game => game.board.flat().filter(Boolean).length;

test('each seven-piece bag contains every tetromino once', () => {
  const game = newGame();
  const sequence = [game.active.type];
  for (let i = 0; i < 20; i++) { game.spawn(); sequence.push(game.active.type); }
  for (let i = 0; i < 21; i += 7) assert.equal(new Set(sequence.slice(i, i + 7)).size, 7);
});
test('hold is limited to once per piece, then swaps with reset orientation', () => {
  const game = newGame(), first = game.active.type;
  assert.equal(game.swap(), true);
  assert.equal(game.hold, first);
  assert.equal(game.swap(), false);
  game.drop();
  const current = game.active.type;
  assert.equal(game.swap(), true);
  assert.equal(game.active.type, first);
  assert.equal(game.hold, current);
  assert.equal(game.active.rotation, 0);
});
test('Shift-style sonic drop lands without locking and permits a slide', () => {
  const game = newGame();
  use(game, 'T');
  game.drop(false);
  assert.equal(game.grounded(), true);
  assert.equal(count(game), 0);
  assert.equal(game.score, 0);
  game.tick(600);
  assert.equal(count(game), 0);
  assert.equal(game.move(-1), true);
  game.tick(600);
  assert.equal(count(game), 0);
  game.tick(50);
  assert.equal(count(game), 4);
});
test('Space-style hard drop locks immediately and awards two points per row', () => {
  const game = newGame(); use(game, 'O', 4);
  game.drop(true);
  assert.equal(count(game), 4);
  assert.equal(game.score, 36);
  assert.equal(game.active.y, 0);
});
test('soft drop awards one point and cannot cross the floor or walls', () => {
  const game = newGame(); use(game, 'O', 0, 0);
  assert.equal(game.move(-1), false);
  assert.equal(game.move(0, 1, true), true);
  assert.equal(game.score, 1);
  game.drop(false);
  assert.equal(game.move(0, 1, true), false);
  assert.equal(game.score, 1);
});
test('rotation cycles correctly and SRS kicks T and I pieces off walls', () => {
  assert.deepEqual(rotateMatrix(rotateMatrix(SHAPES.T), -1), SHAPES.T);
  for (const type of ['T', 'I']) {
    const game = newGame(); use(game, type);
    game.rotate();
    while (game.move(-1)) {}
    assert.equal(game.rotate(), true);
    assert.equal(game.valid(game.active), true);
    assert.ok(cells(game.active).every(c => c.x >= 0));
  }
});
test('a four-line clear compacts the board and scores a Tetris', () => {
  const game = newGame();
  for (let y = 16; y < 20; y++) game.board[y] = Array.from({ length: 10 }, (_, x) => x === 4 ? null : 'J');
  use(game, 'I', 2, 16); game.active.matrix = rotateMatrix(SHAPES.I); game.active.rotation = 1;
  game.lock();
  assert.equal(game.lines, 4);
  assert.equal(game.score, 800);
  assert.equal(count(game), 0);
});
test('consecutive Tetrises award back-to-back and combo bonuses', () => {
  const game = newGame();
  for (let i = 0; i < 2; i++) {
    for (let y = 16; y < 20; y++) game.board[y] = Array.from({ length: 10 }, (_, x) => x === 4 ? null : 'L');
    use(game, 'I', 2, 16); game.active.matrix = rotateMatrix(SHAPES.I); game.active.rotation = 1; game.lock();
  }
  assert.equal(game.score, 800 + 1200 + 50);
  assert.equal(game.lines, 8);
});
test('line thresholds increase level and gravity speed', () => {
  const game = newGame(); game.lines = 9;
  game.board[19] = Array.from({ length: 10 }, (_, x) => x >= 3 && x <= 6 ? null : 'S');
  use(game, 'I', 3, 18); game.lock();
  assert.equal(game.level, 2);
  assert.equal(game.lines, 10);
  assert.ok(game.interval < 850);
});
test('pause freezes gravity and disables gameplay actions', () => {
  const game = newGame(), before = structuredClone(game.active);
  game.pause(); game.tick(5000); game.drop(); game.swap(); game.rotate(); game.move(1);
  assert.deepEqual(game.active, before);
  assert.equal(count(game), 0);
  game.pause(); game.tick(850);
  assert.equal(game.active.y, before.y + 1);
});
test('repeated movement cannot reset the lock delay indefinitely', () => {
  const game = newGame(); use(game, 'O', 4); game.drop(false);
  for (let i = 0; i < 16; i++) { game.move(i % 2 ? 1 : -1); game.tick(20); }
  assert.equal(game.lockResets, 15);
  game.tick(650);
  assert.equal(count(game), 4);
});
test('blocked spawn ends the game and restart clears all state', () => {
  const game = newGame(); game.board[0].fill('Z'); game.spawn('O');
  assert.equal(game.state, 'over');
  game.start();
  assert.equal(game.state, 'playing');
  assert.equal(count(game), 0);
  assert.equal(game.score, 0);
  assert.equal(game.hold, null);
});
