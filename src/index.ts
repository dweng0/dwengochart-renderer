// @dwengochart/renderer
// SVG rendering library for financial charts

import { EventBus } from '@yatamazuki/typed-eventbus';

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

export class Renderer {
  private svg: SVGSVGElement;
  private seriesLayer: SVGGElement;
  private unsubscribers: (() => void)[] = [];

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

    this.unsubscribers.push(
      eventbus.on('series:add', (payload) => {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('data-series-id', payload.id);
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
      eventbus.on('series:show', (payload) => {
        const group = this.seriesLayer.querySelector(`[data-series-id="${payload.id}"]`);
        group?.removeAttribute('display');
      }),
      eventbus.on('series:hide', (payload) => {
        const group = this.seriesLayer.querySelector(`[data-series-id="${payload.id}"]`);
        group?.setAttribute('display', 'none');
      }),
      eventbus.on('series:remove', (payload) => {
        const group = this.seriesLayer.querySelector(`[data-series-id="${payload.id}"]`);
        group?.remove();
      }),
    );
  }

  destroy(): void {
    this.unsubscribers.forEach((fn) => fn());
    this.unsubscribers = [];
    this.svg.remove();
  }
}
