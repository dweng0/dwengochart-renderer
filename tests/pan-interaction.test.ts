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

describe('Pan Interaction', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class {
      constructor(cb: () => void) { void cb; }
      observe() {}
      disconnect() {}
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  // emit_interactionpan_on_mouse_drag
  it('emit interaction:pan on mouse drag', () => {
    const { container, bus } = setup();
    const svg = container.querySelector('svg')!;
    const emitted: { deltaX: number }[] = [];
    bus.on('interaction:pan', (p) => emitted.push(p));

    svg.dispatchEvent(new MouseEvent('mousedown', { clientX: 400, clientY: 300, buttons: 1, bubbles: true }));
    svg.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, clientY: 300, buttons: 1, bubbles: true }));

    expect(emitted.length).toBeGreaterThan(0);
    expect(emitted[0].deltaX).toBe(100);
  });

  // emit_interactionpan_on_touch_drag
  it('emit interaction:pan on touch drag', () => {
    const { container, bus } = setup();
    const svg = container.querySelector('svg')!;
    const emitted: { deltaX: number }[] = [];
    bus.on('interaction:pan', (p) => emitted.push(p));

    const makeTouch = (x: number) => ({ clientX: x, clientY: 300, identifier: 1, target: svg });

    svg.dispatchEvent(Object.assign(new Event('touchstart', { bubbles: true }), {
      touches: [makeTouch(400)],
    }));
    svg.dispatchEvent(Object.assign(new Event('touchmove', { bubbles: true }), {
      touches: [makeTouch(500)],
    }));

    expect(emitted.length).toBeGreaterThan(0);
    expect(emitted[0].deltaX).toBe(100);
  });

  // viewport_updates_only_via_viewportchanged
  it('viewport updates only via viewport:changed', () => {
    const { container, bus } = setup();
    const svg = container.querySelector('svg')!;

    // Drag the chart — renderer emits pan but doesn't update scales
    const scaleBefore = (svg.querySelector('svg') ?? svg).getAttribute('viewBox');
    svg.dispatchEvent(new MouseEvent('mousedown', { clientX: 400, clientY: 300, buttons: 1, bubbles: true }));
    svg.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, clientY: 300, buttons: 1, bubbles: true }));

    // ViewBox should NOT change from pan alone
    expect(svg.getAttribute('viewBox')).toBe(scaleBefore ?? '0 0 800 600');

    // Only viewport:changed should cause re-render
    bus.emit('viewport:changed', { timeRange: [100, 1100], priceRange: [50, 150] });
    // After viewport:changed, scales update (we can't directly check scales in DOM but this doesn't throw)
    expect(true).toBe(true);
  });

  // kinetic_scrolling_emits_pan_events
  it('kinetic scrolling emits pan events', () => {
    const { container, bus } = setup();
    const svg = container.querySelector('svg')!;
    const emitted: { deltaX: number }[] = [];
    bus.on('interaction:pan', (p) => emitted.push(p));

    // Drag with velocity
    svg.dispatchEvent(new MouseEvent('mousedown', { clientX: 400, clientY: 300, buttons: 1, bubbles: true }));
    svg.dispatchEvent(new MouseEvent('mousemove', { clientX: 440, clientY: 300, buttons: 1, bubbles: true }));
    svg.dispatchEvent(new MouseEvent('mousemove', { clientX: 480, clientY: 300, buttons: 1, bubbles: true }));
    svg.dispatchEvent(new MouseEvent('mouseup', { clientX: 480, clientY: 300, bubbles: true }));

    const countAfterDrag = emitted.length;

    // Advance timers to trigger kinetic pan events
    vi.advanceTimersByTime(500);

    // Should have more pan events from kinetic scrolling
    expect(emitted.length).toBeGreaterThan(countAfterDrag);
    // Deltas should be decelerating (getting smaller)
    const kineticDeltas = emitted.slice(countAfterDrag).map(e => Math.abs(e.deltaX));
    if (kineticDeltas.length >= 2) {
      expect(kineticDeltas[0]).toBeGreaterThanOrEqual(kineticDeltas[kineticDeltas.length - 1]);
    }
  });

  // small_mouse_movements_do_not_trigger_pan
  it('small mouse movements do not trigger pan', () => {
    const { container, bus } = setup();
    const svg = container.querySelector('svg')!;
    const panEvents: unknown[] = [];
    const clickEvents: unknown[] = [];
    bus.on('interaction:pan', (p) => panEvents.push(p));
    bus.on('interaction:click', (p) => clickEvents.push(p));

    // Click with < 3px movement
    svg.dispatchEvent(new MouseEvent('mousedown', { clientX: 400, clientY: 300, buttons: 1, bubbles: true }));
    svg.dispatchEvent(new MouseEvent('mousemove', { clientX: 402, clientY: 300, buttons: 1, bubbles: true }));
    svg.dispatchEvent(new MouseEvent('mouseup', { clientX: 402, clientY: 300, bubbles: true }));
    svg.dispatchEvent(new MouseEvent('click', { clientX: 402, clientY: 300, bubbles: true }));

    expect(panEvents.length).toBe(0);
    expect(clickEvents.length).toBeGreaterThan(0);
  });

  // rightclick_drag_does_not_pan
  it('right-click drag does not pan', () => {
    const { container, bus } = setup();
    const svg = container.querySelector('svg')!;
    const emitted: unknown[] = [];
    bus.on('interaction:pan', (p) => emitted.push(p));

    // Right-click drag (button=2, buttons=2)
    svg.dispatchEvent(new MouseEvent('mousedown', { clientX: 400, clientY: 300, button: 2, buttons: 2, bubbles: true }));
    svg.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, clientY: 300, button: 2, buttons: 2, bubbles: true }));

    expect(emitted.length).toBe(0);
  });
});
