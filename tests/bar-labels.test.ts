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

const VIEWPORT = { timeRange: [0, 400] as [number, number], priceRange: [90, 120] as [number, number] };

const BARS_WITH_LABEL = [
  { time: 0,   open: 100, high: 105, low: 98,  close: 102 },
  { time: 100, open: 102, high: 108, low: 100, close: 105, label: { text: 'Earnings', background: '#f0c040', color: '#000' } },
  { time: 200, open: 105, high: 110, low: 103, close: 107 },
  { time: 300, open: 107, high: 112, low: 105, close: 109 },
];

const BARS_NO_LABELS = [
  { time: 0,   open: 100, high: 105, low: 98,  close: 102 },
  { time: 100, open: 102, high: 108, low: 100, close: 105 },
];

function setup(showLabels = true) {
  const container = makeContainer();
  const bus = new EventBus<RendererEvents>();
  const renderer = new Renderer(container, bus, { showLabels });
  bus.emit('series:add', { id: 's1', type: 'candlestick' });
  bus.emit('viewport:changed', VIEWPORT);
  return { container, bus, renderer };
}

describe('Bar Labels', () => {
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

  // display_label_indicator_on_labeled_bar
  it('display label indicator on labeled bar', () => {
    const { container, bus } = setup(true);
    bus.emit('series:data', { id: 's1', bars: BARS_WITH_LABEL });

    const group = container.querySelector('[data-series-id="s1"]')!;
    const indicator = group.querySelector('[data-label-indicator]');
    expect(indicator).not.toBeNull();
  });

  // hide_label_indicators_when_showlabels_is_disabled
  it('hide label indicators when showLabels is disabled', () => {
    const { container, bus } = setup(false);
    bus.emit('series:data', { id: 's1', bars: BARS_WITH_LABEL });

    const group = container.querySelector('[data-series-id="s1"]')!;
    const indicator = group.querySelector('[data-label-indicator]');
    expect(indicator).toBeNull();
  });

  // show_label_text_with_background_in_crosshair_tooltip
  it('show label text with background in crosshair tooltip', () => {
    const { container, bus } = setup(true);
    bus.emit('series:data', { id: 's1', bars: BARS_WITH_LABEL });

    const svg = container.querySelector('svg')!;
    // Bar at time=100 maps to x=200 in [0,400] -> [0,800]
    svg.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 300, buttons: 0, bubbles: true }));

    const crosshair = container.querySelector('.crosshair-layer')!;
    const allText = [...crosshair.querySelectorAll('text')].map(t => t.textContent ?? '').join(' ');
    expect(allText).toContain('Earnings');

    // Background rect should be present
    const rects = crosshair.querySelectorAll('rect[data-label-bg]');
    expect(rects.length).toBeGreaterThan(0);
  });

  // label_background_color_comes_from_bar_data
  it('label background color comes from bar data', () => {
    const { container, bus } = setup(true);
    const bars = [
      { time: 0,   open: 100, high: 105, low: 98,  close: 102 },
      { time: 100, open: 102, high: 108, low: 100, close: 105, label: { text: 'Buy signal', background: '#26a69a', color: '#fff' } },
    ];
    bus.emit('series:data', { id: 's1', bars });

    const svg = container.querySelector('svg')!;
    svg.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 300, buttons: 0, bubbles: true }));

    const crosshair = container.querySelector('.crosshair-layer')!;
    const bgRect = crosshair.querySelector('rect[data-label-bg]');
    expect(bgRect).not.toBeNull();
    expect(bgRect!.getAttribute('fill')).toBe('#26a69a');

    const labelText = crosshair.querySelector('text[data-label-text]');
    expect(labelText).not.toBeNull();
    expect(labelText!.getAttribute('fill')).toBe('#fff');
  });

  // bars_without_labels_show_no_indicator
  it('bars without labels show no indicator', () => {
    const { container, bus } = setup(true);
    bus.emit('series:data', { id: 's1', bars: BARS_NO_LABELS });

    const group = container.querySelector('[data-series-id="s1"]')!;
    const indicators = group.querySelectorAll('[data-label-indicator]');
    expect(indicators.length).toBe(0);
  });
});
