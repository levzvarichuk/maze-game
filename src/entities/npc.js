export function createNPCs(level) {
  return level.npcs.map((n) => ({
    id: n.id,
    x: n.x,
    y: n.y,
    name: n.name,
    riddle: n.riddle,
    solved: false,
  }));
}

export function applyRiddles(npcs, riddlesData) {
  if (!riddlesData) return npcs;
  for (const npc of npcs) {
    const r = riddlesData[npc.id];
    if (r) {
      if (r.name) npc.name = r.name;
      npc.riddle = {
        question: r.question,
        options: r.options,
      };
    }
  }
  return npcs;
}

export function findNPCAt(npcs, x, y) {
  return npcs.find((n) => n.x === x && n.y === y) || null;
}

export function findAdjacentNPC(npcs, player) {
  return npcs.find((n) => {
    if (n.solved) return false;
    const dx = Math.abs(n.x - player.x);
    const dy = Math.abs(n.y - player.y);
    return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
  }) || null;
}
