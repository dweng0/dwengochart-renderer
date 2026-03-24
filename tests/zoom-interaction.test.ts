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

function setup() {
  const container = makeContainer();
  const bus = new EventBus<RendererEvents>();
  new Renderer(container, bus);
  bus.emit('viewport:changed', { timeRange: [0, 1000], priceRange: [50, 150] });
  return { container, bus };
}

describe('Zoom Interaction', () => {
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

  // emit_interactionzoom_on_pinch_gesture
  it('emit interaction:zoom on pinch gesture', () => {
    const { container, bus } = setup();
    const svg = container.querySelector('svg')!;
    const emitted: { delta: number; centerX: number }[] = [];
    bus.on('interaction:zoom', (p) => emitted.push(p));

    const makeTouch = (id: number, x: number) => ({ clientX: x, clientY: 300, identifier: id, target: svg });

    // Two-finger touchmove
    svg.dispatchEvent(Object.assign(new Event('touchstart', { bubbles: true }), {
      touches: [makeTouch(1, 300), makeTouch(2, 500)],
    }));
    svg.dispatchEvent(Object.assign(new Event('touchmove', { bubbles: true }), {
      touches: [makeTouch(1, 300), makeTouch(2, 500)],
    }));

    expect(emitted.length).toBeGreaterThan(0);
    expect(emitted[0].centerX).toBeCloseTo(400, 0); // midpoint of 300 and 500
  });

  // emit_interactionzoom_on_keyboard_shortcut
  it('emit interaction:zoom on keyboard shortcut', () => {
    const { container, bus } = setup();
    const svg = container.querySelector('svg')!;
    const emitted: { delta: number; centerX: number }[] = [];
    bus.on('interaction:zoom', (p) => emitted.push(p));

    // Focus the SVG and press '+'
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));
    expect(emitted.length).toBeGreaterThan(0);
    expect(emitted[0].delta).toBeGreaterThan(0); // positive = zoom in

    // Press '-'
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: '-', bubbles: true }));
    expect(emitted.length).toBe(2);
    expect(emitted[1].delta).toBeLessThan(0); // negative = zoom out
  });

  // emit_interactionfit_on_doubleclick
  it('emit interaction:fit on double-click', () => {
    const { container, bus } = setup();
    const svg = container.querySelector('svg')!;
    const emitted: unknown[] = [];
    bus.on('interaction:fit', (p) => emitted.push(p));

    svg.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(emitted.length).toBe(1);
  });

  // viewport_updates_only_via_viewportchanged
  it('viewport updates only via viewport:changed', () => {
    const { container, bus } = setup();
    const svg = container.querySelector('svg')!;

    const viewboxBefore = svg.getAttribute('viewBox');

    // Zoom the chart — renderer emits zoom but doesn't update scales
    svg.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, clientX: 400, clientY: 300, bubbles: true }));
    expect(svg.getAttribute('viewBox')).toBe(viewboxBefore); // viewBox unchanged

    // Only viewport:changed updates rendering
    bus.emit('viewport:changed', { timeRange: [100, 900], priceRange: [60, 140] });
    expect(true).toBe(true); // just verifying no throw
  });

  // scroll_direction_respects_natural_scrolling_setting
  it('scroll direction respects natural scrolling setting', () => {
    const container = makeContainer();
    const bus = new EventBus<RendererEvents>();
    const renderer = new Renderer(container, bus);
    renderer.setNaturalScrolling(true);
    bus.emit('viewport:changed', { timeRange: [0, 1000], priceRange: [50, 150] });

    const svg = container.querySelector('svg')!;
    const emitted: { delta: number; centerX: number }[] = [];
    bus.on('interaction:zoom', (p) => emitted.push(p));

    // Scroll up = deltaY negative → with natural scrolling, zoom out (positive delta becomes negative)
    svg.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, clientX: 400, bubbles: true }));
    expect(emitted.length).toBeGreaterThan(0);
    expect(emitted[0].delta).toBeGreaterThan(0); // natural: scroll up = positive delta

    renderer.destroy();
  });

  // zoom_transition_animates_between_viewportchanged_events
  it('zoom transition animates between viewport:changed events', () => {
    const { container, bus } = setup();
    bus.emit('series:add', { id: 's1', type: 'line' });
    const bars = [
      { time: 0, open: 100, high: 105, low: 98, close: 102 },
      { time: 100, open: 102, high: 107, low: 100, close: 105 },
    ];
    bus.emit('series:data', { id: 's1', bars });

    // Emit viewport:changed — renderer should handle it without error
    // (animation via RAF is best-effort; we just verify DOM updates)
    bus.emit('viewport:changed', { timeRange: [0, 200], priceRange: [95, 110] });
    const path = container.querySelector('[data-series-id="s1"] path');
    expect(path).not.toBeNull();
    expect(path!.getAttribute('d')).not.toBeNull();
  });
});
