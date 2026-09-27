import { loadLevel, findPlayerStart, findTreasure } from './entities/maze.js';
import { createPlayer, tryMove } from './entities/player.js';
import { createNPCs, applyRiddles, findAdjacentNPC } from './entities/npc.js';
import { makeCanMove } from './game/collision.js';
import { bindInput } from './game/input.js';
import { createState, STATE } from './game/state.js';
import { drawScene } from './ui/renderer.js';
import { openDialogue, closeDialogue, isDialogueOpen } from './ui/dialogue.js';
import { sounds, toggleMute, isEnabled, startAmbient } from './game/audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const solvedEl = document.getElementById('solved-count');
const titleEl = document.getElementById('level-title');
const hintEl = document.getElementById('hint');
const winOverlay = document.getElementById('win-overlay');
const winRestart = document.getElementById('win-restart');
const muteBtn = document.getElementById('mute-btn');

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
  const solvedCount = () => npcs.filter((n) => n.solved).length;
  const onTreasure = () => player.x === treasure.x && player.y === treasure.y;

  const updateHUD = () => {
    solvedEl.textContent = `${solvedCount()}/${npcs.length}`;
    if (state.current === STATE.WIN) {
      statusEl.textContent = '🏆 Клад твой!';
      hintEl.textContent = '';
    } else if (state.current === STATE.DIALOGUE) {
      statusEl.textContent = 'Идёт разговор...';
      hintEl.textContent = '';
    } else if (onTreasure() && solvedCount() < npcs.length) {
      const left = npcs.length - solvedCount();
      statusEl.textContent = `Клад запечатан. Осталось загадок: ${left}.`;
      hintEl.textContent = '';
    } else {
      statusEl.textContent = `Позиция: (${player.x}, ${player.y})`;
      const near = findAdjacentNPC(npcs, player);
      hintEl.textContent = near ? `Рядом: ${near.name}. Enter — говорить.` : '';
    }
  };

  const checkWin = () => {
    if (!onTreasure()) return 'none';
    if (solvedCount() < npcs.length) return 'locked';
    state.current = STATE.WIN;
    winOverlay.classList.add('open');
    sounds.win();
    return 'win';
  };

  winRestart.addEventListener('click', () => location.reload());

  muteBtn.addEventListener('click', () => {
    const on = toggleMute();
    muteBtn.textContent = on ? '🔊 Звук' : '🔇 Тихо';
  });

  const fullscreenBtn = document.getElementById('fullscreen-btn');
  fullscreenBtn?.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  });
  document.addEventListener('fullscreenchange', () => {
    if (fullscreenBtn) {
      fullscreenBtn.textContent = document.fullscreenElement
        ? '✕ Свернуть'
        : '⛶ На весь экран';
    }
  });

  bindInput({
    move: (dx, dy) => {
      if (state.current !== STATE.EXPLORING) return;
      if (tryMove(player, dx, dy, canMove)) {
        sounds.step();
        render();
        const result = checkWin();
        if (result === 'locked') sounds.locked();
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

  muteBtn.textContent = isEnabled() ? '🔊 Звук' : '🔇 Тихо';
  render();
  updateHUD();

  const startMusic = () => startAmbient();
  window.addEventListener('keydown', startMusic, { once: true });
  window.addEventListener('click', startMusic, { once: true });
}

main().catch((err) => {
  console.error(err);
  statusEl.textContent = 'Ошибка: ' + err.message;
});
