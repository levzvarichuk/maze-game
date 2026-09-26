export const TILE = {
  WALL: '#',
  FLOOR: '.',
  PLAYER_START: '@',
  NPC_MARKER: 'N',
  TREASURE: 'T',
};

export async function loadLevel(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Не удалось загрузить ${url}: ${res.status}`);
  const data = await res.json();
  validate(data);
  return data;
}

function validate(level) {
  const { cols, rows, grid } = level;
  if (grid.length !== rows) {
    throw new Error(`grid имеет ${grid.length} строк, ожидалось ${rows}`);
  }
  grid.forEach((row, i) => {
    if (row.length !== cols) {
      throw new Error(`строка ${i} имеет длину ${row.length}, ожидалось ${cols}`);
    }
  });
}

export function findPlayerStart(level) {
  for (let y = 0; y < level.rows; y++) {
    for (let x = 0; x < level.cols; x++) {
      if (level.grid[y][x] === TILE.PLAYER_START) return { x, y };
    }
  }
  throw new Error('Стартовая позиция @ не найдена');
}

export function findTreasure(level) {
  for (let y = 0; y < level.rows; y++) {
    for (let x = 0; x < level.cols; x++) {
      if (level.grid[y][x] === TILE.TREASURE) return { x, y };
    }
  }
  return null;
}

export function isWalkable(level, x, y) {
  if (x < 0 || y < 0 || x >= level.cols || y >= level.rows) return false;
  const ch = level.grid[y][x];
  return ch !== TILE.WALL;
}
