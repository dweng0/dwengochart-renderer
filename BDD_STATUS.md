# BDD Status

Checked 143 scenario(s) across 2 test file(s).


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
- [ ] UNCOVERED: Listen to chart:loading event
- [ ] UNCOVERED: Listen to chart:error event
- [ ] UNCOVERED: Listen to theme:changed event
- [ ] UNCOVERED: Emit interaction:crosshair event
- [ ] UNCOVERED: Emit interaction:click event
- [ ] UNCOVERED: Emit interaction:pan event
- [ ] UNCOVERED: Emit interaction:zoom event
- [ ] UNCOVERED: Emit interaction:fit event
- [ ] UNCOVERED: Emit renderer:ready event
- [ ] UNCOVERED: Emit renderer:destroyed event
- [ ] UNCOVERED: Ignore events for unknown series
- [ ] UNCOVERED: Unsubscribe from all events on destroy

## Feature: SVG Container Setup

- [ ] UNCOVERED: Initialize SVG in a container
- [ ] UNCOVERED: SVG is resolution-independent
- [ ] UNCOVERED: Respond to container resize
- [ ] UNCOVERED: Handle zero-size container gracefully
- [ ] UNCOVERED: Clean up on destroy
- [ ] UNCOVERED: Initialize in a container with existing children
- [ ] UNCOVERED: Handle container resize to zero
- [ ] UNCOVERED: SVG has correct namespace
- [ ] UNCOVERED: SVG contains layer groups in correct order

## Feature: Coordinate Mapping

- [ ] UNCOVERED: Map time to x-pixel
- [ ] UNCOVERED: Map x-pixel to time
- [ ] UNCOVERED: Map price to y-pixel
- [ ] UNCOVERED: Map y-pixel to price
- [ ] UNCOVERED: Handle time at viewport boundary
- [ ] UNCOVERED: Handle time outside viewport
- [ ] UNCOVERED: Recalculate on viewport:changed event
- [ ] UNCOVERED: Account for axis margins in coordinate mapping
- [ ] UNCOVERED: Map coordinates with logarithmic scale from viewport:changed
- [ ] UNCOVERED: Map coordinates with percentage scale from viewport:changed
- [ ] UNCOVERED: Handle zero price range without division by zero

## Feature: Candlestick Series Rendering

- [ ] UNCOVERED: Render a bullish candle
- [ ] UNCOVERED: Render a bearish candle
- [ ] UNCOVERED: Render a doji (open equals close)
- [ ] UNCOVERED: Render only visible bars
- [x] Render with no bars
- [ ] UNCOVERED: Render a single bar
- [ ] UNCOVERED: Scale candle width based on viewport
- [ ] UNCOVERED: Handle bars with zero range (all OHLC values equal)
- [ ] UNCOVERED: Enforce minimum candle width at extreme zoom-out
- [ ] UNCOVERED: Wick is centered and single-pixel wide

## Feature: Line Series Rendering

- [ ] UNCOVERED: Render a line connecting close prices
- [ ] UNCOVERED: Render with a single bar
- [x] Render with no bars
- [ ] UNCOVERED: Line is clipped to viewport boundaries
- [ ] UNCOVERED: Render a line with exactly two bars
- [ ] UNCOVERED: Line width is configurable via series options

## Feature: Area Series Rendering

- [ ] UNCOVERED: Render an area fill below the line
- [ ] UNCOVERED: Area gradient fill
- [x] Area render with no bars
- [ ] UNCOVERED: Area render with a single bar
- [ ] UNCOVERED: Baseline area fill from a specific price
- [ ] UNCOVERED: Area border line is configurable

## Feature: Series Composition

- [ ] UNCOVERED: Add a series via event
- [ ] UNCOVERED: Overlay multiple series via events
- [ ] UNCOVERED: Reorder series via series:order event
- [x] Remove a series via event
- [x] Show and hide a series via events
- [x] Update series options via event
- [ ] UNCOVERED: Each series has independent styling
- [ ] UNCOVERED: Series re-renders on viewport:changed
- [ ] UNCOVERED: Swap series type via event

## Feature: OHLC Bar Series Rendering

- [ ] UNCOVERED: Render a bullish OHLC bar
- [ ] UNCOVERED: Render a bearish OHLC bar
- [ ] UNCOVERED: Render OHLC bar with no bars

## Feature: Volume Histogram

