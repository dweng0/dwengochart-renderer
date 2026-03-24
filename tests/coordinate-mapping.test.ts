import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventBus } from '@yatamazuki/typed-eventbus';
import type { RendererEvents } from '../src/index';
import { Renderer } from '../src/index';

function makeContainer(width = 800, height = 600): HTMLElement {
  const el = document.createElement('div');
  el.getBoundingClientRect = () =>
    ({ width, height, top: 0, left: 0, right: width, bottom: height }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

describe('Coordinate Mapping', () => {
  let container: HTMLElement;
  let eventbus: EventBus<RendererEvents>;
  let renderer: Renderer;

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class {
      constructor(cb: () => void) { void cb; }
      observe() {}
      disconnect() {}
    });
    container = makeContainer(800, 600);
    eventbus = new EventBus<RendererEvents>();
    renderer = new Renderer(container, eventbus);
    eventbus.emit('viewport:changed', { timeRange: [1000, 5000], priceRange: [50, 150] });
  });

  afterEach(() => {
    renderer.destroy();
    document.body.removeChild(container);
    vi.unstubAllGlobals();
  });

  // map_time_to_xpixel
  it('map time to x-pixel', () => {
    expect(renderer.mapTimeToX(3000)).toBe(400);
  });

  // map_xpixel_to_time
  it('map x-pixel to time', () => {
    expect(renderer.mapXToTime(400)).toBe(3000);
  });

  // map_price_to_ypixel
  it('map price to y-pixel', () => {
    // y-axis is inverted: price 100 (midpoint of 50–150) → y=300 (midpoint of 0–600)
    expect(renderer.mapPriceToY(100)).toBe(300);
  });

  // map_ypixel_to_price
  it('map y-pixel to price', () => {
    expect(renderer.mapYToPrice(300)).toBe(100);
  });

  // handle_time_at_viewport_boundary
  it('handle time at viewport boundary', () => {
    expect(renderer.mapTimeToX(1000)).toBe(0);
    expect(renderer.mapTimeToX(5000)).toBe(800);
  });

  // handle_time_outside_viewport
  it('handle time outside viewport', () => {
    expect(renderer.mapTimeToX(0)).toBeLessThan(0);
  });

  // recalculate_on_viewportchanged_event
  it('recalculate on viewport:changed event', () => {
    eventbus.emit('viewport:changed', { timeRange: [2000, 6000], priceRange: [50, 150] });
    // time 4000 is midpoint of [2000,6000] → x=400
    expect(renderer.mapTimeToX(4000)).toBe(400);
  });

  // account_for_axis_margins_in_coordinate_mapping
  it('account for axis margins in coordinate mapping', () => {
    renderer.setMargins({ right: 70, bottom: 30 });
    // Drawing area: (800-70) x (600-30) = 730x570
    // Time 1000 (start) → x=0; time 5000 (end) → x=730
    expect(renderer.mapTimeToX(1000)).toBe(0);
    expect(renderer.mapTimeToX(5000)).toBe(730);
    // Price 150 (top) → y=0; price 50 (bottom) → y=570
    expect(renderer.mapPriceToY(50)).toBe(570);
  });

  // map_coordinates_with_logarithmic_scale_from_viewportchanged
  it('map coordinates with logarithmic scale from viewport:changed', () => {
    eventbus.emit('viewport:changed', {
      timeRange: [1000, 5000],
      priceRange: [10, 1000],
      priceScale: 'logarithmic',
    });
    // log(100) is midway between log(10) and log(1000) → y=300
    expect(renderer.mapPriceToY(100)).toBeCloseTo(300, 0);
  });

  // map_coordinates_with_percentage_scale_from_viewportchanged
  it('map coordinates with percentage scale from viewport:changed', () => {
    eventbus.emit('viewport:changed', {
      timeRange: [1000, 5000],
      priceRange: [-10, 10],
      priceScale: 'percentage',
      basePrice: 100,
    });
    // price 105 → +5% → midpoint towards top of [-10,10]
    const y = renderer.mapPriceToY(105);
    const yAt5pct = renderer.mapPriceToY(100 * (1 + 5 / 100));
    expect(y).toBeCloseTo(yAt5pct, 1);
    expect(y).toBeLessThan(300); // above center (inverted y)
  });

  // handle_zero_price_range_without_division_by_zero
  it('handle zero price range without division by zero', () => {
    expect(() => {
      eventbus.emit('viewport:changed', {
        timeRange: [1000, 5000],
        priceRange: [100, 100],
      });
    }).not.toThrow();
    const y = renderer.mapPriceToY(100);
    expect(y).toBeCloseTo(300, 0); // vertical center
  });
});
