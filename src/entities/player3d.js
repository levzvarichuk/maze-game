export const HEADING = {
  NORTH: 0, // -Z в трёхмерной системе
  EAST:  1, // +X
  SOUTH: 2, // +Z
  WEST:  3, // -X
};

const FORWARD = [
  { dx: 0,  dy: -1 }, // NORTH (y-1 в grid = север)
  { dx: 1,  dy: 0  }, // EAST
  { dx: 0,  dy: 1  }, // SOUTH
  { dx: -1, dy: 0  }, // WEST
];

export function createPlayer3D(start) {
  return {
    x: start.x,
    y: start.y,
    heading: HEADING.SOUTH,
    // FPS-режим: continuous позиция и pitch (наклон вверх/вниз)
    px: start.x,
    pz: start.y,
    pitch: 0,
    solvedCount: 0,
  };
}

// Синхронизация float-полей со step-полями (при входе в FPS-режим)
export function syncFPSFromStep(player) {
  player.px = player.x;
  player.pz = player.y;
}

// Обратная синхронизация: округление FPS-позиции в клетку, heading по yaw
export function syncStepFromFPS(player, yaw) {
  player.x = Math.round(player.px);
  player.y = Math.round(player.pz);
  // Yaw → heading: 0 = -Z (север), -PI/2 = +X (восток) и т.д.
  const norm = ((yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const step = Math.round(-norm / (Math.PI / 2));
  player.heading = ((step % 4) + 4) % 4;
  player.pitch = 0;
}

export function forwardStep(player) {
  return FORWARD[player.heading];
}

export function backwardStep(player) {
  const f = FORWARD[player.heading];
  return { dx: -f.dx, dy: -f.dy };
}

export function turnLeft(player) {
  player.heading = (player.heading + 3) % 4;
}

export function turnRight(player) {
  player.heading = (player.heading + 1) % 4;
}

export function headingToYaw(heading) {
  // Yaw (=поворот вокруг Y) в радианах для Three.js камеры.
  // heading 0 (север = -Z) должен смотреть в -Z. camera.rotation.y = 0 => взгляд в -Z. ✓
  // heading 1 (восток = +X) => rotation.y = -PI/2
  // heading 2 (юг = +Z) => rotation.y = PI
  // heading 3 (запад = -X) => rotation.y = +PI/2
  return -heading * Math.PI / 2;
}

export function tryMoveWithDir(player, dir, canMoveFn) {
  const nx = player.x + dir.dx;
  const ny = player.y + dir.dy;
  if (canMoveFn(nx, ny)) {
    player.x = nx;
    player.y = ny;
    return true;
  }
  return false;
}
