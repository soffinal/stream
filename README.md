# @soffinal/stream

Reactive async-first streaming library with functional transformations and reactive data structures. Build real-time apps with streams, state management, and event-driven collections.

## Key Features

- **Multicast by Default**: One stream, many consumers - perfect for event systems
- **Awaitable Streams**: Simply `await stream` to get the next value
- **Async Iterable**: Use `for await` loops to process data as it flows
- **Lazy & Shared**: All operation run once per event, results shared across all listeners
- **Auto Cleanup**: Resources freed automatically when no longer needed
- **Async & Stateful Transformers**: Filter, map, group accept sync/async predicates and can maintain state
- **Custom Transformers**: Build your own transformers like throttle, debounce, distinctUntilChanged
- **Reactive State**: State objects that automatically notify dependents of changes
- **Reactive Collections**: Lists, Maps, Sets that emit change events

**@soffinal/stream** treats asynchronous data flow as the primary concern, making it useful for:

- Real-time data processing
- Event-driven architectures
- Streaming APIs and WebSockets
- state management
- Memory-efficient data pipelines
- UI updates

## Core Concepts

### The Stream: Your Data Pipeline Foundation

A `Stream` is an async iterable that can push values to multiple listeners, while also being a promise for the next value. Think of it as a smart data pipe where information flows through - multiple consumers can tap into the same flow to receive all values, or you can simply await the stream to get the next single value. This dual nature makes streams incredibly versatile for both event-driven architectures and simple async operations.

```typescript
import { Stream } from "@soffinal/stream";

// Create a data pipeline
const userEvents = new Stream<{ userId: string; action: string }>();

// Multiple consumers can listen to the same stream
userEvents.listen((event) => logToAnalytics(event));
userEvents.listen((event) => updateUserActivity(event));
userEvents.listen((event) => triggerNotifications(event));

// Push data through the pipeline
userEvents.push({ userId: "alice", action: "login" }, { userId: "bob", action: "purchase" });
// All three listeners receive both events

// Stream is also a promise for the next value
const nextEvent = await userEvents; // Waits for next pushed value
console.log("Next event:", nextEvent);
```

### Async Iteration: Processing Data as it Flows

Streams implement `AsyncIterable`, allowing you to process data as it arrives using `for await` loops:

```typescript
const messageStream = new Stream<string>();

// Process messages as they arrive
(async () => {
  for await (const message of messageStream) {
    await processMessage(message);
    if (message === "shutdown") break;
  }
})();

messageStream.push("user-login", "data-sync", "shutdown");
```

### Generator-based Streams: Infinite Data Sources

Create infinite, lazy data sources using async generators:

```typescript
const sensorStream = new Stream(async function* () {
  while (true) {
    const temperature = await readTemperatureSensor();
    const humidity = await readHumiditySensor();
    yield { temperature, humidity, timestamp: Date.now() };
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
});

sensorStream.listen((data) => console.log("Sensor reading:", data));
```

### Lazy Evaluation: Resource Efficiency by Design

Streams don't consume resources until needed and automatically clean up:

```typescript
const events = new Stream<{ userId: string; action: string }>();

const authorizedEvents = events.filter(async (event) => {
  const isAuthorized = await checkUserPermissions(event.userId);
  return isAuthorized;
});

const cleanup = authorizedEvents.listen((event) => handleAuthorizedEvent(event));
setTimeout(cleanup, 30000); // Auto cleanup
```

### Pipe: Functional Composition Made Easy

The `pipe` method enables functional composition of stream transformations. It provides a clean way to chain transformations and build reusable transformation pipelines:

```typescript
import { Stream, map, filter, group, merge, flat } from "@soffinal/stream";

const numbers = new Stream<number>();

// Functional composition with built-in transformers
const result = numbers
  .pipe(filter((n) => n > 0)) // Remove negative numbers
  .pipe(map((n) => n * 2)) // Double each value
  .pipe(group((batch) => batch.length >= 5)) // Group into batches of 5
  .pipe(flat()); // Flatten the batches

result.listen((value) => console.log("Processed:", value));
```

### Built-in Transformer Functions

