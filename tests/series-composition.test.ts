import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventBus } from '@yatamazuki/typed-eventbus';
import type { RendererEvents, Bar } from '../src/index';
import { Renderer } from '../src/index';

function makeContainer(width = 800, height = 600): HTMLElement {
  const el = document.createElement('div');
  el.getBoundingClientRect = () =>
    ({ width, height, top: 0, left: 0, right: width, bottom: height }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

const BARS: Bar[] = [
  { time: 0,   open: 100, high: 105, low: 98,  close: 103 },
  { time: 100, open: 103, high: 108, low: 101, close: 106 },
  { time: 200, open: 106, high: 110, low: 104, close: 108 },
];

function setup() {
  const container = makeContainer();
  const bus = new EventBus<RendererEvents>();
  new Renderer(container, bus);
  bus.emit('viewport:changed', { timeRange: [0, 200], priceRange: [95, 115] });
  return { container, bus };
}

describe('Series Composition', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class {
      constructor(cb: () => void) { void cb; }
      observe() {}
      disconnect() {}
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  // add_a_series_via_event
  it('add a series via event', () => {
    const { container, bus } = setup();
    bus.emit('series:add', { id: 's1', type: 'candlestick', options: {} });
    const seriesLayer = container.querySelector('.series-layer')!;
    const group = seriesLayer.querySelector('[data-series-id="s1"]');
    expect(group).not.toBeNull();
    expect(group!.tagName.toLowerCase()).toBe('g');
  });

  // overlay_multiple_series_via_events
  it('overlay multiple series via events', () => {
    const { container, bus } = setup();
    bus.emit('series:add', { id: 'candles', type: 'candlestick' });
    bus.emit('series:add', { id: 'ma20', type: 'line', options: { color: 'orange' } });
    bus.emit('series:data', { id: 'candles', bars: BARS });
    bus.emit('series:data', { id: 'ma20', bars: BARS });

    const seriesLayer = container.querySelector('.series-layer')!;
    const groups = seriesLayer.querySelectorAll('[data-series-id]');
    expect(groups.length).toBe(2);

    // ma20 should come after candles in DOM (rendered on top)
    const ids = [...groups].map(g => g.getAttribute('data-series-id'));
    expect(ids[0]).toBe('candles');
    expect(ids[1]).toBe('ma20');

    // Both should have rendered content
    expect(seriesLayer.querySelector('[data-series-id="candles"] .bar')).not.toBeNull();
    expect(seriesLayer.querySelector('[data-series-id="ma20"] path')).not.toBeNull();
  });

  // reorder_series_via_seriesorder_event
  it('reorder series via series:order event', () => {
    const { container, bus } = setup();
    bus.emit('series:add', { id: 's1', type: 'line' });
    bus.emit('series:add', { id: 's2', type: 'line' });
    bus.emit('series:add', { id: 's3', type: 'line' });
    bus.emit('series:order', { ids: ['s3', 's1', 's2'] });

    const seriesLayer = container.querySelector('.series-layer')!;
    const ids = [...seriesLayer.querySelectorAll('[data-series-id]')]
      .map(g => g.getAttribute('data-series-id'));
    expect(ids).toEqual(['s3', 's1', 's2']);
  });

  // each_series_has_independent_styling
  it('each series has independent styling', () => {
    const { container, bus } = setup();
    bus.emit('series:add', { id: 'line1', type: 'line', options: { color: 'blue' } });
    bus.emit('series:add', { id: 'line2', type: 'line', options: { color: 'red' } });
    bus.emit('series:data', { id: 'line1', bars: BARS });
    bus.emit('series:data', { id: 'line2', bars: BARS });

    const path1 = container.querySelector('[data-series-id="line1"] path');
    const path2 = container.querySelector('[data-series-id="line2"] path');
    expect(path1).not.toBeNull();
    expect(path2).not.toBeNull();
    expect(path1!.getAttribute('stroke')).toBe('blue');
    expect(path2!.getAttribute('stroke')).toBe('red');
  });

  // series_rerenders_on_viewportchanged
  it('series re-renders on viewport:changed', () => {
    const { container, bus } = setup();
    bus.emit('series:add', { id: 's1', type: 'line' });
    bus.emit('series:data', { id: 's1', bars: BARS });

    const pathBefore = container.querySelector('[data-series-id="s1"] path');
    const dBefore = pathBefore?.getAttribute('d');

    // Change viewport — scales change, path d should change
    bus.emit('viewport:changed', { timeRange: [0, 100], priceRange: [100, 110] });

    const pathAfter = container.querySelector('[data-series-id="s1"] path');
    const dAfter = pathAfter?.getAttribute('d');
    expect(pathAfter).not.toBeNull();
    expect(dAfter).not.toBe(dBefore);
  });

  // swap_series_type_via_event
  it('swap series type via event', () => {
    const { container, bus } = setup();
    bus.emit('series:add', { id: 's1', type: 'line' });
    bus.emit('series:data', { id: 's1', bars: BARS });

    // Line should have a <path fill="none">
    const linePath = container.querySelector('[data-series-id="s1"] path[fill="none"]');
    expect(linePath).not.toBeNull();

    // Swap to area
    bus.emit('series:type', { id: 's1', type: 'area' });

    // Area should have a <path> with a fill color (not "none")
    const paths = container.querySelectorAll('[data-series-id="s1"] path');
    const areaPath = [...paths].find(p => p.getAttribute('fill') !== 'none');
    expect(areaPath).not.toBeNull();
  });
});
