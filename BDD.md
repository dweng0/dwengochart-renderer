---
language: typescript
framework: react-vite
build_cmd: npm run build
test_cmd: npm test
lint_cmd: npm run lint
fmt_cmd: npm run format
birth_date: 2026-03-23
---

You must only write code and tests that meet the features and scenarios of this behaviour driven development document.

System: A TypeScript SVG rendering library for financial charts, built with D3.js. It is a purely reactive renderer — it listens to inbound events from @dwengochart/core via @yatamazuki/typed-eventbus telling it what to draw, and emits outbound interaction events reporting what the user did. It never decides viewport state, auto-scales, clamps boundaries, or fetches data. All output is SVG DOM elements that can be inspected and asserted on directly in tests.

    Feature: Event Contract
        As a developer
        I want a well-defined event interface between core and renderer
        So that the two packages stay decoupled and testable

        Background:
            Given the renderer is initialized and subscribed to the eventbus

        Scenario: Listen to series:add event
            When a "series:add" event is received with { id: "s1", type: "candlestick", options: {} }
            Then the renderer should create a new SVG group for series "s1" in the series layer
            Note: payload is { id: string, type: string, options?: SeriesOptions }

        Scenario: Listen to series:remove event
            Given a series "s1" exists
            When a "series:remove" event is received with { id: "s1" }
            Then the SVG group for "s1" should be removed from the DOM
            Note: payload is { id: string }

        Scenario: Listen to series:update event
            Given a series "s1" exists with color green
            When a "series:update" event is received with { id: "s1", options: { color: "blue" } }
            Then the series "s1" SVG elements should update to use blue
            Note: payload is { id: string, options: Partial<SeriesOptions> }

        Scenario: Listen to series:show event
            Given a series "s1" exists and is hidden
            When a "series:show" event is received with { id: "s1" }
            Then the SVG group for "s1" should become visible
            Note: payload is { id: string }

        Scenario: Listen to series:hide event
            Given a series "s1" exists and is visible
            When a "series:hide" event is received with { id: "s1" }
            Then the SVG group for "s1" should have display="none"
            Note: payload is { id: string }

        Scenario: Listen to series:type event
            Given a series "s1" exists with type "line"
            When a "series:type" event is received with { id: "s1", type: "area" }
            Then the series "s1" should re-render its data using the area renderer
            Note: payload is { id: string, type: string }

        Scenario: Listen to series:order event
            Given series "s1", "s2", "s3" exist
            When a "series:order" event is received with { ids: ["s3", "s1", "s2"] }
            Then the SVG groups should be reordered to match: s3, s1, s2
            Note: payload is { ids: string[] }

        Scenario: Listen to series:data event
            Given a series "s1" exists with type "candlestick"
            When a "series:data" event is received with { id: "s1", bars: [...] }
            Then the series "s1" should render the provided bars as SVG elements
            Note: payload is { id: string, bars: Bar[] }

        Scenario: Listen to viewport:changed event
            When a "viewport:changed" event is received with { timeRange: [1000, 5000], priceRange: [50, 150] }
            Then the renderer should update its D3 scales to match
            And all series should re-render with the new scales
            Note: payload is { timeRange: [number, number], priceRange: [number, number], priceScale?: "linear" | "logarithmic" | "percentage", basePrice?: number }

        Scenario: Listen to symbol:resolved event for watermark and metadata
            When a "symbol:resolved" event is received with { symbol: { name: "AAPL", currency_code: "USD", timezone: "America/New_York", ... } }
            Then the watermark should update to "AAPL"
            And the price axis should use "$" prefix
            And the time axis should use "America/New_York" timezone
            Note: payload is { symbol: SymbolInfo }

        Scenario: Listen to chart:loading event
            When a "chart:loading" event is received with { loading: true }
            Then a loading indicator should appear in the chart area
            When a "chart:loading" event is received with { loading: false }
            Then the loading indicator should be removed
            Note: payload is { loading: boolean, region?: "left" | "center" }

        Scenario: Listen to chart:error event
            When a "chart:error" event is received with { message: "Failed to load" }
            Then an error message should appear in the chart area
            When a "chart:error" event is received with null
            Then the error message should be cleared
            Note: payload is { message: string } | null

        Scenario: Listen to theme:changed event
            When a "theme:changed" event is received with a dark theme object
            Then all SVG elements should update their fill, stroke, and style attributes
            Note: payload is { theme: Theme }

        Scenario: Emit interaction:crosshair event
            When the user moves the mouse over the chart
            Then the renderer should emit "interaction:crosshair" with { price: number, time: number, x: number, y: number }
            Note: payload is { price: number, time: number, x: number, y: number } | null

        Scenario: Emit interaction:click event
            When the user clicks on the chart
            Then the renderer should emit "interaction:click" with { price: number, time: number, x: number, y: number }
            Note: payload is { price: number, time: number, x: number, y: number }

        Scenario: Emit interaction:pan event
            When the user drags the chart
            Then the renderer should emit "interaction:pan" with { deltaX: number }
            And the renderer should NOT update the viewport itself
            Note: payload is { deltaX: number }

        Scenario: Emit interaction:zoom event
            When the user scrolls the mouse wheel on the chart
            Then the renderer should emit "interaction:zoom" with { delta: number, centerX: number }
            And the renderer should NOT update the viewport itself
            Note: payload is { delta: number, centerX: number }

        Scenario: Emit interaction:fit event
            When the user double-clicks on the chart
            Then the renderer should emit "interaction:fit" with {}
            And the renderer should NOT update the viewport itself
            Note: payload is {}

        Scenario: Emit renderer:ready event
            When the renderer has finished initializing the SVG
            Then it should emit "renderer:ready" with {}
            Note: payload is {}

        Scenario: Emit renderer:destroyed event
            When the renderer is destroyed
            Then it should emit "renderer:destroyed" with {}
            Note: payload is {}

        Scenario: Ignore events for unknown series
            When a "series:data" event is received with { id: "nonexistent", bars: [...] }
            Then no error should be thrown
            And no SVG elements should be created

        Scenario: Unsubscribe from all events on destroy
            Given the renderer is subscribed to eventbus events
            When the renderer is destroyed
            Then all eventbus subscriptions should be removed

    Feature: SVG Container Setup
        As a developer
        I want the renderer to initialize an SVG element with correct sizing
        So that the chart displays crisply on all screens

        Scenario: Initialize SVG in a container
            Given a container div of width 800 and height 600
            When the renderer is initialized with that container
            Then an SVG element should be created inside the container
            And the SVG viewBox should be "0 0 800 600"
            And the SVG width and height attributes should be "100%"
            And a "renderer:ready" event should be emitted

        Scenario: SVG is resolution-independent
            Given a container div of width 800 and height 600
            And the device pixel ratio is 2
            When the renderer is initialized
            Then the SVG should render crisply without any buffer scaling
            And the viewBox should remain "0 0 800 600"

        Scenario: Respond to container resize
            Given an initialized renderer in a container of width 800 and height 600
            When the container is resized to 1024x768
            Then the SVG viewBox should update to "0 0 1024 768"
            And all series should re-render with updated scales

        Scenario: Handle zero-size container gracefully
            Given a container div of width 0 and height 0
            When the renderer is initialized
            Then the renderer should not throw
            And no SVG child elements should be created

        Scenario: Clean up on destroy
            Given an initialized renderer
            When the renderer is destroyed
            Then the SVG element should be removed from the container
            And all DOM event listeners should be detached
            And all eventbus subscriptions should be unsubscribed
            And a "renderer:destroyed" event should be emitted

        Scenario: Initialize in a container with existing children
            Given a container div that already has child elements
            When the renderer is initialized with that container
            Then the SVG should be appended without removing existing children

        Scenario: Handle container resize to zero
            Given an initialized renderer in a container of width 800 and height 600
            When the container is resized to 0x0
            Then all SVG child elements should be cleared
            And no errors should be thrown

        Scenario: SVG has correct namespace
            Given a container div of width 800 and height 600
            When the renderer is initialized
            Then the SVG element should use the "http://www.w3.org/2000/svg" namespace

        Scenario: SVG contains layer groups in correct order
            When the renderer is initialized
            Then the SVG should contain ordered g elements: background, watermark, gridlines, series, axes, crosshair, overlays
            And each g element should have a descriptive class name

    Feature: Coordinate Mapping
        As a developer
        I want to convert between pixel coordinates and price/time values
        So that interactions and rendering use the correct positions

        Background:
            Given a renderer initialized with SVG viewBox 800x600
            And a "viewport:changed" event received with { timeRange: [1000, 5000], priceRange: [50, 150] }

        Scenario: Map time to x-pixel
            When time 3000 is mapped to a pixel x-coordinate
            Then the result should be 400 (midpoint of 800px for midpoint of time range)

        Scenario: Map x-pixel to time
            When pixel x 400 is mapped to a time
            Then the result should be 3000

        Scenario: Map price to y-pixel
            When price 100 is mapped to a pixel y-coordinate
            Then the result should be 300 (midpoint of 600px for midpoint of price range, y-axis inverted)

        Scenario: Map y-pixel to price
            When pixel y 300 is mapped to a price
            Then the result should be 100

        Scenario: Handle time at viewport boundary
            When time 1000 is mapped to a pixel x-coordinate
            Then the result should be 0

        Scenario: Handle time outside viewport
            When time 0 is mapped to a pixel x-coordinate
            Then the result should be negative (off-screen left)

        Scenario: Recalculate on viewport:changed event
            Given a "viewport:changed" event is received with { timeRange: [2000, 6000] }
            When time 4000 is mapped to a pixel x-coordinate
            Then the result should reflect the new range

        Scenario: Account for axis margins in coordinate mapping
            Given a price axis width of 70px on the right
            And a time axis height of 30px on the bottom
            Then the chart drawing area should be (800 - 70) x (600 - 30) = 730x570
            And time-to-pixel mapping should use the 730px drawing width
            And price-to-pixel mapping should use the 570px drawing height

        Scenario: Map coordinates with logarithmic scale from viewport:changed
            Given a "viewport:changed" event with { priceScale: "logarithmic", priceRange: [10, 1000] }
            When price 100 is mapped to a pixel y-coordinate
            Then the result should be at the midpoint (log(100) is midway between log(10) and log(1000))

        Scenario: Map coordinates with percentage scale from viewport:changed
            Given a "viewport:changed" event with { priceScale: "percentage", basePrice: 100, priceRange: [-10, 10] }
            When price 105 is mapped to a pixel y-coordinate
            Then the result should correspond to +5%

        Scenario: Handle zero price range without division by zero
            Given a "viewport:changed" event with { priceRange: [100, 100] }
            When price 100 is mapped to a pixel y-coordinate
            Then the result should be the vertical center of the chart
            And no division-by-zero error should occur

    Feature: Candlestick Series Rendering
        As a user
        I want to see OHLCV data rendered as candlesticks
        So that I can visually analyze price movements

        Background:
            Given the renderer is initialized
            And a "series:add" event is received with { id: "candles", type: "candlestick" }
            And a "viewport:changed" event has been received

        Scenario: Render a bullish candle
            When a "series:data" event is received with a bar where open 100, high 110, low 95, close 108
            Then a rect SVG element should represent the body from 100 to 108 with the bullish fill color
            And line SVG elements should represent wicks from 95 to 100 and from 108 to 110

        Scenario: Render a bearish candle
            When a "series:data" event is received with a bar where open 108, high 110, low 95, close 100
            Then a rect SVG element should represent the body from 108 to 100 with the bearish fill color
            And line SVG elements should represent wicks from 95 to 100 and from 108 to 110

        Scenario: Render a doji (open equals close)
            When a "series:data" event is received with a bar where open 100, high 105, low 95, close 100
            Then a line SVG element should represent the body as a horizontal line at 100
            And line SVG elements should represent wicks from 95 to 100 and from 100 to 105

        Scenario: Render only visible bars
            Given a "series:data" event with 1000 bars
            And a "viewport:changed" event showing bars 200 through 300
            When the series is rendered
            Then only SVG elements for bars 200 through 300 should exist in the DOM
            And no SVG elements should exist for bars outside the viewport

        Scenario: Render with no bars
            When a "series:data" event is received with an empty bars array
            Then no candlestick SVG elements should exist in the series group
            And no errors should be thrown

        Scenario: Render a single bar
            When a "series:data" event is received with one bar
            Then one candlestick group should exist centered in the viewport

        Scenario: Scale candle width based on viewport
            Given a "series:data" event with 50 bars
            And a "viewport:changed" event showing all 50 bars
            When the series is rendered
            Then each candle rect width should be proportional to available pixel space
            And there should be visible gaps between candles

        Scenario: Handle bars with zero range (all OHLC values equal)
            When a "series:data" event is received with a bar where open 100, high 100, low 100, close 100
            Then a line SVG element should represent a horizontal line at 100

        Scenario: Enforce minimum candle width at extreme zoom-out
            Given a "series:data" event with 5000 bars in a 800px wide chart
            And a "viewport:changed" event showing all 5000 bars
            When the series is rendered
            Then each candle rect should be at least 1 pixel wide

        Scenario: Wick is centered and single-pixel wide
            Given a bar with visible body and wicks
            When the bar is rendered
            Then the wick line should have stroke-width of 1
            And the wick line x-position should be horizontally centered on the candle body rect

    Feature: Line Series Rendering
        As a user
        I want to see close prices rendered as a connected line
        So that I can see the price trend clearly

        Background:
            Given the renderer is initialized
            And a "series:add" event is received with { id: "line1", type: "line" }
            And a "viewport:changed" event has been received

        Scenario: Render a line connecting close prices
            When a "series:data" event is received with bars with close prices [100, 105, 102, 108, 103]
            Then a path SVG element should exist with a "d" attribute tracing through each close price point

        Scenario: Render with a single bar
            When a "series:data" event is received with one bar with close 100
            Then a circle SVG element should be drawn at the close price position

        Scenario: Render with no bars
            When a "series:data" event is received with an empty bars array
            Then no path or circle SVG elements should exist in the series group

        Scenario: Line is clipped to viewport boundaries
            Given a "series:data" event with bars extending beyond the viewport
            When the series is rendered
            Then a clipPath should constrain the line path to the chart drawing area
            And no visual artifacts should appear outside the viewport

        Scenario: Render a line with exactly two bars
            When a "series:data" event is received with bars with close prices [100, 105]
            Then a path SVG element should contain a single line segment between the two points

        Scenario: Line width is configurable via series options
            Given a "series:add" event with { id: "line1", type: "line", options: { strokeWidth: 2 } }
            When a "series:data" event is received with bars
            Then the path SVG element should have stroke-width of 2

    Feature: Area Series Rendering
        As a user
        I want to see close prices rendered as a filled area
        So that I can see the price trend with volume emphasis

        Background:
            Given the renderer is initialized
            And a "series:add" event is received with { id: "area1", type: "area" }
            And a "viewport:changed" event has been received

        Scenario: Render an area fill below the line
            When a "series:data" event is received with bars with close prices [100, 105, 102, 108]
            Then a path SVG element should trace the close prices and close back to the bottom axis
            And the path should have a fill color matching the area theme color

        Scenario: Area gradient fill
            Given a "series:add" event with { id: "area1", type: "area", options: { gradient: true } }
            When a "series:data" event is received with bars
            Then an SVG linearGradient element should be defined in defs
            And the area path should reference the gradient via fill="url(#...)"

        Scenario: Area render with no bars
            When a "series:data" event is received with an empty bars array
            Then no area path SVG elements should exist in the series group

        Scenario: Area render with a single bar
            When a "series:data" event is received with one bar with close 100
            Then a rect SVG element should fill from the close price to the bottom axis

        Scenario: Baseline area fill from a specific price
            Given a "series:add" event with { id: "area1", type: "area", options: { baseline: 100 } }
            When a "series:data" event is received with bars with close prices [95, 105, 98, 110]
            Then a path above baseline 100 should be filled with the positive color
            And a path below baseline 100 should be filled with the negative color

        Scenario: Area border line is configurable
            Given a "series:add" event with { id: "area1", type: "area", options: { borderWidth: 2, borderColor: "blue" } }
            When a "series:data" event is received with bars
            Then the top line path of the area should have stroke-width 2 and stroke color blue

    Feature: Series Composition
        As a developer
        I want to layer multiple series renderers in the same chart
        So that I can overlay indicators, compare instruments, and swap rendering styles

        Background:
            Given the renderer is initialized

        Scenario: Add a series via event
            When a "series:add" event is received with { id: "s1", type: "candlestick", options: {} }
            Then a new SVG g element for "s1" should appear in the series layer

        Scenario: Overlay multiple series via events
            Given a "series:add" event for { id: "candles", type: "candlestick" }
            And a "series:add" event for { id: "ma20", type: "line", options: { color: "orange" } }
            When both receive "series:data" events with bar data
            Then both should have their own SVG group within the series layer
            And the "ma20" group should be rendered on top of the "candles" group

        Scenario: Reorder series via series:order event
            Given series "s1", "s2", "s3" exist
            When a "series:order" event is received with { ids: ["s3", "s1", "s2"] }
            Then the SVG groups should be reordered to match: s3, s1, s2

        Scenario: Remove a series via event
            Given series "s1" and "s2" exist
            When a "series:remove" event is received with { id: "s1" }
            Then the SVG group for "s1" should be removed from the DOM
            And series "s2" should continue to render

        Scenario: Show and hide a series via events
            Given a series "s1" exists and is visible
            When a "series:hide" event is received with { id: "s1" }
            Then the SVG group for "s1" should have display="none"
            When a "series:show" event is received with { id: "s1" }
            Then the SVG group for "s1" should become visible again

        Scenario: Update series options via event
            Given a line series "s1" with color blue
            When a "series:update" event is received with { id: "s1", options: { color: "red" } }
            Then the series "s1" path element should update to stroke red
            And the underlying bar data should not change

        Scenario: Each series has independent styling
            Given a "series:add" for { id: "line1", type: "line", options: { color: "blue" } }
            And a "series:add" for { id: "line2", type: "line", options: { color: "red" } }
            When both receive "series:data" events
            Then each path element should use its own stroke color

        Scenario: Series re-renders on viewport:changed
            Given a series "s1" with bar data
            When a "viewport:changed" event is received with a new time range
            Then series "s1" should re-render its SVG elements with updated scales

        Scenario: Swap series type via event
            Given a series "s1" of type "line" with bar data
            When a "series:type" event is received with { id: "s1", type: "area" }
            Then the line SVG elements should be replaced with area SVG elements
            And the same bar data should be used

    Feature: OHLC Bar Series Rendering
        As a user
        I want to see OHLCV data rendered as OHLC bars with tick marks
        So that I can see price data in a compact bar format

        Background:
            Given the renderer is initialized
            And a "series:add" event is received with { id: "ohlc1", type: "ohlc" }
            And a "viewport:changed" event has been received

        Scenario: Render a bullish OHLC bar
            When a "series:data" event is received with a bar where open 100, high 110, low 95, close 108
            Then a vertical line SVG element should span from 95 to 110
            And a left tick line element should appear at 100 (open)
            And a right tick line element should appear at 108 (close)
            And all elements should have the bullish stroke color

        Scenario: Render a bearish OHLC bar
            When a "series:data" event is received with a bar where open 108, high 110, low 95, close 100
            Then a vertical line SVG element should span from 95 to 110
            And a left tick line element should appear at 108 (open)
            And a right tick line element should appear at 100 (close)
            And all elements should have the bearish stroke color

        Scenario: Render OHLC bar with no bars
            When a "series:data" event is received with an empty bars array
            Then no OHLC bar SVG elements should exist in the series group

    Feature: Volume Histogram
        As a user
        I want to see volume data rendered as a histogram below the price chart
        So that I can see trading activity alongside price movements

        Background:
            Given the renderer is initialized
            And a "series:add" event is received with { id: "vol", type: "volume" }

        Scenario: Render volume bars below the price chart
            When a "series:data" event is received with bars with volume data [1000, 2000, 500, 3000, 1500]
            Then rect SVG elements should be drawn in a dedicated group below the main chart
            And volume rects should align horizontally with their corresponding price bars

        Scenario: Volume bar color matches candle direction
            When a "series:data" event is received with a bullish bar (volume 1000) and a bearish bar (volume 2000)
            Then the bullish volume rect should have the bullish fill color
            And the bearish volume rect should have the bearish fill color

        Scenario: Volume area has its own y-scale
            When a "series:data" event is received with bars with volumes ranging from 100 to 10000
            Then the tallest volume rect should fill the volume area height
            And shorter rects should be proportional

        Scenario: Volume area height is configurable
            Given a "series:add" event with { id: "vol", type: "volume", options: { heightPercent: 20 } }
            When the chart is rendered
            Then the bottom 20% should be reserved for the volume group
            And the top 80% should be used for the price chart group

        Scenario: Hide volume when series is removed
            Given volume bars are rendered
            When a "series:remove" event is received with { id: "vol" }
            Then the volume group should be removed
            And the full chart height should be used for the price chart

        Scenario: Handle bars with zero volume
            When a "series:data" event is received with a bar with volume 0
            Then a minimal-height or invisible rect should exist for that position

    Feature: Price Axis Rendering
        As a user
        I want to see a vertical price axis with labels
        So that I can read the values on the chart

        Background:
            Given the renderer is initialized
            And a "viewport:changed" event is received with { priceRange: [50, 150] }

        Scenario: Render price axis labels at sensible intervals
            When the price axis is rendered
            Then text SVG elements should appear at round-number intervals (e.g. 60, 80, 100, 120, 140)
            And line SVG elements should extend horizontally across the chart as gridlines

        Scenario: Update axis on viewport:changed
            Given price axis labels are rendered for range [50, 150]
            When a "viewport:changed" event is received with { priceRange: [95, 110] }
            Then the axis text elements should recalculate for the new range

        Scenario: Handle very small price range
            When a "viewport:changed" event is received with { priceRange: [100.01, 100.05] }
            Then text elements should show sufficient decimal precision
            And the interval between labels should be appropriate for the range

        Scenario: Handle very large price range
            When a "viewport:changed" event is received with { priceRange: [1, 100000] }
            Then text elements should use abbreviated notation or appropriate intervals
            And the axis should remain readable

        Scenario: Price axis width accommodates label length
            Given labels like "100,000.00"
            When the price axis is rendered
            Then the axis group should be wide enough to display the longest text element without clipping

        Scenario: Last price marker on price axis
            Given a series with the latest bar having close price 102.50
            When the price axis is rendered
            Then a highlighted text element should appear at 102.50 on the price axis
            And a horizontal dashed line element should extend across the chart at that price

        Scenario: Price labels include currency symbol from symbol:resolved
            Given a "symbol:resolved" event is received with { symbol: { name: "AAPL", currency_code: "USD" } }
            When the price axis is rendered
            Then text elements should be prefixed with "$"

        Scenario: Price axis on the left side
            Given the renderer is configured with price axis on the left
            When the price axis is rendered
            Then the axis group should be positioned on the left side of the SVG
            And the chart drawing area should adjust accordingly

        Scenario: Drag price axis emits interaction event
            Given the price axis is rendered
            When the user clicks and drags vertically on the price axis
            Then the renderer should emit "interaction:zoom" with the drag delta
            And the renderer should NOT update the price range itself

        Scenario: Price axis labels in logarithmic scale
            Given a "viewport:changed" event with { priceScale: "logarithmic", priceRange: [10, 10000] }
            When the price axis is rendered
            Then text elements should be spaced logarithmically (e.g. 10, 100, 1000, 10000)

    Feature: Time Axis Rendering
        As a user
        I want to see a horizontal time axis with labels
        So that I can read the dates and times on the chart

        Background:
            Given the renderer is initialized
            And a "viewport:changed" event has been received

        Scenario: Render time labels for daily resolution
            Given a "viewport:changed" event with timeRange spanning 30 days at "1D" resolution
            When the time axis is rendered
            Then text SVG elements should show dates at sensible intervals (e.g. every 5 days)

        Scenario: Render time labels for intraday resolution
            Given a "viewport:changed" event with timeRange spanning 8 hours at "5" resolution
            When the time axis is rendered
            Then text SVG elements should show hours and minutes at sensible intervals

        Scenario: Labels do not overlap
            Given any viewport:changed event
            When the time axis is rendered
            Then no two text elements should overlap horizontally

        Scenario: Handle gaps in time data (weekends/holidays)
            Given a "series:data" event with daily bars that skip Saturday and Sunday
            When the time axis is rendered
            Then the time axis should not leave large visual gaps for non-trading days

        Scenario: Display timezone from symbol:resolved
            Given a "symbol:resolved" event with { symbol: { name: "AAPL", timezone: "America/New_York" } }
            When the time axis is rendered
            Then times should be displayed in the symbol's timezone

        Scenario: Configurable timezone override
            Given the renderer is configured with timezone "UTC"
            When the time axis is rendered
            Then times should be displayed in UTC regardless of symbol timezone

        Scenario: Hierarchical time labels at boundary crossings
            Given a "viewport:changed" event with timeRange spanning multiple months at "1D" resolution
            When the time axis is rendered
            Then day text elements should appear at regular intervals
            And month text elements should appear at month boundaries
            And year text elements should appear at year boundaries

    Feature: Crosshair
        As a user
        I want a crosshair that follows my mouse/touch position
        So that I can see the exact price and time at any point on the chart

        Background:
            Given the renderer is initialized with crosshair enabled
            And a "viewport:changed" event has been received

        Scenario: Show crosshair on mouse move
            When the mouse moves to pixel position (400, 300)
            Then a vertical line SVG element should be positioned at x=400
            And a horizontal line SVG element should be positioned at y=300
            And price and time text elements should appear on the axes

        Scenario: Snap crosshair to nearest bar
            Given a series with bar data has been rendered
            When the mouse moves near a bar
            Then the crosshair vertical line should snap to the bar's x-position
            And the price text element should show the bar's close value

        Scenario: Hide crosshair when mouse leaves SVG
            Given the crosshair is visible
            When the mouse leaves the SVG element
            Then the crosshair group should be hidden (display="none" or removed)
            And an "interaction:crosshair" event should be emitted with null

        Scenario: Emit interaction:crosshair on mouse move
            When the mouse moves to a position mapping to time 3000 and price 100
            Then an "interaction:crosshair" event should be emitted with { price: 100, time: 3000, x: 400, y: 300 }

        Scenario: Crosshair tooltip shows OHLCV values
            Given a series with bar data has been rendered
            When the crosshair hovers over a bar
            Then tooltip text elements should display open, high, low, close, and volume values for that bar

        Scenario: Crosshair line style from theme
            Given a "theme:changed" event with crosshair line style as dashed
            When the crosshair is rendered
            Then the crosshair line elements should have stroke-dasharray set for a dashed pattern

        Scenario: Crosshair is hidden during pan drag
            Given the crosshair is visible
            When the user begins a pan drag
            Then the crosshair should be hidden
            And the crosshair should reappear when the drag ends

        Scenario: Crosshair activation on touch devices
            Given the renderer is on a touch device
            When the user performs a long-press on the chart
            Then the crosshair should appear at the touch position
            And the crosshair should follow subsequent touch movements
            And the crosshair should hide when the touch ends

        Scenario: Crosshair magnet mode is toggleable
            Given crosshair magnet mode is disabled
            When the mouse moves between two bars
            Then the crosshair should remain at the exact mouse position without snapping

    Feature: Pan Interaction
        As a user
        I want to drag the chart to pan through time
        So that I can explore historical data

        Background:
            Given the renderer is initialized with pan enabled

        Scenario: Emit interaction:pan on mouse drag
            When the user clicks and drags 100 pixels to the right
            Then the renderer should emit "interaction:pan" with { deltaX: 100 }
            And the renderer should NOT update the viewport itself

        Scenario: Emit interaction:pan on touch drag
            When the user performs a single-finger touch drag 100 pixels to the right
            Then the renderer should emit "interaction:pan" with { deltaX: 100 }

        Scenario: Viewport updates only via viewport:changed
            Given the user drags the chart
            And the renderer emits "interaction:pan"
            When a "viewport:changed" event is received with the new range from core
            Then the chart should re-render with the new viewport

        Scenario: Kinetic scrolling emits pan events
            Given the user is dragging the chart at velocity
            When the user releases the drag
            Then the renderer should emit a series of "interaction:pan" events with decelerating deltaX values
            And the momentum should eventually stop

        Scenario: Small mouse movements do not trigger pan
            Given the user clicks on the chart
            When the mouse moves less than 3 pixels before release
            Then no "interaction:pan" event should be emitted
            And an "interaction:click" event should be emitted instead

        Scenario: Right-click drag does not pan
            Given the user right-clicks on the chart
            When the user drags with the right mouse button
            Then no "interaction:pan" event should be emitted

    Feature: Zoom Interaction
        As a user
        I want to zoom in and out of the chart
        So that I can view data at different levels of detail

        Background:
            Given the renderer is initialized with zoom enabled

        Scenario: Emit interaction:zoom on mouse wheel up
            When the user scrolls the mouse wheel up at position x=400
            Then the renderer should emit "interaction:zoom" with { delta: positive, centerX: 400 }

        Scenario: Emit interaction:zoom on mouse wheel down
            When the user scrolls the mouse wheel down at position x=400
            Then the renderer should emit "interaction:zoom" with { delta: negative, centerX: 400 }

        Scenario: Emit interaction:zoom on pinch gesture
            When the user performs a two-finger pinch gesture centered at x=300
            Then the renderer should emit "interaction:zoom" with { delta, centerX: 300 }

        Scenario: Emit interaction:zoom on keyboard shortcut
            Given the chart has focus
            When the user presses the "+" key
            Then the renderer should emit "interaction:zoom" with { delta: positive, centerX: center }
            When the user presses the "-" key
            Then the renderer should emit "interaction:zoom" with { delta: negative, centerX: center }

        Scenario: Emit interaction:fit on double-click
            When the user double-clicks on the chart
            Then the renderer should emit "interaction:fit" with {}
            And the renderer should NOT update the viewport itself

        Scenario: Viewport updates only via viewport:changed
            Given the user zooms the chart
            And the renderer emits "interaction:zoom"
            When a "viewport:changed" event is received with the new range from core
            Then the chart should re-render with the new viewport

        Scenario: Scroll direction respects natural scrolling setting
            Given the renderer is configured for natural scrolling (inverted)
            When the user scrolls up on a trackpad
            Then the "interaction:zoom" delta should be negative (zoom out)

        Scenario: Zoom transition animates between viewport:changed events
            Given the current viewport is rendered
            When a "viewport:changed" event is received with a new range
            Then the transition should animate smoothly using D3 transitions
            And intermediate states should be rendered during the transition

    Feature: Theming
        As a developer
        I want to apply visual themes to the chart
        So that the chart matches the application's design

        Background:
            Given the renderer is initialized

        Scenario: Apply a light theme via event
            When a "theme:changed" event is received with a light theme
            Then the background rect should have a white fill
            And gridline elements should have a light gray stroke
            And bullish candle rects should have green fill and bearish candle rects should have red fill

        Scenario: Apply a dark theme via event
            When a "theme:changed" event is received with a dark theme
            Then the background rect should have a dark fill
            And gridline elements should have a dark gray stroke
            And text elements should have a light fill color

        Scenario: Override individual theme properties
            Given a "theme:changed" event with a dark theme has been received
            When a "theme:changed" event with partial overrides is received (e.g. bullish color changed to blue)
            Then only the overridden SVG attributes should change
            And all other theme properties should remain from the dark theme

        Scenario: Switch theme without losing chart state
            Given a chart with series and bar data rendered in a light theme
            When a "theme:changed" event with a dark theme is received
            Then the bars and viewport should remain the same
            And only the SVG fill, stroke, and style attributes should change

        Scenario: Custom font family in theme
            When a "theme:changed" event with font family "Inter" is received
            Then all text SVG elements (axis labels, tooltips) should have font-family "Inter"

        Scenario: Opacity settings for gridlines
            When a "theme:changed" event with gridline opacity 0.3 is received
            Then gridline elements should have opacity="0.3" or stroke-opacity="0.3"

    Feature: Render Pipeline
        As a developer
        I want a structured render pipeline
        So that DOM updates are batched efficiently without redundant work

        Scenario: Batch multiple events into one update
            Given a "viewport:changed" event and a "series:data" event arrive in the same tick
            When the render pipeline processes
            Then only one DOM update pass should occur (not two)

        Scenario: Skip rendering when nothing changed
            Given no events have been received since the last render
            When the render loop ticks
            Then no DOM mutations should occur

        Scenario: Handle rapid successive events
            Given 100 "series:data" events arrive within 16ms
            When the render pipeline processes
            Then at most one DOM update should occur for that 16ms window
            And the update should reflect the latest data

        Scenario: RequestAnimationFrame integration
            Given the renderer is active
            When events are received
            Then DOM updates should be scheduled via requestAnimationFrame
            And should not block the main thread

        Scenario: Pause rendering when tab is hidden
            Given the renderer is active
            When the browser tab becomes hidden
            Then rendering should pause
            And when the tab becomes visible again, a single update should apply the latest state from accumulated events

    Feature: Loading State
        As a user
        I want to see visual feedback while data is loading
        So that I know the chart is working and not broken

        Scenario: Show loading indicator via chart:loading event
            When a "chart:loading" event is received with { loading: true }
            Then a loading indicator SVG group should be visible in the chart area

        Scenario: Show loading indicator at specific region
            When a "chart:loading" event is received with { loading: true, region: "left" }
            Then a loading indicator should appear at the left edge of the chart

        Scenario: Hide loading indicator via chart:loading event
            Given a loading indicator is displayed
            When a "chart:loading" event is received with { loading: false }
            Then the loading indicator group should be hidden or removed

    Feature: Empty and Error States
        As a user
        I want to see clear feedback when there is no data or an error occurs
        So that I understand the chart state

        Scenario: Display error state via chart:error event
            When a "chart:error" event is received with { message: "Failed to load data" }
            Then a text SVG element with "Failed to load data" should be displayed in the chart area

        Scenario: Clear error state via chart:error null
            Given an error message is displayed
            When a "chart:error" event is received with null
            Then the error text element should be removed

        Scenario: Display empty state when series has no data
            Given a series exists but has received a "series:data" event with an empty bars array
            And no "chart:loading" or "chart:error" events are active
            Then a text SVG element with "No data available" should be displayed in the chart area

    Feature: Watermark
        As a user
        I want to see the symbol name as a watermark in the chart background
        So that I always know which instrument I am viewing

        Scenario: Display symbol name from symbol:resolved event
            When a "symbol:resolved" event is received with { symbol: { name: "AAPL" } }
            Then a text SVG element with "AAPL" should exist with a large font size and low opacity in the center of the chart area

        Scenario: Watermark updates on symbol:resolved event
            Given the watermark shows "AAPL"
            When a "symbol:resolved" event is received with { symbol: { name: "GOOG" } }
            Then the watermark text element content should update to "GOOG"

        Scenario: Watermark is behind all chart elements
            When the SVG is rendered
            Then the watermark text element should be in the watermark group, rendered after background but before gridlines and series groups

        Scenario: Watermark is configurable
            Given the renderer is configured with watermark disabled
            When a "symbol:resolved" event is received
            Then no watermark text element should exist in the SVG
