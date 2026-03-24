import { EventBus } from '@yatamazuki/typed-eventbus';
import { Renderer, type RendererEvents } from '../src/index';

// --- logging ---
const logEl = document.getElementById('log')!;
logEl.innerHTML = ''; // clear on HMR reload
function log(msg: string, error = false) {
  const el = document.createElement('div');
  el.className = 'log-entry' + (error ? ' error' : '');
  el.textContent = `[${new Date().toISOString().slice(11, 23)}] ${msg}`;
  logEl.appendChild(el);
  logEl.scrollTop = logEl.scrollHeight;
}

// --- setup ---
const container = document.getElementById('chart')!;
container.innerHTML = ''; // clear on HMR reload
const bus = new EventBus<RendererEvents>();
const renderer = new Renderer(container, bus);
log('Renderer initialized');

// --- fire scenario events ---
bus.emit('series:add', { id: 's1', type: 'candlestick', options: {} });
log('Emitted series:add { id: "s1", type: "candlestick" }');

bus.emit('series:add', { id: 's2', type: 'line', options: { color: 'steelblue' } });
log('Emitted series:add { id: "s2", type: "line" }');

// --- show what was created ---
const groups = container.querySelectorAll('[data-series-id]');
log(`SVG now has ${groups.length} series group(s): ${[...groups].map(g => g.getAttribute('data-series-id')).join(', ')}`);

// --- cleanup on HMR ---
if (import.meta.hot) {
  import.meta.hot.dispose(() => renderer.destroy());
}
