---
name: D3.js + SVG rendering preference
description: User wants D3.js with SVG as the rendering technology instead of HTML Canvas. Values testability — SVG DOM elements can be asserted directly.
type: user
---

User wants the renderer built with D3.js + SVG instead of HTML Canvas. Key reasons:
- Testability: SVG elements are in the DOM, so tests can assert on actual SVG nodes (rect, line, path) rather than mocking canvas draw calls
- D3.js for bindings/scales/rendering logic
- This is a deliberate architectural choice for the @dwengochart/renderer package