- [ ] UNCOVERED: Render volume bars below the price chart
- [ ] UNCOVERED: Volume bar color matches candle direction
- [ ] UNCOVERED: Volume area has its own y-scale
- [ ] UNCOVERED: Volume area height is configurable
- [ ] UNCOVERED: Hide volume when series is removed
- [ ] UNCOVERED: Handle bars with zero volume

## Feature: Price Axis Rendering

- [ ] UNCOVERED: Render price axis labels at sensible intervals
- [x] Update axis on viewport:changed
- [ ] UNCOVERED: Handle very small price range
- [ ] UNCOVERED: Handle very large price range
- [ ] UNCOVERED: Price axis width accommodates label length
- [ ] UNCOVERED: Last price marker on price axis
- [ ] UNCOVERED: Price labels include currency symbol from symbol:resolved
- [ ] UNCOVERED: Price axis on the left side
- [ ] UNCOVERED: Drag price axis emits interaction event
- [ ] UNCOVERED: Price axis labels in logarithmic scale

## Feature: Time Axis Rendering

- [ ] UNCOVERED: Render time labels for daily resolution
- [ ] UNCOVERED: Render time labels for intraday resolution
- [ ] UNCOVERED: Labels do not overlap
- [ ] UNCOVERED: Handle gaps in time data (weekends/holidays)
- [x] Display timezone from symbol:resolved
- [ ] UNCOVERED: Configurable timezone override
- [ ] UNCOVERED: Hierarchical time labels at boundary crossings

## Feature: Crosshair

- [ ] UNCOVERED: Show crosshair on mouse move
- [ ] UNCOVERED: Snap crosshair to nearest bar
- [ ] UNCOVERED: Hide crosshair when mouse leaves SVG
- [ ] UNCOVERED: Emit interaction:crosshair on mouse move
- [ ] UNCOVERED: Crosshair tooltip shows OHLCV values
- [ ] UNCOVERED: Crosshair line style from theme
- [ ] UNCOVERED: Crosshair is hidden during pan drag
- [ ] UNCOVERED: Crosshair activation on touch devices
- [ ] UNCOVERED: Crosshair magnet mode is toggleable

## Feature: Pan Interaction

- [ ] UNCOVERED: Emit interaction:pan on mouse drag
- [ ] UNCOVERED: Emit interaction:pan on touch drag
- [ ] UNCOVERED: Viewport updates only via viewport:changed
- [ ] UNCOVERED: Kinetic scrolling emits pan events
- [ ] UNCOVERED: Small mouse movements do not trigger pan
- [ ] UNCOVERED: Right-click drag does not pan

## Feature: Zoom Interaction

- [ ] UNCOVERED: Emit interaction:zoom on mouse wheel up
- [ ] UNCOVERED: Emit interaction:zoom on mouse wheel down
- [ ] UNCOVERED: Emit interaction:zoom on pinch gesture
- [ ] UNCOVERED: Emit interaction:zoom on keyboard shortcut
- [ ] UNCOVERED: Emit interaction:fit on double-click
- [ ] UNCOVERED: Viewport updates only via viewport:changed
- [ ] UNCOVERED: Scroll direction respects natural scrolling setting
- [ ] UNCOVERED: Zoom transition animates between viewport:changed events

## Feature: Theming

- [ ] UNCOVERED: Apply a light theme via event
- [ ] UNCOVERED: Apply a dark theme via event
- [ ] UNCOVERED: Override individual theme properties
- [ ] UNCOVERED: Switch theme without losing chart state
- [ ] UNCOVERED: Custom font family in theme
- [ ] UNCOVERED: Opacity settings for gridlines

## Feature: Render Pipeline

- [ ] UNCOVERED: Batch multiple events into one update
- [ ] UNCOVERED: Skip rendering when nothing changed
- [ ] UNCOVERED: Handle rapid successive events
- [ ] UNCOVERED: RequestAnimationFrame integration
- [ ] UNCOVERED: Pause rendering when tab is hidden

## Feature: Loading State

- [ ] UNCOVERED: Show loading indicator via chart:loading event
- [ ] UNCOVERED: Show loading indicator at specific region
- [ ] UNCOVERED: Hide loading indicator via chart:loading event

## Feature: Empty and Error States

- [ ] UNCOVERED: Display error state via chart:error event
- [ ] UNCOVERED: Clear error state via chart:error null
- [ ] UNCOVERED: Display empty state when series has no data

## Feature: Watermark