The library provides a minimal set of **irreducible building block** transformers that work seamlessly with pipe. Rather than including every possible transformer, we focus on fundamental primitives that cannot be decomposed further - allowing you to compose domain-specific transformers from these core building blocks:

```typescript
// Import transformer functions
import { map, filter, group, merge, flat } from "@soffinal/stream";

const stream = new Stream<number>();

// Simple transformations
stream
  .pipe(map((n) => n.toString())) // Stream<string>
  .pipe(filter((s) => s.length > 1)) // Stream<string>
  .pipe(map((s) => parseInt(s))); // Stream<number>

// Stateful transformations
stream
  .pipe(filter(0, (prev, curr) => [curr > prev, Math.max(prev, curr)]))
  .pipe(map(0, (sum, n) => [sum + n, sum + n]));

// Advanced transformations
const stream2 = new Stream<number>();
stream
  .pipe(merge(stream2)) // Merge multiple streams
  .pipe(group((batch) => batch.length >= 10)) // Batch processing
  .pipe(flat()); // Flatten results
```

### Custom Transformers: Building Your Own Transformers

You can create custom transformers using three approaches:

**1. Simple Generator Functions:**

```typescript
// DistinctUntilChanged transformer - only emit when value changes
const distinctUntilChanged = <T>(stream: Stream<T>): Stream<T> => {
  return new Stream<T>(async function* () {
    let prev: T;
    let first = true;

    for await (const value of stream) {
      if (first || value !== prev) {
        yield value;
        prev = value;
        first = false;
      }
    }
  });
};

// Rate limiting transformer
const throttle =
  <T>(ms: number) =>
  (stream: Stream<T>): Stream<T> => {
    return new Stream<T>(async function* () {
      let lastEmit = 0;

      for await (const value of stream) {
        const now = Date.now();
        if (now - lastEmit >= ms) {
          yield value;
          lastEmit = now;
        }
      }
    });
  };

// Usage with perfect type inference
const searchInput = new Stream<string>();
const searchResults = searchInput
  .pipe(distinctUntilChanged) // Only emit when search term changes
  .pipe(throttle(1000)) // Limit API calls
  .pipe(map((query) => searchAPI(query)));
```

**2. Interface-based Transformers (with overloads):**

```typescript
// Define transformer interface with multiple overloads
interface DebounceFunction {
  <T>(ms: number): (stream: Stream<T>) => Stream<T>;
  <T>(ms: number, immediate: boolean): (stream: Stream<T>) => Stream<T>;
}

// Implement with full overload support
const debounce: DebounceFunction =
  <T>(ms: number, immediate?: boolean) =>
  (stream: Stream<T>): Stream<T> => {
    return new Stream<T>(async function* () {
      let timeoutId: NodeJS.Timeout | null = null;
      let lastValue: T;

      for await (const value of stream) {
        if (timeoutId) clearTimeout(timeoutId);

        if (immediate && !timeoutId) {
          yield value;
        }

        lastValue = value;
        timeoutId = setTimeout(() => {
          if (!immediate) yield lastValue;
          timeoutId = null;
        }, ms);
      }
    });
  };

// Perfect type inference and autocomplete
stream
  .pipe(debounce(300)) // Basic debounce
  .pipe(debounce(500, true)); // Immediate debounce
```

**3. Active Listening Pattern (Not Recommended):**

For specialized use cases that require immediate processing or side effects, you can create transformers that actively listen to the source stream:

```typescript
// Buffer with time-based flushing
const bufferWithTimeout =
  <T>(ms: number) =>
  (source: Stream<T>): Stream<T[]> => {
    const output = new Stream<T[]>();
    const buffer: T[] = [];
    let timeoutId: NodeJS.Timeout | null = null;

    const flush = () => {
      if (buffer.length > 0) {
        output.push([...buffer]);
        buffer.length = 0;
      }
      timeoutId = null;
    };

    source.listen((value) => {
      buffer.push(value);
      if (!timeoutId) {
        timeoutId = setTimeout(flush, ms);
      }
    });

    return output;
  };

// Usage
const events = new Stream<string>();
const buffered = events.pipe(bufferWithTimeout(1000));
buffered.listen((batch) => console.log("Batch:", batch));
```

