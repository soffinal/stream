# Tutorial

Real-world examples demonstrating architectural benefits of reactive streams.

## Table of Contents

1. [Multi-Transport RPC System](#1-multi-transport-rpc-system)
2. [Distributed State Synchronization](#2-distributed-state-synchronization)
3. [Plugin Architecture with Event Bus](#3-plugin-architecture-with-event-bus)
4. [Multi-Source Data Aggregation](#4-multi-source-data-aggregation)
5. [Collaborative Editing System](#5-collaborative-editing-system)

---

## 1. Multi-Transport RPC System

Build an RPC system that works over WebSocket, HTTP, or IPC with zero business logic changes.

### The Problem

Traditional RPC implementations tightly couple transport logic with request/response handling:

```typescript
// ❌ Tightly coupled - hard to test, hard to swap transports
class RPCClient {
  private ws: WebSocket;
  private pendingRequests = new Map();

  async call(method: string, params: any) {
    const id = generateId();
    const promise = new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      setTimeout(() => reject(new Error("Timeout")), 5000);
    });

    this.ws.send(JSON.stringify({ id, method, params }));
    return promise;
  }

  private handleMessage(data: any) {
    const pending = this.pendingRequests.get(data.id);
    if (pending) {
      pending.resolve(data.result);
      this.pendingRequests.delete(data.id);
    }
  }
}
```

**Problems:**

- Can't swap WebSocket for HTTP without rewriting
- Hard to test (need real WebSocket)
- Connection state mixed with request logic
- No request queuing during reconnection

### Stream-Based Solution

Separate concerns: transport, request/response matching, connection state.

#### Step 1: Define Core Types

```typescript
import { Stream, filter, map, gate, queue, state } from "@soffinal/stream";

type RPCRequest = { id: string; method: string; params: any };
type RPCResponse = { id: string; result?: any; error?: any };
type ConnectionState = "disconnected" | "connecting" | "connected";
```

#### Step 2: Transport Interface

```typescript
// Transport is just two streams - dead simple to implement
interface Transport {
  outgoing: Stream<RPCRequest>; // Requests to send
  incoming: Stream<RPCResponse>; // Responses received
  state: Stream<ConnectionState>; // Connection state
}
```

#### Step 3: WebSocket Transport

```typescript
function createWebSocketTransport(url: string): Transport {
  const outgoing = new Stream<RPCRequest>();
  const incoming = new Stream<RPCResponse>();
  const connectionState = new Stream<ConnectionState>().pipe(state("disconnected"));

  let ws: WebSocket;

  function connect() {
    connectionState.state.value = "connecting";
    ws = new WebSocket(url);

    ws.onopen = () => {
      connectionState.state.value = "connected";
    };

    ws.onmessage = (event) => {
      incoming.push(JSON.parse(event.data));
    };

    ws.onclose = () => {
      connectionState.state.value = "disconnected";
      setTimeout(connect, 1000); // Auto-reconnect
    };
  }

  // Send requests when connected
  const gatedOutgoing = outgoing.pipe(gate());

  connectionState.listen((state) => {
    if (state === "connected") {
      gatedOutgoing.gate.open();
    } else {
      gatedOutgoing.gate.close();
    }
  });

  gatedOutgoing.listen((request) => {
    ws.send(JSON.stringify(request));
  });

  connect();

  return { outgoing, incoming, state: connectionState };
}
```

#### Step 4: HTTP Transport

```typescript
function createHTTPTransport(baseUrl: string): Transport {
  const outgoing = new Stream<RPCRequest>();
  const incoming = new Stream<RPCResponse>();
  const connectionState = new Stream<ConnectionState>().pipe(state("connected"));

  outgoing.listen(async (request) => {
    try {
      const response = await fetch(`${baseUrl}/rpc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      const result = await response.json();
      incoming.push({ id: request.id, ...result });
    } catch (error) {
      incoming.push({ id: request.id, error: error.message });
    }
  });

  return { outgoing, incoming, state: connectionState };
}
```

#### Step 5: Mock Transport (for testing)

```typescript
function createMockTransport(mockHandler: (req: RPCRequest) => RPCResponse): Transport {
  const outgoing = new Stream<RPCRequest>();
  const incoming = new Stream<RPCResponse>();
  const connectionState = new Stream<ConnectionState>().pipe(state("connected"));

  // Simulate async processing
  outgoing.listen(async (request) => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    incoming.push(mockHandler(request));
  });

  return { outgoing, incoming, state: connectionState };
}
```

#### Step 6: RPC Client (Transport-Agnostic)

```typescript
class RPCClient {
  private transport: Transport;
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (error: any) => void;
    }
  >();

  // Queue requests during disconnection
  private requestQueue: Stream<RPCRequest>;

  constructor(transport: Transport) {
    this.transport = transport;

    // Queue requests when disconnected, flush when connected
    this.requestQueue = new Stream<RPCRequest>().pipe(queue());

    // Forward queued requests to transport (concise with .bind())
    this.requestQueue.listen(this.transport.outgoing.push.bind(this.transport.outgoing));

    // Handle responses
    this.transport.incoming.listen((response) => {
      const pending = this.pendingRequests.get(response.id);
      if (pending) {
        if (response.error) {
          pending.reject(new Error(response.error));
        } else {
          pending.resolve(response.result);
        }
        this.pendingRequests.delete(response.id);
      }
    });
  }

  async call(method: string, params: any, timeout = 5000): Promise<any> {
    const id = crypto.randomUUID();

    const promise = new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${id} timed out`));
      }, timeout);

      this.pendingRequests.get(id)!.resolve = (value) => {
        clearTimeout(timer);
        resolve(value);
      };
    });

    this.requestQueue.push({ id, method, params });

    return promise;
  }
}
```

#### Step 7: Usage

```typescript
// Production: WebSocket
const wsTransport = createWebSocketTransport("ws://localhost:8080");
const wsClient = new RPCClient(wsTransport);

// Production: HTTP fallback
const httpTransport = createHTTPTransport("http://localhost:8080");
const httpClient = new RPCClient(httpTransport);

// Testing: Mock
const mockTransport = createMockTransport((req) => ({
  id: req.id,
  result: `Mocked ${req.method}`,
}));
const mockClient = new RPCClient(mockTransport);

// Same API, different transports!
await wsClient.call("getUser", { id: 123 });
await httpClient.call("getUser", { id: 123 });
await mockClient.call("getUser", { id: 123 });
```

### Benefits Demonstrated

✅ **Separation of Concerns**: Transport logic separate from RPC logic  
✅ **Dependency Injection**: Pass any transport implementation  
✅ **Easy Testing**: Mock transport without network  
✅ **Plug & Play**: Swap transports with zero code changes  
✅ **Request Queuing**: Automatic during disconnection (via `queue`)  
✅ **Connection Management**: Gate controls flow based on state  
✅ **Incremental**: Add features by composing streams (retry, rate limiting, etc.)

### Extensions

Add retry logic:

```typescript
const retriedOutgoing = transport.outgoing.pipe(
  filter({ attempts: new Map() }, async (state, request) => {
    const attempts = state.attempts.get(request.id) || 0;
    if (attempts >= 3) return [false, state];

    state.attempts.set(request.id, attempts + 1);
    return [true, state];
  }),
);
```

Add rate limiting:

```typescript
const rateLimited = transport.outgoing.pipe(
  filter({ lastEmit: 0 }, (state) => {
    const now = Date.now();
    if (now - state.lastEmit < 100) return [false, state];
    return [true, { lastEmit: now }];
  }),
);
```

---

## 2. Distributed State Synchronization

Build a system where multiple clients sync state through a server with conflict resolution and optimistic updates.

### The Problem

Traditional state sync implementations mix concerns:

```typescript
// ❌ Tightly coupled - state, network, and UI logic mixed
class StateManager {
  private state: any = {};
  private ws: WebSocket;
  private pendingUpdates = new Map();

  async updateState(key: string, value: any) {
    // Optimistic update
    this.state[key] = value;
    this.renderUI();

    // Send to server
    const id = generateId();
    this.pendingUpdates.set(id, { key, value });
    this.ws.send(JSON.stringify({ id, key, value }));

    // Wait for confirmation
    await this.waitForConfirmation(id);
  }

  private handleServerUpdate(data: any) {
    // Conflict resolution mixed with network logic
    if (this.pendingUpdates.has(data.id)) {
      this.pendingUpdates.delete(data.id);
    } else {
      this.state[data.key] = data.value;
      this.renderUI();
    }
  }
}
```

**Problems:**

- State, network, and UI logic entangled
- Hard to test conflict resolution
- Can't replay state changes
- No separation between local and remote updates

### Stream-Based Solution

Separate: local updates, remote updates, conflict resolution, state management.

#### Step 1: Define Core Types

```typescript
import { Stream, merge, filter, map, state, store } from "@soffinal/stream";

type StateUpdate = {
  key: string;
  value: any;
  version: number;
  clientId: string;
  timestamp: number;
};

type ConflictResolution = "last-write-wins" | "server-wins" | "client-wins";
```

#### Step 2: State Manager (Pure Logic)

```typescript
class DistributedState<T extends Record<string, any>> {
  // Separate streams for different concerns
  private localUpdates = new Stream<StateUpdate>();
  private remoteUpdates = new Stream<StateUpdate>();
  private conflicts = new Stream<{ local: StateUpdate; remote: StateUpdate }>();

  // Current state
  public state: Stream<T>;

  // All updates (local + remote + resolved conflicts)
  public updates: Stream<StateUpdate>;

  constructor(
    initialState: T,
    private clientId: string,
    private resolution: ConflictResolution = "last-write-wins",
  ) {
    // Merge local and remote updates
    this.updates = this.localUpdates.pipe(merge(this.remoteUpdates));

    // Detect conflicts
    this.updates
      .pipe(
        filter({ pending: new Map<string, StateUpdate>() }, (state, update) => {
          const pending = state.pending.get(update.key);

          if (pending && pending.clientId !== update.clientId) {
            // Conflict detected!
            this.conflicts.push({ local: pending, remote: update });
            state.pending.delete(update.key);
            return [false, state]; // Don't apply yet
          }

          if (update.clientId === this.clientId) {
            state.pending.set(update.key, update);
          } else {
            state.pending.delete(update.key);
          }

          return [true, state];
        }),
      )
      .listen((update) => {
        // Apply non-conflicting updates
        this.applyUpdate(update);
      });

    // Resolve conflicts
    this.conflicts.listen(({ local, remote }) => {
      const resolved = this.resolveConflict(local, remote);
      this.applyUpdate(resolved);
    });

    // State stream with current value
    this.state = new Stream<T>().pipe(state(initialState));
  }

  // Public API: Update local state
  set(key: string, value: any) {
    const update: StateUpdate = {
      key,
      value,
      version: Date.now(),
      clientId: this.clientId,
      timestamp: Date.now(),
    };

    this.localUpdates.push(update);
  }

  // Called by network layer
  receiveRemoteUpdate(update: StateUpdate) {
    this.remoteUpdates.push(update);
  }

  private applyUpdate(update: StateUpdate) {
    const current = this.state.state.value;
    this.state.state.value = {
      ...current,
      [update.key]: update.value,
    };
  }

  private resolveConflict(local: StateUpdate, remote: StateUpdate): StateUpdate {
    switch (this.resolution) {
      case "last-write-wins":
        return local.timestamp > remote.timestamp ? local : remote;
      case "server-wins":
        return remote;
      case "client-wins":
        return local;
    }
  }
}
```

#### Step 3: Network Sync Layer

```typescript
class NetworkSync {
  constructor(
    private stateManager: DistributedState<any>,
    private transport: Transport, // From tutorial #1!
  ) {
    // Send local updates to server
    stateManager.updates.pipe(filter((update) => update.clientId === stateManager["clientId"])).listen((update) => {
      transport.outgoing.push({
        id: crypto.randomUUID(),
        method: "state.update",
        params: update,
      });
    });

    // Receive remote updates from server
    transport.incoming.pipe(filter((response) => response.result?.type === "state.update")).listen((response) => {
      stateManager.receiveRemoteUpdate(response.result.update);
    });
  }
}
```

#### Step 4: Usage

```typescript
// Client A
const stateA = new DistributedState({ count: 0, name: "" }, "client-a", "last-write-wins");

const transportA = createWebSocketTransport("ws://localhost:8080");
const syncA = new NetworkSync(stateA, transportA);

// Listen to state changes
stateA.state.listen((state) => {
  console.log("Client A state:", state);
});

// Update state
stateA.set("count", 1);
stateA.set("name", "Alice");

// Client B (different machine)
const stateB = new DistributedState({ count: 0, name: "" }, "client-b", "last-write-wins");

const transportB = createWebSocketTransport("ws://localhost:8080");
const syncB = new NetworkSync(stateB, transportB);

stateB.state.listen((state) => {
  console.log("Client B state:", state);
});

// Both clients stay in sync!
stateB.set("count", 2); // Client A sees this
```

#### Step 5: Testing with Mock Transport

```typescript
// Simulate server
const serverState = new Map<string, any>();

const mockTransport = createMockTransport((req) => {
  if (req.method === "state.update") {
    const update = req.params as StateUpdate;
    serverState.set(update.key, update);

    // Broadcast to other clients
    return {
      id: req.id,
      result: { type: "state.update", update },
    };
  }

  return { id: req.id, result: null };
});

const testState = new DistributedState({ count: 0 }, "test-client", "last-write-wins");

const testSync = new NetworkSync(testState, mockTransport);

// Test conflict resolution
testState.set("count", 1);
testState.receiveRemoteUpdate({
  key: "count",
  value: 2,
  version: Date.now() + 1000, // Later timestamp
  clientId: "other-client",
  timestamp: Date.now() + 1000,
});

// Conflict resolved based on strategy
testState.state.listen((state) => {
  console.log("Resolved state:", state); // { count: 2 } (last-write-wins)
});
```

#### Step 6: Event Sourcing (Replay History)

```typescript
// Store all updates for replay
const history = stateManager.updates.pipe(store());

// Replay from any point
function replayFrom(timestamp: number) {
  const newState = new DistributedState({}, "replay-client", "last-write-wins");

  history.store.values
    .filter((update) => update.timestamp >= timestamp)
    .forEach((update) => {
      newState.receiveRemoteUpdate(update);
    });

  return newState;
}

// Time travel debugging!
const stateAt10MinutesAgo = replayFrom(Date.now() - 10 * 60 * 1000);
```

### Benefits Demonstrated

✅ **Separation of Concerns**: State, network, conflict resolution separate  
✅ **Easy Testing**: Mock transport, test conflict resolution in isolation  
✅ **Event Sourcing**: Replay history with `store` transformer  
✅ **Conflict Detection**: Automatic via stateful `filter`  
✅ **Pluggable Resolution**: Swap strategies without changing code  
✅ **Observable State**: UI reacts to `state.listen()`  
✅ **Time Travel**: Replay from any point in history

### Extensions

Add undo/redo:

```typescript
const undoStack = stateManager.updates.pipe(filter((u) => u.clientId === clientId)).pipe(store([], 50)); // Keep last 50 local updates

function undo() {
  const updates = undoStack.store.values;
  if (updates.length > 0) {
    const lastUpdate = updates[updates.length - 1];
    // Revert by sending inverse update
    stateManager.set(lastUpdate.key, previousValue);
  }
}
```

Add optimistic UI updates:

```typescript
// Show pending updates differently
const pendingUpdates = stateManager.updates.pipe(filter((u) => u.clientId === clientId)).pipe(
  filter({ pending: new Set() }, (state, update) => {
    state.pending.add(update.key);
    return [true, state];
  }),
);

pendingUpdates.listen((update) => {
  // Show loading indicator for this key
  showPending(update.key);
});
```

---

## 3. Plugin Architecture with Event Bus

Build an extensible system where plugins can subscribe to events without coupling to core logic.

### The Problem

Traditional plugin systems use callbacks or event emitters with string-based events:

```typescript
// ❌ Stringly-typed, no type safety, hard to test
class PluginSystem {
  private plugins: Plugin[] = [];
  private eventEmitter = new EventEmitter();

  registerPlugin(plugin: Plugin) {
    this.plugins.push(plugin);
    plugin.init(this.eventEmitter);
  }

  emit(event: string, data: any) {
    this.eventEmitter.emit(event, data);
  }
}

// Plugin implementation
class MyPlugin {
  init(emitter: EventEmitter) {
    emitter.on("user:created", (data) => {
      // No type safety!
      console.log(data.name);
    });
  }
}
```

**Problems:**

- No type safety (string-based events)
- Hard to test plugins in isolation
- Can't filter/transform events declaratively
- No way to see event flow
- Memory leaks (forgot to unsubscribe)

### Stream-Based Solution

Type-safe event bus with declarative subscriptions.

#### Step 1: Define Event Types

```typescript
import { Stream, filter, map, merge } from "@soffinal/stream";

// Type-safe events
type AppEvent =
  | { type: "user:created"; user: { id: string; name: string; email: string } }
  | { type: "user:updated"; user: { id: string; name: string } }
  | { type: "user:deleted"; userId: string }
  | { type: "post:created"; post: { id: string; title: string; authorId: string } }
  | { type: "post:published"; postId: string };
```

#### Step 2: Event Bus

```typescript
class EventBus {
  private events = new Stream<AppEvent>();

  // Publish event
  emit(event: AppEvent) {
    this.events.push(event);
  }

  // Subscribe to specific event type (type-safe!)
  on<T extends AppEvent["type"]>(type: T, handler: (event: Extract<AppEvent, { type: T }>) => void) {
    return this.events
      .pipe(filter((event): event is Extract<AppEvent, { type: T }> => event.type === type))
      .listen(handler);
  }

  // Subscribe to multiple event types
  onAny<T extends AppEvent["type"][]>(types: T, handler: (event: Extract<AppEvent, { type: T[number] }>) => void) {
    return this.events
      .pipe(filter((event): event is Extract<AppEvent, { type: T[number] }> => types.includes(event.type as any)))
      .listen(handler);
  }

  // Get stream for specific event type
  stream<T extends AppEvent["type"]>(type: T): Stream<Extract<AppEvent, { type: T }>> {
    return this.events.pipe(filter((event): event is Extract<AppEvent, { type: T }> => event.type === type));
  }

  // Get all events stream
  all(): Stream<AppEvent> {
    return this.events;
  }
}
```

#### Step 3: Plugin Interface

```typescript
interface Plugin {
  name: string;
  init(bus: EventBus): void | (() => void); // Returns cleanup function
}
```

#### Step 4: Example Plugins

```typescript
// Email notification plugin
class EmailPlugin implements Plugin {
  name = "email";

  init(bus: EventBus) {
    // Type-safe subscription!
    const cleanup1 = bus.on("user:created", (event) => {
      this.sendWelcomeEmail(event.user.email, event.user.name);
    });

    const cleanup2 = bus.on("post:published", async (event) => {
      const post = await this.getPost(event.postId);
      await this.notifySubscribers(post);
    });

    // Return cleanup function
    return () => {
      cleanup1();
      cleanup2();
    };
  }

  private sendWelcomeEmail(email: string, name: string) {
    console.log(`Sending welcome email to ${email}`);
  }

  private async getPost(postId: string) {
    return { id: postId, title: "Example", authorId: "123" };
  }

  private async notifySubscribers(post: any) {
    console.log(`Notifying subscribers about: ${post.title}`);
  }
}

// Analytics plugin
class AnalyticsPlugin implements Plugin {
  name = "analytics";

  init(bus: EventBus) {
    // Subscribe to all events
    return bus.all().listen((event) => {
      this.track(event.type, event);
    });
  }

  private track(eventName: string, data: any) {
    console.log(`[Analytics] ${eventName}:`, data);
  }
}

// Audit log plugin with batching
class AuditLogPlugin implements Plugin {
  name = "audit";

  init(bus: EventBus) {
    // Batch events every 5 seconds
    const batched = bus.all().pipe(
      filter({ buffer: [] as AppEvent[], timer: null as any }, (state, event) => {
        state.buffer.push(event);

        if (!state.timer) {
          state.timer = setTimeout(() => {
            this.saveBatch(state.buffer);
            state.buffer = [];
            state.timer = null;
          }, 5000);
        }

        return [false, state]; // Don't emit individual events
      }),
    );

    return batched.listen(() => {});
  }

  private saveBatch(events: AppEvent[]) {
    console.log(`[Audit] Saving ${events.length} events to database`);
  }
}

// Cache invalidation plugin
class CachePlugin implements Plugin {
  name = "cache";
  private cache = new Map<string, any>();

  init(bus: EventBus) {
    // Invalidate cache on updates
    const cleanup1 = bus.onAny(["user:updated", "user:deleted"], (event) => {
      const userId = event.type === "user:updated" ? event.user.id : event.userId;
      this.cache.delete(`user:${userId}`);
      console.log(`[Cache] Invalidated user:${userId}`);
    });

    const cleanup2 = bus.on("post:published", (event) => {
      this.cache.delete(`post:${event.postId}`);
      console.log(`[Cache] Invalidated post:${event.postId}`);
    });

    return () => {
      cleanup1();
      cleanup2();
    };
  }
}
```

#### Step 5: Plugin Manager

```typescript
class PluginManager {
  private plugins = new Map<string, () => void>();

  constructor(private bus: EventBus) {}

  register(plugin: Plugin) {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin ${plugin.name} already registered`);
    }

    const cleanup = plugin.init(this.bus);
    if (cleanup) {
      this.plugins.set(plugin.name, cleanup);
    }

    console.log(`[PluginManager] Registered: ${plugin.name}`);
  }

  unregister(pluginName: string) {
    const cleanup = this.plugins.get(pluginName);
    if (cleanup) {
      cleanup();
      this.plugins.delete(pluginName);
      console.log(`[PluginManager] Unregistered: ${pluginName}`);
    }
  }

  unregisterAll() {
    for (const [name, cleanup] of this.plugins) {
      cleanup();
    }
    this.plugins.clear();
  }
}
```

#### Step 6: Usage

```typescript
// Create event bus
const bus = new EventBus();
const manager = new PluginManager(bus);

