import { loadLevel, findPlayerStart, findTreasure } from './entities/maze.js';
import { createPlayer, tryMove } from './entities/player.js';
import { createNPCs, applyRiddles, findAdjacentNPC } from './entities/npc.js';
import { makeCanMove } from './game/collision.js';
import { bindInput } from './game/input.js';
import { createState, STATE } from './game/state.js';
import { drawScene } from './ui/renderer.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const solvedEl = document.getElementById('solved-count');

async function main() {
  statusEl.textContent = 'Загрузка...';

  const [level, riddles] = await Promise.all([
    loadLevel('./src/content/level1.json'),
    fetch('./src/content/riddles.json')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ]);

  canvas.width = level.cols * level.tileSize;
  canvas.height = level.rows * level.tileSize;

  const player = createPlayer(findPlayerStart(level));
  const npcs = applyRiddles(createNPCs(level), riddles);
  const state = createState();
  const canMove = makeCanMove(level, npcs);
  const treasure = findTreasure(level);

  const render = () => drawScene(ctx, level, player, npcs);

  const updateHUD = () => {
    const solved = npcs.filter((n) => n.solved).length;
    solvedEl.textContent = `${solved}/${npcs.length}`;
    if (state.current === STATE.WIN) {
      statusEl.textContent = '🏆 Клад твой!';
    } else {
      statusEl.textContent = `Позиция: (${player.x}, ${player.y})`;
    }
  };

  const checkWin = () => {
    if (player.x === treasure.x && player.y === treasure.y) {
      state.current = STATE.WIN;
      return true;
    }
    return false;
  };

  bindInput({
    move: (dx, dy) => {
      if (state.current !== STATE.EXPLORING) return;
      if (tryMove(player, dx, dy, canMove)) {
        render();
        checkWin();
        updateHUD();
      }
    },
    interact: () => {
      if (state.current !== STATE.EXPLORING) return;
      const near = findAdjacentNPC(npcs, player);
      if (near) {
        // Этап 4 подставит модалку. Пока — превью текста в статусе.
        statusEl.textContent = `${near.name}: ${near.riddle.question}`;
      }
    },
  });

  render();
  updateHUD();
}

main().catch((err) => {
  console.error(err);
  statusEl.textContent = 'Ошибка: ' + err.message;
});
