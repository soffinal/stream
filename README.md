# @soffinal/stream

[![npm version](https://badge.fury.io/js/@soffinal%2Fstream.svg)](https://badge.fury.io/js/@soffinal%2Fstream)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@soffinal/stream)](https://bundlephobia.com/package/@soffinal/stream)

> **High-performance reactive streaming library for TypeScript/JavaScript**

A modern, async-first streaming library that treats asynchronous data flow as a first-class citizen. Built for real-time applications, event-driven architectures, and reactive programming patterns.

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Core Concepts](#core-concepts)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Performance](#performance)
- [Browser Support](#browser-support)
- [Migration Guide](#migration-guide)
- [Contributing](#contributing)
- [License](#license)

## Features

- 🚀 **High Performance** - Optimized for speed and efficiency
- 🔄 **Multicast by Default** - One stream, many consumers
- ⏳ **Awaitable Streams** - `await stream` for next value
- 🔁 **Async Iterable** - Use `for await` loops naturally
- ⚡ **Async Operations** - All transformers support async functions while maintaining order
- 🧠 **Smart Caching** - Operations run once, results shared
- 🗑️ **Auto Cleanup** - Memory management handled automatically
- 🔧 **Dual Programming Paradigms** - Method chaining or functional pipe composition
- 🛠️ **Custom Transformers** - Create reusable transformers in both OOP and functional styles
- 📊 **Reactive Collections** - Lists, Maps, Sets with fine-grained change events
- 🔀 **Stateful Operations** - Built-in support for stateful filtering, mapping, and grouping
- 📦 **Zero Dependencies** - Lightweight (~6KB minified, ~2KB gzipped) and tree-shakeable
- 🌐 **Universal** - Node.js, browsers, Deno, Bun, Cloudflare Workers
- 📘 **Full TypeScript** - Complete type safety and inference

## Quick Start

```typescript
import { Stream, State } from "@soffinal/stream";

// Create reactive data streams
const events = new Stream<string>();
const counter = new State(0);

// Transform and filter data
const processed = events.filter((msg) => msg.length > 3).map((msg) => msg.toUpperCase());

// Multiple consumers
processed.listen((msg) => console.log("Logger:", msg));
processed.listen((msg) => updateUI(msg));

// Push data through the pipeline
events.push("hello", "hi", "world"); // Only 'HELLO' and 'WORLD' processed

// Reactive state management
counter.listen((count) => (document.title = `Count: ${count}`));
counter.value++; // UI updates automatically
```

## Installation

### Package Managers

```bash
# npm
npm install @soffinal/stream

# yarn
yarn add @soffinal/stream

# pnpm
pnpm add @soffinal/stream

# bun
bun add @soffinal/stream

# Deno
deno add jsr:@soffinal/stream
```

### CDN (Browser)

```html
<!-- Production (minified) -->
<script type="module">
  import { Stream, State } from "https://cdn.jsdelivr.net/npm/@soffinal/stream@latest/dist/index.js";
</script>

<!-- Alternative CDNs -->
<script type="module">
  import { Stream } from "https://esm.sh/@soffinal/stream";
  import { Stream } from "https://cdn.skypack.dev/@soffinal/stream";
</script>
```

## Core Concepts

### Streams: Async Data Pipelines

A `Stream` is an async iterable that can push values to multiple listeners while also being awaitable for the next value.

```typescript
const userEvents = new Stream<UserEvent>();

// Multiple consumers
userEvents.listen((event) => analytics.track(event));
userEvents.listen((event) => notifications.send(event));
userEvents.listen((event) => database.save(event));

// Or await the next event
const nextEvent = await userEvents;
```

### Transformers: Fluent & Functional Styles

#### Method Chaining (Fluent)

```typescript
const stream = new Stream<number>();

// Simple transformations
const result = stream
  .filter((x) => x > 0)
  .map((x) => x * 2)
  .group((batch) => batch.length >= 5);

// Async operations with order preservation
const asyncProcessed = stream
  .filter(async (value) => {
    const isValid = await validateAsync(value);
    return isValid;
  })
  .map(async (value) => {
    const enriched = await enrichWithExternalData(value);
    return { original: value, enriched };
  });

// Stateful operations with initial state
const stateful = stream
  .filter(0, (prev, curr) => [curr > prev, Math.max(prev, curr)]) // Only increasing values
  .map([], (history, value) => {
    const newHistory = [...history, value].slice(-3); // Keep last 3
    const average = newHistory.reduce((a, b) => a + b, 0) / newHistory.length;
    return [{ value, average, history: newHistory }, newHistory];
  })
  .group(5, (count, item) => [count >= 5, count >= 5 ? 0 : count + 1]); // Batch every 5
```

#### Functional Composition (Pipe)

```typescript
import { filter, map, group, merge } from "@soffinal/stream";

// Simple functional composition
const result = stream
  .pipe(filter((x) => x > 0))
  .pipe(map((x) => x * 2))
  .pipe(group((batch) => batch.length >= 5));

// Async functional transformers (order preserved)
const asyncPipeline = stream
  .pipe(filter(async (x) => await isValidAsync(x)))
  .pipe(map(async (x) => await processAsync(x)))
  .pipe(group(batch => batch.length >= 5));

// Stateful functional transformers
const advanced = stream
  .pipe(filter(0, (prev, curr) => [curr > prev, Math.max(prev, curr)]))
  .pipe(
    map([], (acc, value) => {
      const newAcc = [...acc, value].slice(-10);
      const sum = newAcc.reduce((a, b) => a + b, 0);
      return [{ value, sum, count: newAcc.length }, newAcc];
    })
  )
  .pipe(group(0, (count, item) => [count >= 3, count >= 3 ? 0 : count + 1]));

// Combining multiple streams
const stream2 = new Stream<number>();
const merged = stream
  .pipe(filter((x) => x % 2 === 0))
  .pipe(merge(stream2))
  .pipe(map((x) => x.toString()));
```

### Custom Transformers

Create reusable transformers for both paradigms:

```typescript
// Custom transformer: distinctUntilChanged
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

// Custom transformer: throttle
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
  .pipe(distinctUntilChanged)
  .pipe(throttle(300))
  .pipe(map((query) => searchAPI(query)));
```

### Reactive State

State objects hold current values and notify dependents of changes:

```typescript
const user = new State<User | null>(null);
const theme = new State<"light" | "dark">("light");

// Derived state with transformations
const isLoggedIn = user.map((u) => u !== null);
const userProfile = user
  .filter((u): u is User => u !== null)
  .map((u) => ({ ...u, displayName: u.firstName + " " + u.lastName }));

// Automatic UI updates
isLoggedIn.listen((loggedIn) => {
  document.body.classList.toggle("authenticated", loggedIn);
});
```

### Reactive Collections

Collections that emit fine-grained change events:

```typescript
const todos = new List<Todo>();
const cache = new Map<string, any>();
const activeUsers = new Set<string>();

// React to changes
todos.insert.listen(([index, todo]) => renderTodo(todo, index));
cache.set.listen(([key, value]) => console.log(`Cached: ${key}`));
activeUsers.add.listen((userId) => showOnlineStatus(userId));
```

## API Reference

### Stream\<T>

#### Properties

- `hasListeners: boolean` - Whether stream has active listeners
- `listenerAdded: Stream<void>` - Emits when listener is added
- `listenerRemoved: Stream<void>` - Emits when listener is removed

#### Methods

- `push(...values: T[]): void` - Emit values to all listeners
- `listen(callback: (value: T) => void, signal?: AbortSignal): () => void` - Add listener, returns cleanup function
- `filter<U extends T>(predicate: (value: T) => value is U): Stream<U>` - Filter with type guard
- `filter(predicate: (value: T) => boolean | Promise<boolean>): Stream<T>` - Filter with async predicate
- `filter<S>(initialState: S, accumulator: (state: S, value: T) => [boolean, S] | Promise<[boolean, S]>): Stream<T>` - Stateful filtering
- `map<U>(mapper: (value: T) => U | Promise<U>): Stream<U>` - Transform with async mapper
- `map<S, U>(initialState: S, accumulator: (state: S, value: T) => [U, S] | Promise<[U, S]>): Stream<U>` - Stateful mapping
- `group(predicate: (batch: T[]) => boolean | Promise<boolean>): Stream<T[]>` - Group into batches
- `group<S>(initialState: S, accumulator: (state: S, value: T) => [boolean, S] | Promise<[boolean, S]>): Stream<S>` - Stateful grouping
- `merge<STREAMS extends [Stream<any>, ...Stream<any>[]]>(...streams: STREAMS): Stream<T | ValueOf<STREAMS[number]>>` - Merge multiple streams
- `flat<DEPTH extends number = 0>(depth?: DEPTH): Stream<FlatArray<T, DEPTH>>` - Flatten arrays with configurable depth
- `pipe<U>(transformer: (stream: Stream<T>) => Stream<U>): Stream<U>` - Apply functional transformer

#### Async Interface

- `then<U>(callback?: (value: T) => U): Promise<U>` - Promise interface
- `[Symbol.asyncIterator](): AsyncIterator<T>` - Async iteration

### State\<T> extends Stream\<T>

#### Properties

- `value: T` - Current state value (get/set)

### Transformer Functions

Functional transformers for use with `pipe()` - all support async operations:

#### filter
- `filter<T, U extends T>(predicate: (value: T) => value is U): (stream: Stream<T>) => Stream<U>`
- `filter<T>(predicate: (value: T) => boolean | Promise<boolean>): (stream: Stream<T>) => Stream<T>`
- `filter<T, S>(initialState: S, accumulator: (state: S, value: T) => [boolean, S] | Promise<[boolean, S]>): (stream: Stream<T>) => Stream<T>`

#### map
- `map<T, U>(mapper: (value: T) => U | Promise<U>): (stream: Stream<T>) => Stream<U>`
- `map<T, S, U>(initialState: S, accumulator: (state: S, value: T) => [U, S] | Promise<[U, S]>): (stream: Stream<T>) => Stream<U>`

#### group
- `group<T>(predicate: (batch: T[]) => boolean | Promise<boolean>): (stream: Stream<T>) => Stream<T[]>`
- `group<T, S>(initialState: S, accumulator: (state: S, value: T) => [boolean, S] | Promise<[boolean, S]>): (stream: Stream<T>) => Stream<S>`

#### merge
- `merge<STREAMS extends [Stream<any>, ...Stream<any>[]]>(...streams: STREAMS): <T>(stream: Stream<T>) => Stream<T | ValueOf<STREAMS[number]>>`

#### flat
- `flat(): <T>(stream: Stream<T>) => Stream<FlatArray<T, 0>>`
- `flat<DEPTH extends number>(depth: DEPTH): <T>(stream: Stream<T>) => Stream<FlatArray<T, DEPTH>>`

### Reactive Collections

#### List\<T>

- `insert: Stream<[number, T]>` - Insertion events
- `delete: Stream<[number, T]>` - Deletion events
- `clear: Stream<void>` - Clear events

#### Map\<K,V> extends globalThis.Map\<K,V>

- `set: Stream<[K, V]>` - Set events (only on changes)
- `delete: Stream<[K, V]>` - Delete events
- `clear: Stream<void>` - Clear events

#### Set\<T> extends globalThis.Set\<T>

- `add: Stream<T>` - Add events (only new values)
- `delete: Stream<T>` - Delete events
- `clear: Stream<void>` - Clear events

## Examples

### Real-time Data Processing

```typescript
const sensorData = new Stream<SensorReading>();

// Multi-stage processing pipeline
const alerts = sensorData
  .filter((reading) => reading.temperature > 30)
  .map((reading) => ({ ...reading, timestamp: Date.now() }))
  .group((batch) => batch.length >= 5);

alerts.listen((batch) => sendAlertNotification(batch));
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

const messages = wsStream.map((event) => JSON.parse(event.data)).filter((data) => data.type === "update");

messages.listen((update) => handleUpdate(update));
```

### State Management

```typescript
interface AppState {
  user: User | null;
  theme: "light" | "dark";
  notifications: Notification[];
}

const appState = new State<AppState>({
  user: null,
  theme: "light",
  notifications: [],
});

// Derived state
const unreadCount = appState.map((state) => state.notifications.filter((n) => !n.read).length);

// Reactive UI
unreadCount.listen((count) => {
  document.title = count > 0 ? `(${count}) App` : "App";
});
```

### Interactive Demo

**🚀 [Live Demo on StackBlitz](https://stackblitz.com/edit/soffinal-stream?file=src%2Fmain.ts)**

Explore the library's capabilities with JSONPlaceholder API integration, showcasing:
- Async operations with order preservation
- Chainable transformations
- Reactive state management
- Real-time data processing

### Browser Counter Example

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Reactive Counter</title>
  </head>
  <body>
    <div id="counter">0</div>
    <button id="increment">+</button>
    <button id="decrement">-</button>

    <script type="module">
      import { State } from "https://esm.sh/@soffinal/stream";

      const count = new State(0);
      const display = document.getElementById("counter");

      // Reactive UI updates
      count.listen((value) => (display.textContent = value));

      // User interactions
      document.getElementById("increment").onclick = () => count.value++;
      document.getElementById("decrement").onclick = () => count.value--;
    </script>
  </body>
</html>
```

## Performance

@soffinal/stream delivers exceptional performance:

- **High throughput** for basic operations
- **Efficient processing** for complex pipelines
- **Memory efficient** with automatic cleanup
- **Zero overhead** for unused features

### Performance Characteristics

- **Optimized data structures** for minimal memory allocation
- **Efficient event dispatch** with smart caching
- **Lazy evaluation** reduces unnecessary computations
- **Automatic cleanup** prevents memory leaks

## Browser Support

- **Modern browsers** supporting ES2020+
- **Node.js** 16+
- **Deno** 1.0+
- **Bun** 1.0+
- **Cloudflare Workers**

## Migration Guide

### From RxJS

```typescript
// RxJS
import { Subject, map, filter } from "rxjs";
const subject = new Subject();
subject
  .pipe(
    filter((x) => x > 0),
    map((x) => x * 2)
  )
  .subscribe(console.log);

// @soffinal/stream
import { Stream } from "@soffinal/stream";
const stream = new Stream();
stream
  .filter((x) => x > 0)
  .map((x) => x * 2)
  .listen(console.log);
```

### From EventEmitter

```typescript
// EventEmitter
import { EventEmitter } from "events";
const emitter = new EventEmitter();
emitter.on("data", console.log);
emitter.emit("data", "hello");

// @soffinal/stream
import { Stream } from "@soffinal/stream";
const stream = new Stream();
stream.listen(console.log);
stream.push("hello");
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
git clone https://github.com/soffinal/stream.git
cd stream
bun install
bun test
```

## License

MIT © [Soffinal](https://github.com/soffinal)

Contact: <smari.sofiane@gmail.com>

---

<div align="center">
  <strong>Built with ❤️ for the JavaScript community</strong>
</div>
