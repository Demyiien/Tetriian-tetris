export const WIDTH = 10;
export const HEIGHT = 20;
export const COLORS = { I: '#00d9ff', O: '#ffcc00', T: '#ad4dff', S: '#35e86b', Z: '#ff3e68', J: '#4275ff', L: '#ff8a24' };
export const SHAPES = {
  I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  O: [[1,1],[1,1]],
  T: [[0,1,0],[1,1,1],[0,0,0]],
  S: [[0,1,1],[1,1,0],[0,0,0]],
  Z: [[1,1,0],[0,1,1],[0,0,0]],
  J: [[1,0,0],[1,1,1],[0,0,0]],
  L: [[0,0,1],[1,1,1],[0,0,0]],
};
const JLSTZ = {
  '0>1': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  '1>0': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
  '1>2': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
  '2>1': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  '2>3': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
  '3>2': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  '3>0': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  '0>3': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
};
const IKICKS = {
  '0>1': [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
  '1>0': [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
  '1>2': [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
  '2>1': [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
  '2>3': [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
  '3>2': [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
  '3>0': [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
  '0>3': [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
};
export function rotateMatrix(matrix, direction = 1) {
  return matrix.map((row, y) => row.map((_, x) => direction === 1 ? matrix[matrix.length - 1 - x][y] : matrix[x][matrix.length - 1 - y]));
}
export function cells(piece) {
  return piece.matrix.flatMap((row, y) => row.flatMap((filled, x) => filled ? [{ x: piece.x + x, y: piece.y + y }] : []));
}
export class Tetris {
  constructor({ random = Math.random, onEvent = () => {} } = {}) {
    this.random = random;
    this.onEvent = onEvent;
    this.reset();
  }
  reset() {
    this.board = Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(null));
    this.queue = [];
    this.hold = null;
    this.holdUsed = false;
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.combo = -1;
    this.backToBack = false;
    this.state = 'ready';
    this.active = null;
    this.refill();
  }
  refill() {
    while (this.queue.length < 7) {
      const bag = Object.keys(SHAPES);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      this.queue.push(...bag);
    }
  }
  start() { this.reset(); this.state = 'playing'; this.spawn(); this.emit('start'); }
  emit(type, data = {}) { this.onEvent({ type, ...data }); }
  spawn(type) {
    const name = type || this.queue.shift();
    this.refill();
    this.active = { type: name, matrix: SHAPES[name].map(row => [...row]), x: name === 'O' ? 4 : 3, y: 0, rotation: 0 };
    this.gravityTime = 0;
    this.lockTime = 0;
    this.lockResets = 0;
    this.lastRotation = false;
    if (!this.valid(this.active)) this.end();
  }
  end() { this.state = 'over'; this.emit('over'); }
  valid(piece) { return cells(piece).every(({ x, y }) => x >= 0 && x < WIDTH && y < HEIGHT && (y < 0 || !this.board[y][x])); }
  grounded() { return this.active && !this.valid({ ...this.active, y: this.active.y + 1 }); }
  resetLock(wasGrounded) {
    if (wasGrounded && this.lockResets < 15) { this.lockTime = 0; this.lockResets++; }
  }
  move(dx, dy = 0, manual = false) {
    if (this.state !== 'playing') return false;
    const moved = { ...this.active, x: this.active.x + dx, y: this.active.y + dy };
    if (!this.valid(moved)) return false;
    const wasGrounded = this.grounded();
    this.active = moved;
    this.lastRotation = false;
    this.resetLock(wasGrounded);
    if (dy > 0) { this.lockTime = 0; if (manual) this.score += dy; }
    if (manual || dx) this.emit(dy ? 'soft' : 'move');
    return true;
  }
  rotate(direction = 1) {
    if (this.state !== 'playing' || this.active.type === 'O') return false;
    const next = (this.active.rotation + direction + 4) % 4;
    const matrix = rotateMatrix(this.active.matrix, direction);
    const table = this.active.type === 'I' ? IKICKS : JLSTZ;
    for (const [dx, dy] of table[`${this.active.rotation}>${next}`]) {
      const rotated = { ...this.active, matrix, rotation: next, x: this.active.x + dx, y: this.active.y - dy };
      if (this.valid(rotated)) {
        const wasGrounded = this.grounded();
        this.active = rotated;
        this.lastRotation = true;
        this.resetLock(wasGrounded);
        this.emit('rotate');
        return true;
      }
    }
    return false;
  }
  ghost() {
    if (!this.active) return null;
    const ghost = { ...this.active };
    while (this.valid({ ...ghost, y: ghost.y + 1 })) ghost.y++;
    return ghost;
  }
  drop(hard = true) {
    if (this.state !== 'playing') return;
    const ghost = this.ghost();
    const distance = ghost.y - this.active.y;
    this.score += distance * (hard ? 2 : 0);
    this.active = ghost;
    if (distance) { this.lastRotation = false; this.lockTime = 0; }
    this.emit(hard ? 'drop' : 'sonic', { cells: cells(ghost), color: COLORS[ghost.type], distance });
    if (hard) this.lock();
  }
  swap() {
    if (this.state !== 'playing' || this.holdUsed) return false;
    const held = this.hold;
    this.hold = this.active.type;
    this.spawn(held);
    this.holdUsed = true;
    this.emit('hold');
    return true;
  }
  pause() {
    if (this.state === 'playing') this.state = 'paused';
    else if (this.state === 'paused') this.state = 'playing';
    this.emit('pause');
  }
  get interval() { return Math.max(65, 850 * Math.pow(0.8, this.level - 1)); }
  tick(dt) {
    if (this.state !== 'playing') return;
    this.gravityTime += dt;
    while (this.gravityTime >= this.interval) { this.gravityTime -= this.interval; if (!this.move(0, 1)) break; }
    if (this.grounded()) { this.lockTime += dt; if (this.lockTime >= 650) this.lock(); }
    else this.lockTime = 0;
  }
  lock() {
    if (this.state !== 'playing') return;
    const locked = cells(this.active);
    if (locked.some(cell => cell.y < 0)) { this.end(); return; }
    let spin = false;
    if (this.active.type === 'T' && this.lastRotation) {
      const { x, y } = this.active;
      spin = [[x,y],[x+2,y],[x,y+2],[x+2,y+2]].filter(([cx,cy]) => cx < 0 || cx >= WIDTH || cy >= HEIGHT || (cy >= 0 && this.board[cy][cx])).length >= 3;
    }
    for (const { x, y } of locked) this.board[y][x] = this.active.type;
    const cleared = this.board.flatMap((row, y) => row.every(Boolean) ? [y] : []);
    const n = cleared.length;
    this.emit('lock', { cells: locked, color: COLORS[this.active.type] });
    if (n || spin) {
      const difficult = n === 4 || (spin && n > 0);
      const bonus = difficult && this.backToBack;
      let points = (spin ? [400,800,1200,1600][n] : [0,100,300,500,800][n]) * this.level;
      if (bonus) points = Math.floor(points * 1.5);
      if (n) {
        this.combo++;
        points += Math.max(0, this.combo) * 50 * this.level;
        this.backToBack = difficult;
      } else this.combo = -1;
      this.score += points;
      this.board = this.board.filter((_, y) => !cleared.includes(y));
      while (this.board.length < HEIGHT) this.board.unshift(Array(WIDTH).fill(null));
      this.lines += n;
      const previous = this.level;
      this.level = Math.floor(this.lines / 10) + 1;
      this.emit('clear', { rows: cleared, count: n, spin, points, combo: this.combo, backToBack: bonus });
      if (this.level > previous) this.emit('level');
    } else this.combo = -1;
    this.holdUsed = false;
    this.spawn();
  }
}
