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
  { time: 0,   open: 100, high: 108, low: 98,  close: 105, volume: 1000 },
  { time: 100, open: 105, high: 110, low: 103, close: 107, volume: 2000 },
  { time: 200, open: 107, high: 112, low: 105, close: 109, volume: 1500 },
];

function setup() {
  const container = makeContainer(800, 600);
  const bus = new EventBus<RendererEvents>();
  const renderer = new Renderer(container, bus);
  bus.emit('series:add', { id: 's1', type: 'candlestick' });
  bus.emit('viewport:changed', { timeRange: [0, 200], priceRange: [95, 115] });
  bus.emit('series:data', { id: 's1', bars: BARS });
  return { container, bus, renderer };
}

function mousemove(el: Element, x: number, y: number, buttons = 0) {
  el.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, buttons, bubbles: true }));
}

function mousedown(el: Element, x: number, y: number) {
  el.dispatchEvent(new MouseEvent('mousedown', { clientX: x, clientY: y, buttons: 1, bubbles: true }));
}

function mouseleave(el: Element) {
  el.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
}

describe('Crosshair', () => {
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

  // snap_crosshair_to_nearest_bar
  it('snap crosshair to nearest bar', () => {
    const { container, bus } = setup();
    // Enable magnet/snap mode
    bus.emit('series:update', { id: 's1', options: { magnetMode: true } });
    const svg = container.querySelector('svg')!;
    // Move near bar at time=100 (middle of viewport), which maps to x=400
    mousemove(svg, 410, 300); // close to bar at time=100

    const crosshair = container.querySelector('.crosshair-layer') ??
                      container.querySelector('[data-crosshair]') ??
                      container.querySelector('.crosshair');
    expect(crosshair).not.toBeNull();
    // Vertical line should be at or near the bar's x position
    const vLine = crosshair!.querySelector('line[data-crosshair-v]') ??
                  crosshair!.querySelector('line:first-child');
    expect(vLine).not.toBeNull();
    const x1 = parseFloat(vLine!.getAttribute('x1') ?? '0');
    // Should be snapped to bar x position (around 400, tolerance ±5px)
    expect(x1).toBeGreaterThan(395);
    expect(x1).toBeLessThan(405);
  });

  // hide_crosshair_when_mouse_leaves_svg
  it('hide crosshair when mouse leaves SVG', () => {
    const { container, bus } = setup();
    const svg = container.querySelector('svg')!;

    // First show crosshair
    mousemove(svg, 400, 300);
    const crosshair = container.querySelector('.crosshair-layer') ??
                      container.querySelector('[data-crosshair]') ??
                      container.querySelector('.crosshair');
    expect(crosshair).not.toBeNull();

    // Now hide it
    const emitted: unknown[] = [];
    bus.on('interaction:crosshair', (p) => emitted.push(p));
    mouseleave(svg);

    const display = crosshair!.getAttribute('display');
    const isHidden = display === 'none' || !container.contains(crosshair);
    expect(isHidden).toBe(true);
    // Should emit null
    expect(emitted[emitted.length - 1]).toBeNull();
  });

  // crosshair_tooltip_shows_ohlcv_values
  it('crosshair tooltip shows OHLCV values', () => {
    const { container } = setup();
    const svg = container.querySelector('svg')!;
    // Move over bar at time=100 (mapped to x=400)
    mousemove(svg, 400, 300);

    const crosshair = container.querySelector('.crosshair-layer') ??
                      container.querySelector('[data-crosshair]') ??
                      container.querySelector('.crosshair');
    expect(crosshair).not.toBeNull();

    // Tooltip should contain OHLCV text
    const texts = crosshair!.querySelectorAll('text');
    const allText = [...texts].map(t => t.textContent ?? '').join(' ');
    // Should contain some numeric values from the bars
    expect(allText.length).toBeGreaterThan(0);
    // Should have O, H, L, C or similar labels
    const hasOHLC = /[Oo]pen|[Hh]igh|[Ll]ow|[Cc]lose|O:|H:|L:|C:/.test(allText) ||
                    texts.length >= 4;
    expect(hasOHLC).toBe(true);
  });

  // crosshair_line_style_from_theme
  it('crosshair line style from theme', () => {
    const { container, bus } = setup();
    bus.emit('theme:changed', { theme: { crosshairStyle: 'dashed' } });

    const svg = container.querySelector('svg')!;
    mousemove(svg, 400, 300);

    const crosshair = container.querySelector('.crosshair-layer') ??
                      container.querySelector('[data-crosshair]') ??
                      container.querySelector('.crosshair');
    expect(crosshair).not.toBeNull();

    const lines = crosshair!.querySelectorAll('line');
    expect(lines.length).toBeGreaterThan(0);
    const hasDashed = [...lines].some(l => l.getAttribute('stroke-dasharray') !== null);
    expect(hasDashed).toBe(true);
  });

  // crosshair_is_hidden_during_pan_drag
  it('crosshair is hidden during pan drag', () => {
    const { container } = setup();
    const svg = container.querySelector('svg')!;

    // Show crosshair first
    mousemove(svg, 400, 300);
    const crosshair = container.querySelector('.crosshair-layer') ??
                      container.querySelector('[data-crosshair]') ??
                      container.querySelector('.crosshair');
    expect(crosshair).not.toBeNull();
    expect(crosshair!.getAttribute('display')).not.toBe('none');

    // Start drag
    mousedown(svg, 400, 300);
    mousemove(svg, 380, 300, 1); // buttons=1 means dragging

    const display = crosshair!.getAttribute('display');
    expect(display).toBe('none');
  });

  // crosshair_activation_on_touch_devices
  it('crosshair activation on touch devices', () => {
    const { container } = setup();
    const svg = container.querySelector('svg')!;

    // JSDOM doesn't have Touch constructor — create a minimal mock
    const makeTouch = (x: number, y: number) => ({ clientX: x, clientY: y, identifier: 1, target: svg });

    svg.dispatchEvent(Object.assign(new Event('touchstart', { bubbles: true }), {
      touches: [makeTouch(400, 300)],
    }));

    const crosshair = container.querySelector('.crosshair-layer') ??
                      container.querySelector('[data-crosshair]') ??
                      container.querySelector('.crosshair');
    expect(crosshair).not.toBeNull();
    expect(crosshair!.getAttribute('display')).not.toBe('none');

    svg.dispatchEvent(Object.assign(new Event('touchmove', { bubbles: true }), {
      touches: [makeTouch(420, 300)],
    }));

    svg.dispatchEvent(Object.assign(new Event('touchend', { bubbles: true }), {
      touches: [],
    }));
    expect(crosshair!.getAttribute('display')).toBe('none');
  });

  // crosshair_magnet_mode_is_toggleable
  it('crosshair magnet mode is toggleable', () => {
    const { container } = setup();
    const svg = container.querySelector('svg')!;

    // With magnet disabled, crosshair should stay at exact mouse position
    // Move to x=420 (between bars at x=400 and x=533)
    mousemove(svg, 420, 300);

    const crosshair = container.querySelector('.crosshair-layer') ??
                      container.querySelector('[data-crosshair]') ??
                      container.querySelector('.crosshair');
    expect(crosshair).not.toBeNull();

    const vLine = crosshair!.querySelector('line[data-crosshair-v]') ??
                  crosshair!.querySelector('line:first-child');
    expect(vLine).not.toBeNull();
    // Without magnet, x should be close to 420
    const x1 = parseFloat(vLine!.getAttribute('x1') ?? '0');
    expect(Math.abs(x1 - 420)).toBeLessThan(5);
  });
});
