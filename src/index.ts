// @dwengochart/renderer
// SVG rendering library for financial charts

import { EventBus } from '@yatamazuki/typed-eventbus';
import { scaleLinear, scaleLog } from 'd3-scale';
import { line, area, curveLinear, curveCardinal } from 'd3-shape';

export interface SeriesOptions {
  color?: string;
  strokeWidth?: number;
  smooth?: number;
  gradient?: boolean;
  baseline?: number;
  borderWidth?: number;
  borderColor?: string;
  heightPercent?: number;
  [key: string]: unknown;
}

export interface BarLabel {
  text: string;
  color?: string;
  background?: string;
}

export interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  label?: BarLabel;
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


export interface RendererOptions {
  watermark?: boolean;
  showLabels?: boolean;
}

export class Renderer {
  private svg: SVGSVGElement;
  private bgRectEl: SVGRectElement;
  private seriesLayer: SVGGElement;
  private unsubscribers: (() => void)[] = [];

  private scaleX = scaleLinear<number, number>();
  private scaleY: ReturnType<typeof scaleLinear<number, number>> | ReturnType<typeof scaleLog<number, number>> = scaleLinear<number, number>();
  private seriesBars = new Map<string, Bar[]>();
  private seriesSmooth = new Map<string, number>();
  private watermarkEl: SVGTextElement;
  private watermarkEnabled: boolean;
  private showLabels: boolean;
  private priceAxisEl: SVGGElement;
  private timeAxisEl: SVGGElement;
  private dragStartX: number | null = null;
  private dragTotalDelta = 0;
  private dragVelocityX = 0;
  private kineticTimer: ReturnType<typeof setTimeout> | null = null;
  private touchStartX: number | null = null;
  private priceAxisDragStartY: number | null = null;
  private currencySymbol = '';
  private lastClosePrice: number | null = null;
  private crosshairEl: SVGGElement;
  private crosshairDashed = false;
  private naturalScrolling = false;
  private currentTheme: Record<string, unknown> = {};
  private _onVisibilityChange: (() => void) | null = null;
  private _tabHidden = false;
  private _rafPending = false;
  private _rafId: number | null = null;
  private _dirtySeriesIds = new Set<string>();
  private _allDirty = false;
  private _lastPinchDist: number | null = null;
  private magnetMode = false;
  private domListeners: Array<{ el: Element; type: string; fn: EventListener }> = [];
  private eventbus: EventBus<RendererEvents>;
  private resizeObserver: ResizeObserver;
  private viewWidth = 0;
  private viewHeight = 0;
  private margins = { left: 0, right: 0, top: 0, bottom: 0 };
  private currentPriceScale: 'linear' | 'logarithmic' | 'percentage' = 'linear';
  private basePrice = 1;
  private viewportSet = false;

