import { isWalkable } from '../entities/maze.js';
import { findNPCAt } from '../entities/npc.js';

export function makeCanMove(level, npcs) {
  return (x, y) => {
    if (!isWalkable(level, x, y)) return false;
    const npc = findNPCAt(npcs, x, y);
    if (npc && !npc.solved) return false;
    return true;
  };
}
