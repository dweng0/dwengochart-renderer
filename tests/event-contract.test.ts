import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventBus } from '@yatamazuki/typed-eventbus';
import type { RendererEvents } from '../src/index';
import { Renderer } from '../src/index';

describe('Event Contract', () => {
  let container: HTMLElement;
  let eventbus: EventBus<RendererEvents>;
  let renderer: Renderer;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    eventbus = new EventBus<RendererEvents>();
    renderer = new Renderer(container, eventbus);
  });

  afterEach(() => {
    renderer.destroy();
    document.body.removeChild(container);
  });

  // listen_to_seriesadd_event
  it('listen to series:add event', () => {
    eventbus.emit('series:add', { id: 's1', type: 'candlestick', options: {} });
    const group = container.querySelector('[data-series-id="s1"]');
    expect(group).not.toBeNull();
    expect(group!.tagName.toLowerCase()).toBe('g');
  });

  // listen_to_seriesupdate_event
  it('listen to series:update event', () => {
    eventbus.emit('series:add', { id: 's1', type: 'line', options: { color: 'green' } });
    const group = container.querySelector('[data-series-id="s1"]') as SVGGElement;
    expect(group.getAttribute('data-color')).toBe('green');

    eventbus.emit('series:update', { id: 's1', options: { color: 'blue' } });
    expect(group.getAttribute('data-color')).toBe('blue');
  });

  // listen_to_themechanged_event
  it('listen to theme:changed event', () => {
    eventbus.emit('theme:changed', {
      theme: { background: '#000', text: '#fff', grid: '#333' },
    });
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('data-theme-background')).toBe('#000');
    expect(svg.getAttribute('data-theme-text')).toBe('#fff');
    expect(svg.getAttribute('data-theme-grid')).toBe('#333');
  });

  // listen_to_chartloading_event
  it('listen to chart:loading event', () => {
    eventbus.emit('chart:loading', { loading: true });
    expect(container.querySelector('.loading-indicator')).not.toBeNull();

    eventbus.emit('chart:loading', { loading: false });
    expect(container.querySelector('.loading-indicator')).toBeNull();
  });

  // listen_to_charterror_event
  it('listen to chart:error event', () => {
    eventbus.emit('chart:error', { message: 'Failed to load' });
    const errorEl = container.querySelector('.error-message');
    expect(errorEl).not.toBeNull();
    expect(errorEl!.textContent).toBe('Failed to load');

    eventbus.emit('chart:error', null);
    expect(container.querySelector('.error-message')).toBeNull();
  });

  // listen_to_symbolresolved_event_for_watermark_and_metadata
  it('listen to symbol:resolved event for watermark and metadata', () => {
    eventbus.emit('symbol:resolved', {
      symbol: { name: 'AAPL', currency_code: 'USD', timezone: 'America/New_York' },
    });
    const watermark = container.querySelector('.watermark');
    expect(watermark).not.toBeNull();
    expect(watermark!.textContent).toBe('AAPL');
    const priceAxis = container.querySelector('.price-axis');
    expect(priceAxis?.getAttribute('data-currency')).toBe('USD');
    const timeAxis = container.querySelector('.time-axis');
    expect(timeAxis?.getAttribute('data-timezone')).toBe('America/New_York');
  });

  // listen_to_viewportchanged_event
  it('listen to viewport:changed event', () => {
    eventbus.emit('series:add', { id: 's1', type: 'candlestick' });
    eventbus.emit('series:data', {
      id: 's1',
      bars: [
        { time: 1000, open: 100, high: 110, low: 90, close: 105 },
        { time: 5000, open: 105, high: 115, low: 95, close: 98 },
      ],
    });

    eventbus.emit('viewport:changed', { timeRange: [1000, 5000], priceRange: [50, 150] });

    // Scales are updated — bars should be re-rendered with mapped coordinates
    const group = container.querySelector('[data-series-id="s1"]')!;
    const bars = group.querySelectorAll('.bar');
    expect(bars.length).toBe(2);
    // First bar at time=1000 should map to x=0 (start of range)
    expect(bars[0].getAttribute('data-x')).toBe('0');
  });

  // listen_to_seriesdata_event
  it('listen to series:data event', () => {
    eventbus.emit('series:add', { id: 's1', type: 'candlestick' });
    eventbus.emit('series:data', {
      id: 's1',
      bars: [
        { time: 1000, open: 100, high: 110, low: 90, close: 105 },
        { time: 2000, open: 105, high: 115, low: 95, close: 98 },
        { time: 3000, open: 98,  high: 108, low: 88, close: 102 },
      ],
    });
    const group = container.querySelector('[data-series-id="s1"]')!;
    const bars = group.querySelectorAll('.bar');
    expect(bars.length).toBe(3);
  });

  // listen_to_seriesorder_event
  it('listen to series:order event', () => {
    eventbus.emit('series:add', { id: 's1', type: 'line' });
    eventbus.emit('series:add', { id: 's2', type: 'line' });
    eventbus.emit('series:add', { id: 's3', type: 'line' });

    eventbus.emit('series:order', { ids: ['s3', 's1', 's2'] });

    const groups = container.querySelectorAll('[data-series-id]');
    expect([...groups].map((g) => g.getAttribute('data-series-id'))).toEqual(['s3', 's1', 's2']);
  });

  // listen_to_seriestype_event
  it('listen to series:type event', () => {
    eventbus.emit('series:add', { id: 's1', type: 'line' });
    const group = container.querySelector('[data-series-id="s1"]') as SVGGElement;
    expect(group.getAttribute('data-type')).toBe('line');

    eventbus.emit('series:type', { id: 's1', type: 'area' });
    expect(group.getAttribute('data-type')).toBe('area');
  });

  // listen_to_seriesshow_event
  it('listen to series:show event', () => {
    eventbus.emit('series:add', { id: 's1', type: 'line' });
    eventbus.emit('series:hide', { id: 's1' });
    const group = container.querySelector('[data-series-id="s1"]') as SVGGElement;
    expect(group.getAttribute('display')).toBe('none');

    eventbus.emit('series:show', { id: 's1' });
    expect(group.getAttribute('display')).toBeNull();
  });

  // listen_to_serieshide_event
  it('listen to series:hide event', () => {
    eventbus.emit('series:add', { id: 's1', type: 'line' });
    const group = container.querySelector('[data-series-id="s1"]') as SVGGElement;
    expect(group.getAttribute('display')).toBeNull();

    eventbus.emit('series:hide', { id: 's1' });
    expect(group.getAttribute('display')).toBe('none');
  });

  // listen_to_seriesremove_event
  it('listen to series:remove event', () => {
    eventbus.emit('series:add', { id: 's1', type: 'candlestick' });
    expect(container.querySelector('[data-series-id="s1"]')).not.toBeNull();

    eventbus.emit('series:remove', { id: 's1' });
    expect(container.querySelector('[data-series-id="s1"]')).toBeNull();
  });
});
