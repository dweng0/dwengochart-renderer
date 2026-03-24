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
  bus.emit('viewport:changed', { timeRange: [0, 200], priceRange: [95, 115] });
  return { container, bus };
}

describe('Loading State', () => {
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

  // show_loading_indicator_at_specific_region
  it('show loading indicator at specific region', () => {
    const { container, bus } = setup();
    bus.emit('chart:loading', { loading: true, region: 'left' });
    const indicator = container.querySelector('.loading-indicator');
    expect(indicator).not.toBeNull();
    // Should have a region attribute or position
    const region = indicator!.getAttribute('data-region') ?? indicator!.getAttribute('class');
    expect(region).toContain('left');
  });
});

describe('Empty and Error States', () => {
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

  // display_error_state_via_charterror_event
  it('display error state via chart:error event', () => {
    const { container, bus } = setup();
    bus.emit('chart:error', { message: 'Failed to load data' });
    const errorEl = container.querySelector('.error-message');
    expect(errorEl).not.toBeNull();
    expect(errorEl!.textContent).toContain('Failed to load data');
  });

  // clear_error_state_via_charterror_null
  it('clear error state via chart:error null', () => {
    const { container, bus } = setup();
    bus.emit('chart:error', { message: 'Failed to load data' });
    expect(container.querySelector('.error-message')).not.toBeNull();

    bus.emit('chart:error', null);
    expect(container.querySelector('.error-message')).toBeNull();
  });

  // display_empty_state_when_series_has_no_data
  it('display empty state when series has no data', () => {
    const { container, bus } = setup();
    bus.emit('series:add', { id: 's1', type: 'line' });
    bus.emit('series:data', { id: 's1', bars: [] });

    const emptyEl = container.querySelector('.empty-state') ??
                    container.querySelector('[data-empty]') ??
                    [...container.querySelectorAll('text')].find(t =>
                      (t.textContent ?? '').toLowerCase().includes('no data')
                    );
    expect(emptyEl).not.toBeNull();
  });
});

describe('Watermark', () => {
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

  // watermark_updates_on_symbolresolved_event
  it('watermark updates on symbol:resolved event', () => {
    const { container, bus } = setup();
    bus.emit('symbol:resolved', { symbol: { name: 'AAPL' } });
    const wm = container.querySelector('.watermark');
    expect(wm).not.toBeNull();
    expect(wm!.textContent).toBe('AAPL');

    bus.emit('symbol:resolved', { symbol: { name: 'GOOG' } });
    expect(wm!.textContent).toBe('GOOG');
  });

  // watermark_is_behind_all_chart_elements
  it('watermark is behind all chart elements', () => {
    const { container, bus } = setup();
    bus.emit('symbol:resolved', { symbol: { name: 'AAPL' } });
    const svg = container.querySelector('svg')!;
    const children = [...svg.children];
    const wmIdx = children.findIndex(c => c.classList.contains('watermark') || c.tagName === 'text');
    const seriesIdx = children.findIndex(c => c.classList.contains('series-layer'));
    // Watermark should come before or at same level as series layer (rendered behind)
    expect(wmIdx).toBeLessThan(seriesIdx);
  });

  // watermark_is_configurable
  it('watermark is configurable', () => {
    const container = makeContainer();
    const bus = new EventBus<RendererEvents>();
    const renderer = new Renderer(container, bus, { watermark: false });
    bus.emit('symbol:resolved', { symbol: { name: 'AAPL' } });

    const wm = container.querySelector('.watermark');
    // With watermark disabled, the text should be empty or hidden
    const isHidden = !wm || wm.getAttribute('display') === 'none' || (wm.textContent ?? '') === '';
    expect(isHidden).toBe(true);

    renderer.destroy();
  });
});