**Note:** This approach is not recommended for most use cases because it creates active subscriptions immediately and doesn't follow the lazy evaluation pattern. Use generator-based approaches when possible.

## Functional Operations: Composable Data Transformations

Streams support functional programming patterns with built-in transformers that can handle both sync and async operations. Each transformer returns a new stream, allowing for powerful composition.

### Filter: Smart Data Selection

Filtering goes beyond simple predicates - it supports stateful filtering and async operations. All filter computations are **lazy and shared** across listeners:

```typescript
const events = new Stream<{ type: string; userId: string; data: any }>();

// Simple filtering
const loginEvents = events.filter((e) => e.type === "login");

// Stateful filtering - only allow increasing user IDs
const validEvents = events.filter(
  0, // initial state
  (lastUserId, event) => {
    const currentId = parseInt(event.userId);
    return [currentId > lastUserId, currentId];
  }
);

// Async filtering - validate against external service
const authorizedEvents = events.filter(async (event) => {
  const isAuthorized = await checkUserPermissions(event.userId);
  return isAuthorized;
});
```

### Map: Data Transformation Pipeline

Mapping transforms data while maintaining the stream's async nature:

```typescript
const rawEvents = new Stream<string>();

// Simple transformation
const parsedEvents = rawEvents.map((json) => JSON.parse(json));

// Stateful transformation - add sequence numbers
const sequencedEvents = rawEvents.map(
  0, // initial sequence
  (seq, event) => [{ ...event, sequence: seq + 1 }, seq + 1]
);

// Async transformation - enrich with external data
const enrichedEvents = parsedEvents.map(async (event) => {
  const userProfile = await getUserProfile(event.userId);
  return { ...event, user: userProfile };
});
```

### Merge

Combine multiple streams into a single output stream.

```typescript
const stream1 = new Stream<string>();
const stream2 = new Stream<string>();
const merged = stream1.merge(stream2);

merged.listen((msg) => console.log("Merged:", msg));

stream1.push("from stream1");
stream2.push("from stream2");
```

### Group: Intelligent Batching

Grouping allows you to batch data based on complex conditions:

```typescript
const transactions = new Stream<{ amount: number; userId: string }>();

// Batch by count
const countBatches = transactions.group((batch) => batch.length >= 100);

// Batch by total amount
const amountBatches = transactions.group(
  0, // initial sum
  (sum, transaction) => {
    const newSum = sum + transaction.amount;
    return [newSum >= 10000, newSum >= 10000 ? 0 : newSum];
  }
);

// Process batches efficiently
amountBatches.listen(async (totalAmount) => {
  await processBulkTransaction(totalAmount);
});
```

## Use Cases

Practical examples of building reactive applications.

### Real-time Data Processing

Process sensor data with filtering and transformation.

```typescript
const sensorData = new Stream<{ temperature: number; humidity: number }>();

// Alert system
sensorData.filter((data) => data.temperature > 30).listen((data) => console.log("High temperature alert:", data));

// Data logging
sensorData.map((data) => ({ ...data, timestamp: Date.now() })).listen((data) => saveToDatabase(data));

// Simulate sensor readings
setInterval(() => {
  sensorData.push({
    temperature: Math.random() * 40,
    humidity: Math.random() * 100,
  });
}, 1000);
```

### Event Aggregation

Collect and batch user events for analytics.

```typescript
const userActions = new Stream<{ userId: string; action: string }>();

// Group actions by time windows
const actionBatches = userActions.group(0, (count, action) => {
  return count >= 10 ? [true, 0] : [false, count + 1];
});

actionBatches.listen((count) => {
  console.log(`Processed ${count} actions`);
});
```

### WebSocket Integration

Create reactive streams from WebSocket connections.

```typescript
const wsStream = new Stream<MessageEvent>(async function* () {
  const ws = new WebSocket("wss://api.example.com");

  while (ws.readyState !== WebSocket.CLOSED) {
    yield await new Promise((resolve) => {
      ws.onmessage = resolve;
    });
  }
});

wsStream
  .map((event) => JSON.parse(event.data))
  .filter((data) => data.type === "update")
  .listen((update) => handleUpdate(update));
```

