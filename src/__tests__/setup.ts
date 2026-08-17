/**
 * Global test setup.
 *
 * jsdom does not implement several browser APIs this app touches at import or
 * mount time. Without these stubs the smoke tests fail on the environment
 * rather than on the code, which would make them worse than useless.
 */

// Leaflet calls this when sizing the map container.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// framer-motion's layout animations need these.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = class {
    root = null;
    rootMargin = "";
    thresholds = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
}

// Leaflet's canvas renderer probes for 2D context support.
if (!HTMLCanvasElement.prototype.getContext) {
  HTMLCanvasElement.prototype.getContext = (() => null) as never;
}

// src/lib/alerts.ts builds a two-tone beep through Web Audio.
if (!globalThis.AudioContext) {
  globalThis.AudioContext = class {
    createOscillator() {
      return {
        connect: () => {},
        start: () => {},
        stop: () => {},
        frequency: { value: 0, setValueAtTime: () => {} },
      };
    }
    createGain() {
      return {
        connect: () => {},
        gain: { value: 0, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
      };
    }
    get destination() {
      return {};
    }
    get currentTime() {
      return 0;
    }
    close() {
      return Promise.resolve();
    }
  } as unknown as typeof AudioContext;
}

// Nothing in a unit test should reach the network. Any test that needs a
// response must stub this explicitly.
globalThis.fetch = (() =>
  Promise.reject(new Error("network access is disabled in tests"))) as typeof fetch;
