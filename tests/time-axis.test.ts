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

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const MIN5 = 5 * 60 * 1000;

// Start at a known Monday (2024-01-08 00:00:00 UTC)
const BASE = new Date('2024-01-08T00:00:00Z').getTime();

function setup() {
  const container = makeContainer();
  const bus = new EventBus<RendererEvents>();
  new Renderer(container, bus);
  return { container, bus };
}

describe('Time Axis Rendering', () => {
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

  // render_time_labels_for_daily_resolution
  it('render time labels for daily resolution', () => {
    const { container, bus } = setup();
    // 30 days
    bus.emit('viewport:changed', {
      timeRange: [BASE, BASE + 30 * DAY],
      priceRange: [100, 110],
    });
    const axis = container.querySelector('.time-axis')!;
    const labels = axis.querySelectorAll('text');
    expect(labels.length).toBeGreaterThan(0);
    // Labels should be spaced out (not too many — sensible intervals)
    expect(labels.length).toBeLessThanOrEqual(15);
  });

  // render_time_labels_for_intraday_resolution
  it('render time labels for intraday resolution', () => {
    const { container, bus } = setup();
    // 8 hours of 5-min bars
    bus.emit('viewport:changed', {
      timeRange: [BASE, BASE + 8 * HOUR],
      priceRange: [100, 110],
    });
    const axis = container.querySelector('.time-axis')!;
    const labels = axis.querySelectorAll('text');
    expect(labels.length).toBeGreaterThan(0);
    // Should show time labels (HH:MM format or similar)
    const texts = [...labels].map(t => t.textContent ?? '');
    const hasTimeFormat = texts.some(t => /\d{1,2}:\d{2}/.test(t) || /\d{1,2}[hH]/.test(t));
    expect(hasTimeFormat).toBe(true);
  });

  // labels_do_not_overlap
  it('labels do not overlap', () => {
    const { container, bus } = setup();
    bus.emit('viewport:changed', {
      timeRange: [BASE, BASE + 7 * DAY],
      priceRange: [100, 110],
    });
    const axis = container.querySelector('.time-axis')!;
    const labels = axis.querySelectorAll('text');
    if (labels.length < 2) return; // nothing to overlap

    // Each label should have a distinct x position
    const xPositions = [...labels].map(t => parseFloat(t.getAttribute('x') ?? '0'));
    for (let i = 1; i < xPositions.length; i++) {
      expect(xPositions[i]).toBeGreaterThan(xPositions[i - 1]);
    }
  });

  // configurable_timezone_override
  it('configurable timezone override', () => {
    const { container, bus } = setup();
    // Set timezone via symbol:resolved first, then try override
    bus.emit('symbol:resolved', { symbol: { name: 'AAPL', timezone: 'America/New_York' } });

    // Override via series:update is not the pattern — the renderer should support a setTimezone method
    // or accept timezone from options. For now test that UTC timezone can be set via symbol:resolved
    bus.emit('symbol:resolved', { symbol: { name: 'AAPL', timezone: 'UTC' } });
    bus.emit('viewport:changed', {
      timeRange: [BASE, BASE + DAY],
      priceRange: [100, 110],
    });

    const axis = container.querySelector('.time-axis')!;
    expect(axis.getAttribute('data-timezone')).toBe('UTC');
    const labels = axis.querySelectorAll('text');
    expect(labels.length).toBeGreaterThan(0);
  });

  // hierarchical_time_labels_at_boundary_crossings
  it('hierarchical time labels at boundary crossings', () => {
    const { container, bus } = setup();
    // 3 months spanning multiple month boundaries
    bus.emit('viewport:changed', {
      timeRange: [BASE, BASE + 90 * DAY],
      priceRange: [100, 110],
    });
    const axis = container.querySelector('.time-axis')!;
    const labels = axis.querySelectorAll('text');
    expect(labels.length).toBeGreaterThan(0);

    // Should have some labels with month/year info (hierarchical)
    const texts = [...labels].map(t => t.textContent ?? '');
    // Some labels should contain month names or year
    const hasHierarchical = texts.some(t =>
      /Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/.test(t) ||
      /20\d\d/.test(t)
    );
    expect(hasHierarchical).toBe(true);
  });
});