// Register plugins
manager.register(new EmailPlugin());
manager.register(new AnalyticsPlugin());
manager.register(new AuditLogPlugin());
manager.register(new CachePlugin());

// Emit events (type-safe!)
bus.emit({
  type: "user:created",
  user: { id: "1", name: "Alice", email: "alice@example.com" },
});

bus.emit({
  type: "post:published",
  postId: "post-123",
});

// Hot-reload: unregister and re-register plugin
manager.unregister("email");
manager.register(new EmailPlugin());
```

#### Step 7: Testing Plugins in Isolation

```typescript
// Test email plugin without other plugins
const testBus = new EventBus();
const emailPlugin = new EmailPlugin();
const cleanup = emailPlugin.init(testBus);

// Mock email sending
const sentEmails: string[] = [];
EmailPlugin.prototype["sendWelcomeEmail"] = (email: string) => {
  sentEmails.push(email);
};

// Test
testBus.emit({
  type: "user:created",
  user: { id: "1", name: "Test", email: "test@example.com" },
});

assert(sentEmails.includes("test@example.com"));

cleanup();
```

### Benefits Demonstrated

✅ **Type Safety**: No string-based events, full TypeScript inference  
✅ **Declarative**: Plugins declare what they listen to  
✅ **Easy Testing**: Test plugins in isolation with mock bus  
✅ **Hot Reload**: Add/remove plugins at runtime  
✅ **Automatic Cleanup**: No memory leaks  
✅ **Event Transformation**: Filter, map, batch events declaratively  
✅ **Visibility**: See entire event flow through streams

### Extensions

Add event replay for debugging:

```typescript
const eventHistory = bus.all().pipe(store([], 100)); // Keep last 100 events

