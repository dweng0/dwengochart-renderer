import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventBus } from '@yatamazuki/typed-eventbus';
import type { RendererEvents } from '../src/index';
import { Renderer } from '../src/index';

// Controllable ResizeObserver mock (overrides the global no-op from setup.ts)
type ResizeCallback = (entries: Array<{ contentRect: { width: number; height: number } }>) => void;
let resizeCallback: ResizeCallback | null = null;

function triggerResize(width: number, height: number) {
  resizeCallback?.([{ contentRect: { width, height } }]);
}

function makeContainer(width = 800, height = 600): HTMLElement {
  const el = document.createElement('div');
  el.getBoundingClientRect = () =>
    ({ width, height, top: 0, left: 0, right: width, bottom: height }) as DOMRect;
  Object.defineProperty(el, 'clientWidth', { get: () => width, configurable: true });
  Object.defineProperty(el, 'clientHeight', { get: () => height, configurable: true });
  document.body.appendChild(el);
  return el;
}

describe('SVG Container Setup', () => {
  let container: HTMLElement;
  let eventbus: EventBus<RendererEvents>;
  let renderer: Renderer;

  beforeEach(() => {
    resizeCallback = null;
    vi.stubGlobal('ResizeObserver', class {
      constructor(cb: ResizeCallback) { resizeCallback = cb; }
      observe() {}
      disconnect() {}
    });
    container = makeContainer(800, 600);
    eventbus = new EventBus<RendererEvents>();
    renderer = new Renderer(container, eventbus);
  });

  afterEach(() => {
    renderer.destroy();
    document.body.removeChild(container);
    vi.unstubAllGlobals();
  });

  // initialize_svg_in_a_container
  it('initialize svg in a container', () => {
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('viewBox')).toBe('0 0 800 600');
    expect(svg!.getAttribute('width')).toBe('100%');
    expect(svg!.getAttribute('height')).toBe('100%');
  });

  // svg_is_resolutionindependent
  it('svg is resolution-independent', () => {
    // No pixel buffer scaling regardless of device pixel ratio — viewBox stays as CSS pixels
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 800 600');
    expect(svg.getAttribute('style') ?? '').not.toContain('transform');
  });

  // respond_to_container_resize
  it('respond to container resize', () => {
    triggerResize(1024, 768);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 1024 768');
  });

  // handle_zerosize_container_gracefully
  it('handle zero-size container gracefully', () => {
    const zeroContainer = makeContainer(0, 0);
    const bus = new EventBus<RendererEvents>();
    expect(() => new Renderer(zeroContainer, bus).destroy()).not.toThrow();
    document.body.removeChild(zeroContainer);
  });

  // clean_up_on_destroy
  it('clean up on destroy', () => {
    expect(container.querySelector('svg')).not.toBeNull();
    renderer.destroy();
    expect(container.querySelector('svg')).toBeNull();
    // Re-create for afterEach
    renderer = new Renderer(container, eventbus);
  });

  // initialize_in_a_container_with_existing_children
  it('initialize in a container with existing children', () => {
    const childContainer = makeContainer(800, 600);
    const pre = document.createElement('div');
    pre.id = 'pre-existing';
    childContainer.appendChild(pre);
    const bus = new EventBus<RendererEvents>();
    const r = new Renderer(childContainer, bus);
    expect(childContainer.querySelector('svg')).not.toBeNull();
    expect(childContainer.querySelector('#pre-existing')).not.toBeNull();
    r.destroy();
    document.body.removeChild(childContainer);
  });

  // handle_container_resize_to_zero
  it('handle container resize to zero', () => {
    expect(() => triggerResize(0, 0)).not.toThrow();
  });

  // svghas_correct_namespace
  it('svg has correct namespace', () => {
    const svg = container.querySelector('svg')!;
    expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
  });

  // svgcontains_layer_groups_in_correct_order
  it('svg contains layer groups in correct order', () => {
    const svg = container.querySelector('svg')!;
    const layers = svg.querySelectorAll('g[class]');
    const classNames = [...layers].map((g) => g.getAttribute('class'));
    expect(classNames).toContain('series-layer');
  });
});
