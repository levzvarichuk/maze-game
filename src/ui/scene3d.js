import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';
import { TILE } from '../entities/maze.js';
import { headingToYaw } from '../entities/player3d.js';

const COLORS = {
  torch: 0xff9944,
  ambient: 0x1a1a2e,
  treasure: 0xf7d774,
};

export function buildScene(canvas, level) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth || canvas.width, canvas.clientHeight || canvas.height, false);
  renderer.setClearColor(0x000000);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a0a15, 2.5, 11);

  const camera = new THREE.PerspectiveCamera(
    75,
    canvas.width / canvas.height,
    0.05,
    50
  );
  camera.position.y = 0.5;
  // YXZ: сначала yaw (Y), потом pitch (X) в локальных осях — стандарт FPS-камеры
  camera.rotation.order = 'YXZ';

  // Освещение
  scene.add(new THREE.AmbientLight(0x3a3a55, 0.35));
  const torch = new THREE.PointLight(COLORS.torch, 2.4, 9, 2);
  torch.position.set(0, 0.5, 0);
  camera.add(torch);
  scene.add(camera);

  // Процедурные текстуры камня
  const wallTex = makeStoneTexture('#3c3c48', 256);
  wallTex.repeat.set(1, 1);
  const floorTex = makeFloorTexture(256);
  floorTex.repeat.set(level.cols / 2, level.rows / 2);
  const ceilTex = makeStoneTexture('#0f0f16', 256);
  ceilTex.repeat.set(level.cols / 3, level.rows / 3);

  // Пол
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95 });
  const floorGeo = new THREE.PlaneGeometry(level.cols, level.rows);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(level.cols / 2 - 0.5, 0, level.rows / 2 - 0.5);
  scene.add(floor);

  // Потолок
  const ceilMat = new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 1 });
  const ceil = new THREE.Mesh(floorGeo.clone(), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(level.cols / 2 - 0.5, 1, level.rows / 2 - 0.5);
  scene.add(ceil);

  // Стены
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.85 });
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

  // Факелы на стенах: расставляем детерминированно по хешу координат
  const torchSpriteMat = new THREE.SpriteMaterial({
    map: makeTorchTexture(64),
    color: 0xffcc66,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });
  const wallTorches = [];
  for (let y = 0; y < level.rows; y++) {
    for (let x = 0; x < level.cols; x++) {
      if (level.grid[y][x] !== TILE.WALL) continue;
      if (((x * 13 + y * 7) % 7) !== 0) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= level.cols || ny >= level.rows) continue;
        if (level.grid[ny][nx] === TILE.WALL) continue;
        const tx = x + dx * 0.45;
        const tz = y + dy * 0.45;
        const sprite = new THREE.Sprite(torchSpriteMat.clone());
        sprite.position.set(tx, 0.68, tz);
        sprite.scale.set(0.55, 0.7, 0.55);
        scene.add(sprite);
        const light = new THREE.PointLight(0xff9944, 1.7, 5, 2);
        light.position.set(tx, 0.68, tz);
        scene.add(light);
        wallTorches.push({
          light, sprite,
          baseIntensity: 1.7,
          seed: (x * 37 + y * 59) % 100,
        });
        break;
      }
    }
  }

  // Искры в воздухе — 250 точек, дрейфуют вверх, wrap к полу
  const SPARK_COUNT = 250;
  const sparkGeo = new THREE.BufferGeometry();
  const sparkPos = new Float32Array(SPARK_COUNT * 3);
  const sparkVel = new Float32Array(SPARK_COUNT);
  for (let i = 0; i < SPARK_COUNT; i++) {
    sparkPos[i * 3] = Math.random() * level.cols;
    sparkPos[i * 3 + 1] = Math.random() * 1;
    sparkPos[i * 3 + 2] = Math.random() * level.rows;
    sparkVel[i] = 0.001 + Math.random() * 0.003;
  }
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparkMat = new THREE.PointsMaterial({
    color: 0xffb060,
    size: 0.05,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: true,
  });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  scene.add(sparks);

  // Клад — вращающийся золотой октаэдр
  const treasureMat = new THREE.MeshStandardMaterial({
    color: COLORS.treasure,
    emissive: 0xffbb55,
    emissiveIntensity: 1.2,
    roughness: 0.35,
    metalness: 0.8,
  });
  const treasureGeo = new THREE.OctahedronGeometry(0.28, 0);
  const treasure = new THREE.Mesh(treasureGeo, treasureMat);
  const tGlow = new THREE.PointLight(COLORS.treasure, 1.1, 3.5, 2);
  treasure.add(tGlow);
  scene.add(treasure);

  // Орбитальные искры вокруг клада — 60 частиц по кругу
  const ORBIT_COUNT = 60;
  const orbitGeo = new THREE.BufferGeometry();
  const orbitPos = new Float32Array(ORBIT_COUNT * 3);
  const orbitPhase = new Float32Array(ORBIT_COUNT);
  for (let i = 0; i < ORBIT_COUNT; i++) {
    orbitPhase[i] = Math.random() * Math.PI * 2;
    orbitPos[i * 3] = 0;
    orbitPos[i * 3 + 1] = 0;
    orbitPos[i * 3 + 2] = 0;
  }
  orbitGeo.setAttribute('position', new THREE.BufferAttribute(orbitPos, 3));
  const orbitMat = new THREE.PointsMaterial({
    color: 0xffdd88,
    size: 0.08,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: true,
  });
  const orbitSparks = new THREE.Points(orbitGeo, orbitMat);
  scene.add(orbitSparks);

  // Столб света от клада — активируется при победе
  const beamGeo = new THREE.CylinderGeometry(0.05, 0.35, 1.6, 16, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffe088,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.y = 0.8;
  scene.add(beam);

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

  // Пост-обработка: bloom + виньетка
  const composer = new EffectComposer(renderer);
  composer.setSize(canvas.width, canvas.height);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(canvas.width, canvas.height),
    0.85, // strength
    0.7,  // radius
    0.25  // threshold
  );
  composer.addPass(bloomPass);
  const vignettePass = new ShaderPass(VignetteShader);
  vignettePass.uniforms.offset.value = 1.1;
  vignettePass.uniforms.darkness.value = 0.9;
  composer.addPass(vignettePass);

  // Состояние финальной вспышки
  let winTime = -1; // время старта победной анимации в t-единицах
  const baseBloomStrength = bloomPass.strength;

  const api = {
    renderer,
    scene,
    camera,
    torch,
    treasure,
    npcMeshes,

    setTreasurePosition(tx, ty) {
      treasure.position.set(tx, 0.5, ty);
      beam.position.x = tx;
      beam.position.z = ty;
    },

    resize(width, height) {
      renderer.setSize(width, height, false);
      composer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
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

    triggerWin(t) {
      winTime = t;
    },

    tick(t, player, cameraPos, cameraYaw, cameraPitch = 0) {
      camera.position.x = cameraPos.x;
      camera.position.z = cameraPos.z;
      camera.rotation.y = cameraYaw;
      camera.rotation.x = cameraPitch;

      // Мерцание нашлемного факела
      torch.intensity = 2.3 + Math.sin(t * 6) * 0.22 + Math.sin(t * 13.7) * 0.14;

      // Мерцание настенных факелов
      for (const wt of wallTorches) {
        const flicker = wt.baseIntensity
          + Math.sin(t * 8 + wt.seed) * 0.25
          + Math.sin(t * 21 + wt.seed * 3) * 0.15;
        wt.light.intensity = flicker;
        wt.sprite.material.opacity = 0.55 + (flicker - wt.baseIntensity) * 0.4;
      }

      // Дрейф искр вверх, wrap к полу
      const arr = sparkGeo.attributes.position.array;
      for (let i = 0; i < SPARK_COUNT; i++) {
        arr[i * 3 + 1] += sparkVel[i];
        if (arr[i * 3 + 1] > 1) arr[i * 3 + 1] = 0;
      }
      sparkGeo.attributes.position.needsUpdate = true;

      // Вращение клада
      treasure.rotation.y = t * 1.2;
      treasure.position.y = 0.5 + Math.sin(t * 2) * 0.08;

      // Орбитальные искры вокруг клада
      const oArr = orbitGeo.attributes.position.array;
      for (let i = 0; i < ORBIT_COUNT; i++) {
        const phase = orbitPhase[i] + t * (0.8 + (i % 5) * 0.15);
        const radius = 0.42 + Math.sin(t * 1.5 + i) * 0.08;
        const yOff = Math.sin(t * 2 + i * 0.7) * 0.25;
        oArr[i * 3] = treasure.position.x + Math.cos(phase) * radius;
        oArr[i * 3 + 1] = treasure.position.y + yOff;
        oArr[i * 3 + 2] = treasure.position.z + Math.sin(phase) * radius;
      }
      orbitGeo.attributes.position.needsUpdate = true;

      // Финальная вспышка: столб света + резкий bloom
      if (winTime >= 0) {
        const dt = t - winTime;
        const beamAlpha = Math.min(1, dt * 1.5) * Math.max(0, 1 - (dt - 2) * 0.4);
        beamMat.opacity = beamAlpha * 0.8;
        beam.scale.y = 1 + Math.min(1, dt * 0.8);
        beam.position.y = 0.8 + Math.min(1, dt * 0.8) * 0.5;
        beam.rotation.y = t * 2;
        const bloomBurst = Math.exp(-Math.pow(dt - 0.5, 2) * 4) * 1.5;
        bloomPass.strength = baseBloomStrength + bloomBurst;
      } else {
        bloomPass.strength = baseBloomStrength;
      }

      // Билборды NPC смотрят на камеру (только по Y)
      for (const { group } of npcMeshes.values()) {
        const dx = camera.position.x - group.position.x;
        const dz = camera.position.z - group.position.z;
        group.rotation.y = Math.atan2(dx, dz);
      }

      composer.render();
    },
  };

  return api;
}

