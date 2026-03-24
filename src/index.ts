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

export type RendererEvents = {
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

  constructor(container: HTMLElement, eventbus: EventBus<RendererEvents>) {
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

  destroy(): void {
    this.unsubscribers.forEach((fn) => fn());
    this.unsubscribers = [];
    this.seriesBars.clear();
    this.svg.remove();
  }
}