function replayEvents() {
  eventHistory.store.values.forEach((event) => {
    console.log("Replaying:", event);
  });
}
```

Add plugin dependencies:

```typescript
interface Plugin {
  name: string;
  dependencies?: string[]; // Required plugins
  init(bus: EventBus): void | (() => void);
}

class PluginManager {
  register(plugin: Plugin) {
    // Check dependencies
    for (const dep of plugin.dependencies || []) {
      if (!this.plugins.has(dep)) {
        throw new Error(`Plugin ${plugin.name} requires ${dep}`);
      }
    }
    // ... rest of registration
  }
}
```

---

## 4. Multi-Source Data Aggregation

Build a real-time dashboard aggregating data from WebSocket feeds, REST APIs, and local sensors.

### The Problem

Traditional dashboards mix data fetching, transformation, and rendering:

```typescript
// ❌ Mixed concerns, hard to test, no unified pipeline
class Dashboard {
  private ws: WebSocket;
  private pollInterval: any;

  async start() {
    // WebSocket feed
    this.ws = new WebSocket("ws://api.example.com/live");
    this.ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      this.updateMetric("live", data);
    };

    // REST API polling
    this.pollInterval = setInterval(async () => {
      const data = await fetch("/api/stats").then((r) => r.json());
      this.updateMetric("stats", data);
    }, 5000);

