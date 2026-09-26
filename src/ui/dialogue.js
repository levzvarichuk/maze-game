const overlay = () => document.getElementById('dialog-overlay');
const nameEl = () => document.getElementById('dialog-name');
const questionEl = () => document.getElementById('dialog-question');
const optionsEl = () => document.getElementById('dialog-options');
const feedbackEl = () => document.getElementById('dialog-feedback');

export function openDialogue(npc, onSolved, onClosed) {
  nameEl().textContent = npc.name;
  questionEl().textContent = npc.riddle.question;
  optionsEl().innerHTML = '';
  feedbackEl().textContent = '';
  feedbackEl().className = '';

  npc.riddle.options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.textContent = opt.text;
    btn.className = 'dialog-option';
    btn.addEventListener('click', () => handleChoice(btn, opt, npc, onSolved));
    optionsEl().appendChild(btn);
  });

  overlay().classList.add('open');
  overlay()._onClosed = onClosed;
}

function handleChoice(btn, opt, npc, onSolved) {
  if (opt.correct) {
    btn.classList.add('correct');
    disableAll();
    feedbackEl().textContent = '✓ ' + (opt.onSolve || 'Верно.');
    feedbackEl().className = 'correct';
    setTimeout(() => {
      closeDialogue();
      onSolved(npc);
    }, 1200);
  } else {
    btn.classList.add('wrong');
    btn.disabled = true;
    feedbackEl().textContent = '✗ ' + (opt.hint || 'Не то.');
    feedbackEl().className = 'wrong';
  }
}

function disableAll() {
  Array.from(optionsEl().children).forEach((c) => (c.disabled = true));
}

export function closeDialogue() {
  overlay().classList.remove('open');
  const cb = overlay()._onClosed;
  overlay()._onClosed = null;
  if (cb) cb();
}

export function isDialogueOpen() {
  return overlay().classList.contains('open');
}
