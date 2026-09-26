import { loadLevel, findPlayerStart, findTreasure } from './entities/maze.js';
import { drawMaze } from './ui/renderer.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');

async function main() {
  status.textContent = 'Загрузка уровня...';
  const level = await loadLevel('./src/content/level1.json');

  canvas.width = level.cols * level.tileSize;
  canvas.height = level.rows * level.tileSize;

  drawMaze(ctx, level);

  const start = findPlayerStart(level);
  const treasure = findTreasure(level);
  status.textContent = `Готово. Старт: (${start.x},${start.y}) · Клад: (${treasure.x},${treasure.y})`;
}

main().catch((err) => {
  console.error(err);
  status.textContent = 'Ошибка: ' + err.message;
});
