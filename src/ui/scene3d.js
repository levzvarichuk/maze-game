import * as THREE from 'three';
import { TILE } from '../entities/maze.js';
import { headingToYaw } from '../entities/player3d.js';

const COLORS = {
  wall: 0x4a4a5a,
  wallDark: 0x2a2a35,
  floor: 0x1a1a24,
  ceiling: 0x080810,
  torch: 0xffaa55,
  ambient: 0x1a1a2e,
  npc: 0xc04a4a,
  npcSolved: 0x4a9a6a,
  treasure: 0xf7d774,
};

export function buildScene(canvas, level) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth || canvas.width, canvas.clientHeight || canvas.height, false);
  renderer.setClearColor(0x000000);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, 3, 12);

  const camera = new THREE.PerspectiveCamera(
    75,
    canvas.width / canvas.height,
    0.05,
    50
  );
  camera.position.y = 0.5;

  // Освещение
  scene.add(new THREE.AmbientLight(COLORS.ambient, 0.15));
  const torch = new THREE.PointLight(COLORS.torch, 2.2, 8, 2);
  torch.position.set(0, 0.5, 0);
  camera.add(torch);
  scene.add(camera);

  // Пол и потолок (одна плоскость на весь лабиринт)
  const floorMat = new THREE.MeshStandardMaterial({ color: COLORS.floor, roughness: 0.9 });
  const floorGeo = new THREE.PlaneGeometry(level.cols, level.rows);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(level.cols / 2 - 0.5, 0, level.rows / 2 - 0.5);
  scene.add(floor);

  const ceilMat = new THREE.MeshStandardMaterial({ color: COLORS.ceiling, roughness: 1 });
  const ceil = new THREE.Mesh(floorGeo.clone(), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(level.cols / 2 - 0.5, 1, level.rows / 2 - 0.5);
  scene.add(ceil);

  // Стены
  const wallMat = new THREE.MeshStandardMaterial({ color: COLORS.wall, roughness: 0.85 });
  const wallGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let y = 0; y < level.rows; y++) {
    for (let x = 0; x < level.cols; x++) {
      if (level.grid[y][x] === TILE.WALL) {
        const wall = new THREE.Mesh(wallGeo, wallMat);
        wall.position.set(x, 0.5, y);
        scene.add(wall);
      }
    }
  }

  // Клад — вращающийся золотой октаэдр
  const treasureMat = new THREE.MeshStandardMaterial({
    color: COLORS.treasure,
    emissive: 0x7a5c1a,
    emissiveIntensity: 0.5,
    roughness: 0.4,
    metalness: 0.7,
  });
  const treasureGeo = new THREE.OctahedronGeometry(0.28, 0);
  const treasure = new THREE.Mesh(treasureGeo, treasureMat);
  const tGlow = new THREE.PointLight(COLORS.treasure, 0.7, 3);
  treasure.add(tGlow);
  scene.add(treasure);

  // NPC — билборд-плоскости с символом
  const npcMeshes = new Map();
  for (const n of level.npcs) {
    const group = new THREE.Group();
    const body = makeNPCSprite(false);
    body.userData.symbol = '?';
    group.add(body);
    group.position.set(n.x, 0.5, n.y);
    npcMeshes.set(n.id, { group, body });
    scene.add(group);
  }

  const api = {
    renderer,
    scene,
    camera,
    torch,
    treasure,
    npcMeshes,

    setTreasurePosition(tx, ty) {
      treasure.position.set(tx, 0.5, ty);
    },

    updateNPCVisual(id, solved) {
      const rec = npcMeshes.get(id);
      if (!rec) return;
      rec.group.remove(rec.body);
      rec.body.material.dispose();
      rec.body.material.map?.dispose();
      const fresh = makeNPCSprite(solved);
      rec.group.add(fresh);
      rec.body = fresh;
    },

    tick(t, player, cameraPos, cameraYaw) {
      camera.position.x = cameraPos.x;
      camera.position.z = cameraPos.z;
      camera.rotation.y = cameraYaw;

      // Мерцание факела
      torch.intensity = 2.0 + Math.sin(t * 6) * 0.25 + Math.sin(t * 13.7) * 0.15;

      // Вращение клада
      treasure.rotation.y = t * 1.2;
      treasure.position.y = 0.5 + Math.sin(t * 2) * 0.08;

      // Билборды NPC смотрят на камеру (только по Y)
      for (const { group } of npcMeshes.values()) {
        const dx = camera.position.x - group.position.x;
        const dz = camera.position.z - group.position.z;
        group.rotation.y = Math.atan2(dx, dz);
      }

      renderer.render(scene, camera);
    },
  };

  return api;
}

