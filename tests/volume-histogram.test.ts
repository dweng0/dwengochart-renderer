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

function makeBars(volumes: number[], bullish = true): Bar[] {
  return volumes.map((volume, i) => ({
    time: i * 100,
    open: bullish ? 100 : 105,
    high: 110,
    low: 95,
    close: bullish ? 105 : 100,
    volume,
  }));
}

function setup(options: Record<string, unknown> = {}) {
  const container = makeContainer();
  const bus = new EventBus<RendererEvents>();
  new Renderer(container, bus);
  bus.emit('series:add', { id: 'vol', type: 'volume', options });
  bus.emit('viewport:changed', { timeRange: [0, 400], priceRange: [90, 115] });
  return { container, bus };
}

describe('Volume Histogram', () => {
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

  // render_volume_bars_below_the_price_chart
  it('render volume bars below the price chart', () => {
    const { container, bus } = setup();
    bus.emit('series:data', { id: 'vol', bars: makeBars([1000, 2000, 500, 3000, 1500]) });
    const group = container.querySelector('[data-series-id="vol"]')!;
    const rects = group.querySelectorAll('rect');
    expect(rects.length).toBe(5);
    // All rects should be within the bottom portion of the chart
    const svgHeight = 600;
    for (const rect of rects) {
      const y = parseFloat(rect.getAttribute('y') ?? '0');
      expect(y).toBeGreaterThan(svgHeight * 0.5); // in lower half
    }
  });

  // volume_bar_color_matches_candle_direction
  it('volume bar color matches candle direction', () => {
    const { container, bus } = setup();
    const bars: Bar[] = [
      { time: 0,   open: 100, high: 110, low: 95, close: 105, volume: 1000 }, // bullish
      { time: 100, open: 105, high: 110, low: 95, close: 100, volume: 2000 }, // bearish
    ];
    bus.emit('series:data', { id: 'vol', bars });
    const group = container.querySelector('[data-series-id="vol"]')!;
    const rects = group.querySelectorAll('rect');
    expect(rects.length).toBe(2);
    const fills = [...rects].map(r => r.getAttribute('fill'));
    // Bullish and bearish should have different colors
    expect(fills[0]).not.toBe(fills[1]);
    // Bullish = green-ish, bearish = red-ish
    expect(fills[0]).toBe('#26a69a');
    expect(fills[1]).toBe('#ef5350');
  });

  // volume_area_has_its_own_yscale
  it('volume area has its own y-scale', () => {
    const { container, bus } = setup();
    bus.emit('series:data', { id: 'vol', bars: makeBars([100, 10000, 5000]) });
    const group = container.querySelector('[data-series-id="vol"]')!;
    const rects = group.querySelectorAll('rect');
    const heights = [...rects].map(r => parseFloat(r.getAttribute('height') ?? '0'));
    // Tallest bar should be tallest rect
    expect(heights[1]).toBeGreaterThan(heights[0]);
    expect(heights[1]).toBeGreaterThan(heights[2]);
    // Heights should be proportional (10000 / 100 = 100x larger)
    expect(heights[1] / heights[0]).toBeCloseTo(100, 0);
  });

  // volume_area_height_is_configurable
  it('volume area height is configurable', () => {
    const container = makeContainer(800, 600);
    const bus = new EventBus<RendererEvents>();
    const renderer = new Renderer(container, bus);
    bus.emit('series:add', { id: 'vol', type: 'volume', options: { heightPercent: 20 } });
    bus.emit('viewport:changed', { timeRange: [0, 400], priceRange: [90, 115] });
    bus.emit('series:data', { id: 'vol', bars: makeBars([1000, 2000]) });

    const group = container.querySelector('[data-series-id="vol"]')!;
    const rects = group.querySelectorAll('rect');
    expect(rects.length).toBeGreaterThan(0);

    // The tallest rect height should be ~20% of chart height (600 * 0.20 = 120)
    const heights = [...rects].map(r => parseFloat(r.getAttribute('height') ?? '0'));
    const maxHeight = Math.max(...heights);
    expect(maxHeight).toBeCloseTo(600 * 0.2, -1); // within ~10px

    renderer.destroy();
  });

  // hide_volume_when_series_is_removed
  it('hide volume when series is removed', () => {
    const { container, bus } = setup();
    bus.emit('series:data', { id: 'vol', bars: makeBars([1000, 2000]) });
    expect(container.querySelector('[data-series-id="vol"]')).not.toBeNull();

    bus.emit('series:remove', { id: 'vol' });
    expect(container.querySelector('[data-series-id="vol"]')).toBeNull();
  });
});
