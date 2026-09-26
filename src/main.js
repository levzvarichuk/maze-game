import { loadLevel, findPlayerStart, findTreasure } from './entities/maze.js';
import { createPlayer, tryMove } from './entities/player.js';
import { createNPCs, applyRiddles, findAdjacentNPC } from './entities/npc.js';
import { makeCanMove } from './game/collision.js';
import { bindInput } from './game/input.js';
import { createState, STATE } from './game/state.js';
import { drawScene } from './ui/renderer.js';
import { openDialogue, closeDialogue, isDialogueOpen } from './ui/dialogue.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const solvedEl = document.getElementById('solved-count');
const titleEl = document.getElementById('level-title');
const winOverlay = document.getElementById('win-overlay');
const winRestart = document.getElementById('win-restart');

async function main() {
  statusEl.textContent = 'Загрузка...';

  const [level, riddles] = await Promise.all([
    loadLevel('./src/content/level1.json'),
    fetch('./src/content/riddles.json')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ]);

  if (level.title) titleEl.textContent = level.title;

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
    } else if (state.current === STATE.DIALOGUE) {
      statusEl.textContent = 'Идёт разговор...';
    } else {
      statusEl.textContent = `Позиция: (${player.x}, ${player.y})`;
    }
  };

  const checkWin = () => {
    if (player.x === treasure.x && player.y === treasure.y) {
      state.current = STATE.WIN;
      winOverlay.classList.add('open');
      return true;
    }
    return false;
  };

  winRestart.addEventListener('click', () => location.reload());

  bindInput({
    move: (dx, dy) => {
      if (state.current !== STATE.EXPLORING) return;
      if (tryMove(player, dx, dy, canMove)) {
        render();
        if (checkWin()) return updateHUD();
        updateHUD();
      }
    },
    interact: () => {
      if (state.current !== STATE.EXPLORING) return;
      const near = findAdjacentNPC(npcs, player);
      if (!near) return;
      state.current = STATE.DIALOGUE;
      updateHUD();
      openDialogue(
        near,
        (npc) => {
          npc.solved = true;
          state.current = STATE.EXPLORING;
          render();
          updateHUD();
        },
        () => {
          if (state.current === STATE.DIALOGUE) {
            state.current = STATE.EXPLORING;
            updateHUD();
          }
        }
      );
    },
    cancel: () => {
      if (isDialogueOpen()) closeDialogue();
    },
  });

  render();
  updateHUD();
}

main().catch((err) => {
  console.error(err);
  statusEl.textContent = 'Ошибка: ' + err.message;
});
