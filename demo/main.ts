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

// --- generate fake OHLCV bars ---
function fakeBar(time: number, prev: number) {
  const open = prev + (Math.random() - 0.5) * 4;
  const close = open + (Math.random() - 0.5) * 4;
  const high = Math.max(open, close) + Math.random() * 2;
  const low = Math.min(open, close) - Math.random() * 2;
  return { time, open, high, low, close, volume: Math.random() * 1000 };
}
const now = Date.now();
const bars = Array.from({ length: 60 }, (_, i) =>
  fakeBar(now + i * 60_000, 100 + i * 0.5));

const timeRange: [number, number] = [bars[0].time, bars[bars.length - 1].time];
const closes = bars.map(b => b.close);
const priceRange: [number, number] = [Math.min(...closes) - 2, Math.max(...closes) + 2];

// --- fire scenario events ---
bus.emit('viewport:changed', { timeRange, priceRange });
log(`Emitted viewport:changed timeRange=[${timeRange[0]}, ${timeRange[1]}]`);

bus.emit('series:add', { id: 's1', type: 'candlestick', options: {} });
log('Emitted series:add { id: "s1", type: "candlestick" }');
bus.emit('series:data', { id: 's1', bars });
log(`Emitted series:data with ${bars.length} bars`);

bus.emit('series:add', { id: 's2', type: 'line', options: { color: 'steelblue', strokeWidth: 2, smooth: 0.6 } });
log('Emitted series:add { id: "s2", type: "line" }');
bus.emit('series:data', { id: 's2', bars });
log(`Emitted series:data for line series`);

// --- show what was created ---
const groups = container.querySelectorAll('[data-series-id]');
log(`SVG now has ${groups.length} series group(s): ${[...groups].map(g => g.getAttribute('data-series-id')).join(', ')}`);

// --- cleanup on HMR ---
if (import.meta.hot) {
  import.meta.hot.dispose(() => renderer.destroy());
}
