# Лабиринт с загадками

Учебная браузерная игра — лабиринт с NPC-стражами, каждый задаёт загадку. Клад в конце запечатан пока все загадки не решены.

**[▶ Играть онлайн](https://alevo4kina.github.io/maze-game/)** · 2D top-down и 3D Grimrock/FPS в одном проекте.

## Управление

**2D-версия** — стрелки для движения, Enter для разговора с NPC.

**3D-версия** (`3d.html`):
- Стрелки — шаг вперёд/назад, поворот (step-mode, как в Legend of Grimrock)
- **Клик по сцене** → FPS-режим: мышь крутит камеру, WASD ходит плавно, Shift — бег
- Escape — выйти из FPS-режима
- Enter — говорить с NPC рядом

**На телефоне** — виртуальный D-pad и кнопка Enter снизу.

## Технически

Vanilla JS + ES modules без сборщика. Three.js через importmap CDN. Python http.server для дева. Web Audio API для процедурной музыки и звуков.

- 3D-сцена: `src/ui/scene3d.js` (Three.js + EffectComposer + UnrealBloomPass + VignetteShader)
- 3D-игровой цикл: `src/main3d.js`
- 2D-игровой цикл: `src/main.js`
- Загадки и уровень: `src/content/`
- Тесты уровня (BFS-валидация): `tests/check-level.mjs`

## Локальный запуск

```bash
python3 -m http.server 8000
# открыть http://localhost:8000/
```

## Что дальше

- Level 2 (нижний ярус)
- Сохранение прогресса в localStorage
- Полноценный виртуальный джойстик вместо D-pad
- Больше NPC-моделей вместо canvas-билбордов

## Лицензия

MIT.
