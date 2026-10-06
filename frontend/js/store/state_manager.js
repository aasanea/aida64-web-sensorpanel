import { EventBus } from './event_bus.js?v=20261006.2';

export class StateManager {
  constructor() {
    this.currentState = {};
    
    // Telemetry Client state
    this.ws = null;
    this.pollingInterval = null;
    this.reconnectTimeout = null;
    this.pingInterval = null;
    this.reconnectAttempts = 0;
    this.maxReconnectDelay = 10000;
    this.baseReconnectDelay = 1000;
    this.lastPingTimestamp = 0;
    this.isPolling = false;
    this.pongReceived = true;
    this.mockOverride = null;
    this.stopped = true;
    this.lastReceivedAt = null;
    this.staleAfterMs = 5000;
    this.staleTimer = null;
    this.pollController = null;
    this.pollGeneration = 0;
  }

  start() {
    if (!this.stopped) return;
    this.stopped = false;
    this.staleTimer = setInterval(() => this.checkFreshness(), 1000);
    this.connect();
  }

  stop() {
    this.stopped = true;
    clearInterval(this.staleTimer);
    this.staleTimer = null;
    clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = null;
    this.stopPollingFallback();
    this.cleanupWebSocket();
    this.invalidateTelemetry();
  }

  checkFreshness() {
    if (this.lastReceivedAt === null || performance.now() - this.lastReceivedAt > this.staleAfterMs) {
      this.invalidateTelemetry();
    }
  }

  invalidateTelemetry() {
    if (this.currentState.telemetry_status === 'stale') return;
    const cleared = Object.fromEntries(Object.keys(this.currentState).map(key => [key, null]));
    cleared.telemetry_status = 'stale';
    this.commitState(cleared);
    this.connectionMode = 'offline';
    EventBus.emit('connection:status', { mode: 'offline', text: 'بيانات قديمة / غير متاحة' });
  }

  getEndpoints() {
    const isHttps = window.location.protocol === 'https:';
    const wsProto = isHttps ? 'wss:' : 'ws:';
    const httpProto = isHttps ? 'https:' : 'http:';
    let host = window.location.host;

    if (!host || host.includes(':5173') || window.location.protocol === 'file:') {
      host = '127.0.0.1:8088';
    }

    return {
      ws: `${wsProto}//${host}/ws`,
      http: `${httpProto}//${host}/api/sensors`
    };
  }

  connect() {
    if (this.stopped) return;
    this.cleanupWebSocket();
    const endpoints = this.getEndpoints();
    this.connectionMode = 'reconnecting';

    EventBus.emit('connection:status', {
      mode: 'reconnecting',
      text: 'جاري الاتصال بالسيرفر...'
    });

    try {
      this.ws = new WebSocket(endpoints.ws);
    } catch (err) {
      console.warn('[StateManager] WebSocket constructor error:', err);
      this.startPollingFallback();
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
      this.reconnectAttempts = 0;
      this.stopPollingFallback();
      // Transport open is not proof that a sensor snapshot has arrived.
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      this.processIncomingMessage(event.data);
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      this.startPollingFallback();
      this.scheduleReconnect();
    };

    this.ws.onerror = (err) => {
      console.warn('[StateManager] WebSocket connection error:', err);
    };
  }

