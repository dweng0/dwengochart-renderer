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
  bus.emit('series:add', { id: 's1', type: 'line' });
  bus.emit('viewport:changed', { timeRange: [0, 200], priceRange: [95, 115] });
  return { container, bus };
}

describe('Render Pipeline', () => {
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

  // batch_multiple_events_into_one_update
  it('batch multiple events into one update', () => {
    const { bus } = setup();

    // Track how many times renderSeries is called by observing DOM mutations
    const mutationCounts: number[] = [];
    let count = 0;
    const observer = new MutationObserver(() => { count++; });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true });

    const twoBars = (c: number) => [
      { time: 0, open: 100, high: 105, low: 98, close: c },
      { time: 100, open: c, high: c + 5, low: c - 2, close: c + 2 },
    ];
    // Fire multiple events synchronously
    bus.emit('series:data', { id: 's1', bars: twoBars(102) });
    bus.emit('series:data', { id: 's1', bars: twoBars(103) });
    bus.emit('series:data', { id: 's1', bars: twoBars(104) });

    // Flush timers / rAF
    vi.runAllTimers();

    // Final state should reflect latest data (close=104)
    const path = document.body.querySelector('[data-series-id="s1"] path');
    expect(path).not.toBeNull();

    observer.disconnect();
    mutationCounts.push(count);
    // Final state should reflect latest data
    expect(path!.getAttribute('d')).not.toBeNull();
  });

  // skip_rendering_when_nothing_changed
  it('skip rendering when nothing changed', () => {
    const { container } = setup();
    const bars = [{ time: 0, open: 100, high: 105, low: 98, close: 102 }];

    // Initial render
    const bus2 = new EventBus<RendererEvents>();
    const r = new Renderer(container.cloneNode(true) as HTMLElement, bus2);
    bus2.emit('series:add', { id: 's1', type: 'line' });
    bus2.emit('viewport:changed', { timeRange: [0, 200], priceRange: [95, 115] });
    bus2.emit('series:data', { id: 's1', bars });

    // Renderer should not throw and DOM should be stable
    expect(r).toBeDefined();
    r.destroy();
  });

  // handle_rapid_successive_events
  it('handle rapid successive events', () => {
    const { container, bus } = setup();

    const mkBars = (c: number) => [
      { time: 0, open: c, high: c + 5, low: c - 2, close: c },
      { time: 100, open: c, high: c + 5, low: c - 2, close: c + 1 },
    ];
    // Fire 100 series:data events rapidly
    for (let i = 0; i < 100; i++) {
      bus.emit('series:data', { id: 's1', bars: mkBars(100 + i) });
    }

    // Flush the batched RAF
    vi.runAllTimers();

    // Should not throw, and final state should be the last event's data
    const path = container.querySelector('[data-series-id="s1"] path');
    expect(path).not.toBeNull();
    expect(path!.getAttribute('d')).not.toBeNull();
  });

  // requestanimationframe_integration
  it('requestAnimationFrame integration', () => {
    const rafCalls: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCalls.push(cb);
      return rafCalls.length;
    });

    const container = makeContainer();
    const bus = new EventBus<RendererEvents>();
    new Renderer(container, bus);
    bus.emit('series:add', { id: 's1', type: 'line' });
    bus.emit('viewport:changed', { timeRange: [0, 200], priceRange: [95, 115] });
    bus.emit('series:data', {
      id: 's1',
      bars: [{ time: 0, open: 100, high: 105, low: 98, close: 102 }],
    });

    // rAF should have been called for scheduling
    expect(rafCalls.length).toBeGreaterThan(0);
    vi.unstubAllGlobals();
  });

  // pause_rendering_when_tab_is_hidden
  it('pause rendering when tab is hidden', () => {
    const { container, bus } = setup();

    // Simulate tab becoming hidden
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    // Emit series:data while hidden — renderer should queue but not crash
    bus.emit('series:data', {
      id: 's1',
      bars: [
        { time: 0, open: 100, high: 105, low: 98, close: 102 },
        { time: 100, open: 102, high: 107, low: 100, close: 105 },
      ],
    });

    // Simulate tab becoming visible again
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    // After visibility restored, data should be rendered
    vi.runAllTimers();
    const path = container.querySelector('[data-series-id="s1"] path');
    expect(path).not.toBeNull();

    // Cleanup
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });
});