### Flat

Flatten nested arrays in stream values.

```typescript
const arrays = new Stream<number[]>();
const flattened = arrays.flat();

flattened.listen((n) => console.log("Flat:", n));
arrays.push([1, 2], [3, 4]);
// Output: Flat: 1, Flat: 2, Flat: 3, Flat: 4

// Deep flattening
const nested = new Stream<number[][][]>();
const deepFlat = nested.flat(2);
```

### Promise Interface

Streams are directly awaitable - no need to call `.then()`.

```typescript
const stream = new Stream<number>();

// Simply await the stream for the next value
const nextValue = await stream;
console.log("Received:", nextValue);

// Or use .then() for transformation
const doubled = await stream.then((x) => x * 2);

// Both resolve when stream.push() is called
stream.push(5); // nextValue = 5, doubled = 10
```

### Listener Events

React to listener lifecycle changes on streams.

```typescript
const stream = new Stream<number>();

// Listen to listener lifecycle
stream.listenerAdded.listen(() => console.log("Listener added"));
stream.listenerRemoved.listen(() => console.log("Listener removed"));

const cleanup = stream.listen((value) => console.log(value));
cleanup(); // Triggers 'Listener removed'
```

### Memory Management

Streams automatically clean up and manage memory efficiently.

```typescript
const stream = new Stream<number>();

// Generators stop when no listeners
const dataStream = new Stream(async function* () {
  while (true) {
    yield Math.random();
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
});

const cleanup = dataStream.listen(console.log);
// Generator running...

cleanup(); // Generator stops automatically
// No memory leaks - generator is cleaned up
```

## State Management: Reactive Application State

State management in @soffinal/stream goes beyond simple value storage - it provides reactive state that automatically notifies dependents of changes, enabling sophisticated application architectures.

### Reactive State: Beyond Simple Variables

State objects are streams that hold current values, enabling reactive programming patterns:

```typescript
import { State } from "@soffinal/stream";

// Application state
const user = new State<User | null>(null);
const theme = new State<"light" | "dark">("light");
const notifications = new State<Notification[]>([]);

// Reactive computations
const isLoggedIn = user.map((u) => u !== null);
const unreadCount = notifications.map((n) => n.filter((x) => !x.read).length);

// Automatic UI updates
isLoggedIn.listen((loggedIn) => {
  document.body.classList.toggle("logged-in", loggedIn);
});

unreadCount.listen((count) => {
  document.title = count > 0 ? `(${count}) My App` : "My App";
});
```

### Complex State Management

Handle complex application state with derived values.

```typescript
interface AppState {
  user: { id: string; name: string } | null;
  notifications: string[];
  theme: "light" | "dark";
}

const appState = new State<AppState>({
  user: null,
  notifications: [],
  theme: "light",
});

// Derived states
const isLoggedIn = appState.map((state) => state.user !== null);
const notificationCount = appState.map((state) => state.notifications.length);

// React to login state
isLoggedIn.listen((loggedIn) => {
  if (loggedIn) {
    console.log("User logged in");
    loadUserData();
  }
});

// Update state immutably
function login(user: { id: string; name: string }) {
  appState.value = {
    ...appState.value,
    user,
  };
}

function addNotification(message: string) {
  appState.value = {
    ...appState.value,
    notifications: [...appState.value.notifications, message],
  };
}
```

### State Persistence

Automatically persist state changes to storage.

```typescript
const settings = new State({ theme: "light", language: "en" });

// Auto-save to localStorage
settings.listen((state) => {
  localStorage.setItem("settings", JSON.stringify(state));
});

// Load from localStorage
const saved = localStorage.getItem("settings");
if (saved) {
  settings.value = JSON.parse(saved);
}
```

## Reactive Data Structures: Collections That Notify

The library extends JavaScript's native collections (Array, Map, Set) with reactive capabilities. Every mutation emits events, allowing you to build reactive UIs and data synchronization systems.

### Reactive List: Arrays That Broadcast Changes

Reactive Lists provide array-like functionality with fine-grained change notifications:

