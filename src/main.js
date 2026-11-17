import { Game } from './engine.js';

const game = new Game();
window.__NABER__ = game;

// pause audio context politely when the tab goes away
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.audio.ctx && game.audio.ctx.state === 'running') {
    game.audio.ctx.suspend().catch(() => {});
  } else if (!document.hidden && game.audio.ctx && game.audio.ctx.state === 'suspended') {
    game.audio.ctx.resume().catch(() => {});
  }
});
