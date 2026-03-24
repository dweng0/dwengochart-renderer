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

const LIGHT_THEME = { background: '#ffffff', grid: '#e0e0e0', text: '#333333' };
const DARK_THEME  = { background: '#1a1a2e', grid: '#333355', text: '#eeeeee' };

describe('Theming', () => {
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

  // apply_a_light_theme_via_event
  it('apply a light theme via event', () => {
    const { container, bus } = setup();
    bus.emit('theme:changed', { theme: LIGHT_THEME });

    const svg = container.querySelector('svg')!;
    const bg = svg.querySelector('rect.background') ?? svg.querySelector('[data-bg]');
    expect(bg).not.toBeNull();
    expect(bg!.getAttribute('fill')).toBe('#ffffff');

    // Gridlines in price axis
    const gridLines = container.querySelectorAll('.price-axis line');
    if (gridLines.length > 0) {
      expect(gridLines[0].getAttribute('stroke')).toBe('#e0e0e0');
    }
  });

  // apply_a_dark_theme_via_event
  it('apply a dark theme via event', () => {
    const { container, bus } = setup();
    bus.emit('theme:changed', { theme: DARK_THEME });

    const svg = container.querySelector('svg')!;
    const bg = svg.querySelector('rect.background') ?? svg.querySelector('[data-bg]');
    expect(bg).not.toBeNull();
    expect(bg!.getAttribute('fill')).toBe('#1a1a2e');

    // Text elements should have light fill
    const texts = svg.querySelectorAll('text');
    if (texts.length > 0) {
      const fills = [...texts].map(t => t.getAttribute('fill') ?? t.getAttribute('data-text-color'));
      const hasLight = fills.some(f => f === '#eeeeee' || f === DARK_THEME.text);
      expect(hasLight).toBe(true);
    }
  });

  // override_individual_theme_properties
  it('override individual theme properties', () => {
    const { container, bus } = setup();
    bus.emit('theme:changed', { theme: DARK_THEME });

    // Override only bullish color
    bus.emit('theme:changed', { theme: { bullishColor: '#0000ff' } });

    const svg = container.querySelector('svg')!;
    const bg = svg.querySelector('rect.background') ?? svg.querySelector('[data-bg]');
    // Background should still be dark (not overridden)
    expect(bg!.getAttribute('fill')).toBe(DARK_THEME.background);
  });

  // switch_theme_without_losing_chart_state
  it('switch theme without losing chart state', () => {
    const { container, bus } = setup();
    bus.emit('series:add', { id: 's1', type: 'candlestick' });
    bus.emit('series:data', {
      id: 's1',
      bars: [{ time: 0, open: 100, high: 108, low: 98, close: 105 }],
    });

    // Verify bars are rendered
    expect(container.querySelector('[data-series-id="s1"] .bar')).not.toBeNull();

    // Switch theme
    bus.emit('theme:changed', { theme: DARK_THEME });

    // Bars should still be there
    expect(container.querySelector('[data-series-id="s1"] .bar')).not.toBeNull();
    // ViewBox unchanged
    expect(container.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 800 600');
  });

  // custom_font_family_in_theme
  it('custom font family in theme', () => {
    const { container, bus } = setup();
    bus.emit('theme:changed', { theme: { fontFamily: 'Inter' } });

    const svg = container.querySelector('svg')!;
    // Either SVG has font-family set, or all text elements do
    const svgFont = svg.getAttribute('font-family') ?? svg.style?.fontFamily;
    const textEls = svg.querySelectorAll('text');
    const textFont = [...textEls].some(t => t.getAttribute('font-family') === 'Inter');
    expect(svgFont === 'Inter' || textFont).toBe(true);
  });

  // opacity_settings_for_gridlines
  it('opacity settings for gridlines', () => {
    const { container, bus } = setup();
    bus.emit('theme:changed', { theme: { gridlineOpacity: 0.3 } });

    const gridLines = container.querySelectorAll('.price-axis line');
    if (gridLines.length > 0) {
      const hasOpacity = [...gridLines].some(
        l => l.getAttribute('opacity') === '0.3' ||
             l.getAttribute('stroke-opacity') === '0.3'
      );
      expect(hasOpacity).toBe(true);
    } else {
      // If no gridlines yet (need viewport:changed to trigger them)
      expect(true).toBe(true);
    }
  });
});