```typescript
import { List } from "@soffinal/stream";

// Create a reactive todo list
const todos = new List<{ id: string; text: string; done: boolean }>();

// Build reactive UI components
todos.insert.listen(([index, todo]) => {
  const element = createTodoElement(todo);
  todoContainer.insertBefore(element, todoContainer.children[index]);
});

todos.delete.listen(([index, todo]) => {
  todoContainer.children[index].remove();
});

// Reactive operations
const completedCount = new State(0);
todos.insert.listen(() => updateCompletedCount());
todos.delete.listen(() => updateCompletedCount());

function updateCompletedCount() {
  const completed = [...todos].filter((t) => t.done).length;
  completedCount.value = completed;
}

// Automatic persistence
todos.insert.listen(() => saveTodosToStorage([...todos]));
todos.delete.listen(() => saveTodosToStorage([...todos]));
```

### Map

Key-value store that emits events on changes.

```typescript
import { Map } from "@soffinal/stream";

const cache = new Map<string, any>();

// Listen to cache updates (only emits on actual changes)
cache.set.listen(([key, value]) => {
  console.log(`Cache updated: ${key} = ${value}`);
});

// Listen to cache evictions
cache.delete.listen(([key, value]) => {
  console.log(`Cache evicted: ${key}`);
});

// Listen to clear events
cache.clear.listen(() => console.log("Cache cleared"));

cache.set("user:123", { name: "John" }); // Cache updated: user:123 = {...}
cache.set("user:123", { name: "John" }); // No emission (same value)
cache.delete("user:123"); // Cache evicted: user:123
cache.delete("nonexistent"); // No emission (didn't exist)

// All native Map methods available
console.log(cache.size);
console.log(cache.has("key"));
for (const [key, value] of cache) {
  console.log(key, value);
}
```

### Set

Unique value collection that emits events on changes.

```typescript
import { Set } from "@soffinal/stream";

const activeUsers = new Set<string>();

// Listen to additions (only emits for new values)
activeUsers.add.listen((userId) => {
  console.log(`User ${userId} came online`);
  broadcastUserStatus(userId, "online");
});

// Listen to deletions
activeUsers.delete.listen((userId) => {
  console.log(`User ${userId} went offline`);
  broadcastUserStatus(userId, "offline");
});

// Listen to clear events
activeUsers.clear.listen(() => console.log("All users cleared"));

activeUsers.add("alice"); // User alice came online
activeUsers.add("alice"); // No emission (duplicate)
activeUsers.delete("alice"); // User alice went offline
activeUsers.delete("bob"); // No emission (didn't exist)

// All native Set methods available
console.log(activeUsers.size);
console.log(activeUsers.has("alice"));
for (const user of activeUsers) {
  console.log(user);
}
```

## Advanced Patterns: Building Production Systems

These patterns show how to build robust, scalable reactive applications using the library's advanced features.

### Event Sourcing Architecture

Build event-driven systems where all changes are captured as streams:

```typescript
// Domain events
const userEvents = new Stream<UserEvent>();
const orderEvents = new Stream<OrderEvent>();
const paymentEvents = new Stream<PaymentEvent>();

// Event store - all events flow through here
const eventStore = userEvents
  .merge(orderEvents, paymentEvents)
  .map((event) => ({ ...event, timestamp: Date.now(), id: generateId() }));

// Projections - build read models from events
const userProjection = new Map<string, User>();
const orderProjection = new Map<string, Order>();

userEvents.listen((event) => {
  switch (event.type) {
    case "UserCreated":
      userProjection.set(event.userId, event.userData);
      break;
    case "UserUpdated":
      const user = userProjection.get(event.userId);
      userProjection.set(event.userId, { ...user, ...event.changes });
      break;
  }
});

// Sagas - coordinate between domains
orderEvents
  .filter((e) => e.type === "OrderPlaced")
  .listen(async (order) => {
    // Trigger payment processing
    paymentEvents.push({
      type: "PaymentRequested",
      orderId: order.orderId,
      amount: order.total,
    });
  });
```

### Error Handling

Handle async operations and errors in streams.

