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

  // listen_to_seriesremove_event
  it('listen to series:remove event', () => {
    eventbus.emit('series:add', { id: 's1', type: 'candlestick' });
    expect(container.querySelector('[data-series-id="s1"]')).not.toBeNull();

    eventbus.emit('series:remove', { id: 's1' });
    expect(container.querySelector('[data-series-id="s1"]')).toBeNull();
  });
});
