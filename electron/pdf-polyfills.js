/**
 * Pre-server polyfills for the bundled Next.js standalone runtime.
 *
 * pdfjs-dist (loaded transitively by pdf-parse) checks for DOM globals
 * at module-load time — DOMMatrix, ImageData, Path2D. In a vanilla Node
 * runtime (which `process.execPath` becomes under ELECTRON_RUN_AS_NODE)
 * those don't exist, and the import throws ReferenceError before pdf-parse
 * is even invoked.
 *
 * We define minimal no-op shapes here. Real PDF parsing in this project
 * uses pdf-parse's text-extraction path, NOT the canvas / screenshot
 * path, so these classes can stay stubbed. If you ever wire the
 * vision-fallback feature (see roadmap), swap these for `@napi-rs/canvas`.
 */

if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class {
    constructor() {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1;
      this.e = 0; this.f = 0;
    }
    multiply() { return this; }
    invertSelf() { return this; }
    translate() { return this; }
    scale() { return this; }
  };
}

if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = class {
    constructor(data, w, h) {
      this.data = data;
      this.width = w;
      this.height = h;
    }
  };
}

if (typeof globalThis.Path2D === 'undefined') {
  globalThis.Path2D = class {
    constructor() {}
    addPath() {}
    moveTo() {}
    lineTo() {}
    bezierCurveTo() {}
    quadraticCurveTo() {}
    arc() {}
    arcTo() {}
    ellipse() {}
    rect() {}
    closePath() {}
  };
}

// Some pdfjs-dist code paths sniff for `window` or `document`. Provide
// the absolute minimum so the import doesn't blow up.
const fakeLocation = {
  protocol: 'http:',
  hostname: 'localhost',
  host: 'localhost',
  port: '',
  pathname: '/',
  search: '',
  hash: '',
  href: 'http://localhost/',
  origin: 'http://localhost',
};

if (typeof globalThis.window === 'undefined') {
  // Stub `window` as a thin object that exposes location + a no-op
  // matchMedia. Don't alias to globalThis because globalThis lacks
  // location and pdfjs destructures `window.location.protocol` at
  // module load.
  globalThis.window = {
    location: fakeLocation,
    matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }),
    addEventListener: () => {},
    removeEventListener: () => {},
    requestAnimationFrame: (fn) => setTimeout(fn, 16),
    cancelAnimationFrame: (id) => clearTimeout(id),
  };
}
if (typeof globalThis.location === 'undefined') {
  globalThis.location = fakeLocation;
}
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElementNS: () => ({ getContext: () => null, style: {} }),
    createElement: () => ({ getContext: () => null, style: {} }),
    documentElement: { style: {} },
  };
}
if (typeof globalThis.navigator === 'undefined') {
  globalThis.navigator = { userAgent: 'AkalanAtelier/0.1', platform: process.platform };
}
