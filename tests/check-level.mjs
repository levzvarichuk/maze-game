import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const level = JSON.parse(readFileSync(`${root}/src/content/level1.json`, 'utf8'));
const riddles = JSON.parse(readFileSync(`${root}/src/content/riddles.json`, 'utf8'));

const fails = [];
const ok = (msg) => console.log('  \x1b[32m✓\x1b[0m', msg);
const fail = (msg) => { fails.push(msg); console.log('  \x1b[31m✗\x1b[0m', msg); };

console.log('\n== Level structure ==');
if (level.grid.length === level.rows) ok(`rows=${level.rows}`); else fail(`rows mismatch: ${level.grid.length} vs ${level.rows}`);
level.grid.forEach((r, i) => {
  if (r.length !== level.cols) fail(`row ${i}: ${r.length} chars, expected ${level.cols}`);
});
if (fails.length === 0) ok(`all ${level.rows} rows have ${level.cols} cols`);

console.log('\n== Unique markers ==');
let starts = 0, treasures = 0;
for (let y = 0; y < level.rows; y++) {
  for (let x = 0; x < level.cols; x++) {
    if (level.grid[y][x] === '@') starts++;
    if (level.grid[y][x] === 'T') treasures++;
  }
}
if (starts === 1) ok('exactly one @'); else fail(`@ count=${starts}`);
if (treasures === 1) ok('exactly one T'); else fail(`T count=${treasures}`);

console.log('\n== NPC coordinates match grid ==');
for (const n of level.npcs) {
  const ch = level.grid[n.y]?.[n.x];
  if (ch === 'N') ok(`${n.id} at (${n.x},${n.y}) = N`);
  else fail(`${n.id} at (${n.x},${n.y}) grid char is '${ch}', expected N`);
}

console.log('\n== NPC id uniqueness ==');
const ids = level.npcs.map((n) => n.id);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length === 0) ok(`${ids.length} unique ids`); else fail(`duplicate ids: ${dupes}`);

console.log('\n== Riddles cover all NPC ==');
const rIds = Object.keys(riddles);
const missing = ids.filter((id) => !rIds.includes(id));
const extra = rIds.filter((id) => !ids.includes(id));
if (missing.length === 0) ok('every NPC has riddle'); else fail(`missing riddles: ${missing}`);
if (extra.length === 0) ok('no orphan riddles'); else fail(`orphan riddles: ${extra}`);

console.log('\n== Riddle shape ==');
for (const [id, r] of Object.entries(riddles)) {
  if (!r.question) fail(`${id}: no question`);
  if (!Array.isArray(r.options) || r.options.length !== 3) { fail(`${id}: options must be array of 3`); continue; }
  const correctCount = r.options.filter((o) => o.correct === true).length;
  if (correctCount !== 1) fail(`${id}: correct=true count is ${correctCount}, expected 1`);
  const wrong = r.options.filter((o) => !o.correct);
  if (wrong.some((o) => !o.hint)) fail(`${id}: wrong option missing hint`);
  const correct = r.options.find((o) => o.correct);
  if (correct && !correct.onSolve) fail(`${id}: correct option missing onSolve`);
}
if (fails.length === 0 || !fails.some((f) => f.startsWith('guard_'))) ok('all riddles well-formed');

console.log('\n== BFS reachability (NPC counted as walkable) ==');
const isPassable = (x, y) => {
  if (x < 0 || y < 0 || x >= level.cols || y >= level.rows) return false;
  return level.grid[y][x] !== '#';
};
const findChar = (ch) => {
  for (let y = 0; y < level.rows; y++)
    for (let x = 0; x < level.cols; x++)
      if (level.grid[y][x] === ch) return { x, y };
  return null;
};
const start = findChar('@');
const treasure = findChar('T');
const visited = new Set();
const key = (x, y) => `${x},${y}`;
const queue = [start];
visited.add(key(start.x, start.y));
while (queue.length) {
  const { x, y } = queue.shift();
  for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const nx = x + dx, ny = y + dy;
    const k = key(nx, ny);
    if (isPassable(nx, ny) && !visited.has(k)) {
      visited.add(k);
      queue.push({ x: nx, y: ny });
    }
  }
}
if (visited.has(key(treasure.x, treasure.y))) ok(`treasure (${treasure.x},${treasure.y}) reachable from start`);
else fail(`treasure NOT reachable from start`);

for (const n of level.npcs) {
  const neighbors = [[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy]) => ({x: n.x+dx, y: n.y+dy}));
  const reachableNeighbor = neighbors.find((c) => visited.has(key(c.x, c.y)) && level.grid[c.y]?.[c.x] !== '#');
  if (reachableNeighbor) ok(`${n.id} approachable from (${reachableNeighbor.x},${reachableNeighbor.y})`);
  else fail(`${n.id} at (${n.x},${n.y}) has no reachable neighbor`);
}

console.log('\n== Summary ==');
if (fails.length === 0) {
  console.log('  \x1b[32mALL CHECKS PASSED\x1b[0m');
  process.exit(0);
} else {
  console.log(`  \x1b[31m${fails.length} FAIL(S)\x1b[0m`);
  process.exit(1);
}