// Процедурная текстура каменной кладки — тёмный фон, шум, швы блоков
function makeStoneTexture(baseColor, size) {
  const cvs = document.createElement('canvas');
  cvs.width = cvs.height = size;
  const g = cvs.getContext('2d');
  g.fillStyle = baseColor;
  g.fillRect(0, 0, size, size);
  // Шум пятнами
  for (let i = 0; i < 600; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 1 + Math.random() * 5;
    const bright = Math.random() > 0.5;
    const alpha = Math.random() * 0.18;
    g.fillStyle = bright
      ? `rgba(255,240,220,${alpha})`
      : `rgba(0,0,0,${alpha * 1.8})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // Швы блоков — кирпичная перевязка
  g.strokeStyle = 'rgba(0,0,0,0.65)';
  g.lineWidth = 2;
  const rowH = 64;
  for (let row = 0; row * rowH < size; row++) {
    const y = row * rowH;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(size, y);
    g.stroke();
    const offset = (row % 2) * (size / 4);
    for (let x = offset; x <= size; x += size / 2) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x, y + rowH);
      g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(cvs);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// Процедурная текстура пола — тёмный камень с трещинами и вкраплениями
function makeFloorTexture(size) {
  const cvs = document.createElement('canvas');
  cvs.width = cvs.height = size;
  const g = cvs.getContext('2d');
  g.fillStyle = '#12121c';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 0.5 + Math.random() * 2.5;
    g.fillStyle = `rgba(255,240,220,${Math.random() * 0.07})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // Трещины
  g.strokeStyle = 'rgba(0,0,0,0.55)';
  g.lineWidth = 1;
  for (let i = 0; i < 18; i++) {
    let x = Math.random() * size;
    let y = Math.random() * size;
    g.beginPath();
    g.moveTo(x, y);
    const steps = 4 + Math.floor(Math.random() * 8);
    for (let s = 0; s < steps; s++) {
      x += (Math.random() - 0.5) * 40;
      y += (Math.random() - 0.5) * 40;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(cvs);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// Sprite факела — тёплое пятно-градиент, аддитивное
function makeTorchTexture(size) {
  const cvs = document.createElement('canvas');
  cvs.width = cvs.height = size;
  const g = cvs.getContext('2d');
  const cx = size / 2, cy = size * 0.5;
  const grad = g.createRadialGradient(cx, cy, 0, cx, cy, size * 0.5);
  grad.addColorStop(0, 'rgba(255,240,180,1)');
  grad.addColorStop(0.25, 'rgba(255,180,80,0.85)');
  grad.addColorStop(0.6, 'rgba(200,80,20,0.4)');
  grad.addColorStop(1, 'rgba(80,30,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(cvs);
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

const NPC_REVEAL_RADIUS = 3;

export function drawMinimap(mcanvas, level, player, npcs, treasurePos, visited) {
  const ctx = mcanvas.getContext('2d');
  const t = Math.min(mcanvas.width / level.cols, mcanvas.height / level.rows);

  const isVisited = (x, y) => {
    if (!visited) return true;
    return visited.has(`${x},${y}`);
  };

  ctx.fillStyle = '#08080e';
  ctx.fillRect(0, 0, mcanvas.width, mcanvas.height);

  // Пол — рисуем только посещённые клетки
  for (let y = 0; y < level.rows; y++) {
    for (let x = 0; x < level.cols; x++) {
      if (level.grid[y][x] === '#') continue;
      if (!isVisited(x, y)) continue;
      ctx.fillStyle = '#1a1a28';
      ctx.fillRect(x * t, y * t, t, t);
    }
  }

  // Стены — только если сама клетка или соседняя (по 4 направлениям) уже посещены
  for (let y = 0; y < level.rows; y++) {
    for (let x = 0; x < level.cols; x++) {
      if (level.grid[y][x] !== '#') continue;
      const seen =
        isVisited(x, y) ||
        isVisited(x - 1, y) || isVisited(x + 1, y) ||
        isVisited(x, y - 1) || isVisited(x, y + 1);
      if (!seen) continue;
      ctx.fillStyle = '#3a3a5c';
      ctx.fillRect(x * t, y * t, t, t);
    }
  }

  // Клад — показываем только если посещали
  if (isVisited(treasurePos.x, treasurePos.y)) {
    ctx.fillStyle = '#f7d774';
    ctx.beginPath();
    ctx.arc(treasurePos.x * t + t / 2, treasurePos.y * t + t / 2, t * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }

  // NPC — видны когда посещали клетку рядом или в радиусе NPC_REVEAL_RADIUS от игрока
  for (const n of npcs) {
    const nearPlayer =
      Math.abs(n.x - player.x) + Math.abs(n.y - player.y) <= NPC_REVEAL_RADIUS;
    const nearVisited =
      isVisited(n.x - 1, n.y) || isVisited(n.x + 1, n.y) ||
      isVisited(n.x, n.y - 1) || isVisited(n.x, n.y + 1) ||
      isVisited(n.x, n.y);
    if (!nearPlayer && !nearVisited) continue;
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
