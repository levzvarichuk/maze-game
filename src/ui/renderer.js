import { TILE } from '../entities/maze.js';

const COLORS = {
  wall: '#3a3a5c',
  wallEdge: '#525275',
  floor: '#1a1a2e',
  floorGrid: '#22223b',
  treasure: '#f7d774',
  treasureShine: '#fff3b0',
  player: '#7ed6a5',
  playerEdge: '#c8f7dc',
  npc: '#b04a4a',
  npcSolved: '#4a6a4a',
  npcHalo: '#f0a0a0',
};

export function drawScene(ctx, level, player, npcs) {
  drawMaze(ctx, level);
  drawNPCs(ctx, level, npcs);
  drawPlayer(ctx, level, player);
}

function drawMaze(ctx, level) {
  const { cols, rows, tileSize, grid } = level;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const ch = grid[y][x];
      const px = x * tileSize;
      const py = y * tileSize;

      if (ch === TILE.WALL) {
        ctx.fillStyle = COLORS.wall;
        ctx.fillRect(px, py, tileSize, tileSize);
        ctx.strokeStyle = COLORS.wallEdge;
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, tileSize - 1, tileSize - 1);
      } else {
        ctx.fillStyle = COLORS.floor;
        ctx.fillRect(px, py, tileSize, tileSize);
        ctx.strokeStyle = COLORS.floorGrid;
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, tileSize - 1, tileSize - 1);

        if (ch === TILE.TREASURE) {
          drawTreasure(ctx, px, py, tileSize);
        }
      }
    }
  }
}

function drawTreasure(ctx, px, py, size) {
  const cx = px + size / 2;
  const cy = py + size / 2;
  ctx.fillStyle = COLORS.treasure;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.treasureShine;
  ctx.beginPath();
  ctx.arc(cx - size * 0.08, cy - size * 0.08, size * 0.08, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer(ctx, level, player) {
  const size = level.tileSize;
  const px = player.x * size;
  const py = player.y * size;
  const cx = px + size / 2;
  const cy = py + size / 2;

  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLORS.playerEdge;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawNPCs(ctx, level, npcs) {
  const size = level.tileSize;
  for (const n of npcs) {
    const px = n.x * size;
    const py = n.y * size;
    const cx = px + size / 2;
    const cy = py + size / 2;

    ctx.fillStyle = n.solved ? COLORS.npcSolved : COLORS.npcHalo;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.42, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = n.solved ? '#2a3a2a' : COLORS.npc;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.28, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#eaeaea';
    ctx.font = `bold ${Math.floor(size * 0.5)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(n.solved ? '✓' : '?', cx, cy + 1);
  }
}
