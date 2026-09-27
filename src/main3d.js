import { loadLevel, findPlayerStart, findTreasure } from './entities/maze.js';
import { createNPCs, applyRiddles, findAdjacentNPC } from './entities/npc.js';
import { makeCanMove } from './game/collision.js';
import { bindInput3D } from './game/input3d.js';
import { createState, STATE } from './game/state.js';
import { openDialogue, closeDialogue, isDialogueOpen } from './ui/dialogue.js';
import { sounds, toggleMute, isEnabled, startAmbient } from './game/audio.js';
import {
  createPlayer3D, forwardStep, backwardStep, turnLeft, turnRight,
  tryMoveWithDir, headingToYaw, syncFPSFromStep, syncStepFromFPS,
} from './entities/player3d.js';
import { isWalkable } from './entities/maze.js';
import { findNPCAt } from './entities/npc.js';
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
const fpsHintEl = document.getElementById('fps-hint');
const fullscreenBtn = document.getElementById('fullscreen-btn');

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

  const applyCanvasSize = () => {
    const rect = sceneCanvas.getBoundingClientRect();
    const w = Math.max(240, Math.round(rect.width));
    const h = Math.max(180, Math.round(rect.height));
    scene.resize(w, h);
  };
  window.addEventListener('resize', applyCanvasSize);
  window.addEventListener('orientationchange', applyCanvasSize);
  document.addEventListener('fullscreenchange', () => {
    // Даём layout'у перекомпоноваться перед пересчётом canvas
    requestAnimationFrame(applyCanvasSize);
  });
  applyCanvasSize();

  fullscreenBtn?.addEventListener('click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
      fullscreenBtn.textContent = '⛶ На весь экран';
    } else {
      document.documentElement.requestFullscreen?.().then(() => {
        fullscreenBtn.textContent = '✕ Свернуть';
      }).catch(() => {});
    }
  });
  document.addEventListener('fullscreenchange', () => {
    if (fullscreenBtn) {
      fullscreenBtn.textContent = document.fullscreenElement
        ? '✕ Свернуть'
        : '⛶ На весь экран';
    }
  });

  const camState = {
    x: player.x,
    z: player.y,
    yaw: headingToYaw(player.heading),
  };
  let animating = false;
  let sceneTime = 0;

  // FPS-режим (pointer lock + мышь + WASD)
  let fpsMode = false;
  let camPitch = 0;
  const MOUSE_SENS = 0.0022;
  const PITCH_LIMIT = Math.PI / 2 - 0.05;
  const MOVE_SPEED = 3.2;
  const RUN_MULT = 1.7;
  const PLAYER_RADIUS = 0.32;
  const pressed = new Set();
  let lastTickTime = performance.now();

  const blockedAt = (px, pz) => {
    for (const [ox, oz] of [[-PLAYER_RADIUS, -PLAYER_RADIUS], [PLAYER_RADIUS, -PLAYER_RADIUS], [-PLAYER_RADIUS, PLAYER_RADIUS], [PLAYER_RADIUS, PLAYER_RADIUS]]) {
      const cx = Math.round(px + ox);
      const cy = Math.round(pz + oz);
      if (!isWalkable(level, cx, cy)) return true;
      const npc = findNPCAt(npcs, cx, cy);
      if (npc && !npc.solved) return true;
    }
    return false;
  };

  const enterFPS = () => {
    if (fpsMode) return;
    fpsMode = true;
    syncFPSFromStep(player);
    camPitch = 0;
    pressed.clear();
    fpsHintEl?.classList.add('hidden');
  };

  const exitFPS = () => {
    if (!fpsMode) return;
    fpsMode = false;
    syncStepFromFPS(player, camState.yaw);
    camState.x = player.x;
    camState.z = player.y;
    camState.yaw = headingToYaw(player.heading);
    camPitch = 0;
    pressed.clear();
    fpsHintEl?.classList.remove('hidden');
    updateHUD();
  };

  sceneCanvas.addEventListener('click', () => {
    if (state.current !== STATE.EXPLORING) return;
    if (document.pointerLockElement === sceneCanvas) return;
    sceneCanvas.requestPointerLock?.();
  });

  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === sceneCanvas) enterFPS();
    else exitFPS();
  });

  document.addEventListener('mousemove', (e) => {
    if (!fpsMode) return;
    camState.yaw -= e.movementX * MOUSE_SENS;
    camPitch -= e.movementY * MOUSE_SENS;
    if (camPitch > PITCH_LIMIT) camPitch = PITCH_LIMIT;
    if (camPitch < -PITCH_LIMIT) camPitch = -PITCH_LIMIT;
  });

  const trackKey = (e, down) => {
    if (!fpsMode) return;
    const k = e.key.toLowerCase();
    const map = {
      'w': 'w', 'ц': 'w', 'arrowup': 'w',
      's': 's', 'ы': 's', 'arrowdown': 's',
      'a': 'a', 'ф': 'a', 'arrowleft': 'a',
      'd': 'd', 'в': 'd', 'arrowright': 'd',
      'shift': 'shift',
    };
    const key = map[k];
    if (!key) return;
    if (down) pressed.add(key); else pressed.delete(key);
    e.preventDefault();
  };
  window.addEventListener('keydown', (e) => trackKey(e, true));
  window.addEventListener('keyup', (e) => trackKey(e, false));

  // Туман войны: набор посещённых клеток
  const visited = new Set();
  const reveal = (x, y) => {
    visited.add(`${x},${y}`);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      visited.add(`${x + dx},${y + dy}`);
    }
  };
  reveal(player.x, player.y);

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
    drawMinimap(minimapCanvas, level, player, npcs, treasurePos, visited);
  };

  const checkWin = () => {
    if (!onTreasure()) return 'none';
    if (solvedCount() < npcs.length) return 'locked';
    state.current = STATE.WIN;
    scene.triggerWin(sceneTime);
    setTimeout(() => winOverlay.classList.add('open'), 1400);
    sounds.win();
    return 'win';
  };

  const moveAnim = () => {
    animating = true;
    reveal(player.x, player.y);
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
      if (fpsMode || animating || state.current !== STATE.EXPLORING) return;
      if (tryMoveWithDir(player, forwardStep(player), canMove)) {
        sounds.step(); moveAnim();
      }
    },
    backward: () => {
      if (fpsMode || animating || state.current !== STATE.EXPLORING) return;
      if (tryMoveWithDir(player, backwardStep(player), canMove)) {
        sounds.step(); moveAnim();
      }
    },
    turnLeft: () => {
      if (fpsMode || animating || state.current !== STATE.EXPLORING) return;
      turnLeft(player); turnAnim();
    },
    turnRight: () => {
      if (fpsMode || animating || state.current !== STATE.EXPLORING) return;
      turnRight(player); turnAnim();
    },
    interact: () => {
      if (state.current !== STATE.EXPLORING) return;
      // В FPS-режиме находим NPC от округлённой позиции игрока
      const probe = fpsMode
        ? { x: Math.round(player.px), y: Math.round(player.pz) }
        : player;
      const near = findAdjacentNPC(npcs, probe);
      if (!near) return;
      state.current = STATE.DIALOGUE;
      // В FPS-режиме отпускаем pointer lock, чтобы игрок мог кликать по вариантам
      if (fpsMode) document.exitPointerLock?.();
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
  let stepSoundAcc = 0;
  const animate = () => {
    const now = performance.now();
    const t = (now - t0) / 1000;
    const dt = Math.min(0.05, (now - lastTickTime) / 1000);
    lastTickTime = now;
    sceneTime = t;

    if (fpsMode && state.current === STATE.EXPLORING) {
      // WASD относительно yaw. Forward = -Z в камерных координатах = (sin(yaw), cos(yaw))
      // но у нас yaw увеличивается против часовой (Y-axis). Взгляд «вперёд» = -Z_world при yaw=0.
      let fx = 0, fz = 0;
      if (pressed.has('w')) fz -= 1;
      if (pressed.has('s')) fz += 1;
      if (pressed.has('a')) fx -= 1;
      if (pressed.has('d')) fx += 1;
      if (fx !== 0 || fz !== 0) {
        const len = Math.hypot(fx, fz);
        fx /= len; fz /= len;
        // Поворот вектора движения на yaw. Взгляд «вперёд» в мир: (sin(yaw), cos(yaw)) для -Z.
        // Значит forward_world = -sin(yaw), -cos(yaw); right_world = cos(yaw), -sin(yaw).
        const sinY = Math.sin(camState.yaw);
        const cosY = Math.cos(camState.yaw);
        const wx = fx * cosY + fz * sinY;
        const wz = -fx * sinY + fz * cosY;
        const speed = MOVE_SPEED * (pressed.has('shift') ? RUN_MULT : 1);
        const moveX = wx * speed * dt;
        const moveZ = wz * speed * dt;

        const tryX = player.px + moveX;
        if (!blockedAt(tryX, player.pz)) player.px = tryX;
        const tryZ = player.pz + moveZ;
        if (!blockedAt(player.px, tryZ)) player.pz = tryZ;

        // Проекция в step-координаты (для onTreasure / NPC / mini-map / визитед)
        const cellX = Math.round(player.px);
        const cellY = Math.round(player.pz);
        if (cellX !== player.x || cellY !== player.y) {
          player.x = cellX;
          player.y = cellY;
          reveal(cellX, cellY);
          const r = checkWin();
          if (r === 'locked') sounds.locked();
          updateHUD();
        }
        // Шаги: раз в ~0.35 сек при движении
        stepSoundAcc += dt;
        if (stepSoundAcc > 0.35) {
          sounds.step();
          stepSoundAcc = 0;
        }
      } else {
        stepSoundAcc = 0;
      }
      camState.x = player.px;
      camState.z = player.pz;
    }

    scene.tick(t, player, { x: camState.x, z: camState.z }, camState.yaw, camPitch);
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
