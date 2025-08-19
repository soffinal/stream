# @soffinal/stream

Reactive async-first streaming library with functional operations and reactive data structures. Build real-time apps with streams, state management, and event-driven collections.

## Core Concepts

### Stream

The `Stream` class is the foundation - an async iterable that can push values to multiple listeners and supports functional operations like `map`, `filter`, and `merge`.

```typescript
import { Stream } from "@soffinal/stream";

const stream = new Stream<number>();

// Listen to values
stream.listen((value) => console.log("Received:", value));

// Push values
stream.push(1, 2, 3);
// Output: Received: 1, Received: 2, Received: 3
```

### Async Iteration

Streams are async iterables, perfect for `for await` loops:

```typescript
const stream = new Stream<string>();

(async () => {
  for await (const message of stream) {
    console.log("Processing:", message);
    if (message === "stop") break;
  }
})();

stream.push("hello", "world", "stop");
```

### Generator-based Streams

Create streams from async generators:

```typescript
const timerStream = new Stream(async function* () {
  let count = 0;
  while (count < 5) {
    yield count++;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
});

timerStream.listen((count) => console.log("Timer:", count));
```

## Functional Operations

### Filter

```typescript
const numbers = new Stream<number>();
const evens = numbers.filter((n) => n % 2 === 0);

evens.listen((n) => console.log("Even:", n));
numbers.push(1, 2, 3, 4, 5, 6);
// Output: Even: 2, Even: 4, Even: 6
```

### Map

```typescript
const numbers = new Stream<number>();
const doubled = numbers.map((n) => n * 2);

doubled.listen((n) => console.log("Doubled:", n));
numbers.push(1, 2, 3);
// Output: Doubled: 2, Doubled: 4, Doubled: 6
```

### Merge

```typescript
const stream1 = new Stream<string>();
const stream2 = new Stream<string>();
const merged = stream1.merge(stream2);

merged.listen((msg) => console.log("Merged:", msg));

stream1.push("from stream1");
stream2.push("from stream2");
```

### Group

```typescript
const numbers = new Stream<number>();
const batches = numbers.group((batch) => batch.length === 3);

batches.listen((batch) => console.log("Batch:", batch));
numbers.push(1, 2, 3, 4, 5, 6);
// Output: Batch: [1, 2, 3], Batch: [4, 5, 6]
```

## Use Cases

### Real-time Data Processing

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

## State Management

The `State` class extends `Stream` to provide reactive state management:

### Basic State

```typescript
import { State } from "@soffinal/stream";

const counter = new State(0);

// Listen to state changes
counter.listen((value) => console.log("Counter:", value));

// Update state
counter.value = 5;
counter.value = 10;
```

### Complex State Management

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

## Reactive Data Structures

### List

```typescript
import { List } from "@soffinal/stream";

const todos = new List<string>();

// Listen to insertions
todos.insert.listen(([index, item]) => {
  console.log(`Added "${item}" at index ${index}`);
});

// Listen to deletions
todos.delete.listen(([index, item]) => {
  console.log(`Removed "${item}" from index ${index}`);
});

todos.insert(0, "Buy milk");
todos.insert(1, "Walk dog");
todos[0] = "Buy organic milk"; // Triggers insert stream
```

### Map

```typescript
import { Map } from "@soffinal/stream";

const cache = new Map<string, any>();

// Listen to cache updates
cache.set.listen(([key, value]) => {
  console.log(`Cache updated: ${key} = ${value}`);
});

// Listen to cache evictions
cache.delete.listen(([key, value]) => {
  console.log(`Cache evicted: ${key}`);
});

cache.set("user:123", { name: "John" });
cache.delete("user:123");
```

### Set

```typescript
import { Set } from "@soffinal/stream";

const activeUsers = new Set<string>();

activeUsers.add.listen((userId) => {
  console.log(`User ${userId} came online`);
  broadcastUserStatus(userId, "online");
});

activeUsers.delete.listen((userId) => {
  console.log(`User ${userId} went offline`);
  broadcastUserStatus(userId, "offline");
});
```

## Advanced Patterns

### Stream Composition

```typescript
const mouseEvents = new Stream<MouseEvent>();
const keyEvents = new Stream<KeyboardEvent>();

const interactions = mouseEvents
  .map((e) => ({ type: "mouse", x: e.clientX, y: e.clientY }))
  .merge(keyEvents.map((e) => ({ type: "key", code: e.code })));

interactions.listen((event) => {
  analytics.track("user_interaction", event);
});
```

### Error Handling

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

## Installation

```bash
bun add @soffinal/stream
```

## API Reference

### Stream<T>

- `push(...values: T[])` - Emit values to all listeners
- `listen(callback, signal?)` - Add listener, returns cleanup function
- `filter(predicate)` - Filter values
- `map(mapper)` - Transform values
- `merge(...streams)` - Combine multiple streams
- `group(predicate)` - Group values into batches
- `flat(depth?)` - Flatten array values
- `then(callback?)` - Promise-like interface for first value

### State<T> extends Stream<T>

- `value` - Get/set current state value
- `push(...values)` - Update state with multiple values

### List<T>, Map<K,V>, Set<T>

Reactive versions of native data structures with stream properties for mutations.