    // Local sensor
    navigator.getBattery().then((battery) => {
      battery.addEventListener("levelchange", () => {
        this.updateMetric("battery", battery.level);
      });
    });
  }

  private updateMetric(source: string, data: any) {
    // Transformation and rendering mixed
    const transformed = this.transform(source, data);
    this.render(transformed);
  }
}
```

**Problems:**

- Data sources tightly coupled to rendering
- Can't test transformations in isolation
- No unified data pipeline
- Hard to add new sources
- Can't replay or cache data

### Stream-Based Solution

Unified data pipeline with pluggable sources.

#### Step 1: Define Data Types

```typescript
import { Stream, merge, map, filter, state, store, gate } from "@soffinal/stream";

type DataPoint = {
  source: string;
  metric: string;
  value: number;
  timestamp: number;
  unit?: string;
};

type AggregatedMetrics = Record<
  string,
  {
    current: number;
    min: number;
    max: number;
    avg: number;
    count: number;
  }
>;
```

#### Step 2: Data Source Interface

```typescript
interface DataSource {
  name: string;
  data: Stream<DataPoint>;
  start(): void;
  stop(): void;
}
```

#### Step 3: WebSocket Data Source

```typescript
class WebSocketSource implements DataSource {
  name = "websocket";
  data = new Stream<DataPoint>();
  private ws?: WebSocket;

