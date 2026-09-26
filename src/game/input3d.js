export function bindInput3D(handlers) {
  const listener = (e) => {
    switch (e.key) {
      case 'ArrowUp': case 'w': case 'W': case 'ц': case 'Ц':
        handlers.forward?.(); e.preventDefault(); break;
      case 'ArrowDown': case 's': case 'S': case 'ы': case 'Ы':
        handlers.backward?.(); e.preventDefault(); break;
      case 'ArrowLeft': case 'a': case 'A': case 'ф': case 'Ф':
        handlers.turnLeft?.(); e.preventDefault(); break;
      case 'ArrowRight': case 'd': case 'D': case 'в': case 'В':
        handlers.turnRight?.(); e.preventDefault(); break;
      case 'Enter': case ' ':
        handlers.interact?.(); break;
      case 'Escape':
        handlers.cancel?.(); break;
    }
  };
  window.addEventListener('keydown', listener);
  return () => window.removeEventListener('keydown', listener);
}
