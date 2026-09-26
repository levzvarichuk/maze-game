export function createPlayer(start) {
  return {
    x: start.x,
    y: start.y,
    solvedCount: 0,
  };
}

export function tryMove(player, dx, dy, canMoveFn) {
  const nx = player.x + dx;
  const ny = player.y + dy;
  if (canMoveFn(nx, ny)) {
    player.x = nx;
    player.y = ny;
    return true;
  }
  return false;
}
