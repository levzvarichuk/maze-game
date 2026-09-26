const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');

ctx.fillStyle = '#0f0f1a';
ctx.fillRect(0, 0, canvas.width, canvas.height);

ctx.fillStyle = '#eaeaea';
ctx.font = '20px system-ui';
ctx.textAlign = 'center';
ctx.fillText('Этап 0 — setup готов', canvas.width / 2, canvas.height / 2);
ctx.font = '14px system-ui';
ctx.fillStyle = '#8888aa';
ctx.fillText('Дальше: сетка лабиринта (этап 1)', canvas.width / 2, canvas.height / 2 + 30);

status.textContent = 'Проект запущен';
