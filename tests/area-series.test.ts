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

function makeBars(closes: number[], timeStart = 0, timeStep = 100): Bar[] {
  return closes.map((close, i) => ({
    time: timeStart + i * timeStep,
    open: close, high: close, low: close, close,
  }));
}

function setup(options: Record<string, unknown> = {}) {
  const container = makeContainer();
  const bus = new EventBus<RendererEvents>();
  new Renderer(container, bus);
  bus.emit('series:add', { id: 'area1', type: 'area', options });
  bus.emit('viewport:changed', { timeRange: [0, 300], priceRange: [90, 115] });
  return { container, bus };
}

describe('Area Series Rendering', () => {
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

  // render_an_area_fill_below_the_line
  it('render an area fill below the line', () => {
    const { container, bus } = setup();
    bus.emit('series:data', { id: 'area1', bars: makeBars([100, 105, 102, 108]) });
    const group = container.querySelector('[data-series-id="area1"]')!;
    const path = group.querySelector('path');
    expect(path).not.toBeNull();
    const fill = path!.getAttribute('fill') ?? '';
    expect(fill).not.toBe('none');
    expect(fill.length).toBeGreaterThan(0);
  });

  // area_gradient_fill
  it('area gradient fill', () => {
    const { container, bus } = setup({ gradient: true });
    bus.emit('series:data', { id: 'area1', bars: makeBars([100, 105, 102, 108]) });
    const svg = container.querySelector('svg')!;
    const gradient = svg.querySelector('defs linearGradient');
    expect(gradient).not.toBeNull();
    const group = container.querySelector('[data-series-id="area1"]')!;
    const path = group.querySelector('path');
    expect(path).not.toBeNull();
    expect(path!.getAttribute('fill')).toMatch(/^url\(#/);
  });

  // area_render_with_no_bars
  it('area render with no bars', () => {
    const { container, bus } = setup();
    bus.emit('series:data', { id: 'area1', bars: [] });
    const group = container.querySelector('[data-series-id="area1"]')!;
    expect(group.querySelector('path')).toBeNull();
    expect(group.querySelector('rect')).toBeNull();
  });

  // area_render_with_a_single_bar
  it('area render with a single bar', () => {
    const { container, bus } = setup();
    bus.emit('series:data', { id: 'area1', bars: makeBars([100]) });
    const group = container.querySelector('[data-series-id="area1"]')!;
    const rect = group.querySelector('rect');
    expect(rect).not.toBeNull();
  });

  // baseline_area_fill_from_a_specific_price
  it('baseline area fill from a specific price', () => {
    const { container, bus } = setup({ baseline: 100 });
    bus.emit('series:data', { id: 'area1', bars: makeBars([95, 105, 98, 110]) });
    const group = container.querySelector('[data-series-id="area1"]')!;
    const paths = group.querySelectorAll('path');
    // Should have two paths: one for above baseline, one for below
    expect(paths.length).toBeGreaterThanOrEqual(2);
    const fills = [...paths].map(p => p.getAttribute('data-baseline-side') ?? p.getAttribute('fill'));
    expect(fills.some(f => f === 'above' || f === 'positive')).toBe(true);
    expect(fills.some(f => f === 'below' || f === 'negative')).toBe(true);
  });

  // area_border_line_is_configurable
  it('area border line is configurable', () => {
    const { container, bus } = setup({ borderWidth: 2, borderColor: 'blue' });
    bus.emit('series:data', { id: 'area1', bars: makeBars([100, 105, 102]) });
    const group = container.querySelector('[data-series-id="area1"]')!;
    const borderPath = group.querySelector('path[stroke="blue"]');
    expect(borderPath).not.toBeNull();
    expect(borderPath!.getAttribute('stroke-width')).toBe('2');
  });
});