```typescript
const apiCalls = new Stream<string>();

const results = apiCalls.map(async (url) => {
  try {
    const response = await fetch(url);
    return { success: true, data: await response.json() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

results.listen((result) => {
  if (result.success) {
    handleData(result.data);
  } else {
    handleError(result.error);
  }
});
```

### Cleanup and Memory Management

Properly clean up listeners and prevent memory leaks.

```typescript
const stream = new Stream<number>();

// Automatic cleanup with AbortSignal
const controller = new AbortController();
stream.listen((value) => console.log(value), controller.signal);

// Clean up when component unmounts
setTimeout(() => controller.abort(), 5000);

// Or manual cleanup
const cleanup = stream.listen((value) => console.log(value));
setTimeout(cleanup, 5000);
```

### Real-time Data Processing Pipeline

Build sophisticated data processing systems:

```typescript
// Raw sensor data stream
const sensorData = new Stream<SensorReading>();

// Multi-stage processing pipeline
const processedData = sensorData
  // 1. Validate data quality
  .filter(async (reading) => {
    return await validateSensorReading(reading);
  })
  // 2. Normalize and enrich
  .map(async (reading) => {
    const location = await getLocationData(reading.sensorId);
    return {
      ...reading,
      location,
      normalized: normalizeReading(reading.value),
    };
  })
  // 3. Detect anomalies using sliding window
  .group(
    { readings: [], sum: 0 }, // sliding window state
    (window, reading) => {
      const newWindow = {
        readings: [...window.readings, reading].slice(-10), // keep last 10
        sum: window.sum + reading.normalized,
      };
      const average = newWindow.sum / newWindow.readings.length;
      const isAnomaly = Math.abs(reading.normalized - average) > threshold;

      return [isAnomaly, newWindow];
    }
  )
  // 4. Batch anomalies for processing
  .group((batch) => batch.length >= 5 || Date.now() - batch[0]?.timestamp > 30000);

// Multiple consumers for different purposes
processedData.listen((anomalies) => sendAlerts(anomalies));
processedData.listen((anomalies) => updateDashboard(anomalies));
processedData.listen((anomalies) => logToDatabase(anomalies));
```

### Distributed System Coordination

Coordinate between multiple services using streams:

```typescript
// Service mesh communication
class ServiceMesh {
  private services = new Map<string, ServiceNode>();
  private messageStream = new Stream<ServiceMessage>();

  constructor() {
    // Route messages between services
    this.messageStream.listen(async (message) => {
      const targetService = this.services.get(message.targetService);
      if (targetService) {
        await targetService.handleMessage(message);
      }
    });

    // Health monitoring
    const healthChecks = new Stream(async function* () {
      while (true) {
        for (const [id, service] of this.services) {
          const health = await service.checkHealth();
          yield { serviceId: id, health, timestamp: Date.now() };
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    });

    // Auto-scaling based on load
    healthChecks
      .filter((check) => check.health.load > 0.8)
      .group((alerts) => alerts.length >= 3) // 3 consecutive high load alerts
      .listen((alerts) => {
        const serviceId = alerts[0].serviceId;
        this.scaleService(serviceId, "up");
      });
  }

  registerService(id: string, node: ServiceNode) {
    this.services.set(id, node);

    // Service discovery
    this.messageStream.push({
      type: "ServiceRegistered",
      serviceId: id,
      capabilities: node.getCapabilities(),
    });
  }
}
```

## Dual Programming Paradigms

@soffinal/stream supports both Object-Oriented and Functional programming styles, giving you the flexibility to choose the approach that fits your needs:

### Object-Oriented Style (Method Chaining)

```typescript
// Familiar method chaining
const result = stream
  .filter((x) => x > 0)
  .map((x) => x * 2)
  .group((batch) => batch.length >= 5);

// Rich instance methods with overloads
stream
  .filter(0, (prev, curr) => [curr > prev, curr]) // Stateful filtering
  .map(async (x) => await enrich(x)); // Async mapping
```

### Functional Style (Pipe Composition)

