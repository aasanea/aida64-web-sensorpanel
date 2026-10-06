export const EventBus = {
  events: {},

  on(event, handler, { signal } = {}) {
    if (signal?.aborted) return () => {};
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(handler);
    let subscribed = true;
    const unsubscribe = () => {
      if (!subscribed) return;
      subscribed = false;
      this.off(event, handler);
      signal?.removeEventListener('abort', unsubscribe);
    };
    signal?.addEventListener('abort', unsubscribe, { once: true });
    return unsubscribe;
  },

  off(event, handler) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(fn => fn !== handler);
  },

  emit(event, payload) {
    if (!this.events[event]) return;
    const listeners = this.events[event];
    for (let i = 0; i < listeners.length; i++) {
      try {
        listeners[i](payload);
      } catch (error) {
        console.error(`[EventBus] Error in handler for event "${event}":`, error);
      }
    }
  }
};