- [x] Display symbol name from symbol:resolved event
- [ ] UNCOVERED: Watermark updates on symbol:resolved event
- [ ] UNCOVERED: Watermark is behind all chart elements
- [ ] UNCOVERED: Watermark is configurable

---
**19/143 scenarios covered.**

124 scenario(s) need tests:
- Listen to chart:loading event
- Listen to chart:error event
- Listen to theme:changed event
- Emit interaction:crosshair event
- Emit interaction:click event
- Emit interaction:pan event
- Emit interaction:zoom event
- Emit interaction:fit event
- Emit renderer:ready event
- Emit renderer:destroyed event
- Ignore events for unknown series
- Unsubscribe from all events on destroy
- Initialize SVG in a container
- SVG is resolution-independent
- Respond to container resize
- Handle zero-size container gracefully
- Clean up on destroy
- Initialize in a container with existing children
- Handle container resize to zero
- SVG has correct namespace
- SVG contains layer groups in correct order
- Map time to x-pixel
- Map x-pixel to time
- Map price to y-pixel
- Map y-pixel to price
- Handle time at viewport boundary
- Handle time outside viewport
- Recalculate on viewport:changed event
- Account for axis margins in coordinate mapping
- Map coordinates with logarithmic scale from viewport:changed
- Map coordinates with percentage scale from viewport:changed
- Handle zero price range without division by zero
- Render a bullish candle
- Render a bearish candle
- Render a doji (open equals close)
- Render only visible bars
- Render a single bar
- Scale candle width based on viewport
- Handle bars with zero range (all OHLC values equal)
- Enforce minimum candle width at extreme zoom-out
- Wick is centered and single-pixel wide
- Render a line connecting close prices
- Render with a single bar
- Line is clipped to viewport boundaries
- Render a line with exactly two bars
- Line width is configurable via series options
- Render an area fill below the line
- Area gradient fill
- Area render with a single bar
- Baseline area fill from a specific price
- Area border line is configurable
- Add a series via event
- Overlay multiple series via events
- Reorder series via series:order event
- Each series has independent styling
- Series re-renders on viewport:changed
- Swap series type via event
- Render a bullish OHLC bar
- Render a bearish OHLC bar
- Render OHLC bar with no bars
- Render volume bars below the price chart
- Volume bar color matches candle direction
- Volume area has its own y-scale
- Volume area height is configurable
- Hide volume when series is removed
- Handle bars with zero volume
- Render price axis labels at sensible intervals
- Handle very small price range
- Handle very large price range
- Price axis width accommodates label length
- Last price marker on price axis
- Price labels include currency symbol from symbol:resolved
- Price axis on the left side
- Drag price axis emits interaction event
- Price axis labels in logarithmic scale
- Render time labels for daily resolution
- Render time labels for intraday resolution
- Labels do not overlap
- Handle gaps in time data (weekends/holidays)
- Configurable timezone override
- Hierarchical time labels at boundary crossings
- Show crosshair on mouse move
- Snap crosshair to nearest bar
- Hide crosshair when mouse leaves SVG
- Emit interaction:crosshair on mouse move
- Crosshair tooltip shows OHLCV values
- Crosshair line style from theme
- Crosshair is hidden during pan drag
- Crosshair activation on touch devices
- Crosshair magnet mode is toggleable
- Emit interaction:pan on mouse drag
- Emit interaction:pan on touch drag
- Viewport updates only via viewport:changed
- Kinetic scrolling emits pan events
- Small mouse movements do not trigger pan
- Right-click drag does not pan
- Emit interaction:zoom on mouse wheel up
- Emit interaction:zoom on mouse wheel down
- Emit interaction:zoom on pinch gesture
- Emit interaction:zoom on keyboard shortcut
- Emit interaction:fit on double-click
- Viewport updates only via viewport:changed
- Scroll direction respects natural scrolling setting
- Zoom transition animates between viewport:changed events
- Apply a light theme via event
- Apply a dark theme via event
- Override individual theme properties
- Switch theme without losing chart state
- Custom font family in theme
- Opacity settings for gridlines
- Batch multiple events into one update
- Skip rendering when nothing changed
- Handle rapid successive events
- RequestAnimationFrame integration
- Pause rendering when tab is hidden
- Show loading indicator via chart:loading event
- Show loading indicator at specific region
- Hide loading indicator via chart:loading event
- Display error state via chart:error event
- Clear error state via chart:error null
- Display empty state when series has no data
- Watermark updates on symbol:resolved event
- Watermark is behind all chart elements
- Watermark is configurable