```typescript
// Composable transformers
const result = stream
  .pipe(filter((x) => x > 0))
  .pipe(map((x) => x * 2))
  .pipe(group((batch) => batch.length >= 5));

// Reusable transformation pipelines
const processNumbers = (stream: Stream<number>) => stream.pipe(filter((x) => x > 0)).pipe(map((x) => x * 2));

const result1 = stream1.pipe(processNumbers);
const result2 = stream2.pipe(processNumbers);
```

### Extensibility Options

**Option 1: Custom Transformers (Lightweight)**

```typescript
const throttle = <T>(ms: number) => (stream: Stream<T>) => /* implementation */;
stream.pipe(throttle(1000));
```

**Option 2: Class Extension (RxJS-style)**

```typescript
class RxStream<T> extends Stream<T> {
  throttle(ms: number): RxStream<T> {
    /* implementation */
  }
  debounce(ms: number): RxStream<T> {
    /* implementation */
  }
}

const rxStream = new RxStream<number>();
rxStream
  .filter((x) => x > 0)
  .throttle(1000)
  .debounce(300);
```

## Installation

```bash
bun add @soffinal/stream
```

## API Reference

### Stream<T>

**Properties:**

- `hasListeners: boolean` - True if stream has active listeners
- `listenerAdded: Stream<void>` - Emits when listener is added
- `listenerRemoved: Stream<void>` - Emits when listener is removed

**Methods:**

- `push(...values: T[])` - Emit values to all listeners
- `listen(callback, signal?)` - Add listener, returns cleanup function
- `filter(predicate)` - Filter values with predicate or accumulator
- `map(mapper)` - Transform values with mapper or accumulator
- `merge(...streams)` - Combine multiple streams
- `group(predicate)` - Group values into batches
- `flat(depth?)` - Flatten array values (default depth: 0)
- `pipe(transformer)` - Apply functional transformer to stream
- `then(callback?)` - Promise-like interface for first value
- `[Symbol.asyncIterator]()` - Async iteration support

### Transformer Functions

**Built-in transformers for functional composition:**

- `map(mapper)` - Transform values (supports stateful mapping)
- `filter(predicate)` - Filter values (supports type guards and stateful filtering)
- `group(predicate)` - Group values into batches (supports stateful grouping)
- `merge(...streams)` - Merge multiple streams into one
- `flat(depth?)` - Flatten array values with configurable depth

**Usage:**

```typescript
import { map, filter, group, merge, flat } from "@soffinal/stream";

// Functional composition
stream
  .pipe(filter((x) => x > 0))
  .pipe(map((x) => x * 2))
  .pipe(group((batch) => batch.length >= 10));

// All transformers support the same overloads as Stream methods
stream
  .pipe(filter(0, (prev, curr) => [curr > prev, curr])) // Stateful
  .pipe(map(async (x) => await processAsync(x))); // Async
```

### State<T> extends Stream<T>

**Properties:**

- `value: T` - Get/set current state value

**Methods:**

- `push(...values: T[])` - Update state with multiple values sequentially

### List<T>

**Properties:**

- `length: number` - Current list length
- `insert: Stream<[number, T]>` - Emits on insertions
- `delete: Stream<[number, T]>` - Emits on deletions
- `clear: Stream<void>` - Emits on clear
- `[index]: T` - Index access with modulo wrapping

**Methods:**

- `insert(index, value)` - Insert value at index
- `delete(index)` - Delete value at index, returns deleted value
- `clear()` - Clear all items
- `get(index)` - Get value without modulo wrapping
- `values()` - Iterator for values

### Map<K,V> extends globalThis.Map<K,V>

**Stream Properties:**

- `set: Stream<[K, V]>` - Emits on set operation (only actual changes)
- `delete: Stream<[K, V]>` - Emits on successful deletions
- `clear: Stream<void>` - Emits on clear (only if not empty)

**Methods:**

- All native Map methods plus reactive stream properties

### Set<T> extends globalThis.Set<T>

**Stream Properties:**

- `add: Stream<T>` - Emits on successful additions (no duplicates)
- `delete: Stream<T>` - Emits on successful deletions
- `clear: Stream<void>` - Emits on clear (only if not empty)

**Methods:**

- All native Set methods plus reactive stream properties
