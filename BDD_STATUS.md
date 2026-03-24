# BDD Status

Checked 150 scenario(s) across 19 test file(s).


## Feature: Event Contract

- [x] Listen to series:add event
- [x] Listen to series:remove event
- [x] Listen to series:update event
- [x] Listen to series:show event
- [x] Listen to series:hide event
- [x] Listen to series:type event
- [x] Listen to series:order event
- [x] Listen to series:data event
- [x] Listen to viewport:changed event
- [x] Listen to symbol:resolved event for watermark and metadata
- [x] Listen to chart:loading event
- [x] Listen to chart:error event
- [x] Listen to theme:changed event
- [x] Emit interaction:crosshair event
- [x] Emit interaction:click event
- [x] Emit interaction:pan event
- [x] Emit interaction:zoom event
- [x] Emit interaction:fit event
- [x] Emit renderer:ready event
- [x] Emit renderer:destroyed event
- [x] Ignore events for unknown series
- [x] Unsubscribe from all events on destroy

## Feature: SVG Container Setup

- [x] Initialize SVG in a container
- [x] SVG is resolution-independent
- [x] Respond to container resize
- [x] Handle zero-size container gracefully
- [x] Clean up on destroy
- [x] Initialize in a container with existing children
- [x] Handle container resize to zero
- [x] SVG has correct namespace
- [x] SVG contains layer groups in correct order

## Feature: Coordinate Mapping

- [x] Map time to x-pixel
- [x] Map x-pixel to time
- [x] Map price to y-pixel
- [x] Map y-pixel to price
- [x] Handle time at viewport boundary
- [x] Handle time outside viewport
- [x] Recalculate on viewport:changed event
- [x] Account for axis margins in coordinate mapping
- [x] Map coordinates with logarithmic scale from viewport:changed
- [x] Map coordinates with percentage scale from viewport:changed
- [x] Handle zero price range without division by zero

## Feature: Candlestick Series Rendering

- [x] Render a bullish candle
- [x] Render a bearish candle
- [x] Render a doji (open equals close)
- [x] Render only visible bars
- [x] Render with no bars
- [x] Render a single bar
- [x] Scale candle width based on viewport
- [x] Handle bars with zero range (all OHLC values equal)
- [x] Enforce minimum candle width at extreme zoom-out
- [x] Wick is centered and single-pixel wide

## Feature: Line Series Rendering

- [x] Render a line connecting close prices
- [x] Render with a single bar
- [x] Render with no bars
- [x] Line is clipped to viewport boundaries
- [x] Render a line with exactly two bars
- [x] Line width is configurable via series options
- [x] Line smoothness produces a curved path
- [x] Line with smooth=0 produces straight segments

## Feature: Area Series Rendering

- [x] Render an area fill below the line
- [x] Area gradient fill
- [x] Area render with no bars
- [x] Area render with a single bar
- [x] Baseline area fill from a specific price
- [x] Area border line is configurable

## Feature: Series Composition

- [x] Add a series via event
- [x] Overlay multiple series via events
- [x] Reorder series via series:order event
- [x] Remove a series via event
- [x] Show and hide a series via events
- [x] Update series options via event
- [x] Each series has independent styling
- [x] Series re-renders on viewport:changed
- [x] Swap series type via event

## Feature: OHLC Bar Series Rendering

- [x] Render a bullish OHLC bar
- [x] Render a bearish OHLC bar
- [x] Render OHLC bar with no bars

## Feature: Volume Histogram

- [x] Render volume bars below the price chart
- [x] Volume bar color matches candle direction
- [x] Volume area has its own y-scale
- [x] Volume area height is configurable
- [x] Hide volume when series is removed
- [x] Handle bars with zero volume

## Feature: Price Axis Rendering

- [x] Render price axis labels at sensible intervals
- [x] Update axis on viewport:changed
- [x] Handle very small price range
- [x] Handle very large price range
- [x] Price axis width accommodates label length
- [x] Last price marker on price axis
- [x] Price labels include currency symbol from symbol:resolved
- [x] Price axis on the left side
- [x] Drag price axis emits interaction event
- [x] Price axis labels in logarithmic scale

## Feature: Time Axis Rendering

- [x] Render time labels for daily resolution
- [x] Render time labels for intraday resolution
- [x] Labels do not overlap
- [x] Handle gaps in time data (weekends/holidays)
- [x] Display timezone from symbol:resolved
- [x] Configurable timezone override
- [x] Hierarchical time labels at boundary crossings

## Feature: Crosshair

- [x] Show crosshair on mouse move
- [x] Snap crosshair to nearest bar
- [x] Hide crosshair when mouse leaves SVG
- [x] Emit interaction:crosshair on mouse move
- [x] Crosshair tooltip shows OHLCV values
- [x] Crosshair line style from theme
- [x] Crosshair is hidden during pan drag
- [x] Crosshair activation on touch devices
- [x] Crosshair magnet mode is toggleable

## Feature: Pan Interaction

- [x] Emit interaction:pan on mouse drag
- [x] Emit interaction:pan on touch drag
- [x] Viewport updates only via viewport:changed
- [x] Kinetic scrolling emits pan events
- [x] Small mouse movements do not trigger pan
- [x] Right-click drag does not pan

## Feature: Zoom Interaction

- [x] Emit interaction:zoom on mouse wheel up
- [x] Emit interaction:zoom on mouse wheel down
- [x] Emit interaction:zoom on pinch gesture
- [x] Emit interaction:zoom on keyboard shortcut
- [x] Emit interaction:fit on double-click
- [x] Viewport updates only via viewport:changed
- [x] Scroll direction respects natural scrolling setting
- [x] Zoom transition animates between viewport:changed events

## Feature: Theming

- [x] Apply a light theme via event
- [x] Apply a dark theme via event
- [x] Override individual theme properties
- [x] Switch theme without losing chart state
- [x] Custom font family in theme
- [x] Opacity settings for gridlines

## Feature: Render Pipeline

- [x] Batch multiple events into one update
- [x] Skip rendering when nothing changed
- [x] Handle rapid successive events
- [x] RequestAnimationFrame integration
- [x] Pause rendering when tab is hidden

## Feature: Loading State

- [x] Show loading indicator via chart:loading event
- [x] Show loading indicator at specific region
- [x] Hide loading indicator via chart:loading event

## Feature: Empty and Error States

- [x] Display error state via chart:error event
- [x] Clear error state via chart:error null
- [x] Display empty state when series has no data

## Feature: Watermark

- [x] Display symbol name from symbol:resolved event
- [x] Watermark updates on symbol:resolved event
- [x] Watermark is behind all chart elements
- [x] Watermark is configurable

## Feature: Bar Labels

- [x] Display label indicator on labeled bar
- [x] Hide label indicators when showLabels is disabled
- [x] Show label text with background in crosshair tooltip
- [x] Label background color comes from bar data
- [x] Bars without labels show no indicator

---
**150/150 scenarios covered.**
