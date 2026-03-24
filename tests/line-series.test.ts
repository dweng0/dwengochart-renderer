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
    open: close,
    high: close,
    low: close,
    close,
  }));
}

function setup(containerWidth = 800, containerHeight = 600) {
  const container = makeContainer(containerWidth, containerHeight);
  const bus = new EventBus<RendererEvents>();
  const renderer = new Renderer(container, bus);
  bus.emit('series:add', { id: 'line1', type: 'line' });
  bus.emit('viewport:changed', { timeRange: [0, 400], priceRange: [95, 115] });
  return { container, bus, renderer };
}

describe('Line Series Rendering', () => {
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

  // render_a_line_connecting_close_prices
  it('render a line connecting close prices', () => {
    const { container, bus } = setup();
    bus.emit('series:data', {
      id: 'line1',
      bars: makeBars([100, 105, 102, 108, 103]),
    });
    const group = container.querySelector('[data-series-id="line1"]')!;
    const path = group.querySelector('path');
    expect(path).not.toBeNull();
    const d = path!.getAttribute('d') ?? '';
    expect(d.length).toBeGreaterThan(0);
    // Should start with M (move to first point) and contain L or C commands to subsequent points
    expect(d).toMatch(/^M/);
  });

  // render_with_a_single_bar
  it('render with a single bar', () => {
    const { container, bus } = setup();
    bus.emit('series:data', {
      id: 'line1',
      bars: makeBars([100]),
    });
    const group = container.querySelector('[data-series-id="line1"]')!;
    const circle = group.querySelector('circle');
    expect(circle).not.toBeNull();
  });

  // render_with_no_bars
  it('render with no bars', () => {
    const { container, bus } = setup();
    bus.emit('series:data', { id: 'line1', bars: [] });
    const group = container.querySelector('[data-series-id="line1"]')!;
    expect(group.querySelector('path')).toBeNull();
    expect(group.querySelector('circle')).toBeNull();
  });

  // render_a_line_with_exactly_two_bars
  it('render a line with exactly two bars', () => {
    const { container, bus } = setup();
    bus.emit('series:data', {
      id: 'line1',
      bars: makeBars([100, 105]),
    });
    const group = container.querySelector('[data-series-id="line1"]')!;
    const path = group.querySelector('path');
    expect(path).not.toBeNull();
    const d = path!.getAttribute('d') ?? '';
    // Should be a simple M...L... (two-point line)
    expect(d).toMatch(/^M[\d.,\s-]+L/);
  });

  // line_width_is_configurable_via_series_options
  it('line width is configurable via series options', () => {
    const container = makeContainer();
    const bus = new EventBus<RendererEvents>();
    new Renderer(container, bus);
    bus.emit('series:add', { id: 'line1', type: 'line', options: { strokeWidth: 2 } });
    bus.emit('viewport:changed', { timeRange: [0, 400], priceRange: [95, 115] });
    bus.emit('series:data', {
      id: 'line1',
      bars: makeBars([100, 105, 102]),
    });
    const group = container.querySelector('[data-series-id="line1"]')!;
    const path = group.querySelector('path');
    expect(path).not.toBeNull();
    expect(path!.getAttribute('stroke-width')).toBe('2');
  });

  // line_is_clipped_to_viewport_boundaries
  it('line is clipped to viewport boundaries', () => {
    const { container, bus } = setup();
    // Add bars extending outside viewport (timeRange: [0, 400])
    bus.emit('series:data', {
      id: 'line1',
      bars: makeBars([100, 105, 102, 108, 103], -200, 100), // times: -200, -100, 0, 100, 200
    });
    const group = container.querySelector('[data-series-id="line1"]')!;
    // A clipPath should exist on the SVG or the path should have clip-path attribute
    const svg = container.querySelector('svg')!;
    const hasClipPath = svg.querySelector('clipPath') !== null ||
      group.querySelector('path')?.getAttribute('clip-path') !== null ||
      group.getAttribute('clip-path') !== null;
    expect(hasClipPath).toBe(true);
  });
});
