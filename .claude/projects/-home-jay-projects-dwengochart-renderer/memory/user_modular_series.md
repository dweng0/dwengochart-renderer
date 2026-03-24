---
name: Modular composable series architecture
description: User wants series renderers to be modular and composable — multiple series layered in the same chart, swappable renderer types, plugin-style architecture.
type: user
---

User wants the renderer to support composable, layered series:
- Different line chart variants (stepped, curved, etc. as seen in D3 examples) should be swappable implementations
- Multiple series can be "painted" on top of each other in the same workspace
- Architecture should be modular enough to handle the wide variety of D3.js visualization types
- Series renderers as a plugin interface, not hardcoded
