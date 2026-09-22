import { EventBus } from './event_bus.js';

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
  }

  start() {
    this.connect();
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
    this.cleanupWebSocket();
    const endpoints = this.getEndpoints();

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
      this.reconnectAttempts = 0;
      this.stopPollingFallback();
      EventBus.emit('connection:status', {
        mode: 'live',
        text: 'مباشر (WebSocket)'
      });
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
    if (this.mockOverride && typeof this.mockOverride === 'object') {
      Object.assign(newState, this.mockOverride);
    }

    const delta = {};
    let hasChanges = false;

    // Compare new state with current state
    for (const key in newState) {
      if (this.currentState[key] !== newState[key]) {
        delta[key] = newState[key];
        this.currentState[key] = newState[key];
        hasChanges = true;
      }
    }

    if (hasChanges) {
      EventBus.emit('state-changed', delta);
    }
    
    // Also emit raw data for legacy or complete updates if necessary
    EventBus.emit('telemetry:data', newState);
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
    if (this.isPolling) return;
    this.isPolling = true;
    this.pollFailures = 0;

    EventBus.emit('connection:status', {
      mode: 'polling',
      text: 'احتياطي (HTTP Polling)'
    });

    const endpoints = this.getEndpoints();
    const executePoll = async () => {
      if (!this.isPolling) return;
      try {
        const start = performance.now();
        const response = await fetch(endpoints.http, { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          const latency = Math.round(performance.now() - start);
          EventBus.emit('connection:ping', latency);
          
          this.processNewState(data);
          this.pollFailures = 0;
        } else {
          this.pollFailures++;
          EventBus.emit('connection:status', {
            mode: 'offline',
            text: 'غير متصل (خطأ API)'
          });
        }
      } catch (err) {
        this.pollFailures++;
        EventBus.emit('connection:status', {
          mode: 'offline',
          text: 'غير متصل (السيرفر متوقف)'
        });
      }
      
      if (this.isPolling) {
        const delay = Math.min(500 * Math.pow(2, this.pollFailures), 8000);
        this.pollingTimeout = setTimeout(executePoll, delay);
      }
    };

    executePoll();
  }

  stopPollingFallback() {
    this.isPolling = false;
    if (this.pollingTimeout) {
      clearTimeout(this.pollingTimeout);
      this.pollingTimeout = null;
    }
  }

  scheduleReconnect() {
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
