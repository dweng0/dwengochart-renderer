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

function setup() {
  const container = makeContainer();
  const bus = new EventBus<RendererEvents>();
  new Renderer(container, bus);
  return { container, bus };
}

describe('Price Axis Rendering', () => {
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

  // render_price_axis_labels_at_sensible_intervals
  it('render price axis labels at sensible intervals', () => {
    const { container, bus } = setup();
    bus.emit('viewport:changed', { timeRange: [0, 1000], priceRange: [50, 150] });
    const axis = container.querySelector('.price-axis')!;
    const labels = axis.querySelectorAll('text');
    expect(labels.length).toBeGreaterThan(0);
    // Labels should be at round-number intervals
    const values = [...labels].map(t => parseFloat(t.textContent ?? '0'));
    // Each value should be within the price range
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(50);
      expect(v).toBeLessThanOrEqual(150);
    }
    // Gridlines
    const lines = axis.querySelectorAll('line');
    expect(lines.length).toBeGreaterThan(0);
  });

  // handle_very_small_price_range
  it('handle very small price range', () => {
    const { container, bus } = setup();
    bus.emit('viewport:changed', { timeRange: [0, 1000], priceRange: [100.01, 100.05] });
    const axis = container.querySelector('.price-axis')!;
    const labels = axis.querySelectorAll('text');
    expect(labels.length).toBeGreaterThan(0);
    // Labels should show decimal precision
    const hasDecimal = [...labels].some(t => (t.textContent ?? '').includes('.'));
    expect(hasDecimal).toBe(true);
  });

  // handle_very_large_price_range
  it('handle very large price range', () => {
    const { container, bus } = setup();
    bus.emit('viewport:changed', { timeRange: [0, 1000], priceRange: [1, 100000] });
    const axis = container.querySelector('.price-axis')!;
    const labels = axis.querySelectorAll('text');
    expect(labels.length).toBeGreaterThan(0);
    // Axis should remain readable — labels should exist and not all be identical
    const texts = new Set([...labels].map(t => t.textContent));
    expect(texts.size).toBeGreaterThan(1);
  });

  // price_axis_width_accommodates_label_length
  it('price axis width accommodates label length', () => {
    const { container, bus } = setup();
    bus.emit('viewport:changed', { timeRange: [0, 1000], priceRange: [99000, 100001] });
    const axis = container.querySelector('.price-axis')!;
    // Axis group should have a data attribute or transform indicating a non-zero width
    const labels = axis.querySelectorAll('text');
    expect(labels.length).toBeGreaterThan(0);
    // Each label should have an x position
    for (const label of labels) {
      const x = parseFloat(label.getAttribute('x') ?? '0');
      expect(x).toBeGreaterThanOrEqual(0);
    }
  });

  // last_price_marker_on_price_axis
  it('last price marker on price axis', () => {
    const { container, bus } = setup();
    bus.emit('viewport:changed', { timeRange: [0, 100], priceRange: [95, 110] });
    bus.emit('series:add', { id: 's1', type: 'candlestick' });
    const bars: Bar[] = [
      { time: 0,  open: 100, high: 105, low: 98, close: 102.5 },
      { time: 50, open: 102.5, high: 106, low: 101, close: 102.5 },
    ];
    bus.emit('series:data', { id: 's1', bars });

    const axis = container.querySelector('.price-axis')!;
    // Should have a highlighted last-price marker
    const marker = axis.querySelector('[data-last-price]') ??
                   axis.querySelector('.last-price') ??
                   axis.querySelector('text[font-weight="bold"]');
    expect(marker).not.toBeNull();
    // Should have a dashed line
    const dashedLine = axis.querySelector('line[stroke-dasharray]');
    expect(dashedLine).not.toBeNull();
  });

  // price_labels_include_currency_symbol_from_symbolresolved
  it('price labels include currency symbol from symbol:resolved', () => {
    const { container, bus } = setup();
    bus.emit('symbol:resolved', { symbol: { name: 'AAPL', currency_code: 'USD' } });
    bus.emit('viewport:changed', { timeRange: [0, 1000], priceRange: [50, 150] });
    const axis = container.querySelector('.price-axis')!;
    const labels = axis.querySelectorAll('text');
    expect(labels.length).toBeGreaterThan(0);
    const hasUSD = [...labels].some(t => (t.textContent ?? '').startsWith('$'));
    expect(hasUSD).toBe(true);
  });

  // drag_price_axis_emits_interaction_event
  it('drag price axis emits interaction event', () => {
    const { container, bus } = setup();
    bus.emit('viewport:changed', { timeRange: [0, 1000], priceRange: [50, 150] });

    const emitted: unknown[] = [];
    bus.on('interaction:zoom', (p) => emitted.push(p));

    const axis = container.querySelector('.price-axis')!;
    // Simulate mousedown + mousemove on the axis
    axis.dispatchEvent(new MouseEvent('mousedown', { clientY: 300, bubbles: true }));
    axis.dispatchEvent(new MouseEvent('mousemove', { clientY: 280, buttons: 1, bubbles: true }));

    expect(emitted.length).toBeGreaterThan(0);
  });

  // price_axis_labels_in_logarithmic_scale
  it('price axis labels in logarithmic scale', () => {
    const { container, bus } = setup();
    bus.emit('viewport:changed', {
      timeRange: [0, 1000],
      priceRange: [10, 10000],
      priceScale: 'logarithmic',
    });
    const axis = container.querySelector('.price-axis')!;
    const labels = axis.querySelectorAll('text');
    expect(labels.length).toBeGreaterThan(0);
    const values = [...labels].map(t => parseFloat(t.textContent?.replace(/[$,]/g, '') ?? '0')).filter(v => !isNaN(v));
    // In log scale, should have labels like 10, 100, 1000, 10000
    const hasLogLabels = values.some(v => v === 10 || v === 100 || v === 1000 || v === 10000);
    expect(hasLogLabels).toBe(true);
  });
});
