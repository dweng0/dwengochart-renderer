// Global test setup — mocks browser APIs not available in jsdom

class MockResizeObserver {
  private cb: (entries: Array<{ contentRect: { width: number; height: number } }>) => void;
  constructor(cb: (entries: Array<{ contentRect: { width: number; height: number } }>) => void) {
    this.cb = cb;
    void this.cb; // suppress unused warning
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

// Synchronous RAF for tests that don't use vi.useFakeTimers().
// Tests that call vi.useFakeTimers() will override this with the fake implementation.
globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
  cb(performance.now());
  return 0;
};
globalThis.cancelAnimationFrame = () => {};