function makeNPCSprite(solved) {
  const size = 128;
  const cvs = document.createElement('canvas');
  cvs.width = size; cvs.height = size;
  const g = cvs.getContext('2d');
  g.clearRect(0, 0, size, size);

  const bodyColor = solved ? '#4a9a6a' : '#c04a4a';
  const outlineColor = solved ? '#7ed6a5' : '#f0a0a0';

  // Плащ (трапеция)
  g.fillStyle = bodyColor;
  g.beginPath();
  g.moveTo(size * 0.32, size * 0.35);
  g.lineTo(size * 0.68, size * 0.35);
  g.lineTo(size * 0.82, size * 0.95);
  g.lineTo(size * 0.18, size * 0.95);
  g.closePath();
  g.fill();
  g.strokeStyle = outlineColor;
  g.lineWidth = 2;
  g.stroke();

  // Голова
  g.fillStyle = '#1a1a1a';
  g.beginPath();
  g.arc(size * 0.5, size * 0.25, size * 0.13, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = outlineColor;
  g.stroke();

  // Символ над головой
  g.fillStyle = outlineColor;
  g.font = `bold ${Math.floor(size * 0.22)}px system-ui`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(solved ? '✓' : '?', size * 0.5, size * 0.07);

  const tex = new THREE.CanvasTexture(cvs);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;

  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const geo = new THREE.PlaneGeometry(0.7, 0.9);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0;
  return mesh;
}

export function tween(from, to, duration, onUpdate, onDone) {
  const start = performance.now();
  const raf = () => {
    const t = Math.min(1, (performance.now() - start) / duration);
    const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const val = from + (to - from) * eased;
    onUpdate(val, t);
    if (t < 1) requestAnimationFrame(raf);
    else onDone?.();
  };
  requestAnimationFrame(raf);
}

// Кратчайший угловой путь для tween поворота (учёт wrap-around через 2π)
export function shortestAngle(from, to) {
  let diff = to - from;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return from + diff;
}

export { headingToYaw };

export function drawMinimap(mcanvas, level, player, npcs, treasurePos) {
  const ctx = mcanvas.getContext('2d');
  const t = Math.min(mcanvas.width / level.cols, mcanvas.height / level.rows);

  ctx.fillStyle = '#0f0f1a';
  ctx.fillRect(0, 0, mcanvas.width, mcanvas.height);

  for (let y = 0; y < level.rows; y++) {
    for (let x = 0; x < level.cols; x++) {
      const ch = level.grid[y][x];
      if (ch === '#') {
        ctx.fillStyle = '#3a3a5c';
        ctx.fillRect(x * t, y * t, t, t);
      }
    }
  }

  ctx.fillStyle = '#f7d774';
  ctx.beginPath();
  ctx.arc(treasurePos.x * t + t / 2, treasurePos.y * t + t / 2, t * 0.32, 0, Math.PI * 2);
  ctx.fill();

  for (const n of npcs) {
    ctx.fillStyle = n.solved ? '#4a9a6a' : '#c04a4a';
    ctx.beginPath();
    ctx.arc(n.x * t + t / 2, n.y * t + t / 2, t * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }

  const px = player.x * t + t / 2;
  const py = player.y * t + t / 2;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(player.heading * Math.PI / 2);
  ctx.fillStyle = '#7ed6a5';
  ctx.beginPath();
  ctx.moveTo(0, -t * 0.42);
  ctx.lineTo(t * 0.3, t * 0.3);
  ctx.lineTo(-t * 0.3, t * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
