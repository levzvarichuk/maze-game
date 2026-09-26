import { loadLevel, findPlayerStart, findTreasure } from './entities/maze.js';
import { createNPCs, applyRiddles, findAdjacentNPC } from './entities/npc.js';
import { makeCanMove } from './game/collision.js';
import { bindInput3D } from './game/input3d.js';
import { createState, STATE } from './game/state.js';
import { openDialogue, closeDialogue, isDialogueOpen } from './ui/dialogue.js';
import { sounds, toggleMute, isEnabled, startAmbient } from './game/audio.js';
import {
  createPlayer3D, forwardStep, backwardStep, turnLeft, turnRight,
  tryMoveWithDir, headingToYaw,
} from './entities/player3d.js';
import { buildScene, tween, shortestAngle, drawMinimap } from './ui/scene3d.js';

const sceneCanvas = document.getElementById('scene');
const minimapCanvas = document.getElementById('minimap');
const statusEl = document.getElementById('status');
const solvedEl = document.getElementById('solved-count');
const titleEl = document.getElementById('level-title');
const hintEl = document.getElementById('hint');
const winOverlay = document.getElementById('win-overlay');
const winRestart = document.getElementById('win-restart');
const muteBtn = document.getElementById('mute-btn');

async function main() {
  statusEl.textContent = 'Загрузка 3D-сцены...';

  const [level, riddles] = await Promise.all([
    loadLevel('./src/content/level1.json'),
    fetch('./src/content/riddles.json')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ]);

  if (level.title) titleEl.textContent = level.title + ' · 3D';

  const player = createPlayer3D(findPlayerStart(level));
  const npcs = applyRiddles(createNPCs(level), riddles);
  const state = createState();
  const canMove = makeCanMove(level, npcs);
  const treasurePos = findTreasure(level);

  const scene = buildScene(sceneCanvas, level);
  scene.setTreasurePosition(treasurePos.x, treasurePos.y);

  const camState = {
    x: player.x,
    z: player.y,
    yaw: headingToYaw(player.heading),
  };
  let animating = false;

  const solvedCount = () => npcs.filter((n) => n.solved).length;
  const onTreasure = () => player.x === treasurePos.x && player.y === treasurePos.y;

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
      const dirName = ['север', 'восток', 'юг', 'запад'][player.heading];
      statusEl.textContent = `(${player.x}, ${player.y}) · смотришь на ${dirName}`;
      const near = findAdjacentNPC(npcs, player);
      hintEl.textContent = near ? `Рядом: ${near.name}. Enter — говорить.` : '';
    }
    drawMinimap(minimapCanvas, level, player, npcs, treasurePos);
  };

  const checkWin = () => {
    if (!onTreasure()) return 'none';
    if (solvedCount() < npcs.length) return 'locked';
    state.current = STATE.WIN;
    winOverlay.classList.add('open');
    sounds.win();
    return 'win';
  };

  const moveAnim = () => {
    animating = true;
    tween(camState.x, player.x, 220, (v) => { camState.x = v; });
    tween(camState.z, player.y, 220, (v) => { camState.z = v; }, () => {
      animating = false;
      const r = checkWin();
      if (r === 'locked') sounds.locked();
      updateHUD();
    });
  };

  const turnAnim = () => {
    animating = true;
    const target = shortestAngle(camState.yaw, headingToYaw(player.heading));
    tween(camState.yaw, target, 220, (v) => { camState.yaw = v; }, () => {
      animating = false;
      updateHUD();
    });
  };

  winRestart.addEventListener('click', () => location.reload());
  muteBtn.addEventListener('click', () => {
    const on = toggleMute();
    muteBtn.textContent = on ? '🔊 Звук' : '🔇 Тихо';
  });

  bindInput3D({
    forward: () => {
      if (animating || state.current !== STATE.EXPLORING) return;
      if (tryMoveWithDir(player, forwardStep(player), canMove)) {
        sounds.step(); moveAnim();
      }
    },
    backward: () => {
      if (animating || state.current !== STATE.EXPLORING) return;
      if (tryMoveWithDir(player, backwardStep(player), canMove)) {
        sounds.step(); moveAnim();
      }
    },
    turnLeft: () => {
      if (animating || state.current !== STATE.EXPLORING) return;
      turnLeft(player); turnAnim();
    },
    turnRight: () => {
      if (animating || state.current !== STATE.EXPLORING) return;
      turnRight(player); turnAnim();
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
          scene.updateNPCVisual(npc.id, true);
          state.current = STATE.EXPLORING;
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
    cancel: () => { if (isDialogueOpen()) closeDialogue(); },
  });

  muteBtn.textContent = isEnabled() ? '🔊 Звук' : '🔇 Тихо';

  const t0 = performance.now();
  const animate = () => {
    const t = (performance.now() - t0) / 1000;
    scene.tick(t, player, { x: camState.x, z: camState.z }, camState.yaw);
    requestAnimationFrame(animate);
  };
  animate();
  updateHUD();

  const startMusic = () => startAmbient();
  window.addEventListener('keydown', startMusic, { once: true });
  window.addEventListener('click', startMusic, { once: true });
}

main().catch((err) => {
  console.error(err);
  statusEl.textContent = 'Ошибка: ' + err.message;
});
