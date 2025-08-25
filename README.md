# @soffinal/stream

[![npm version](https://badge.fury.io/js/@soffinal%2Fstream.svg)](https://badge.fury.io/js/@soffinal%2Fstream)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@soffinal/stream)](https://bundlephobia.com/package/@soffinal/stream)

> **A reactive streaming library with Adaptive Constraints**

A groundbreaking streaming library that introduces **Adaptive Reactive Programming** - where transformers maintain state and evolve their behavior based on stream history. Built with four universal primitives that compose into infinite possibilities.

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
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

## Features

- 🧠 **Adaptive Constraints** - Transformers that learn and evolve based on stream history
- 🔧 **Universal Primitives** - Four algebraic primitives: `filter`, `map`, `merge`, `flat`
- 📚 **Documentation-as-Distribution** - Copy-paste transformers embedded in JSDoc, no separate packages needed
- ⚡ **Async-First** - All operations support async with order preservation
- 🔄 **Multicast Streams** - One stream, unlimited consumers
- ⏳ **Awaitable** - `await stream` for next value
- 🔁 **Async Iterable** - Native `for await` loop support
- 🛠️ **Pipe Composition** - Functional transformer composition
- 📊 **Reactive State** - Stateful values with automatic change propagation
- 📋 **Reactive Collections** - Lists, Maps, Sets with fine-grained events
- 🗑️ **Stream Termination** - Declarative stream lifecycle control
- 📦 **Zero Dependencies** - Lightweight and tree-shakeable
- 🌐 **Universal** - Node.js, browsers, Deno, Bun, Cloudflare Workers
- 📘 **Full TypeScript** - Complete type safety without the burden

## Quick Start

```typescript
import { Stream, State, filter, map, merge } from "@soffinal/stream";

// Create reactive streams
const events = new Stream<string>();
const numbers = new Stream<number>();

// Pipe-based transformation with Adaptive Constraints
const processed = events
  .pipe(simpleFilter((msg) => msg.length > 3)) // Simple filtering
  .pipe(simpleMap((msg) => msg.toUpperCase())); // Transform to uppercase

// Stateful transformers that learn and adapt
const runningAverage = numbers
  .pipe(
    filter({ count: 0 }, (state, value) => {
      // Only pass every 3rd number, terminate after 10
      if (state.count >= 10) return; // Stream termination
      return [(state.count + 1) % 3 === 0, { count: state.count + 1 }];
    })
  )
  .pipe(
    map({ sum: 0, count: 0 }, (state, value) => {
      const newSum = state.sum + value;
      const newCount = state.count + 1;
      const average = newSum / newCount;
      return [
        { value, average },
        { sum: newSum, count: newCount },
      ];
    })
  );

// Copy-paste transformers from JSDoc
const limited = numbers.pipe(take(5)); // Limit to 5 items
const indexed = events.pipe(withIndex()); // Add indices
const delayed = processed.pipe(delay(100)); // Delay each value

// Multiple consumers
processed.listen((msg) => console.log("Processed:", msg));
runningAverage.listen(({ value, average }) => console.log(`Value: ${value}, Running Average: ${average}`));

// Reactive state
const counter = new State(0);
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

### Streams: Multicast Event Pipelines

A `Stream` is a multicast, async iterable that pushes values to multiple listeners while being awaitable for the next value.

```typescript
const userEvents = new Stream<UserEvent>();

// Multiple consumers automatically share the same data
userEvents.listen((event) => analytics.track(event));
userEvents.listen((event) => notifications.send(event));
userEvents.listen((event) => database.save(event));

// Await the next event
const nextEvent = await userEvents;

// Async iteration
for await (const event of userEvents) {
  if (event.type === "critical") break;
  processEvent(event);
}
```

### Universal Primitives: The Four Algebraic Operations

All stream operations are built from four universal primitives with **Adaptive Constraints**:

#### 1. Filter - Adaptive Gatekeeper

```typescript
import { filter } from "@soffinal/stream";

// Simple filtering
stream.pipe(filter({}, (_, value) => [value > 0, {}]));

// Stateful filtering with termination
stream.pipe(
  filter({ count: 0 }, (state, value) => {
    if (state.count >= 10) return; // Terminate after 10 items
    return [value > 0, { count: state.count + 1 }];
  })
);

// Async filtering
stream.pipe(
  filter({}, async (_, value) => {
    const isValid = await validateAsync(value);
    return [isValid, {}];
  })
);
```

**[📖 Complete Filter Documentation →](src/transformers/filter.md)**

#### 2. Map - Adaptive Transformer

```typescript
import { map } from "@soffinal/stream";

// Simple transformation
stream.pipe(map({}, (_, value) => [value * 2, {}]));

// Stateful transformation with context
stream.pipe(
  map({ sum: 0 }, (state, value) => {
    const newSum = state.sum + value;
    return [{ value, runningSum: newSum }, { sum: newSum }];
  })
);

// Async transformation with order preservation
stream.pipe(
  map({}, async (_, value) => {
    const enriched = await enrichWithAPI(value);
    return [{ original: value, enriched }, {}];
  })
);
```

**[📖 Complete Map Documentation →](src/transformers/map.md)**

#### 3. Merge - Stream Orchestration

```typescript
import { merge } from "@soffinal/stream";

const stream1 = new Stream<number>();
const stream2 = new Stream<string>();

// Combine multiple streams with type safety
const combined = stream1.pipe(merge(stream2));
// Type: Stream<number | string>

combined.listen((value) => {
  if (typeof value === "number") {
    console.log("Number:", value);
  } else {
    console.log("String:", value);
  }
});
```

**[📖 Complete Merge Documentation →](src/transformers/merge.md)**

#### 4. Flat - Event Multiplication

```typescript
import { flat } from "@soffinal/stream";

// Transform 1 array event → N individual events
const arrayStream = new Stream<number[]>();
const individualNumbers = arrayStream.pipe(flat());

arrayStream.push([1, 2, 3]); // Emits: 1, 2, 3 as separate events

// Configurable depth flattening
const deepArrays = new Stream<number[][][]>();
const flattened = deepArrays.pipe(flat(2)); // Flatten 2 levels deep
```

**[📖 Complete Flat Documentation →](src/transformers/flat.md)**

### Documentation-as-Distribution: Revolutionary Copy-Paste Transformers

**🚀 World's First Documentation-as-Distribution System**

No separate repos, no CLI tools, no package management - just copy-paste ready transformers embedded in JSDoc!

```typescript
// 📦 All transformers are copy-pastable from IntelliSense!
// Just hover over any primitive in your IDE to see the transformer library

// Example: Essential transformers available via autocomplete
const searchInput = new Stream<string>();
const searchResults = searchInput
  .pipe(distinct()) // Copy from filter() JSDoc
  .pipe(simpleFilter((q) => q.length > 2)) // Copy from filter() JSDoc
  .pipe(take(10)) // Copy from filter() JSDoc
  .pipe(delay(300)) // Copy from map() JSDoc
  .pipe(simpleMap((query) => searchAPI(query))); // Copy from map() JSDoc
```

**Benefits:**

- ✅ **Zero friction** - Copy-paste ready transformers
- ✅ **Perfect discoverability** - IntelliSense shows all available transformers
- ✅ **Always up-to-date** - Examples match current API version
- ✅ **No ecosystem fragmentation** - Everything in one place
- ✅ **Self-documenting** - Usage examples included

**How it works:**

1. Hover over `filter()`, `map()`, `merge()`, or `flat()` in your IDE
2. Browse the 📦 COPY-PASTE TRANSFORMER examples
3. Copy the transformer you need
4. Use immediately - perfect TypeScript inference included!

**Available Transformers (via JSDoc):**

- `take(n)`, `skip(n)`, `distinct()` - Essential filtering
- `withIndex()`, `delay(ms)`, `pluck(key)` - Common transformations
- `simpleFilter(predicate)` - Convenient filtering without state
- `simpleMap(fn)` - Convenient mapping without state
- More transformers added with each release!

**📊 Bundle Size Impact:**

- **Package size**: Currently ~15KB, grows with JSDoc transformer examples over time
- **Your app bundle**: Always only 5.5KB (runtime code only, zero JSDoc overhead)
- **Tree-shaking**: Only imported functions included in final bundle
- **JSDoc transformers**: "Free" - rich transformer library without production cost

### Manual Composition

```typescript
// You can still build transformers manually
const customTransformer = <T>(count: number) =>
  filter<T, { taken: number }>({ taken: 0 }, (state, value) => {
    if (state.taken >= count) return; // Terminate after N items
    return [true, { taken: state.taken + 1 }];
  });
```

### Reactive State: Stateful Values

`State` extends `Stream` with a current value that can be read and written:

```typescript
const user = new State<User | null>(null);
const theme = new State<"light" | "dark">("light");
const counter = new State(0);

// Read current value
console.log(counter.value); // 0

// Write triggers all listeners
counter.value = 5;

// Derived state using transformers
const isLoggedIn = user.pipe(map({}, (_, u) => [u !== null, {}]));

const userDisplayName = user.pipe(
  filter({}, (_, u) => [u !== null, {}]),
  map({}, (_, u) => [`${u.firstName} ${u.lastName}`, {}])
);

// Automatic UI updates
isLoggedIn.listen((loggedIn) => {
  document.body.classList.toggle("authenticated", loggedIn);
});

// State changes propagate through the pipeline
user.value = { firstName: "John", lastName: "Doe" };
// Triggers: isLoggedIn → true, userDisplayName → 'John Doe'
```

### Reactive Collections: Fine-Grained Change Events

Collections that emit specific change events for efficient UI updates:

```typescript
import { List, Map, Set } from "@soffinal/stream";

const todos = new List<Todo>();
const userCache = new Map<string, User>();
const activeUsers = new Set<string>();

// React to specific operations
todos.insert.listen(([index, todo]) => {
  console.log(`Todo inserted at ${index}:`, todo);
  renderTodoAtIndex(index, todo);
});

todos.delete.listen(([index, todo]) => {
  console.log(`Todo removed from ${index}:`, todo);
  removeTodoFromDOM(index);
});

// Map changes
userCache.set.listen(([key, user]) => {
  console.log(`User cached: ${key}`, user);
  updateUserInUI(key, user);
});

// Set changes
activeUsers.add.listen((userId) => {
  console.log(`User ${userId} came online`);
  showOnlineIndicator(userId);
});

activeUsers.delete.listen((userId) => {
  console.log(`User ${userId} went offline`);
  hideOnlineIndicator(userId);
});

// Use like normal collections
todos.push({ id: 1, text: "Learn streams", done: false });
userCache.set("user1", { name: "Alice", email: "alice@example.com" });
activeUsers.add("user1");
```

## API Reference

### Stream\<T>

#### Core Methods

- `push(...values: T[]): void` - Emit values to all listeners
- `listen(callback: (value: T) => void, signal?: AbortSignal | Stream<any>): () => void` - Add listener, returns cleanup
- `pipe<U>(transformer: (stream: Stream<T>) => Stream<U>): Stream<U>` - Apply functional transformer

#### Async Interface

- `then<U>(callback?: (value: T) => U): Promise<U>` - Promise interface for next value
- `[Symbol.asyncIterator](): AsyncIterator<T>` - Async iteration support

#### Properties

- `hasListeners: boolean` - Whether stream has active listeners
- `listenerAdded: Stream<void>` - Emits when listener is added
- `listenerRemoved: Stream<void>` - Emits when listener is removed

### State\<T> extends Stream\<T>

#### Additional Properties

- `value: T` - Current state value (get/set)

### Universal Transformers

#### filter(initialState, accumulator)

- **Simple**: `filter({}, (_, value) => [boolean, {}])`
- **Stateful**: `filter(state, (state, value) => [boolean, newState])`
- **Async**: `filter({}, async (_, value) => [boolean, {}])`
- **Termination**: Return `undefined` to terminate stream

#### map(initialState, accumulator)

- **Simple**: `map({}, (_, value) => [newValue, {}])`
- **Stateful**: `map(state, (state, value) => [newValue, newState])`
- **Async**: `map({}, async (_, value) => [newValue, {}])`

#### merge(...streams)

- **Basic**: `stream.pipe(merge(stream2, stream3))`
- **Type-Safe**: Automatically creates union types
- **Temporal Order**: Maintains chronological sequence

#### flat(depth?)

- **Basic**: `stream.pipe(flat())` - Flatten one level
- **Deep**: `stream.pipe(flat(2))` - Flatten N levels
- **Event Multiplication**: 1 array event → N individual events

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

## Performance

### Bundle Size

- **Runtime bundle** - 5.5KB minified, 1.6KB gzipped
- **Package size** - Starts small, grows with JSDoc transformer library
- **Your production app** - Always gets only the 5.5KB runtime code
- **Tree-shakeable** - Import only what you use

### Benchmarks

- **Fast startup** - Zero dependencies, instant initialization
- **Efficient pipelines** - Optimized transformer composition
- **Memory bounded** - Built-in backpressure handling

## Runtime Support

- **Modern browsers** supporting ES2020+
- **Node.js** 16+
- **Deno** 1.0+
- **Bun** 1.0+
- **Cloudflare Workers**

## Migration Guide

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

## Documentation

### Transformer Guides

- **[Filter Transformer →](src/transformers/filter.md)** - Adaptive constraints and stream termination
- **[Map Transformer →](src/transformers/map.md)** - Stateful transformations and async processing
- **[Merge Transformer →](src/transformers/merge.md)** - Stream orchestration and type-safe combination
- **[Flat Transformer →](src/transformers/flat.md)** - Event multiplication and array flattening

### Philosophy

**Adaptive Reactive Programming** - A new paradigm where transformers maintain state and evolve their behavior based on stream history. This enables:

- **Learning transformers** that adapt to data patterns
- **Stateful operations** with memory between events
- **Stream termination** for lifecycle control
- **Zero-overhead types** with perfect inference

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
  <strong>Pioneering Adaptive Reactive Programming</strong>
</div>