  constructor(container: HTMLElement, eventbus: EventBus<RendererEvents>, options?: RendererOptions) {
    this.eventbus = eventbus;
    this.watermarkEnabled = options?.watermark !== false;
    this.showLabels = options?.showLabels ?? false;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    container.appendChild(svg);
    this.svg = svg;

    // Background rect (first child — behind everything)
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('class', 'background');
    bgRect.setAttribute('data-bg', '');
    bgRect.setAttribute('width', '100%');
    bgRect.setAttribute('height', '100%');
    bgRect.setAttribute('fill', '#000000');
    svg.appendChild(bgRect);
    this.bgRectEl = bgRect;

    // Watermark (behind series layer)
    const watermark = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    watermark.setAttribute('class', 'watermark');
    svg.appendChild(watermark);
    this.watermarkEl = watermark;

    // Set initial viewBox from container size
    const { width, height } = container.getBoundingClientRect();
    this.updateSize(width || 0, height || 0);

    // Watch for container resize
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        this.updateSize(w, h);
      }
    });
    this.resizeObserver.observe(container);

    const seriesLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    seriesLayer.setAttribute('class', 'series-layer');
    svg.appendChild(seriesLayer);
    this.seriesLayer = seriesLayer;

    const priceAxis = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    priceAxis.setAttribute('class', 'price-axis');
    svg.appendChild(priceAxis);
    this.priceAxisEl = priceAxis;

    const timeAxis = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    timeAxis.setAttribute('class', 'time-axis');
    svg.appendChild(timeAxis);
    this.timeAxisEl = timeAxis;

    const crosshair = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    crosshair.setAttribute('class', 'crosshair-layer');
    crosshair.setAttribute('display', 'none');
    svg.appendChild(crosshair);
    this.crosshairEl = crosshair;

    this.bindDomEvents(eventbus);

    // Pause rendering when tab hidden; resume on visibility restored
    this._onVisibilityChange = () => {
      if (document.hidden) {
        this._tabHidden = true;
      } else {
        this._tabHidden = false;
        this._allDirty = true;
        this._flushRender();
      }
    };
    document.addEventListener('visibilitychange', this._onVisibilityChange);

    eventbus.emit('renderer:ready', {});

    this.unsubscribers.push(
      eventbus.on('series:add', (payload) => {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('data-series-id', payload.id);
        group.setAttribute('data-type', payload.type);
        if (payload.options?.color) {
          group.setAttribute('data-color', payload.options.color as string);
        }
        if (payload.options?.strokeWidth !== undefined) {
          group.setAttribute('data-stroke-width', String(payload.options.strokeWidth));
        }
        if (payload.options?.smooth !== undefined) {
          group.setAttribute('data-smooth', String(payload.options.smooth));
          this.seriesSmooth.set(payload.id, payload.options.smooth);
        }
        if (payload.options?.gradient) {
          group.setAttribute('data-gradient', 'true');
        }
        if (payload.options?.baseline !== undefined) {
          group.setAttribute('data-baseline', String(payload.options.baseline));
        }
        if (payload.options?.borderWidth !== undefined) {
          group.setAttribute('data-border-width', String(payload.options.borderWidth));
        }
        if (payload.options?.borderColor !== undefined) {
          group.setAttribute('data-border-color', String(payload.options.borderColor));
        }
        if (payload.options?.heightPercent !== undefined) {
          group.setAttribute('data-height-percent', String(payload.options.heightPercent));
        }
        this.seriesLayer.appendChild(group);
      }),
      eventbus.on('series:update', (payload) => {
        const group = this.seriesLayer.querySelector(`[data-series-id="${payload.id}"]`);
        if (!group) return;
        if (payload.options.color) {
          group.setAttribute('data-color', payload.options.color as string);
        }
        if (payload.options.smooth !== undefined) {
          group.setAttribute('data-smooth', String(payload.options.smooth));
          this.seriesSmooth.set(payload.id, payload.options.smooth);
        }
        if ('magnetMode' in payload.options) {
          this.magnetMode = !!payload.options.magnetMode;
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
        this.scheduleRender(payload.id);
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
        if (payload.bars.length > 0) {
          this.lastClosePrice = payload.bars[payload.bars.length - 1].close;
          this.svg.querySelector('.empty-state')?.remove();
        } else {
          // Show empty state if no loading/error is active
          const hasLoading = !!this.svg.querySelector('.loading-indicator');
          const hasError = !!this.svg.querySelector('.error-message');
          if (!hasLoading && !hasError && !this.svg.querySelector('.empty-state')) {
            const empty = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            empty.setAttribute('class', 'empty-state');
            empty.setAttribute('x', String(this.viewWidth / 2));
            empty.setAttribute('y', String(this.viewHeight / 2));
            empty.setAttribute('text-anchor', 'middle');
            empty.textContent = 'No data available';
            this.svg.appendChild(empty);
          }
        }
        this.scheduleRender(payload.id);
      }),
      eventbus.on('viewport:changed', (payload) => {
        this.viewportSet = true;
        this.currentPriceScale = payload.priceScale ?? 'linear';
        this.basePrice = payload.basePrice ?? 1;
        this.scaleX.domain(payload.timeRange);
        this.applyPriceScale(payload.priceRange);
        this.scheduleRender();
      }),
      eventbus.on('theme:changed', (payload) => {
        this.currentTheme = { ...this.currentTheme, ...payload.theme };
        const theme = this.currentTheme;
        if (theme.background) {
          this.bgRectEl.setAttribute('fill', theme.background as string);
          this.svg.setAttribute('data-theme-background', theme.background as string);
        }
        if (theme.text) {
          this.svg.setAttribute('data-theme-text', theme.text as string);
          this.svg.querySelectorAll('text').forEach(t => {
            if (!t.classList.contains('watermark')) t.setAttribute('fill', theme.text as string);
          });
        }
        if (theme.grid) {
          this.svg.setAttribute('data-theme-grid', theme.grid as string);
          this.svg.querySelectorAll('.price-axis line').forEach(l => {
            l.setAttribute('stroke', theme.grid as string);
          });
        }
        if (theme.gridlineOpacity !== undefined) {
          this.svg.querySelectorAll('.price-axis line').forEach(l => {
            l.setAttribute('opacity', String(theme.gridlineOpacity));
          });
        }
        if (theme.fontFamily) {
          this.svg.setAttribute('font-family', theme.fontFamily as string);
        }
        if (theme.crosshairStyle === 'dashed') this.crosshairDashed = true;
        else if (theme.crosshairStyle === 'solid') this.crosshairDashed = false;
      }),
      eventbus.on('chart:loading', (payload) => {
        const existing = this.svg.querySelector('.loading-indicator');
        if (payload.loading && !existing) {
          const el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          const region = payload.region ?? 'center';
          el.setAttribute('class', `loading-indicator loading-indicator--${region}`);
          el.setAttribute('data-region', region);
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
        if (this.watermarkEnabled) {
          this.watermarkEl.textContent = payload.symbol.name;
        }
        if (payload.symbol.currency_code) {
          this.priceAxisEl.setAttribute('data-currency', payload.symbol.currency_code);
          this.currencySymbol = payload.symbol.currency_code === 'USD' ? '$' :
                                payload.symbol.currency_code === 'EUR' ? '€' :
                                payload.symbol.currency_code === 'GBP' ? '£' : '';
        }
        if (payload.symbol.timezone) {
          this.timeAxisEl.setAttribute('data-timezone', payload.symbol.timezone);
        }
        this.scheduleRender();
      }),
      eventbus.on('series:remove', (payload) => {
        this.seriesBars.delete(payload.id);
        this.seriesSmooth.delete(payload.id);
        const group = this.seriesLayer.querySelector(`[data-series-id="${payload.id}"]`);
        group?.remove();
      }),
    );
  }

  private updateSize(width: number, height: number): void {
    this.viewWidth = width;
    this.viewHeight = height;
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    this.applyRanges();
    this.scheduleRender();
  }

  private applyRanges(): void {
    const drawW = Math.max(0, this.viewWidth - this.margins.left - this.margins.right);
    const drawH = Math.max(0, this.viewHeight - this.margins.top - this.margins.bottom);
    this.scaleX.range([this.margins.left, this.margins.left + drawW]);
    this.scaleY.range([this.margins.top + drawH, this.margins.top]);
  }

  private applyPriceScale(range: [number, number]): void {
    const [lo, hi] = range[0] === range[1] ? [range[0] - 0.5, range[1] + 0.5] : range;
    if (this.currentPriceScale === 'logarithmic') {
      this.scaleY = scaleLog<number, number>().domain([Math.max(lo, 1e-10), Math.max(hi, 1e-10)]);
    } else {
      this.scaleY = scaleLinear<number, number>().domain([lo, hi]);
    }
    this.applyRanges();
  }

  // --- Public coordinate mapping API ---

  setNaturalScrolling(enabled: boolean): void {
    this.naturalScrolling = enabled;
  }

  setMargins(margins: { left?: number; right?: number; top?: number; bottom?: number }): void {
    this.margins = { ...this.margins, ...margins };
    this.applyRanges();
    this.scheduleRender();
  }

  mapTimeToX(time: number): number {
    return this.scaleX(time);
  }

  mapXToTime(x: number): number {
    return this.scaleX.invert(x);
  }

  mapPriceToY(price: number): number {
    if (this.currentPriceScale === 'percentage') {
      const pct = (price / this.basePrice - 1) * 100;
      return this.scaleY(pct);
    }
    return this.scaleY(price);
  }

  mapYToPrice(y: number): number {
    const raw = this.scaleY.invert(y);
    if (this.currentPriceScale === 'percentage') {
      return this.basePrice * (1 + raw / 100);
    }
    return raw;
  }

  private scheduleRender(id?: string): void {
    if (id) this._dirtySeriesIds.add(id);
    else this._allDirty = true;
    if (this._tabHidden) return;
    if (this._rafPending) return;
    this._rafPending = true;
    this._rafId = requestAnimationFrame(() => this._flushRender());
  }

  private _flushRender(): void {
    this._rafPending = false;
    this._rafId = null;
    if (this._allDirty) {
      for (const [id, bars] of this.seriesBars) this.renderSeries(id, bars);
      this._dirtySeriesIds.clear();
      this._allDirty = false;
    } else {
      for (const id of this._dirtySeriesIds) {
        const bars = this.seriesBars.get(id) ?? [];
        this.renderSeries(id, bars);
      }
      this._dirtySeriesIds.clear();
    }
    if (this.viewportSet) {
      this.renderPriceAxis();
      this.renderTimeAxis();
    }
  }

  private renderSeries(id: string, bars: Bar[]): void {
    const group = this.seriesLayer.querySelector(`[data-series-id="${id}"]`);
    if (!group) return;
    while (group.firstChild) group.removeChild(group.firstChild);

    const type = group.getAttribute('data-type') ?? 'line';
    const [t0, t1] = this.scaleX.domain() as [number, number];
    const visible = this.viewportSet
      ? bars.filter((b) => b.time >= t0 && b.time <= t1)
      : bars;

    // Calculate candle slot width from bar time spacing
    let slotWidth = this.viewWidth;
    if (bars.length >= 2) {
      const dt = bars[1].time - bars[0].time;
      slotWidth = Math.abs(this.scaleX(t0 + dt) - this.scaleX(t0));
    } else if (visible.length === 1) {
      slotWidth = this.viewWidth;
    }

    if (type === 'line') {
      const strokeWidth = parseFloat(group.getAttribute('data-stroke-width') ?? '1');
      const smooth = this.seriesSmooth.get(id) ?? 0;
      this.renderLineSeries(group, visible, strokeWidth, smooth);
      return;
    }

    if (type === 'area') {
      this.renderAreaSeries(group, visible);
      return;
    }

    if (type === 'volume') {
      this.renderVolumeSeries(group, bars); // use all bars for volume scale
      return;
    }

    for (const bar of visible) {
      const barEl = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      barEl.setAttribute('class', 'bar');
      barEl.setAttribute('data-x', String(Math.round(this.scaleX(bar.time))));
      barEl.setAttribute('data-y-open', String(Math.round(this.mapPriceToY(bar.open))));
      barEl.setAttribute('data-y-close', String(Math.round(this.mapPriceToY(bar.close))));
      barEl.setAttribute('data-y-high', String(Math.round(this.mapPriceToY(bar.high))));
      barEl.setAttribute('data-y-low', String(Math.round(this.mapPriceToY(bar.low))));

      if (type === 'candlestick') {
        this.renderCandlestickBar(barEl, bar, slotWidth);
      }

      group.appendChild(barEl);
    }

    // Label indicators (dots below the lowest wick for each labeled bar)
    if (this.showLabels) {
      for (const bar of visible) {
        if (!bar.label) continue;
        const cx = this.scaleX(bar.time);
        const cy = this.mapPriceToY(bar.low) + 8;
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('data-label-indicator', '');
        dot.setAttribute('cx', String(cx));
        dot.setAttribute('cy', String(cy));
        dot.setAttribute('r', '4');
        dot.setAttribute('fill', bar.label.background ?? bar.label.color ?? '#f0c040');
        group.appendChild(dot);
      }
    }
  }

  private renderLineSeries(group: Element, bars: Bar[], strokeWidth: number, smooth = 0): void {
    if (bars.length === 0) return;

    const seriesId = group.getAttribute('data-series-id') ?? 'series';
    const clipId = `line-clip-${seriesId}`;

    // Ensure clipPath exists in SVG for viewport clipping
    let clipPath = this.svg.querySelector(`#${clipId}`) as SVGClipPathElement | null;
    if (!clipPath) {
      clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath') as SVGClipPathElement;
      clipPath.setAttribute('id', clipId);
      this.svg.insertBefore(clipPath, this.svg.firstChild);
    }
    while (clipPath.firstChild) clipPath.removeChild(clipPath.firstChild);
    const [xMin, xMax] = this.scaleX.range() as [number, number];
    const yRange = this.scaleY.range() as [number, number];
    const yMin = Math.min(...yRange);
    const yMax = Math.max(...yRange);
    const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    clipRect.setAttribute('x', String(xMin));
    clipRect.setAttribute('y', String(yMin));
    clipRect.setAttribute('width', String(xMax - xMin));
    clipRect.setAttribute('height', String(yMax - yMin));
    clipPath.appendChild(clipRect);

    if (bars.length === 1) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', String(this.scaleX(bars[0].time)));
      circle.setAttribute('cy', String(this.mapPriceToY(bars[0].close)));
      circle.setAttribute('r', String(strokeWidth + 1));
      circle.setAttribute('clip-path', `url(#${clipId})`);
      group.appendChild(circle);
      return;
    }

    // smooth=0 → linear; smooth=1 → curveCardinal tension=0 (loosest/smoothest)
    const tension = 1 - Math.min(1, Math.max(0, smooth));
    const curve = smooth > 0 ? curveCardinal.tension(tension) : curveLinear;

    const lineGen = line<Bar>()
      .x((b: Bar) => this.scaleX(b.time))
      .y((b: Bar) => this.mapPriceToY(b.close))
      .curve(curve);

    const d = lineGen(bars);
    if (!d) return;

    const color = group.getAttribute('data-color') ?? 'currentColor';
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', String(strokeWidth));
    path.setAttribute('clip-path', `url(#${clipId})`);
    group.appendChild(path);
  }

  private renderAreaSeries(group: Element, bars: Bar[]): void {
    if (bars.length === 0) return;

    const seriesId = group.getAttribute('data-series-id') ?? 'series';
    const useGradient = group.getAttribute('data-gradient') === 'true';
    const baselineAttr = group.getAttribute('data-baseline');
    const baseline = baselineAttr !== null ? parseFloat(baselineAttr) : null;
    const borderWidth = group.getAttribute('data-border-width');
    const borderColor = group.getAttribute('data-border-color');

    const [yBottom] = this.scaleY.range() as [number, number]; // range is [bottom, top]

    // Ensure defs element exists for gradient
    let defs = this.svg.querySelector('defs') as SVGDefsElement | null;
    if (useGradient && !defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs') as SVGDefsElement;
      this.svg.insertBefore(defs, this.svg.firstChild);
    }

    const gradientId = `area-gradient-${seriesId}`;
    if (useGradient && defs) {
      let grad = defs.querySelector(`#${gradientId}`);
      if (!grad) {
        grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
        grad.setAttribute('id', gradientId);
        grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0');
        grad.setAttribute('x2', '0'); grad.setAttribute('y2', '1');
        const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        stop1.setAttribute('offset', '0%');
        stop1.setAttribute('stop-color', '#26a69a');
        stop1.setAttribute('stop-opacity', '0.6');
        const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        stop2.setAttribute('offset', '100%');
        stop2.setAttribute('stop-color', '#26a69a');
        stop2.setAttribute('stop-opacity', '0.05');
        grad.appendChild(stop1);
        grad.appendChild(stop2);
        defs.appendChild(grad);
      }
    }

    const fill = useGradient ? `url(#${gradientId})` : '#26a69a';

    if (bars.length === 1) {
      const cx = this.scaleX(bars[0].time);
      const cy = this.mapPriceToY(bars[0].close);
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(cx - 2));
      rect.setAttribute('y', String(cy));
      rect.setAttribute('width', '4');
      rect.setAttribute('height', String(Math.abs(yBottom - cy)));
      rect.setAttribute('fill', fill);
      group.appendChild(rect);
      return;
    }

    if (baseline !== null) {
      // Split into above-baseline and below-baseline paths
      const baselineY = this.mapPriceToY(baseline);
      const mkAreaPath = (barsSlice: Bar[], side: 'above' | 'below') => {
        const y0 = side === 'above' ? baselineY : baselineY;
        const areaGen = area<Bar>()
          .x((b: Bar) => this.scaleX(b.time))
          .y0(y0)
          .y1((b: Bar) => this.mapPriceToY(b.close));
        const d = areaGen(barsSlice);
        if (!d) return;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('fill', side === 'above' ? '#26a69a' : '#ef5350');
        path.setAttribute('data-baseline-side', side === 'above' ? 'above' : 'below');
        group.appendChild(path);
      };
      // Above: bars where close >= baseline
      const aboveBars = bars.map(b => ({ ...b, close: Math.max(b.close, baseline) }));
      mkAreaPath(aboveBars, 'above');
      // Below: bars where close <= baseline
      const belowBars = bars.map(b => ({ ...b, close: Math.min(b.close, baseline) }));
      mkAreaPath(belowBars, 'below');
      return;
    }

    // Standard area
    const areaGen = area<Bar>()
      .x((b: Bar) => this.scaleX(b.time))
      .y0(yBottom)
      .y1((b: Bar) => this.mapPriceToY(b.close));

    const d = areaGen(bars);
    if (!d) return;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', fill);
    group.appendChild(path);

    // Optional border line on top
    if (borderWidth || borderColor) {
      const lineGen = line<Bar>()
        .x((b: Bar) => this.scaleX(b.time))
        .y((b: Bar) => this.mapPriceToY(b.close));
      const ld = lineGen(bars);
      if (ld) {
        const borderPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        borderPath.setAttribute('d', ld);
        borderPath.setAttribute('fill', 'none');
        borderPath.setAttribute('stroke', borderColor ?? 'currentColor');
        borderPath.setAttribute('stroke-width', borderWidth ?? '1');
        group.appendChild(borderPath);
      }
    }
  }

  private renderTimeAxis(): void {
    const axis = this.timeAxisEl;
    while (axis.firstChild) axis.removeChild(axis.firstChild);

    if (!this.viewportSet) return;

    const [t0, t1] = this.scaleX.domain() as [number, number];
    const rangeMs = t1 - t0;
    const axisY = this.viewHeight - 4;

    // Choose label interval and format based on range
    const DAY = 24 * 60 * 60 * 1000;
    const HOUR = 60 * 60 * 1000;
    const MIN = 60 * 1000;

    let interval: number;
    let fmt: (t: number) => string;
    let hierarchicalFmt: ((t: number) => string) | null = null;

    if (rangeMs > 60 * DAY) {
      // Monthly labels, hierarchical year labels
      interval = 7 * DAY;
      fmt = (t) => {
        const d = new Date(t);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      };
      hierarchicalFmt = (t) => {
        const d = new Date(t);
        return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      };
    } else if (rangeMs > 7 * DAY) {
      // Daily labels
      interval = 3 * DAY;
      fmt = (t) => {
        const d = new Date(t);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      };
    } else if (rangeMs > DAY) {
      // Daily with day-of-week
      interval = DAY;
      fmt = (t) => {
        const d = new Date(t);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      };
    } else if (rangeMs > 4 * HOUR) {
      // Hourly
      interval = HOUR;
      fmt = (t) => {
        const d = new Date(t);
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      };
    } else {
      // Sub-hourly
      interval = 30 * MIN;
      fmt = (t) => {
        const d = new Date(t);
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      };
    }

    // Generate tick times at interval boundaries
    const startAligned = Math.ceil(t0 / interval) * interval;
    const ticks: number[] = [];
    for (let t = startAligned; t <= t1; t += interval) {
      ticks.push(t);
    }

    const minLabelSpacing = 60; // min pixels between labels
    let lastX = -Infinity;

    // Track which ticks get "hierarchical" labels
    const hierarchicalTicks = new Set<number>();
    if (hierarchicalFmt) {
      let lastMonth = -1;
      for (const t of ticks) {
        const d = new Date(t);
        const month = d.getMonth();
        if (month !== lastMonth) {
          hierarchicalTicks.add(t);
          lastMonth = month;
        }
      }
    }

    for (const t of ticks) {
      const x = this.scaleX(t);
      if (x < 0 || x > this.viewWidth) continue;
      if (x - lastX < minLabelSpacing) continue;
      lastX = x;

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', String(Math.round(x)));
      label.setAttribute('y', String(axisY));
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '11');

      if (hierarchicalTicks.has(t) && hierarchicalFmt) {
        label.textContent = hierarchicalFmt(t);
        label.setAttribute('font-weight', 'bold');
      } else {
        label.textContent = fmt(t);
      }

      axis.appendChild(label);
    }
  }

  private renderPriceAxis(): void {
    const axis = this.priceAxisEl;
    while (axis.firstChild) axis.removeChild(axis.firstChild);

    if (!this.viewportSet) return;

    const axisX = this.viewWidth; // right edge by default
    const chartWidth = this.viewWidth;

    const ticks = this.scaleY.ticks(6);

    // Format tick value
    const fmt = (v: number): string => {
      const sym = this.currencySymbol;
      const range = Math.abs((this.scaleY.domain()[1] as number) - (this.scaleY.domain()[0] as number));
      let formatted: string;
      if (range < 0.1) {
        formatted = v.toFixed(4);
      } else if (range < 1) {
        formatted = v.toFixed(3);
      } else if (range < 10) {
        formatted = v.toFixed(2);
      } else {
        formatted = v.toLocaleString('en-US', { maximumFractionDigits: 2 });
      }
      return sym + formatted;
    };

    for (const tick of ticks) {
      const y = this.scaleY(tick as number);

      // Gridline
      const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      gridLine.setAttribute('x1', '0');
      gridLine.setAttribute('y1', String(y));
      gridLine.setAttribute('x2', String(chartWidth));
      gridLine.setAttribute('y2', String(y));
      gridLine.setAttribute('stroke', '#333');
      gridLine.setAttribute('stroke-width', '1');
      axis.appendChild(gridLine);

      // Label
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(axisX - 4));
      text.setAttribute('y', String(y));
      text.setAttribute('text-anchor', 'end');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('font-size', '11');
      text.textContent = fmt(tick as number);
      axis.appendChild(text);
    }

    // Last price marker
    if (this.lastClosePrice !== null) {
      const [lo, hi] = this.scaleY.domain() as [number, number];
      const inRange = this.lastClosePrice >= Math.min(lo, hi) && this.lastClosePrice <= Math.max(lo, hi);
      if (inRange) {
        const ly = this.mapPriceToY(this.lastClosePrice);

        // Dashed horizontal line
        const dashLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        dashLine.setAttribute('x1', '0');
        dashLine.setAttribute('y1', String(ly));
        dashLine.setAttribute('x2', String(chartWidth));
        dashLine.setAttribute('y2', String(ly));
        dashLine.setAttribute('stroke', '#f0c040');
        dashLine.setAttribute('stroke-dasharray', '4,2');
        dashLine.setAttribute('stroke-width', '1');
        axis.appendChild(dashLine);

        // Highlighted label
        const lText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        lText.setAttribute('x', String(axisX - 4));
        lText.setAttribute('y', String(ly));
        lText.setAttribute('text-anchor', 'end');
        lText.setAttribute('dominant-baseline', 'middle');
        lText.setAttribute('font-size', '11');
        lText.setAttribute('font-weight', 'bold');
        lText.setAttribute('data-last-price', String(this.lastClosePrice));
        lText.textContent = fmt(this.lastClosePrice);
        axis.appendChild(lText);
      }
    }
  }

  private renderVolumeSeries(group: Element, bars: Bar[]): void {
    if (bars.length === 0) return;

    const heightPctAttr = group.getAttribute('data-height-percent');
    const heightPct = heightPctAttr !== null ? parseFloat(heightPctAttr) / 100 : 0.2;
    const volumeAreaHeight = this.viewHeight * heightPct;
    const chartBottom = this.viewHeight; // bottom of SVG

    const maxVol = Math.max(...bars.map(b => b.volume ?? 0));
    if (maxVol === 0) {
      // Render minimal-height rects for zero-volume bars
      for (const bar of bars) {
        const cx = this.scaleX(bar.time);
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', String(cx - 2));
        rect.setAttribute('y', String(chartBottom - 1));
        rect.setAttribute('width', '4');
        rect.setAttribute('height', '1');
        rect.setAttribute('fill', '#888');
        group.appendChild(rect);
      }
      return;
    }

    // Calculate bar slot width
    let slotWidth = 8;
    if (bars.length >= 2) {
      const dt = bars[1].time - bars[0].time;
      const [t0] = this.scaleX.domain() as [number, number];
      slotWidth = Math.max(1, Math.abs(this.scaleX(t0 + dt) - this.scaleX(t0)) * 0.8);
    }

    const [t0, t1] = this.scaleX.domain() as [number, number];
    const visible = this.viewportSet ? bars.filter(b => b.time >= t0 && b.time <= t1) : bars;

    for (const bar of visible) {
      const vol = bar.volume ?? 0;
      const barHeight = (vol / maxVol) * volumeAreaHeight;
      const cx = this.scaleX(bar.time);
      const isBullish = bar.close >= bar.open;
      const color = isBullish ? '#26a69a' : '#ef5350';

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(cx - slotWidth / 2));
      rect.setAttribute('y', String(chartBottom - barHeight));
      rect.setAttribute('width', String(slotWidth));
      rect.setAttribute('height', String(Math.max(1, barHeight)));
      rect.setAttribute('fill', color);
      group.appendChild(rect);
    }
  }

  private renderCandlestickBar(barEl: SVGGElement, bar: Bar, slotWidth: number): void {
    const GAP = 0.2;
    const candleWidth = Math.max(1, slotWidth * (1 - GAP));
    const cx = this.scaleX(bar.time);
    const bodyX = cx - candleWidth / 2;

    const isDoji = bar.open === bar.close;
    const isBullish = bar.close > bar.open;
    const color = isBullish ? '#26a69a' : '#ef5350';

    const yHigh = this.mapPriceToY(bar.high);
    const yLow = this.mapPriceToY(bar.low);
    const yOpen = this.mapPriceToY(bar.open);
    const yClose = this.mapPriceToY(bar.close);
    const yBodyTop = Math.min(yOpen, yClose);
    const yBodyBottom = Math.max(yOpen, yClose);

    const mkLine = (x1: number, y1: number, x2: number, y2: number, stroke = color) => {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      el.setAttribute('x1', String(x1));  el.setAttribute('y1', String(y1));
      el.setAttribute('x2', String(x2));  el.setAttribute('y2', String(y2));
      el.setAttribute('stroke', stroke);
      el.setAttribute('stroke-width', '1');
      return el;
    };

    if (isDoji) {
      // Horizontal body line + wicks
      barEl.appendChild(mkLine(bodyX, yOpen, bodyX + candleWidth, yOpen, '#888'));
      barEl.appendChild(mkLine(cx, yHigh, cx, yOpen));
      barEl.appendChild(mkLine(cx, yOpen, cx, yLow));
    } else {
      // Body rect
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(bodyX));
      rect.setAttribute('y', String(yBodyTop));
      rect.setAttribute('width', String(candleWidth));
      rect.setAttribute('height', String(Math.max(1, yBodyBottom - yBodyTop)));
      rect.setAttribute('fill', color);
      rect.setAttribute('data-direction', isBullish ? 'bullish' : 'bearish');
      barEl.appendChild(rect);
      // Upper wick
      barEl.appendChild(mkLine(cx, yHigh, cx, yBodyTop));
      // Lower wick
      barEl.appendChild(mkLine(cx, yBodyBottom, cx, yLow));
    }
  }

  private renderCrosshair(x: number, y: number, snap = false): void {
    const ch = this.crosshairEl;
    while (ch.firstChild) ch.removeChild(ch.firstChild);
    ch.removeAttribute('display');

    // Snap to nearest bar if snap is enabled
    let crossX = x;
    if (snap) {
      let bestDist = Infinity;
      for (const bars of this.seriesBars.values()) {
        for (const bar of bars) {
          const bx = this.scaleX(bar.time);
          const dist = Math.abs(bx - x);
          if (dist < bestDist) {
            bestDist = dist;
            crossX = bx;
          }
        }
      }
    }

    const dashArray = this.crosshairDashed ? '4,2' : undefined;

    const mkLine = (x1: number, y1: number, x2: number, y2: number) => {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      el.setAttribute('x1', String(x1)); el.setAttribute('y1', String(y1));
      el.setAttribute('x2', String(x2)); el.setAttribute('y2', String(y2));
      el.setAttribute('stroke', '#aaa');
      el.setAttribute('stroke-width', '1');
      if (dashArray) el.setAttribute('stroke-dasharray', dashArray);
      return el;
    };

    // Vertical line
    const vLine = mkLine(crossX, 0, crossX, this.viewHeight);
    vLine.setAttribute('data-crosshair-v', '');
    ch.appendChild(vLine);

    // Horizontal line
    const hLine = mkLine(0, y, this.viewWidth, y);
    hLine.setAttribute('data-crosshair-h', '');
    ch.appendChild(hLine);

    // Find nearest bar for tooltip
    let nearestBar: import('./index').Bar | null = null;
    let minDist = Infinity;
    for (const bars of this.seriesBars.values()) {
      for (const bar of bars) {
        const dist = Math.abs(this.scaleX(bar.time) - crossX);
        if (dist < minDist) { minDist = dist; nearestBar = bar; }
      }
    }

    if (nearestBar && minDist < 50) {
      const tooltipX = Math.min(crossX + 8, this.viewWidth - 80);
      const tooltipY = Math.max(y - 60, 10);
      const b = nearestBar;
      const lines = [
        `O: ${b.open.toFixed(2)}`,
        `H: ${b.high.toFixed(2)}`,
        `L: ${b.low.toFixed(2)}`,
        `C: ${b.close.toFixed(2)}`,
        `V: ${b.volume ?? 0}`,
      ];
      lines.forEach((line, i) => {
        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.setAttribute('x', String(tooltipX));
        t.setAttribute('y', String(tooltipY + i * 14));
        t.setAttribute('font-size', '11');
        t.textContent = line;
        ch.appendChild(t);
      });

      // Label annotation tooltip (with background rect)
      if (this.showLabels && b.label) {
        const lbl = b.label;
        const lblX = tooltipX;
        const lblY = tooltipY + lines.length * 14 + 6;
        const PAD = 4;
        const FONT = 11;
        const approxW = lbl.text.length * 6.5 + PAD * 2;

        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bg.setAttribute('data-label-bg', '');
        bg.setAttribute('x', String(lblX - PAD));
        bg.setAttribute('y', String(lblY - FONT));
        bg.setAttribute('width', String(approxW));
        bg.setAttribute('height', String(FONT + PAD * 2));
        bg.setAttribute('rx', '3');
        bg.setAttribute('fill', lbl.background ?? '#f0c040');
        ch.appendChild(bg);

        const lt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        lt.setAttribute('data-label-text', '');
        lt.setAttribute('x', String(lblX));
        lt.setAttribute('y', String(lblY));
        lt.setAttribute('font-size', String(FONT));
        lt.setAttribute('fill', lbl.color ?? '#000');
        lt.textContent = lbl.text;
        ch.appendChild(lt);
      }
    }
  }

  private hideCrosshair(eventbus: EventBus<RendererEvents>): void {
    this.crosshairEl.setAttribute('display', 'none');
    eventbus.emit('interaction:crosshair', null);
  }

  private bindDomEvents(eventbus: EventBus<RendererEvents>): void {
    const rect = () => this.svg.getBoundingClientRect();

    const toPoint = (e: MouseEvent): InteractionPoint => {
      const r = rect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      return { x, y, time: this.scaleX.invert(x), price: this.scaleY.invert(y) };
    };

    const PAN_THRESHOLD = 3; // px before pan activates

    const onMouseMove = ((e: Event) => {
      const me = e as MouseEvent;
      // Only left-button drag pans (button=0, buttons=1)
      if (me.buttons === 1 && this.dragStartX !== null && me.button !== 2) {
        const deltaX = me.clientX - this.dragStartX;
        this.dragStartX = me.clientX;
        this.dragTotalDelta += Math.abs(deltaX);
        this.dragVelocityX = deltaX; // track last velocity
        if (this.dragTotalDelta >= PAN_THRESHOLD) {
          this.crosshairEl.setAttribute('display', 'none');
          eventbus.emit('interaction:pan', { deltaX });
        }
      } else if (me.buttons !== 1) {
        const r = rect();
        const x = me.clientX - r.left;
        const y = me.clientY - r.top;
        this.renderCrosshair(x, y, this.magnetMode);
        eventbus.emit('interaction:crosshair', toPoint(me));
      }
    }) as EventListener;

    const onMouseLeave = (() => {
      this.hideCrosshair(eventbus);
    }) as EventListener;

    const onMouseDown = ((e: Event) => {
      const me = e as MouseEvent;
      if (me.button === 2) return; // ignore right-click
      this.dragStartX = me.clientX;
      this.dragTotalDelta = 0;
      this.dragVelocityX = 0;
      if (this.kineticTimer !== null) {
        clearTimeout(this.kineticTimer);
        this.kineticTimer = null;
      }
    }) as EventListener;

    const onMouseUp = (() => {
      this.dragStartX = null;
      // Kinetic scrolling: emit decelerating pan events
      if (this.dragTotalDelta >= PAN_THRESHOLD && Math.abs(this.dragVelocityX) > 1) {
        let v = this.dragVelocityX * 0.8; // initial kinetic velocity
        const emit = () => {
          if (Math.abs(v) < 0.5) { this.kineticTimer = null; return; }
          eventbus.emit('interaction:pan', { deltaX: v });
          v *= 0.85; // decelerate
          this.kineticTimer = setTimeout(emit, 16);
        };
        this.kineticTimer = setTimeout(emit, 16);
      }
      this.dragTotalDelta = 0;
    }) as EventListener;

    // Touch events: single-finger crosshair + pan, two-finger zoom
    const onTouchStart = ((e: Event) => {
      const te = e as (Event & { touches: ArrayLike<{ clientX: number; clientY: number }> });
      if (te.touches && te.touches.length > 0) {
        const r = rect();
        const t = te.touches[0];
        const x = t.clientX - r.left;
        const y = t.clientY - r.top;
        this.touchStartX = t.clientX;
        this.renderCrosshair(x, y);
      }
      if (te.touches && te.touches.length === 2) {
        const t0 = te.touches[0], t1 = te.touches[1];
        const dx = t1.clientX - t0.clientX, dy = t1.clientY - t0.clientY;
        this._lastPinchDist = Math.sqrt(dx * dx + dy * dy);
      }
    }) as EventListener;

    const onTouchMove = ((e: Event) => {
      const te = e as (Event & { touches: ArrayLike<{ clientX: number; clientY: number }> });
      if (!te.touches) return;
      if (te.touches.length === 1) {
        const r = rect();
        const t = te.touches[0];
        const x = t.clientX - r.left;
        const y = t.clientY - r.top;
        if (this.touchStartX !== null) {
          const deltaX = t.clientX - this.touchStartX;
          if (Math.abs(deltaX) >= PAN_THRESHOLD) {
            this.crosshairEl.setAttribute('display', 'none');
            eventbus.emit('interaction:pan', { deltaX: deltaX });
            this.touchStartX = t.clientX;
            return;
          }
        }
        this.renderCrosshair(x, y, this.magnetMode);
      } else if (te.touches.length === 2) {
        const t0 = te.touches[0];
        const t1 = te.touches[1];
        const dx = t1.clientX - t0.clientX, dy = t1.clientY - t0.clientY;
        const currDist = Math.sqrt(dx * dx + dy * dy);
        const delta = this._lastPinchDist !== null ? this._lastPinchDist - currDist : 0;
        this._lastPinchDist = currDist;
        const midX = ((t0.clientX + t1.clientX) / 2) - rect().left;
        eventbus.emit('interaction:zoom', { delta, centerX: midX });
      }
    }) as EventListener;

    const onTouchEnd = (() => {
      this.touchStartX = null;
      this._lastPinchDist = null;
      this.hideCrosshair(eventbus);
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
      const delta = this.naturalScrolling ? -we.deltaY : we.deltaY;
      eventbus.emit('interaction:zoom', { delta, centerX: we.clientX - r.left });
    }) as EventListener;

    const onKeyDown = ((e: Event) => {
      const ke = e as KeyboardEvent;
      const centerX = this.viewWidth / 2;
      if (ke.key === '+' || ke.key === '=') {
        eventbus.emit('interaction:zoom', { delta: 100, centerX });
      } else if (ke.key === '-') {
        eventbus.emit('interaction:zoom', { delta: -100, centerX });
      }
    }) as EventListener;

    // Price axis drag — emits interaction:zoom with vertical delta
    const onPriceAxisMouseDown = ((e: Event) => {
      this.priceAxisDragStartY = (e as MouseEvent).clientY;
      e.stopPropagation();
    }) as EventListener;

    const onPriceAxisMouseMove = ((e: Event) => {
      const me = e as MouseEvent;
      if (me.buttons === 1 && this.priceAxisDragStartY !== null) {
        const deltaY = me.clientY - this.priceAxisDragStartY;
        this.priceAxisDragStartY = me.clientY;
        eventbus.emit('interaction:zoom', { delta: deltaY, centerX: this.viewWidth / 2 });
      }
    }) as EventListener;

    const onPriceAxisMouseUp = (() => {
      this.priceAxisDragStartY = null;
    }) as EventListener;

    const listeners: Array<{ el: Element; type: string; fn: EventListener }> = [
      { el: this.svg, type: 'mousemove', fn: onMouseMove },
      { el: this.svg, type: 'mouseleave', fn: onMouseLeave },
      { el: this.svg, type: 'mousedown', fn: onMouseDown },
      { el: this.svg, type: 'mouseup', fn: onMouseUp },
      { el: this.svg, type: 'click', fn: onClick },
      { el: this.svg, type: 'dblclick', fn: onDblClick },
      { el: this.svg, type: 'wheel', fn: onWheel },
      { el: this.svg, type: 'touchstart', fn: onTouchStart },
      { el: this.svg, type: 'touchmove', fn: onTouchMove },
      { el: this.svg, type: 'touchend', fn: onTouchEnd },
      { el: this.svg, type: 'keydown', fn: onKeyDown },
      { el: this.priceAxisEl, type: 'mousedown', fn: onPriceAxisMouseDown },
      { el: this.priceAxisEl, type: 'mousemove', fn: onPriceAxisMouseMove },
      { el: this.priceAxisEl, type: 'mouseup', fn: onPriceAxisMouseUp },
    ];

    for (const { el, type, fn } of listeners) {
      el.addEventListener(type, fn);
    }
    this.domListeners = listeners;
  }

  destroy(): void {
    this.resizeObserver.disconnect();
    for (const { el, type, fn } of this.domListeners) {
      el.removeEventListener(type, fn);
    }
    this.domListeners = [];
    this.unsubscribers.forEach((fn) => fn());
    this.unsubscribers = [];
    if (this._onVisibilityChange) {
      document.removeEventListener('visibilitychange', this._onVisibilityChange);
      this._onVisibilityChange = null;
    }
    if (this.kineticTimer !== null) {
      clearTimeout(this.kineticTimer);
      this.kineticTimer = null;
    }
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._rafPending = false;
    this.seriesBars.clear();
    this.svg.remove();
    this.eventbus.emit('renderer:destroyed', {});
  }
}
