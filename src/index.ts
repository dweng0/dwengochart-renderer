// @dwengochart/renderer
// SVG rendering library for financial charts

import { EventBus } from '@yatamazuki/typed-eventbus';
import { scaleLinear, scaleLog } from 'd3-scale';
import { line, area } from 'd3-shape';

export interface SeriesOptions {
  color?: string;
  strokeWidth?: number;
  gradient?: boolean;
  baseline?: number;
  borderWidth?: number;
  borderColor?: string;
  heightPercent?: number;
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


export class Renderer {
  private svg: SVGSVGElement;
  private seriesLayer: SVGGElement;
  private unsubscribers: (() => void)[] = [];

  private scaleX = scaleLinear<number, number>();
  private scaleY: ReturnType<typeof scaleLinear<number, number>> | ReturnType<typeof scaleLog<number, number>> = scaleLinear<number, number>();
  private seriesBars = new Map<string, Bar[]>();
  private watermarkEl: SVGTextElement;
  private priceAxisEl: SVGGElement;
  private timeAxisEl: SVGGElement;
  private dragStartX: number | null = null;
  private domListeners: Array<{ el: Element; type: string; fn: EventListener }> = [];
  private eventbus: EventBus<RendererEvents>;
  private resizeObserver: ResizeObserver;
  private viewWidth = 0;
  private viewHeight = 0;
  private margins = { left: 0, right: 0, top: 0, bottom: 0 };
  private currentPriceScale: 'linear' | 'logarithmic' | 'percentage' = 'linear';
  private basePrice = 1;
  private viewportSet = false;

  constructor(container: HTMLElement, eventbus: EventBus<RendererEvents>) {
    this.eventbus = eventbus;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    container.appendChild(svg);
    this.svg = svg;

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
        if (payload.options?.strokeWidth !== undefined) {
          group.setAttribute('data-stroke-width', String(payload.options.strokeWidth));
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
        const bars = this.seriesBars.get(payload.id) ?? [];
        this.renderSeries(payload.id, bars);
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
        this.viewportSet = true;
        this.currentPriceScale = payload.priceScale ?? 'linear';
        this.basePrice = payload.basePrice ?? 1;
        this.scaleX.domain(payload.timeRange);
        this.applyPriceScale(payload.priceRange);
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

  private updateSize(width: number, height: number): void {
    this.viewWidth = width;
    this.viewHeight = height;
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    this.applyRanges();
    for (const [id, bars] of this.seriesBars) {
      this.renderSeries(id, bars);
    }
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

  setMargins(margins: { left?: number; right?: number; top?: number; bottom?: number }): void {
    this.margins = { ...this.margins, ...margins };
    this.applyRanges();
    for (const [id, bars] of this.seriesBars) {
      this.renderSeries(id, bars);
    }
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
      this.renderLineSeries(group, visible, strokeWidth);
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
  }

  private renderLineSeries(group: Element, bars: Bar[], strokeWidth: number): void {
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

    const lineGen = line<Bar>()
      .x((b: Bar) => this.scaleX(b.time))
      .y((b: Bar) => this.mapPriceToY(b.close));

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
    this.resizeObserver.disconnect();
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