  constructor(private url: string) {}

  start() {
    this.ws = new WebSocket(this.url);

    this.ws.onmessage = (event) => {
      const raw = JSON.parse(event.data);
      this.data.push({
        source: this.name,
        metric: raw.metric,
        value: raw.value,
        timestamp: Date.now(),
        unit: raw.unit,
      });
    };

    this.ws.onerror = () => {
      console.error(`[${this.name}] Connection error`);
    };
  }

  stop() {
    this.ws?.close();
  }
}
```

#### Step 4: REST API Polling Source

```typescript
class PollingSource implements DataSource {
  name = "polling";
  data = new Stream<DataPoint>();
  private interval?: any;

  constructor(
    private url: string,
    private intervalMs: number = 5000,
  ) {}

  start() {
    const poll = async () => {
      try {
        const response = await fetch(this.url);
        const metrics = await response.json();

        for (const [metric, value] of Object.entries(metrics)) {
          this.data.push({
            source: this.name,
            metric,
            value: value as number,
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        console.error(`[${this.name}] Fetch error:`, error);
      }
    };

    poll(); // Initial fetch
    this.interval = setInterval(poll, this.intervalMs);
  }

  stop() {
    clearInterval(this.interval);
  }
}
```

#### Step 5: Local Sensor Source

```typescript
class SensorSource implements DataSource {
  name = "sensor";
  data = new Stream<DataPoint>();

  async start() {
    // Battery sensor
    const battery = await navigator.getBattery();

    const emitBattery = () => {
      this.data.push({
        source: this.name,
        metric: "battery",
        value: battery.level * 100,
        timestamp: Date.now(),
        unit: "%",
      });
    };

    emitBattery();
    battery.addEventListener("levelchange", emitBattery);

    // Memory sensor (if available)
    if ("memory" in performance) {
      setInterval(() => {
        const memory = (performance as any).memory;
        this.data.push({
          source: this.name,
          metric: "memory",
          value: memory.usedJSHeapSize / memory.jsHeapSizeLimit,
          timestamp: Date.now(),
          unit: "ratio",
        });
      }, 10000);
    }
  }

  stop() {
    // Cleanup listeners
  }
}
```

#### Step 6: Data Aggregator

```typescript
class DataAggregator {
  private sources: DataSource[] = [];
  public unified: Stream<DataPoint>;
  public aggregated: Stream<AggregatedMetrics>;

  constructor() {
    this.unified = new Stream<DataPoint>();

    // Aggregate metrics over time
    this.aggregated = this.unified.pipe(
      map({ metrics: {} as AggregatedMetrics }, (state, point) => {
        const metric = state.metrics[point.metric] || {
          current: point.value,
          min: point.value,
          max: point.value,
          avg: point.value,
          count: 0,
        };

        const count = metric.count + 1;
        const newMetric = {
          current: point.value,
          min: Math.min(metric.min, point.value),
          max: Math.max(metric.max, point.value),
          avg: (metric.avg * metric.count + point.value) / count,
          count,
        };

        const newMetrics = {
          ...state.metrics,
          [point.metric]: newMetric,
        };

        return [newMetrics, { metrics: newMetrics }];
      }),
    );
  }

  addSource(source: DataSource) {
    this.sources.push(source);

    // Forward source data to unified stream (concise with .bind())
    source.data.listen(this.unified.push.bind(this.unified));

    source.start();
  }

  removeSource(sourceName: string) {
    const source = this.sources.find((s) => s.name === sourceName);
    if (source) {
      source.stop();
      this.sources = this.sources.filter((s) => s.name !== sourceName);
    }
  }

  // Get stream for specific metric
  metric(name: string): Stream<DataPoint> {
    return this.unified.pipe(filter((point) => point.metric === name));
  }

  // Get stream for specific source
  source(name: string): Stream<DataPoint> {
    return this.unified.pipe(filter((point) => point.source === name));
  }
}
```

#### Step 7: Dashboard with Transformations

```typescript
class Dashboard {
  private aggregator: DataAggregator;

  constructor() {
    this.aggregator = new DataAggregator();

    // Add data sources
    this.aggregator.addSource(new WebSocketSource("ws://api.example.com/live"));
    this.aggregator.addSource(new PollingSource("https://api.example.com/stats", 5000));
    this.aggregator.addSource(new SensorSource());
  }

  start() {
    // Real-time metrics display
    this.aggregator.aggregated.listen((metrics) => {
      this.renderMetrics(metrics);
    });

    // Alert on high values
    this.aggregator.unified.pipe(filter((point) => point.metric === "cpu" && point.value > 80)).listen((point) => {
      this.showAlert(`High CPU: ${point.value}%`);
    });

    // Rate limit updates (max 1 per second)
    this.aggregator.unified
      .pipe(
        filter({ lastEmit: 0 }, (state, point) => {
          const now = Date.now();
          if (now - state.lastEmit < 1000) return [false, state];
          return [true, { lastEmit: now }];
        }),
      )
      .listen((point) => {
        this.updateChart(point);
      });

    // Historical data (keep last 1000 points)
    const history = this.aggregator.unified.pipe(store([], 1000));

    // Export data
    document.getElementById("export")?.addEventListener("click", () => {
      this.exportData(history.store.values);
    });
  }

  private renderMetrics(metrics: AggregatedMetrics) {
    console.log("Metrics:", metrics);
  }

  private showAlert(message: string) {
    console.warn("Alert:", message);
  }

  private updateChart(point: DataPoint) {
    console.log("Chart update:", point);
  }

  private exportData(points: DataPoint[]) {
    const csv = points.map((p) => `${p.timestamp},${p.source},${p.metric},${p.value}`).join("\n");
    console.log("Exported:", csv);
  }
}
```

#### Step 8: Testing with Mock Sources

```typescript
class MockSource implements DataSource {
  name = "mock";
  data = new Stream<DataPoint>();

  start() {
    // Generate test data
    setInterval(() => {
      this.data.push({
        source: this.name,
        metric: "test",
        value: Math.random() * 100,
        timestamp: Date.now(),
      });
    }, 100);
  }

  stop() {}
}

// Test aggregation
const testAggregator = new DataAggregator();
testAggregator.addSource(new MockSource());

testAggregator.aggregated.listen((metrics) => {
  console.log("Test metrics:", metrics);
});
```

### Benefits Demonstrated

✅ **Unified Pipeline**: All data flows through single stream  
✅ **Pluggable Sources**: Add/remove sources without changing dashboard  
✅ **Easy Testing**: Mock sources for testing transformations  
✅ **Declarative Transformations**: Filter, map, aggregate declaratively  
✅ **Historical Data**: Replay with `store` transformer  
✅ **Rate Limiting**: Built-in with stateful `filter`  
✅ **Separation of Concerns**: Sources, aggregation, rendering separate

### Extensions

Add data validation:

```typescript
const validated = aggregator.unified.pipe(
  filter((point) => {
    return point.value >= 0 && point.value <= 100;
  }),
);
```

Add anomaly detection:

```typescript
const anomalies = aggregator.unified.pipe(
  filter({ history: [] as number[] }, (state, point) => {
    const history = [...state.history, point.value].slice(-10);
    const avg = history.reduce((a, b) => a + b, 0) / history.length;
    const isAnomaly = Math.abs(point.value - avg) > avg * 0.5;

    return [isAnomaly, { history }];
  }),
);

anomalies.listen((point) => {
  console.warn("Anomaly detected:", point);
});
```

---

## 5. Collaborative Editing System

Build a real-time collaborative editor with operational transforms, cursor synchronization, and undo/redo.

### The Problem

Traditional collaborative editors mix editing logic, network sync, and conflict resolution:

```typescript
// ❌ Tightly coupled, hard to test, complex state management
class CollaborativeEditor {
  private content: string = "";
  private ws: WebSocket;
  private pendingOps: Operation[] = [];
  private cursors: Map<string, number> = new Map();

  handleLocalEdit(op: Operation) {
    // Apply locally
    this.content = this.applyOp(this.content, op);
    this.render();

    // Send to server
    this.ws.send(JSON.stringify(op));
    this.pendingOps.push(op);
  }

  handleRemoteEdit(op: Operation) {
    // Transform against pending ops
    let transformed = op;
    for (const pending of this.pendingOps) {
      transformed = this.transform(transformed, pending);
    }

    // Apply and render
    this.content = this.applyOp(this.content, transformed);
    this.render();
  }
}
```

**Problems:**

- Editing, networking, and OT logic mixed
- Hard to test transformations
- No event sourcing
- Can't replay editing history
- Cursor sync mixed with content sync

### Stream-Based Solution

Separate: local edits, remote edits, operational transforms, cursor sync.

#### Step 1: Define Types

```typescript
import { Stream, merge, filter, map, state, store, zip } from "@soffinal/stream";

type Operation =
  | { type: "insert"; pos: number; text: string; userId: string; version: number }
  | { type: "delete"; pos: number; length: number; userId: string; version: number };

type Cursor = {
  userId: string;
  position: number;
  selection?: { start: number; end: number };
};

type EditorState = {
  content: string;
  version: number;
};
```

#### Step 2: Operational Transform Engine

```typescript
class OTEngine {
  // Transform operation A against operation B
  static transform(opA: Operation, opB: Operation): Operation {
    if (opA.type === "insert" && opB.type === "insert") {
      if (opA.pos < opB.pos) return opA;
      return { ...opA, pos: opA.pos + opB.text.length };
    }

    if (opA.type === "insert" && opB.type === "delete") {
      if (opA.pos <= opB.pos) return opA;
      if (opA.pos > opB.pos + opB.length) {
        return { ...opA, pos: opA.pos - opB.length };
      }
      return { ...opA, pos: opB.pos };
    }

    if (opA.type === "delete" && opB.type === "insert") {
      if (opA.pos < opB.pos) return opA;
      return { ...opA, pos: opA.pos + opB.text.length };
    }

    if (opA.type === "delete" && opB.type === "delete") {
      if (opA.pos < opB.pos) return opA;
      if (opA.pos >= opB.pos + opB.length) {
        return { ...opA, pos: opA.pos - opB.length };
      }
      // Overlapping deletes - adjust
      return { ...opA, pos: opB.pos, length: opA.length };
    }

    return opA;
  }

  // Apply operation to content
  static apply(content: string, op: Operation): string {
    if (op.type === "insert") {
      return content.slice(0, op.pos) + op.text + content.slice(op.pos);
    }
    if (op.type === "delete") {
      return content.slice(0, op.pos) + content.slice(op.pos + op.length);
    }
    return content;
  }
}
```

#### Step 3: Collaborative Document

```typescript
class CollaborativeDocument {
  private localOps = new Stream<Operation>();
  private remoteOps = new Stream<Operation>();
  private cursors = new Stream<Cursor>();

  public state: Stream<EditorState>;
  public allOps: Stream<Operation>;
  public remoteCursors: Stream<Map<string, Cursor>>;

  constructor(
    initialContent: string,
    private userId: string,
  ) {
    // Merge local and remote operations
    this.allOps = this.localOps.pipe(merge(this.remoteOps));

    // Transform remote ops against pending local ops
    const transformedRemote = this.remoteOps.pipe(
      filter({ pending: [] as Operation[] }, (state, remoteOp) => {
        // Transform remote op against all pending local ops
        let transformed = remoteOp;
        for (const localOp of state.pending) {
          transformed = OTEngine.transform(transformed, localOp);
        }

        return [true, state];
      }),
    );

    // Track pending local ops
    this.localOps.listen((op) => {
      // Add to pending (will be cleared on server ack)
    });

    // Apply operations to state
    this.state = this.allOps.pipe(
      map({ content: initialContent, version: 0 }, (state, op) => {
        const newContent = OTEngine.apply(state.content, op);
        return [
          { content: newContent, version: state.version + 1 },
          { content: newContent, version: state.version + 1 },
        ];
      }),
    );

    // Track remote cursors
    this.remoteCursors = this.cursors.pipe(filter((cursor) => cursor.userId !== this.userId)).pipe(
      map({ cursors: new Map<string, Cursor>() }, (state, cursor) => {
        const newCursors = new Map(state.cursors);
        newCursors.set(cursor.userId, cursor);
        return [newCursors, { cursors: newCursors }];
      }),
    );
  }

  // Public API: Insert text
  insert(pos: number, text: string) {
    const op: Operation = {
      type: "insert",
      pos,
      text,
      userId: this.userId,
      version: 0, // Will be set by server
    };
    this.localOps.push(op);
  }

  // Public API: Delete text
  delete(pos: number, length: number) {
    const op: Operation = {
      type: "delete",
      pos,
      length,
      userId: this.userId,
      version: 0,
    };
    this.localOps.push(op);
  }

  // Public API: Update cursor
  updateCursor(position: number, selection?: { start: number; end: number }) {
    this.cursors.push({
      userId: this.userId,
      position,
      selection,
    });
  }

  // Called by network layer
  receiveOperation(op: Operation) {
    this.remoteOps.push(op);
  }

  // Called by network layer
  receiveCursor(cursor: Cursor) {
    this.cursors.push(cursor);
  }
}
```

#### Step 4: Network Sync

```typescript
class EditorSync {
  constructor(
    private doc: CollaborativeDocument,
    private transport: Transport, // From tutorial #1!
  ) {
    // Send local operations
    doc.allOps.pipe(filter((op) => op.userId === doc["userId"])).listen((op) => {
      transport.outgoing.push({
        id: crypto.randomUUID(),
        method: "editor.operation",
        params: op,
      });
    });

    // Receive remote operations
    transport.incoming.pipe(filter((res) => res.result?.type === "operation")).listen((res) => {
      doc.receiveOperation(res.result.operation);
    });

    // Sync cursors (throttled)
    doc["cursors"]
      .pipe(
        filter({ lastEmit: 0 }, (state, cursor) => {
          const now = Date.now();
          if (now - state.lastEmit < 100) return [false, state];
          return [true, { lastEmit: now }];
        }),
      )
      .listen((cursor) => {
        transport.outgoing.push({
          id: crypto.randomUUID(),
          method: "editor.cursor",
          params: cursor,
        });
      });
  }
}
```

#### Step 5: Undo/Redo with Event Sourcing

```typescript
class UndoManager {
  private undoStack: Operation[] = [];
  private redoStack: Operation[] = [];

  constructor(private doc: CollaborativeDocument) {
    // Track local operations for undo
    doc.allOps.pipe(filter((op) => op.userId === doc["userId"])).listen((op) => {
      this.undoStack.push(op);
      this.redoStack = []; // Clear redo on new operation
    });
  }

  undo() {
    const op = this.undoStack.pop();
    if (!op) return;

    // Create inverse operation
    const inverse = this.inverse(op);
    this.doc["localOps"].push(inverse);
    this.redoStack.push(op);
  }

  redo() {
    const op = this.redoStack.pop();
    if (!op) return;

    this.doc["localOps"].push(op);
    this.undoStack.push(op);
  }

  private inverse(op: Operation): Operation {
    if (op.type === "insert") {
      return {
        type: "delete",
        pos: op.pos,
        length: op.text.length,
        userId: op.userId,
        version: op.version,
      };
    }
    // For delete, would need to store deleted text
    return op;
  }
}
```

#### Step 6: Usage

```typescript
// Create document
const doc = new CollaborativeDocument("", "user-123");

// Connect to server
const transport = createWebSocketTransport("ws://localhost:8080");
const sync = new EditorSync(doc, transport);

// Setup undo/redo
const undoManager = new UndoManager(doc);

// Listen to state changes
doc.state.listen((state) => {
  console.log("Content:", state.content);
  console.log("Version:", state.version);
});

// Listen to cursor changes
doc.remoteCursors.listen((cursors) => {
  for (const [userId, cursor] of cursors) {
    console.log(`User ${userId} at position ${cursor.position}`);
  }
});

// Edit document
doc.insert(0, "Hello ");
doc.insert(6, "World");
doc.delete(0, 6); // Delete 'Hello '

// Update cursor
doc.updateCursor(5);

// Undo/Redo
undoManager.undo();
undoManager.redo();
```

#### Step 7: Testing with Mock Transport

```typescript
const mockTransport = createMockTransport((req) => {
  if (req.method === "editor.operation") {
    // Simulate server broadcasting to other clients
    return {
      id: req.id,
      result: { type: "operation", operation: req.params },
    };
  }
  return { id: req.id, result: null };
});

const testDoc = new CollaborativeDocument("", "test-user");
const testSync = new EditorSync(testDoc, mockTransport);

// Test operations
testDoc.insert(0, "Test");
testDoc.state.listen((state) => {
  console.log("Test content:", state.content); // 'Test'
});
```

### Benefits Demonstrated

✅ **Separation of Concerns**: Editing, OT, network, cursors separate  
✅ **Event Sourcing**: Replay entire editing history with `store`  
✅ **Easy Testing**: Mock transport, test OT in isolation  
✅ **Undo/Redo**: Natural with operation history  
✅ **Cursor Throttling**: Built-in with stateful `filter`  
✅ **Conflict Resolution**: Automatic via operational transforms  
✅ **Type Safety**: Full TypeScript inference throughout

### Extensions

Add presence awareness:

```typescript
const presence = new Stream<{ userId: string; online: boolean }>();

const onlineUsers = presence.pipe(
  map({ users: new Set<string>() }, (state, event) => {
    const users = new Set(state.users);
    if (event.online) {
      users.add(event.userId);
    } else {
      users.delete(event.userId);
    }
    return [Array.from(users), { users }];
  }),
);
```

Add version history:

```typescript
const history = doc.state.pipe(store([], 100)); // Keep last 100 versions

function revertToVersion(version: number) {
  const targetState = history.store.values.find((s) => s.version === version);
  if (targetState) {
    // Restore content
  }
}
```
