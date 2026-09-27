/** jsdom 里没有 ResizeObserver（画布用到了），给个空实现 */

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

const globalWithObserver = globalThis as unknown as { ResizeObserver?: typeof ResizeObserverStub }

if (!globalWithObserver.ResizeObserver) {
  globalWithObserver.ResizeObserver = ResizeObserverStub
}