  processIncomingMessage(messageData) {
    if (typeof messageData === 'string') {
      if (messageData === 'ping') {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send('pong');
        }
        return;
      }

      if (messageData === 'pong') {
        this.pongReceived = true;
        const latency = Math.round(performance.now() - this.lastPingTimestamp);
        EventBus.emit('connection:ping', latency);
        return;
      }

      try {
        const payload = JSON.parse(messageData);
        this.processNewState(payload);
      } catch (err) {
        console.warn('[StateManager] Could not parse JSON message:', err);
      }
    }
  }

  setMockTelemetry(override) {
    this.mockOverride = override;
    if (override && typeof override === 'object') {
      this.processNewState({ ...this.currentState, ...override });
    }
  }

  processNewState(newState) {
    if (!newState || typeof newState !== 'object' || Array.isArray(newState)) return;
    newState = { ...newState };
    if (this.mockOverride && typeof this.mockOverride === 'object') {
      Object.assign(newState, this.mockOverride);
    }

    // Both endpoints send complete snapshots: omitted fields are unavailable.
    for (const key of Object.keys(this.currentState)) {
      if (!(key in newState) && key !== 'telemetry_status') newState[key] = null;
    }
    for (const key of Object.keys(newState)) {
      if (typeof newState[key] === 'number' && !Number.isFinite(newState[key])) newState[key] = null;
    }
    this.lastReceivedAt = performance.now();
    newState.telemetry_status = 'live';
    this.commitState(newState);
    const mode = this.isPolling ? 'polling' : 'live';
    if (this.connectionMode !== mode) {
      this.connectionMode = mode;
      EventBus.emit('connection:status', {
        mode, text: mode === 'live' ? 'مباشر (WebSocket)' : 'احتياطي (HTTP Polling)'
      });
    }
  }

  commitState(newState) {
    const delta = {};
    let hasChanges = false;

    // Compare new state with current state
    for (const key in newState) {
      const currentVal = this.currentState[key];
      const newVal = newState[key];

      let isChanged = currentVal !== newVal;
      if (isChanged && typeof currentVal === 'object' && currentVal !== null && typeof newVal === 'object' && newVal !== null) {
        try {
          isChanged = JSON.stringify(currentVal) !== JSON.stringify(newVal);
        } catch {
          isChanged = true;
        }
      }

      if (isChanged) {
        delta[key] = newVal;
        this.currentState[key] = newVal;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      EventBus.emit('state-changed', delta);
    }
    
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.pongReceived = true;
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        if (!this.pongReceived) {
          console.warn('[StateManager] Pong timeout — zombie connection detected, reconnecting...');
          this.cleanupWebSocket();
          this.startPollingFallback();
          this.scheduleReconnect();
          return;
        }
        this.pongReceived = false;
        this.lastPingTimestamp = performance.now();
        this.ws.send('ping');
      }
    }, 4000);
  }

  stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  startPollingFallback() {
    if (this.isPolling || this.stopped) return;
    this.isPolling = true;
    this.pollFailures = 0;

    this.connectionMode = 'polling';
    EventBus.emit('connection:status', {
      mode: 'polling',
      text: 'احتياطي (HTTP Polling)'
    });

    const endpoints = this.getEndpoints();
    const generation = ++this.pollGeneration;
    const executePoll = async () => {
      if (!this.isPolling || generation !== this.pollGeneration) return;
      try {
        const start = performance.now();
        this.pollController = new AbortController();
        const response = await fetch(endpoints.http, {
          cache: 'no-store', signal: this.pollController.signal
        });
        if (!this.isPolling || generation !== this.pollGeneration) return;
        if (response.ok) {
          const data = await response.json();
          if (!this.isPolling || generation !== this.pollGeneration) return;
          const latency = Math.round(performance.now() - start);
          EventBus.emit('connection:ping', latency);
          
          this.processNewState(data);
          this.pollFailures = 0;
        } else {
          this.pollFailures++;
          this.connectionMode = 'offline';
          EventBus.emit('connection:status', {
            mode: 'offline',
            text: 'غير متصل (خطأ API)'
          });
        }
      } catch (err) {
        if (!this.isPolling || generation !== this.pollGeneration) return;
        this.pollFailures++;
        this.connectionMode = 'offline';
        EventBus.emit('connection:status', {
          mode: 'offline',
          text: 'غير متصل (السيرفر متوقف)'
        });
      }
      
      if (this.isPolling && generation === this.pollGeneration) {
        const delay = Math.min(500 * Math.pow(2, this.pollFailures), 8000);
        this.pollingTimeout = setTimeout(executePoll, delay);
      }
    };

    executePoll();
  }

  stopPollingFallback() {
    this.isPolling = false;
    this.pollGeneration++;
    this.pollController?.abort();
    this.pollController = null;
    if (this.pollingTimeout) {
      clearTimeout(this.pollingTimeout);
      this.pollingTimeout = null;
    }
  }

  scheduleReconnect() {
    if (this.stopped) return;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);

    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(1.5, this.reconnectAttempts),
      this.maxReconnectDelay
    );
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  cleanupWebSocket() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
  }
}
