// @dwengochart/renderer
// SVG rendering library for financial charts

import { EventBus } from '@yatamazuki/typed-eventbus';
import { scaleLinear } from 'd3-scale';

export interface SeriesOptions {
  color?: string;
  [key: string]: unknown;
}

export interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface SymbolInfo {
  name: string;
  currency_code?: string;
  timezone?: string;
  [key: string]: unknown;
}

export interface Theme {
  background?: string;
  text?: string;
  grid?: string;
  [key: string]: unknown;
}

export type InteractionPoint = { price: number; time: number; x: number; y: number };

export type RendererEvents = {
  // Inbound (from core)
  'series:add': { id: string; type: string; options?: SeriesOptions };
  'series:remove': { id: string };
  'series:update': { id: string; options: Partial<SeriesOptions> };
  'series:show': { id: string };
  'series:hide': { id: string };
  'series:type': { id: string; type: string };
  'series:order': { ids: string[] };
  'series:data': { id: string; bars: Bar[] };
  'viewport:changed': {
    timeRange: [number, number];
    priceRange: [number, number];
    priceScale?: 'linear' | 'logarithmic' | 'percentage';
    basePrice?: number;
  };
  'symbol:resolved': { symbol: SymbolInfo };
  'chart:loading': { loading: boolean; region?: 'left' | 'center' };
  'chart:error': { message: string } | null;
  'theme:changed': { theme: Theme };
  // Outbound (emitted by renderer)
  'interaction:crosshair': InteractionPoint | null;
  'interaction:click': InteractionPoint;
  'interaction:pan': { deltaX: number };
  'interaction:zoom': { delta: number; centerX: number };
  'interaction:fit': Record<string, never>;
  'renderer:ready': Record<string, never>;
  'renderer:destroyed': Record<string, never>;
};

// Default pixel dimensions (updated by resize handling in a later scenario)
const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;

export class Renderer {
  private svg: SVGSVGElement;
  private seriesLayer: SVGGElement;
  private unsubscribers: (() => void)[] = [];

  private scaleX = scaleLinear().range([0, DEFAULT_WIDTH]);
  private scaleY = scaleLinear().range([DEFAULT_HEIGHT, 0]);
  private seriesBars = new Map<string, Bar[]>();
  private watermarkEl: SVGTextElement;
  private priceAxisEl: SVGGElement;
  private timeAxisEl: SVGGElement;
  private dragStartX: number | null = null;
  private domListeners: Array<{ el: Element; type: string; fn: EventListener }> = [];
  private eventbus: EventBus<RendererEvents>;

  constructor(container: HTMLElement, eventbus: EventBus<RendererEvents>) {
    this.eventbus = eventbus;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    container.appendChild(svg);
    this.svg = svg;

    const seriesLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    seriesLayer.setAttribute('class', 'series-layer');
    svg.appendChild(seriesLayer);
    this.seriesLayer = seriesLayer;

    const watermark = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    watermark.setAttribute('class', 'watermark');
    svg.appendChild(watermark);
    this.watermarkEl = watermark;

    const priceAxis = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    priceAxis.setAttribute('class', 'price-axis');
    svg.appendChild(priceAxis);
    this.priceAxisEl = priceAxis;

    const timeAxis = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    timeAxis.setAttribute('class', 'time-axis');
    svg.appendChild(timeAxis);
    this.timeAxisEl = timeAxis;

    this.bindDomEvents(eventbus);
    eventbus.emit('renderer:ready', {});

    this.unsubscribers.push(
      eventbus.on('series:add', (payload) => {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('data-series-id', payload.id);
        group.setAttribute('data-type', payload.type);
        if (payload.options?.color) {
          group.setAttribute('data-color', payload.options.color as string);
        }
        this.seriesLayer.appendChild(group);
      }),
      eventbus.on('series:update', (payload) => {
        const group = this.seriesLayer.querySelector(`[data-series-id="${payload.id}"]`);
        if (!group) return;
        if (payload.options.color) {
          group.setAttribute('data-color', payload.options.color as string);
        }
      }),
      eventbus.on('series:order', (payload) => {
        for (const id of payload.ids) {
          const group = this.seriesLayer.querySelector(`[data-series-id="${id}"]`);
          if (group) this.seriesLayer.appendChild(group);
        }
      }),
      eventbus.on('series:type', (payload) => {
        const group = this.seriesLayer.querySelector(`[data-series-id="${payload.id}"]`);
        group?.setAttribute('data-type', payload.type);
      }),
      eventbus.on('series:show', (payload) => {
        const group = this.seriesLayer.querySelector(`[data-series-id="${payload.id}"]`);
        group?.removeAttribute('display');
      }),
      eventbus.on('series:hide', (payload) => {
        const group = this.seriesLayer.querySelector(`[data-series-id="${payload.id}"]`);
        group?.setAttribute('display', 'none');
      }),
      eventbus.on('series:data', (payload) => {
        this.seriesBars.set(payload.id, payload.bars);
        this.renderSeries(payload.id, payload.bars);
      }),
      eventbus.on('viewport:changed', (payload) => {
        this.scaleX.domain(payload.timeRange);
        this.scaleY.domain(payload.priceRange);
        // Re-render all series with updated scales
        for (const [id, bars] of this.seriesBars) {
          this.renderSeries(id, bars);
        }
      }),
      eventbus.on('theme:changed', (payload) => {
        const { theme } = payload;
        if (theme.background) this.svg.setAttribute('data-theme-background', theme.background as string);
        if (theme.text) this.svg.setAttribute('data-theme-text', theme.text as string);
        if (theme.grid) this.svg.setAttribute('data-theme-grid', theme.grid as string);
      }),
      eventbus.on('chart:loading', (payload) => {
        const existing = this.svg.querySelector('.loading-indicator');
        if (payload.loading && !existing) {
          const el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          el.setAttribute('class', 'loading-indicator');
          this.svg.appendChild(el);
        } else if (!payload.loading && existing) {
          existing.remove();
        }
      }),
      eventbus.on('chart:error', (payload) => {
        const existing = this.svg.querySelector('.error-message');
        existing?.remove();
        if (payload) {
          const el = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          el.setAttribute('class', 'error-message');
          el.textContent = payload.message;
          this.svg.appendChild(el);
        }
      }),
      eventbus.on('symbol:resolved', (payload) => {
        this.watermarkEl.textContent = payload.symbol.name;
        if (payload.symbol.currency_code) {
          this.priceAxisEl.setAttribute('data-currency', payload.symbol.currency_code);
        }
        if (payload.symbol.timezone) {
          this.timeAxisEl.setAttribute('data-timezone', payload.symbol.timezone);
        }
      }),
      eventbus.on('series:remove', (payload) => {
        this.seriesBars.delete(payload.id);
        const group = this.seriesLayer.querySelector(`[data-series-id="${payload.id}"]`);
        group?.remove();
      }),
    );
  }

