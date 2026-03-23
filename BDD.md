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

System: A TypeScript canvas rendering library for financial charts. It listens to state change events from @dwengochart/core via @yatamazuki/typed-eventbus and draws series (candlestick, line, area), axes, gridlines, crosshairs, and interaction overlays onto an HTML Canvas. It handles coordinate mapping between pixel space and price/time space, user interactions (pan, zoom, crosshair), theming, and responsive resizing.

    Feature: Canvas Setup
        As a developer
        I want the renderer to initialize a canvas with correct sizing and pixel density
        So that the chart displays crisply on all screens

        Scenario: Initialize canvas in a container
            Given a container div of width 800 and height 600
            When the renderer is initialized with that container
            Then a canvas element should be created inside the container
            And the canvas logical size should be 800x600

        Scenario: Handle high-DPI displays
            Given a container div of width 800 and height 600
            And the device pixel ratio is 2
            When the renderer is initialized
            Then the canvas buffer size should be 1600x1200
            And the canvas CSS size should be 800x600
            And the drawing context should be scaled by 2

        Scenario: Respond to container resize
            Given an initialized renderer in a container of width 800 and height 600
            When the container is resized to 1024x768
            Then the canvas should resize to match
            And a full redraw should be triggered

        Scenario: Handle zero-size container gracefully
            Given a container div of width 0 and height 0
            When the renderer is initialized
            Then the renderer should not throw
            And no drawing operations should occur

        Scenario: Clean up on destroy
            Given an initialized renderer
            When the renderer is destroyed
            Then the canvas element should be removed from the container
            And all event listeners should be detached
            And all eventbus subscriptions should be unsubscribed

        Scenario: Initialize in a container with existing children
            Given a container div that already has child elements
            When the renderer is initialized with that container
            Then the canvas should be appended without removing existing children

        Scenario: Handle DPI change mid-session
            Given an initialized renderer with device pixel ratio 2
            When the device pixel ratio changes to 1
            Then the canvas buffer should resize to match the new DPI
            And a full redraw should be triggered

        Scenario: Handle fractional DPI
            Given a container div of width 800 and height 600
            And the device pixel ratio is 1.5
            When the renderer is initialized
            Then the canvas buffer size should be 1200x900
            And rendering should remain crisp without subpixel blurring

    Feature: Coordinate Mapping
        As a developer
        I want to convert between pixel coordinates and price/time values
        So that interactions and rendering use the correct positions

        Background:
            Given a renderer with canvas size 800x600
            And a visible time range from 1000 to 5000
            And a visible price range from 50 to 150

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

        Scenario: Recalculate on viewport change
            Given the visible time range changes to from 2000 to 6000
            When time 4000 is mapped to a pixel x-coordinate
            Then the result should reflect the new range

        Scenario: Account for axis margins in coordinate mapping
            Given a price axis width of 70px on the right
            And a time axis height of 30px on the bottom
            Then the chart drawing area should be (800 - 70) x (600 - 30) = 730x570
            And time-to-pixel mapping should use the 730px drawing width
            And price-to-pixel mapping should use the 570px drawing height

        Scenario: Map coordinates in logarithmic price scale
            Given the price scale is set to logarithmic
            And the visible price range is from 10 to 1000
            When price 100 is mapped to a pixel y-coordinate
            Then the result should be at the midpoint (log(100) is midway between log(10) and log(1000))

        Scenario: Map coordinates in percentage scale
            Given the percentage scale is enabled
            And the first visible bar has close price 100
            And the visible price range is -10% to +10%
            When price 105 is mapped to a pixel y-coordinate
            Then the result should correspond to +5%

        Scenario: Handle zero price range without division by zero
            Given all visible bars have the same price of 100
            When price 100 is mapped to a pixel y-coordinate
            Then the result should be the vertical center of the chart
            And no division-by-zero error should occur

    Feature: Candlestick Series Rendering
        As a user
        I want to see OHLCV data rendered as candlesticks
        So that I can visually analyze price movements

        Background:
            Given the renderer is initialized with a candlestick series type

        Scenario: Render a bullish candle
            Given a bar with open 100, high 110, low 95, and close 108
            When the bar is rendered
            Then it should draw a filled body from 100 to 108 in the bullish color
            And wicks from 95 to 100 and from 108 to 110

        Scenario: Render a bearish candle
            Given a bar with open 108, high 110, low 95, and close 100
            When the bar is rendered
            Then it should draw a filled body from 108 to 100 in the bearish color
            And wicks from 95 to 100 and from 108 to 110

        Scenario: Render a doji (open equals close)
            Given a bar with open 100, high 105, low 95, and close 100
            When the bar is rendered
            Then it should draw a horizontal line at 100 for the body
            And wicks from 95 to 100 and from 100 to 105

        Scenario: Render only visible bars
            Given 1000 bars in the store
            And the viewport shows bars 200 through 300
            When the series is rendered
            Then only bars 200 through 300 should be drawn
            And no draw calls should occur for bars outside the viewport

        Scenario: Render with no bars
            Given the bar store is empty
            When the series is rendered
            Then no candle draw calls should occur
            And no errors should be thrown

        Scenario: Render a single bar
            Given only one bar in the store
            When the series is rendered
            Then one candle should be drawn centered in the viewport

        Scenario: Scale candle width based on zoom level
            Given 50 visible bars
            When the series is rendered
            Then each candle width should be proportional to available pixel space
            And there should be visible gaps between candles

        Scenario: Handle bars with zero range (all OHLC values equal)
            Given a bar with open 100, high 100, low 100, and close 100
            When the bar is rendered
            Then it should draw a horizontal line at 100

        Scenario: Enforce minimum candle width at extreme zoom-out
            Given 5000 visible bars in a 800px wide chart
            When the series is rendered
            Then each candle should be at least 1 pixel wide
            And candles may overlap or be drawn as vertical lines

        Scenario: Wick is centered and single-pixel wide
            Given a bar with visible body and wicks
            When the bar is rendered
            Then the wick should be 1 pixel wide
            And the wick should be horizontally centered on the candle body

    Feature: Line Series Rendering
        As a user
        I want to see close prices rendered as a connected line
        So that I can see the price trend clearly

        Background:
            Given the renderer is initialized with a line series type

        Scenario: Render a line connecting close prices
            Given bars with close prices [100, 105, 102, 108, 103]
            When the series is rendered
            Then a continuous line path should be drawn through each close price point

        Scenario: Render with a single bar
            Given one bar with close 100
            When the series is rendered
            Then a single point or dot should be drawn at the close price

        Scenario: Render with no bars
            Given the bar store is empty
            When the series is rendered
            Then no line draw calls should occur

        Scenario: Line is clipped to viewport boundaries
            Given bars extending beyond the viewport on both sides
            When the series is rendered
            Then the line should be clipped at the canvas edges
            And no artifacts should appear outside the viewport

        Scenario: Render a line with exactly two bars
            Given bars with close prices [100, 105]
            When the series is rendered
            Then a single line segment should be drawn between the two points

        Scenario: Line width is configurable via theme
            Given the theme specifies a line width of 2
            When the series is rendered
            Then the line should be drawn with width 2

    Feature: Area Series Rendering
        As a user
        I want to see close prices rendered as a filled area
        So that I can see the price trend with volume emphasis

        Background:
            Given the renderer is initialized with an area series type

        Scenario: Render an area fill below the line
            Given bars with close prices [100, 105, 102, 108]
            When the series is rendered
            Then a line path should be drawn through the close prices
            And the area between the line and the bottom axis should be filled with the area color

        Scenario: Area gradient fill
            Given the theme specifies a gradient area fill
            When the series is rendered
            Then the fill should use a vertical gradient from the area top color to transparent

        Scenario: Area render with no bars
            Given the bar store is empty
            When the series is rendered
            Then no area draw calls should occur

        Scenario: Area render with a single bar
            Given one bar with close 100
            When the series is rendered
            Then a single vertical fill from the close price to the bottom axis should be drawn

        Scenario: Baseline area fill from a specific price
            Given a baseline price of 100
            And bars with close prices [95, 105, 98, 110]
            When the series is rendered
            Then the area above baseline 100 should be filled with the positive color
            And the area below baseline 100 should be filled with the negative color

        Scenario: Area border line is configurable
            Given the theme specifies an area border line width of 2 and color blue
            When the series is rendered
            Then the top line of the area should be drawn with width 2 in blue

    Feature: Price Axis Rendering
        As a user
        I want to see a vertical price axis with labels
        So that I can read the values on the chart

        Background:
            Given the renderer is initialized
            And the visible price range is 50 to 150

        Scenario: Render price axis labels at sensible intervals
            When the price axis is rendered
            Then labels should appear at round-number intervals (e.g. 60, 80, 100, 120, 140)
            And gridlines should extend horizontally across the chart

        Scenario: Auto-scale price axis to fit visible bars
            Given visible bars with prices ranging from 95 to 110
            When the price axis auto-scales
            Then the visible price range should expand slightly beyond 95-110 for padding
            And labels should recalculate for the new range

        Scenario: Handle very small price range
            Given visible bars with prices from 100.01 to 100.05
            When the price axis is rendered
            Then labels should show sufficient decimal precision
            And the interval between labels should be appropriate for the range

        Scenario: Handle very large price range
            Given visible bars with prices from 1 to 100000
            When the price axis is rendered
            Then labels should use abbreviated notation or appropriate intervals
            And the axis should remain readable

        Scenario: Price axis width accommodates label length
            Given labels like "100,000.00"
            When the price axis is rendered
            Then the axis area should be wide enough to display the longest label without clipping

        Scenario: Last price marker on price axis
            Given the latest bar has a close price of 102.50
            When the price axis is rendered
            Then a highlighted label should appear at 102.50 on the price axis
            And a horizontal dashed line should extend across the chart at that price

        Scenario: Price labels include currency symbol
            Given the symbol has currency_code "USD"
            When the price axis is rendered
            Then labels should be prefixed with "$"

        Scenario: Price axis on the left side
            Given the price axis is configured to display on the left
            When the price axis is rendered
            Then the axis labels and area should appear on the left side of the chart
            And the chart drawing area should adjust accordingly

        Scenario: Drag price axis to scale
            Given the price axis is rendered
            When the user clicks and drags vertically on the price axis
            Then the visible price range should scale proportionally to the drag distance
            And auto-scaling should be disabled

        Scenario: Price axis labels in logarithmic scale
            Given the price scale is set to logarithmic
            And the visible price range is from 10 to 10000
            When the price axis is rendered
            Then labels should be spaced logarithmically (e.g. 10, 100, 1000, 10000)

    Feature: Time Axis Rendering
        As a user
        I want to see a horizontal time axis with labels
        So that I can read the dates and times on the chart

        Background:
            Given the renderer is initialized

        Scenario: Render time labels for daily resolution
            Given the resolution is "1D"
            And the visible range spans 30 days
            When the time axis is rendered
            Then labels should show dates at sensible intervals (e.g. every 5 days)

        Scenario: Render time labels for intraday resolution
            Given the resolution is "5" (5 minutes)
            And the visible range spans 8 hours
            When the time axis is rendered
            Then labels should show hours and minutes at sensible intervals

        Scenario: Labels do not overlap
            Given any resolution and zoom level
            When the time axis is rendered
            Then no two labels should overlap horizontally

        Scenario: Handle gaps in time data (weekends/holidays)
            Given daily bars that skip Saturday and Sunday
            When the time axis is rendered
            Then the time axis should not leave large visual gaps for non-trading days

        Scenario: Display timezone on time axis
            Given the symbol timezone is "America/New_York"
            When the time axis is rendered
            Then times should be displayed in the symbol's timezone

        Scenario: Configurable timezone display
            Given the user has configured timezone display to "UTC"
            When the time axis is rendered
            Then times should be displayed in UTC regardless of symbol timezone

        Scenario: Hierarchical time labels at boundary crossings
            Given the resolution is "1D" and the visible range spans multiple months
            When the time axis is rendered
            Then day labels should appear at regular intervals
            And month labels should appear at month boundaries
            And year labels should appear at year boundaries

    Feature: Crosshair
        As a user
        I want a crosshair that follows my mouse/touch position
        So that I can see the exact price and time at any point on the chart

        Background:
            Given the renderer is initialized with crosshair enabled

        Scenario: Show crosshair on mouse move
            When the mouse moves to pixel position (400, 300)
            Then a vertical line should be drawn at x=400
            And a horizontal line should be drawn at y=300
            And price and time labels should appear on the axes

        Scenario: Snap crosshair to nearest bar
            Given bars are rendered
            When the mouse moves near a bar
            Then the crosshair vertical line should snap to the bar's x-position
            And the price label should show the bar's close value

        Scenario: Hide crosshair when mouse leaves canvas
            Given the crosshair is visible
            When the mouse leaves the canvas
            Then the crosshair should be hidden
            And an "interaction:crosshair" event should be emitted with null values

        Scenario: Emit crosshair events
            When the mouse moves to a position mapping to time 3000 and price 100
            Then an "interaction:crosshair" event should be emitted with { price: 100, time: 3000, x: pixelX, y: pixelY }

        Scenario: Crosshair tooltip shows OHLCV values
            Given bars are rendered
            When the crosshair hovers over a bar
            Then a tooltip should display open, high, low, close, and volume values for that bar

        Scenario: Crosshair line style is configurable
            Given the theme specifies crosshair line style as dashed
            When the crosshair is rendered
            Then the crosshair lines should be drawn with a dashed pattern

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

        Scenario: Pan via mouse drag
            Given the visible range is from 1000 to 5000
            When the user clicks and drags 100 pixels to the right
            Then the viewport should shift earlier in time
            And a "viewport:pan" event should be emitted

        Scenario: Pan via touch drag
            Given the visible range is from 1000 to 5000
            When the user performs a single-finger touch drag 100 pixels to the right
            Then the viewport should shift earlier in time

        Scenario: Pan does not exceed data boundaries
            Given the earliest bar is at time 1000
            And the visible range starts at 1000
            When the user drags to the right (further into the past)
            Then the viewport should not scroll before time 1000

        Scenario: Panning disables auto-scroll
            Given auto-scroll is enabled
            When the user pans the chart
            Then auto-scroll should be disabled
            And new real-time bars should not shift the viewport

        Scenario: Kinetic scrolling after drag release
            Given the user is dragging the chart at velocity
            When the user releases the drag
            Then the chart should continue scrolling with decelerating momentum
            And the scrolling should eventually come to a stop

        Scenario: Small mouse movements do not trigger pan
            Given the user clicks on the chart
            When the mouse moves less than 3 pixels before release
            Then no pan should be triggered
            And the event should be treated as a click

        Scenario: Right-click drag does not pan
            Given the user right-clicks on the chart
            When the user drags with the right mouse button
            Then no pan should occur

    Feature: Zoom Interaction
        As a user
        I want to zoom in and out of the chart
        So that I can view data at different levels of detail

        Background:
            Given the renderer is initialized with zoom enabled

        Scenario: Zoom in via mouse wheel
            Given the visible range is from 1000 to 5000
            When the user scrolls the mouse wheel up at position x=400
            Then the visible range should shrink centered on the mouse position
            And a "viewport:zoom" event should be emitted

        Scenario: Zoom out via mouse wheel
            Given the visible range is from 1000 to 5000
            When the user scrolls the mouse wheel down
            Then the visible range should expand
            And a "viewport:zoom" event should be emitted

        Scenario: Pinch-to-zoom on touch devices
            Given the visible range is from 1000 to 5000
            When the user performs a two-finger pinch gesture
            Then the visible range should change proportionally to the pinch distance

        Scenario: Zoom does not exceed maximum range
            Given a maximum zoom-out limit of 100000 time units
            When the user zooms out beyond the limit
            Then the visible range should be clamped

        Scenario: Zoom does not go below minimum range
            Given a minimum zoom-in limit of 5 bars visible
            When the user zooms in beyond the limit
            Then the visible range should be clamped to show at least 5 bars

        Scenario: Zoom via keyboard shortcuts
            Given the chart has focus
            When the user presses the "+" key
            Then the visible range should shrink (zoom in)
            When the user presses the "-" key
            Then the visible range should expand (zoom out)

        Scenario: Double-click to reset zoom
            Given the user has zoomed into a subset of bars
            When the user double-clicks on the chart
            Then the viewport should fit all loaded data
            And a "viewport:zoom" event should be emitted

        Scenario: Scroll direction respects natural scrolling setting
            Given the renderer is configured for natural scrolling (inverted)
            When the user scrolls up on a trackpad
            Then the chart should zoom out (opposite of default mouse wheel behavior)

        Scenario: Zoom transition is animated
            Given the visible range is from 1000 to 5000
            When the user triggers a zoom action
            Then the zoom should animate smoothly over a short duration
            And intermediate frames should be rendered during the transition

    Feature: Theming
        As a developer
        I want to apply visual themes to the chart
        So that the chart matches the application's design

        Scenario: Apply a light theme
            Given the renderer is initialized
            When a light theme is applied
            Then the background should be white
            And grid lines should be light gray
            And bullish candles should be green and bearish candles should be red

        Scenario: Apply a dark theme
            Given the renderer is initialized
            When a dark theme is applied
            Then the background should be dark
            And grid lines should be dark gray
            And text should be light colored

        Scenario: Override individual theme properties
            Given a dark theme is applied
            When individual overrides are applied (e.g. bullish color changed to blue)
            Then only the overridden properties should change
            And all other theme properties should remain from the dark theme

        Scenario: Switch theme without losing chart state
            Given a chart with bars rendered in a light theme
            When the theme is switched to dark
            Then the bars and viewport should remain the same
            And only the visual styling should change

        Scenario: Custom font family in theme
            Given a theme with font family "Inter"
            When the chart is rendered
            Then all text (axis labels, tooltips) should use the "Inter" font

        Scenario: Opacity settings for gridlines
            Given a theme with gridline opacity set to 0.3
            When gridlines are rendered
            Then they should be drawn with 30% opacity

    Feature: Render Pipeline
        As a developer
        I want a structured render pipeline
        So that frames are drawn efficiently without redundant work

        Scenario: Batch multiple state changes into one frame
            Given the viewport changes and new bars arrive in the same tick
            When the render pipeline processes
            Then only one frame should be drawn (not two)

        Scenario: Skip rendering when nothing changed
            Given no state changes since the last frame
            When the render loop ticks
            Then no draw calls should be made

        Scenario: Render layers in correct order
            When a full frame is rendered
            Then the draw order should be: background, gridlines, series, axes, crosshair, overlays

        Scenario: Handle rapid successive updates
            Given 100 real-time bar updates arrive within 16ms
            When the render pipeline processes
            Then at most one frame should be drawn for that 16ms window
            And the frame should reflect the latest state

        Scenario: RequestAnimationFrame integration
            Given the renderer is active
            When state changes occur
            Then rendering should be scheduled via requestAnimationFrame
            And should not block the main thread

        Scenario: Pause rendering when tab is hidden
            Given the renderer is active
            When the browser tab becomes hidden
            Then rendering should pause
            And when the tab becomes visible again, a single frame should be drawn with the latest state

    Feature: Volume Histogram
        As a user
        I want to see volume data rendered as a histogram below the price chart
        So that I can see trading activity alongside price movements

        Background:
            Given the renderer is initialized with volume display enabled

        Scenario: Render volume bars below the price chart
            Given bars with volume data [1000, 2000, 500, 3000, 1500]
            When the chart is rendered
            Then volume bars should be drawn in a dedicated area below the main chart
            And volume bars should align vertically with their corresponding price bars

        Scenario: Volume bar color matches candle direction
            Given a bullish bar with volume 1000
            And a bearish bar with volume 2000
            When the volume histogram is rendered
            Then the bullish volume bar should use the bullish color
            And the bearish volume bar should use the bearish color

        Scenario: Volume area has its own y-scale
            Given bars with volumes ranging from 100 to 10000
            When the volume histogram is rendered
            Then the tallest volume bar should fill the volume area height
            And shorter bars should be proportional

        Scenario: Volume area height is configurable
            Given the volume area is configured to use 20% of the chart height
            When the chart is rendered
            Then the bottom 20% should be reserved for volume
            And the top 80% should be used for the price chart

        Scenario: Handle bars with no volume data
            Given bars where has_no_volume is true on the symbol
            When the chart is rendered
            Then the volume area should not be displayed
            And the full chart height should be used for the price chart

        Scenario: Handle bars with zero volume
            Given a bar with volume 0
            When the volume histogram is rendered
            Then a minimal-height or invisible bar should be drawn for that position

    Feature: OHLC Bar Series Rendering
        As a user
        I want to see OHLCV data rendered as OHLC bars with tick marks
        So that I can see price data in a compact bar format

        Background:
            Given the renderer is initialized with an OHLC bar series type

        Scenario: Render a bullish OHLC bar
            Given a bar with open 100, high 110, low 95, and close 108
            When the bar is rendered
            Then a vertical line should be drawn from 95 to 110
            And a left tick mark should appear at 100 (open)
            And a right tick mark should appear at 108 (close)
            And the bar should use the bullish color

        Scenario: Render a bearish OHLC bar
            Given a bar with open 108, high 110, low 95, and close 100
            When the bar is rendered
            Then a vertical line should be drawn from 95 to 110
            And a left tick mark should appear at 108 (open)
            And a right tick mark should appear at 100 (close)
            And the bar should use the bearish color

        Scenario: Render OHLC bar with no bars
            Given the bar store is empty
            When the series is rendered
            Then no OHLC bar draw calls should occur

    Feature: Loading State
        As a user
        I want to see visual feedback while data is loading
        So that I know the chart is working and not broken

        Scenario: Show loading indicator during initial data fetch
            Given the chart is initialized but no bars have loaded yet
            When the chart is rendered
            Then a loading indicator should be displayed in the chart area

        Scenario: Show loading indicator during backward pagination
            Given the chart has bars loaded
            When the user scrolls back and more history is being fetched
            Then a loading indicator should appear at the left edge of the chart

        Scenario: Hide loading indicator when data arrives
            Given a loading indicator is displayed
            When bars are loaded and a "bars:historical" event is received
            Then the loading indicator should be hidden
            And the chart should render the bars

    Feature: Empty and Error States
        As a user
        I want to see clear feedback when there is no data or an error occurs
        So that I understand the chart state

        Scenario: Display empty state when no data is available
            Given the symbol is resolved but getBars returned noData
            When the chart is rendered
            Then a "No data available" message should be displayed in the chart area

        Scenario: Display error state when data loading fails
            Given a "symbol:error" event is received
            When the chart is rendered
            Then an error message should be displayed in the chart area

        Scenario: Clear error state when new data loads successfully
            Given an error state is displayed
            When a new symbol is resolved and bars are loaded
            Then the error message should be replaced with the rendered chart

    Feature: Watermark
        As a user
        I want to see the symbol name as a watermark in the chart background
        So that I always know which instrument I am viewing

        Scenario: Display symbol name as watermark
            Given the active symbol is "AAPL"
            When the chart is rendered
            Then "AAPL" should be drawn as a large semi-transparent text in the center of the chart area

        Scenario: Watermark updates on symbol change
            Given the watermark shows "AAPL"
            When the symbol changes to "GOOG"
            Then the watermark should update to "GOOG"

        Scenario: Watermark is behind all chart elements
            When a full frame is rendered
            Then the watermark should be drawn after the background but before gridlines and series

        Scenario: Watermark is configurable
            Given the watermark is disabled in configuration
            When the chart is rendered
            Then no watermark should be drawn
