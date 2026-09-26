export function bindInput(handlers) {
  const listener = (e) => {
    switch (e.key) {
      case 'ArrowUp': case 'w': case 'W': case 'ц': case 'Ц':
        handlers.move?.(0, -1); e.preventDefault(); break;
      case 'ArrowDown': case 's': case 'S': case 'ы': case 'Ы':
        handlers.move?.(0, 1); e.preventDefault(); break;
      case 'ArrowLeft': case 'a': case 'A': case 'ф': case 'Ф':
        handlers.move?.(-1, 0); e.preventDefault(); break;
      case 'ArrowRight': case 'd': case 'D': case 'в': case 'В':
        handlers.move?.(1, 0); e.preventDefault(); break;
      case 'Enter': case ' ':
        handlers.interact?.(); e.preventDefault(); break;
      case 'Escape':
        handlers.cancel?.(); break;
    }
  };
  window.addEventListener('keydown', listener);
  return () => window.removeEventListener('keydown', listener);
}