  private renderSeries(id: string, bars: Bar[]): void {
    const group = this.seriesLayer.querySelector(`[data-series-id="${id}"]`);
    if (!group) return;
    while (group.firstChild) group.removeChild(group.firstChild);
    for (const bar of bars) {
      const barEl = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      barEl.setAttribute('class', 'bar');
      barEl.setAttribute('data-x', String(Math.round(this.scaleX(bar.time))));
      barEl.setAttribute('data-y-open', String(Math.round(this.scaleY(bar.open))));
      barEl.setAttribute('data-y-close', String(Math.round(this.scaleY(bar.close))));
      barEl.setAttribute('data-y-high', String(Math.round(this.scaleY(bar.high))));
      barEl.setAttribute('data-y-low', String(Math.round(this.scaleY(bar.low))));
      group.appendChild(barEl);
    }
  }

  private bindDomEvents(eventbus: EventBus<RendererEvents>): void {
    const rect = () => this.svg.getBoundingClientRect();

    const toPoint = (e: MouseEvent): InteractionPoint => {
      const r = rect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      return { x, y, time: this.scaleX.invert(x), price: this.scaleY.invert(y) };
    };

    const onMouseMove = ((e: Event) => {
      const me = e as MouseEvent;
      if (me.buttons === 1 && this.dragStartX !== null) {
        const deltaX = me.clientX - this.dragStartX;
        this.dragStartX = me.clientX;
        eventbus.emit('interaction:pan', { deltaX });
      } else {
        eventbus.emit('interaction:crosshair', toPoint(me));
      }
    }) as EventListener;

    const onMouseDown = ((e: Event) => {
      this.dragStartX = (e as MouseEvent).clientX;
    }) as EventListener;

    const onMouseUp = (() => {
      this.dragStartX = null;
    }) as EventListener;

    const onClick = ((e: Event) => {
      eventbus.emit('interaction:click', toPoint(e as MouseEvent));
    }) as EventListener;

    const onDblClick = (() => {
      eventbus.emit('interaction:fit', {});
    }) as EventListener;

    const onWheel = ((e: Event) => {
      const we = e as WheelEvent;
      const r = rect();
      eventbus.emit('interaction:zoom', { delta: we.deltaY, centerX: we.clientX - r.left });
    }) as EventListener;

    const listeners: Array<{ el: Element; type: string; fn: EventListener }> = [
      { el: this.svg, type: 'mousemove', fn: onMouseMove },
      { el: this.svg, type: 'mousedown', fn: onMouseDown },
      { el: this.svg, type: 'mouseup', fn: onMouseUp },
      { el: this.svg, type: 'click', fn: onClick },
      { el: this.svg, type: 'dblclick', fn: onDblClick },
      { el: this.svg, type: 'wheel', fn: onWheel },
    ];

    for (const { el, type, fn } of listeners) {
      el.addEventListener(type, fn);
    }
    this.domListeners = listeners;
  }

  destroy(): void {
    for (const { el, type, fn } of this.domListeners) {
      el.removeEventListener(type, fn);
    }
    this.domListeners = [];
    this.unsubscribers.forEach((fn) => fn());
    this.unsubscribers = [];
    this.seriesBars.clear();
    this.svg.remove();
    this.eventbus.emit('renderer:destroyed', {});
  }
}
