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

function setup(containerWidth = 800, containerHeight = 600) {
  const container = makeContainer(containerWidth, containerHeight);
  const bus = new EventBus<RendererEvents>();
  const renderer = new Renderer(container, bus);
  bus.emit('series:add', { id: 'candles', type: 'candlestick' });
  bus.emit('viewport:changed', { timeRange: [0, 1000], priceRange: [50, 150] });
  return { container, bus, renderer };
}

describe('Candlestick Series Rendering', () => {
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

  // render_a_bullish_candle
  it('render a bullish candle', () => {
    const { container, bus } = setup();
    bus.emit('series:data', {
      id: 'candles',
      bars: [{ time: 500, open: 100, high: 110, low: 95, close: 108 }],
    });
    const group = container.querySelector('[data-series-id="candles"]')!;
    const rect = group.querySelector('rect');
    expect(rect).not.toBeNull();
    expect(rect!.getAttribute('data-direction')).toBe('bullish');
    const wicks = group.querySelectorAll('line');
    expect(wicks.length).toBe(2);
  });

  // render_a_bearish_candle
  it('render a bearish candle', () => {
    const { container, bus } = setup();
    bus.emit('series:data', {
      id: 'candles',
      bars: [{ time: 500, open: 108, high: 110, low: 95, close: 100 }],
    });
    const group = container.querySelector('[data-series-id="candles"]')!;
    const rect = group.querySelector('rect');
    expect(rect).not.toBeNull();
    expect(rect!.getAttribute('data-direction')).toBe('bearish');
  });

  // render_a_doji_open_equals_close
  it('render a doji (open equals close)', () => {
    const { container, bus } = setup();
    bus.emit('series:data', {
      id: 'candles',
      bars: [{ time: 500, open: 100, high: 105, low: 95, close: 100 }],
    });
    const group = container.querySelector('[data-series-id="candles"]')!;
    // Doji: no rect body, horizontal line instead
    const lines = group.querySelectorAll('line');
    expect(lines.length).toBeGreaterThanOrEqual(1);
    // No solid rect body for doji
    const rect = group.querySelector('rect');
    expect(rect).toBeNull();
  });

  // render_only_visible_bars
  it('render only visible bars', () => {
    const { container, bus } = setup();
    // 300 bars spanning time 0-2990 (every 10)
    const bars: Bar[] = Array.from({ length: 300 }, (_, i) => ({
      time: i * 10,
      open: 100, high: 110, low: 90, close: 105,
    }));
    // Viewport covers bars 100-149 (time 1000-1490)
    bus.emit('viewport:changed', { timeRange: [1000, 1490], priceRange: [50, 150] });
    bus.emit('series:data', { id: 'candles', bars });

    const group = container.querySelector('[data-series-id="candles"]')!;
    const barGroups = group.querySelectorAll('.bar');
    // Only bars within [1000, 1490] should render (bars 100-149 = 50 bars)
    expect(barGroups.length).toBeLessThan(300);
    expect(barGroups.length).toBeGreaterThan(0);
  });

  // render_with_no_bars
  it('render with no bars', () => {
    const { container, bus } = setup();
    expect(() => {
      bus.emit('series:data', { id: 'candles', bars: [] });
    }).not.toThrow();
    const group = container.querySelector('[data-series-id="candles"]')!;
    expect(group.querySelectorAll('.bar').length).toBe(0);
  });

  // render_a_single_bar
  it('render a single bar', () => {
    const { container, bus } = setup();
    bus.emit('series:data', {
      id: 'candles',
      bars: [{ time: 500, open: 100, high: 110, low: 90, close: 105 }],
    });
    const group = container.querySelector('[data-series-id="candles"]')!;
    expect(group.querySelectorAll('.bar').length).toBe(1);
  });

  // scale_candle_width_based_on_viewport
  it('scale candle width based on viewport', () => {
    const { container, bus } = setup();
    const bars: Bar[] = Array.from({ length: 50 }, (_, i) => ({
      time: i * 20, open: 100, high: 110, low: 90, close: 105,
    }));
    bus.emit('viewport:changed', { timeRange: [0, 980], priceRange: [50, 150] });
    bus.emit('series:data', { id: 'candles', bars });

    const group = container.querySelector('[data-series-id="candles"]')!;
    const rects = group.querySelectorAll('rect');
    expect(rects.length).toBeGreaterThan(0);
    const w = parseFloat(rects[0].getAttribute('width') ?? '0');
    expect(w).toBeGreaterThan(1);
    // Width should be less than full chart width / bar count (there are gaps)
    expect(w).toBeLessThan(800 / 50);
  });

  // handle_bars_with_zero_range_all_ohlc_values_equal
  it('handle bars with zero range (all OHLC values equal)', () => {
    const { container, bus } = setup();
    bus.emit('series:data', {
      id: 'candles',
      bars: [{ time: 500, open: 100, high: 100, low: 100, close: 100 }],
    });
    const group = container.querySelector('[data-series-id="candles"]')!;
    expect(group.querySelectorAll('line').length).toBeGreaterThanOrEqual(1);
    expect(group.querySelector('rect')).toBeNull();
  });

  // enforce_minimum_candle_width_at_extreme_zoomout
  it('enforce minimum candle width at extreme zoom-out', () => {
    const { container, bus } = setup();
    const bars: Bar[] = Array.from({ length: 5000 }, (_, i) => ({
      time: i, open: 100, high: 110, low: 90, close: 105,
    }));
    bus.emit('viewport:changed', { timeRange: [0, 4999], priceRange: [50, 150] });
    bus.emit('series:data', { id: 'candles', bars });

    const group = container.querySelector('[data-series-id="candles"]')!;
    const rects = group.querySelectorAll('rect');
    for (const rect of rects) {
      const w = parseFloat(rect.getAttribute('width') ?? '0');
      expect(w).toBeGreaterThanOrEqual(1);
    }
  });

  // wick_is_centered_and_singlepixel_wide
  it('wick is centered and single-pixel wide', () => {
    const { container, bus } = setup();
    bus.emit('series:data', {
      id: 'candles',
      bars: [{ time: 500, open: 100, high: 110, low: 90, close: 105 }],
    });
    const group = container.querySelector('[data-series-id="candles"]')!;
    const wicks = group.querySelectorAll('line');
    const rect = group.querySelector('rect')!;
    for (const wick of wicks) {
      expect(wick.getAttribute('stroke-width')).toBe('1');
      const wickX = parseFloat(wick.getAttribute('x1') ?? '0');
      const rectX = parseFloat(rect.getAttribute('x') ?? '0');
      const rectW = parseFloat(rect.getAttribute('width') ?? '0');
      const rectCenter = rectX + rectW / 2;
      expect(wickX).toBeCloseTo(rectCenter, 1);
    }
  });
});
