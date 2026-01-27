# @soffinal/stream

[![npm version](https://badge.fury.io/js/@soffinal%2Fstream.svg)](https://badge.fury.io/js/@soffinal%2Fstream)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Multi-paradigm reactive primitives for modern applications**

Stream provides composable primitives that unify multiple programming paradigms - functional reactive, event-driven, dataflow, data-driven, and object-oriented - with native support for parallel (Web Workers) and distributed (network) execution.

**What makes it unique:**

- **Multi-paradigm**: Combine FRP, event-driven, dataflow, data-driven, and OOP in one pipeline
- **Execution agnostic**: Same code runs locally, in workers, or across network
- **Minimal core**: 1 primitive (Stream), infinite patterns
- **Type-safe**: Full TypeScript inference across entire pipeline
- **Composable**: Build complex from simple, no framework lock-in

**When to use:**

- Building npm packages with type-safe events
- Event-driven architectures (local or distributed)
- CPU-intensive operations (parallel execution)
- Real-time data pipelines
- Multi-tenant systems with dynamic behavior

**When not to use:**

- Simple CRUD operations
- One-off scripts
- Static business logic

## Quick Start

```typescript
import { Stream } from "@soffinal/stream";

const events = new Stream<string>();

events.listen((value) => console.log(value));
events.push("Hello", "World");
// Output: Hello, World
```

## Installation

```bash
npm install @soffinal/stream
```

## Philosophy

Stream explores a new approach to reactive programming: **multi-paradigm composition with execution-agnostic primitives**. Rather than replacing existing tools, it offers an alternative mental model for building event-driven systems.

**Design principles:**

- **Minimal primitive**: 1 core concept (Stream), not a framework
- **Composability over features**: Build complex from simple, no batteries included
- **Paradigm agnostic**: Support multiple mental models, don't force one
- **Execution agnostic**: Same code, different contexts (local, parallel, distributed)
- **Type safety**: Let TypeScript enforce contracts, fail at compile time
- **User responsibility**: Explicit over implicit, no magic

> "The primitive is powerful enough to implement itself."

**What we don't do:**

- Replace existing tools - we offer an alternative approach
- Provide every possible operator (compose your own)
- Hide complexity (you see the data flow)
- Make decisions for you (you choose paradigms, execution, patterns)

**What we explore:**

- Can multiple paradigms coexist in one system?
- Can execution context be independent of programming model?
- Can dynamic configuration enable new patterns?
- Can one minimal primitive be more powerful than feature-rich frameworks?

**This library demonstrates principles for reactive system design.** The concepts are language-agnostic - understanding the principles enables implementation in any language. If these patterns prove valuable in real-world usage, we'll expand implementations to other languages (Python, Go, Rust, etc.).

The patterns and insights discovered here may prove more valuable than the implementation itself. This is a **research artifact** as much as a production tool.

## Core Concepts

### 1. Stream - Push & Pull

```typescript
// Push: Emit values manually
const stream = new Stream<number>();
stream.listen((n) => console.log(n));
stream.push(1, 2, 3);

// Pull: Generate values from async source
// Generator executes lazily when first listener is added
// Automatically stops when all listeners are removed
const countdown = new Stream(async function* () {
  console.log("Started"); // Only logs when first listener added
  for (let i = 5; i > 0; i--) {
    yield i;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  console.log("Stopped"); // Logs when done or all listeners removed
});

// Both: Push to a pull-based stream
const messages = new Stream(async function* () {
  const ws = new WebSocket("ws://localhost");
  while (ws.readyState === WebSocket.OPEN) {
    yield await new Promise((resolve) => {
      ws.onmessage = (e) => resolve(e.data);
    });
  }
});

messages.push("manual event"); // Can still push!
```

### 2. Automatic Cleanup

```typescript
// Disposable pattern
using stream.listen(handler);

// Manual cleanup
const cleanup = stream.listen(handler);
cleanup();

// AbortSignal
stream.listen(handler, controller.signal);

// Stream as signal
const stop = new Stream<void>();
stream.listen(handler, stop);
stop.push(); // Remove listener
```

### 3. Transform with pipe

```typescript
const numbers = new Stream<number>();

const doubled = numbers.pipe(filter((n) => n > 0)).pipe(map((n) => n * 2));

doubled.listen((n) => console.log(n));
numbers.push(-1, 2, 3);
// Output: 4, 6
```

### 4. Async Iteration

```typescript
for await (const value of stream) {
  console.log(value);
  if (done) break;
}
```

### 5. Extend Stream (OOP)

```typescript
class MetricsStream extends Stream<Metric> {
  private count = 0;

  emit(metric: Metric) {
    this.count++;
    this.push({ ...metric, id: this.count });
  }

  getCount() {
    return this.count;
  }
}

const metrics = new MetricsStream();
metrics.listen((m) => console.log(m));
metrics.emit({ value: 100 }); // { value: 100, id: 1 }
```

## All Values Are Valid

**Stream treats `undefined` and `null` as valid data** :

```typescript
const stream = new Stream<string | undefined | null>();

stream.listen((value) => console.log("Received:", value));

stream.push(undefined); // ✅ Emits undefined
stream.push(null); // ✅ Emits null
stream.push("hello"); // ✅ Emits 'hello'
stream.push(0); // ✅ Emits 0
stream.push(false); // ✅ Emits false
stream.push(""); // ✅ Emits empty string
```

**Why this matters:**

```typescript
// API responses with optional fields
const user = new Stream<User | undefined>();
user.push(undefined); // "User not found" is valid data

// Nullable database fields
const age = new Stream<number | null>();
age.push(null); // "Age unknown" is valid data

// Clearing state
const selected = new Stream<Item | null>();
selected.push(null); // "Deselect" is a valid action

// Optional configuration
const config = new Stream<Config | undefined>();
config.push(undefined); // "Use defaults" is a valid signal
```

**Implementation detail**: Stream never checks `if (value)` - it treats all values equally. Values are opaque data, never control flow signals.

## Universal AsyncIterable Adapter

Stream implements `AsyncIterable<T>`, making it a **universal adapter** for any async data source in JavaScript:

```typescript
// WebSocket → Stream
const ws = new WebSocket("ws://localhost");
const wsStream = new Stream(async function* () {
  while (ws.readyState === WebSocket.OPEN) {
    yield await new Promise((r) => (ws.onmessage = (e) => r(e.data)));
  }
});

// Server-Sent Events → Stream
const sse = new EventSource("/events");
const sseStream = new Stream(async function* () {
  while (true) {
    yield await new Promise((r) => (sse.onmessage = (e) => r(e.data)));
  }
});

// ReadableStream → Stream
const response = await fetch("/api/data");
const fetchStream = new Stream(async function* () {
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield value;
  }
});

// Merge ANY AsyncIterable
const unified = wsStream
  .pipe(merge(sseStream))
  .pipe(merge(fetchStream))
  .pipe(filter((x) => x.length > 0))
  .pipe(map((x) => JSON.parse(x)));

unified.listen((data) => console.log(data));
```

**Works with:**

- WebSocket, EventSource, WebRTC
- fetch() ReadableStream
- Node.js Readable streams
- Async generators
- Any object with `[Symbol.asyncIterator]()`

## Transformers

### state - Reactive State

```typescript
const counter = new Stream<number>().pipe(state(0));

counter.listen((n) => console.log(n));
counter.state.value = 5; // Triggers listener
console.log(counter.state.value); // 5
```

**[📖 Full Documentation →](src/transformers/state/state.md)**

### gate - Flow Control

```typescript
const stream = new Stream<number>().pipe(gate());

stream.listen((n) => console.log(n));
stream.push(1); // Logs: 1
stream.gate.close();
stream.push(2); // Blocked
stream.gate.open();
stream.push(3); // Logs: 3
```

**[📖 Full Documentation →](src/transformers/gate/gate.md)**

### filter - Remove Values

```typescript
// Simple
stream.pipe(filter((n) => n > 0));

// Async
stream.pipe(filter(async (n) => await validate(n)));

// Stateful
stream.pipe(
  filter({ count: 0 }, (state, n) => {
    if (state.count >= 10) return; // Stop after 10
    return [n > 0, { count: state.count + 1 }];
  }),
);
```

**[📖 Full Documentation →](src/transformers/filter/filter.md)**

### map - Transform Values

```typescript
// Simple
stream.pipe(map((n) => n * 2));

// Async
stream.pipe(map(async (n) => await process(n)));

// Stateful
stream.pipe(
  map({ sum: 0 }, (state, n) => {
    const newSum = state.sum + n;
    return [newSum, { sum: newSum }];
  }),
);
```

**[📖 Full Documentation →](src/transformers/map/map.md)**

## Execution Strategies

All transformers (`map`, `filter`, `effect`) support multiple execution strategies:

```typescript
// Sequential (default) - one at a time, main thread
stream.pipe(map((x) => x * 2));

// Concurrent - all at once, main thread, unordered
stream.pipe(map(async (x) => await fetch(x), { execution: "concurrent" }));

// Concurrent-ordered - all execute concurrently, emit in order
// Events don't wait - all computations start immediately
// Results are buffered if necessary and emitted in original order
// When computations have equal or incremental execution time, performance equals concurrent
stream.pipe(map(async (x) => await fetch(x), { execution: "concurrent-ordered" }));

// Parallel - Web Workers, unordered (fastest for CPU-intensive)
stream.pipe(map((x) => heavyComputation(x), { execution: "parallel" }));

// Parallel-ordered - all execute in parallel, emit in order
// Events don't wait - all computations start immediately in workers
// Results are buffered if necessary and emitted in original order
// When computations have equal or incremental execution time, performance equals parallel
stream.pipe(map((x) => heavyComputation(x), { execution: "parallel-ordered" }));
```

**Performance insight**: Ordered strategies (`concurrent-ordered`, `parallel-ordered`) only buffer when newer events finish before older ones. When execution times are equal or incremental (each takes same or slightly more time), results naturally arrive in order with zero buffering overhead - matching unordered performance.

**With args (for parallel strategies):**

```typescript
stream.pipe(
  map((x, args) => x * args.multiplier, {
    execution: "parallel",
    args: { multiplier: 2 },
  }),
);
```

**Worker Pool**: Parallel strategies use a shared pool of Web Workers. Functions are registered once (not serialized per event) for optimal performance.

**Configuration**: Customize worker pool size based on your hardware:

```typescript
// Configure before using parallel execution
Stream.configure({ workerPoolSize: 8 }); // Default: 4

// Now parallel execution uses 8 workers
stream.pipe(map((x) => heavyComputation(x), { execution: "parallel" }));
```

### merge - Combine Streams

```typescript
const numbers = new Stream<number>();
const strings = new Stream<string>();

const combined = numbers.pipe(merge(strings));
// Type: Stream<number | string>
```

**[📖 Full Documentation →](src/transformers/merge/merge.md)**

### flat - Flatten Arrays

```typescript
const arrays = new Stream<number[]>();
const numbers = arrays.pipe(flat());

arrays.push([1, 2, 3]); // Emits: 1, 2, 3
```

**[📖 Full Documentation →](src/transformers/flat/flat.md)**

### zip - Combine Pairwise

```typescript
const numbers = new Stream<number>();
const strings = new Stream<string>();

const zipped = numbers.pipe(zip(strings));
// Type: Stream<[number, string]>

numbers.push(1, 2, 3);
strings.push("a", "b", "c");
// Emits: [1, "a"], [2, "b"], [3, "c"]
```

**[📖 Full Documentation →](src/transformers/zip/zip.md)**

### buffer - Collect Values

```typescript
const stream = new Stream<number>();
const buffered = stream.pipe(buffer(3));

buffered.listen((arr) => console.log(arr));
stream.push(1, 2, 3, 4, 5, 6);
// Output: [1, 2, 3], [4, 5, 6]
```

**[📖 Full Documentation →](src/transformers/buffer/buffer.md)**

### effect - Side Effects

```typescript
// Simple
stream.pipe(effect((v) => console.log(v)));

// Async
stream.pipe(
  effect(async (v) => {
    await db.write(v);
    await sleep(100);
  }),
);

// Stateful side effect
stream.pipe(
  effect({ count: 0 }, (state, v) => {
    console.log(`[${state.count}]`, v);
    return { count: state.count + 1 };
  }),
);

// Strategy for flow control
stream.pipe(
  effect(
    async (v) => {
      await db.write(v);
    },
    { strategy: "sequential" },
  ),
); // Wait for each effect
```

**[📖 Full Documentation →](src/transformers/effect/effect.md)**

### branch - Parallel Branches

```typescript
const monitoring = new Stream<number>();
const analytics = new Stream<number>();

const result = source
  .pipe(filter((n) => n > 0))
  .pipe(branch(monitoring)) // Branch for monitoring
  .pipe(map((n) => n * 2))
  .pipe(branch(analytics)) // Branch for analytics
  .pipe(buffer(3));

// Independent branches
monitoring.listen(logMetrics);
analytics.listen(sendToAnalytics);
```

**[📖 Full Documentation →](src/transformers/branch/branch.md)**

### cache (HOT)

```typescript
// Inspect stream history
const events = stream.pipe(cache({ maxSize: 100 }));
console.log(events.cache.values); // Access cached values

// Metrics & monitoring
const requests = stream.pipe(cache({ maxSize: 1000 }));
setInterval(() => {
  console.log(`Recent requests: ${requests.cache.values.length}`);
}, 5000);

// Drop strategy
const cached = stream.pipe(
  cache({
    maxSize: 10,
    dropStrategy: "oldest", // or 'newest'
  }),
);
```

**[📖 Full Documentation →](src/transformers/cache/cache.md)**

## Stream Chain Contract

Each stream in a pipeline is both a **transformer output** and an **injection point**:

```typescript
const source = new Stream<number>();
const gated = source.pipe(gate());
const filtered = gated.pipe(filter((x) => x > 0));
const mapped = filtered.pipe(map((x) => x * 2));

// CONFORM: Push to source, flows through all transformers
source.push(5);
// → gate checks isOpen
// → filter checks x > 0
// → map applies x * 2
// → listeners receive 10

// BYPASS: Inject at any point to skip upstream transformers
gated.push(5); // Skips gate, goes through filter → map
filtered.push(5); // Skips gate + filter, goes through map
mapped.push(5); // Skips everything, direct to listeners
```

### The Bypass Pattern

Direct `.push()` bypasses the stream's own transformer:

```typescript
const filtered = source.pipe(filter((n) => n > 0));

filtered.listen(console.log);

source.push(-1, 1); // Logs: 1 (filtered)
filtered.push(-999); // Logs: -999 (bypasses filter!)
```

**Use cases**: Emergency notifications, pre-computed values, critical system messages.

This gives you **surgical control** over which transformations apply to each value.

## Write Your Own

A transformer is just a function:

```typescript
const double = (stream: Stream<number>) =>
  new Stream(async function* () {
    try {
      for await (const n of stream) yield n * 2;
    } finally {
      return;
    }
  });

stream.pipe(double);
```

### Common Patterns

Build complex transformers from primitives:

```typescript
// Take first N values
const take = <T>(n: number) =>
  filter<T, { count: number }>({ count: 0 }, (state, value) => {
    if (state.count >= n) return;
    return [true, { count: state.count + 1 }];
  });

// Accumulate values (running sum, etc.)
const scan = <T, U>(fn: (acc: U, value: T) => U, initial: U) =>
  map<T, { acc: U }, U>({ acc: initial }, (state, value) => {
    const newAcc = fn(state.acc, value);
    return [newAcc, { acc: newAcc }];
  });

// Rate limit emissions
const throttle = <T>(ms: number) =>
  filter<T, { lastEmit: number }>({ lastEmit: 0 }, (state, value) => {
    const now = Date.now();
    if (now - state.lastEmit < ms) return [false, state];
    return [true, { lastEmit: now }];
  });
```

**[📖 See all patterns →](patterns/README.md)**

## Self-Referential Pattern

Streams can use themselves as building blocks - a profound meta-pattern that eliminates coordination complexity:

```typescript
// Concurrent-ordered execution (from map transformer)
const concurrentOrdered = <T, U>(mapper: (value: T) => Promise<U>) => {
  return (source: Stream<T>) => {
    return new Stream<U>(async function* () {
      const output = new Stream<Promise<U>>(); // Stream creates Stream

      const abort = source.listen((value) => {
        output.push(mapper(value)); // Push promises immediately
      });

      try {
        for await (const mapped of output) {
          yield await mapped; // Await in order
        }
      } finally {
        abort(); // Automatic cleanup
      }
    });
  };
};
```

**Why this is genius:**

- **Eliminates coordination**: No manual tracking of pending promises, resolve functions, or state
- **Maintains order**: Async iteration naturally awaits promises sequentially
- **Automatic cleanup**: Generator lifecycle manages listener lifecycle
- **Minimal**: 11 lines vs 20+ with manual coordination
- **Self-documenting**: Code reads exactly like what it does

**Compare to manual approach:**

```typescript
// Manual coordination (20+ lines)
const pendings: Promise<U>[] = [];
let resolve: Function | undefined;
source.listen((value) => {
  pendings.push(mapper(value));
  resolve?.();
});
while (true) {
  if (pendings.length) yield await pendings.shift()!;
  else await new Promise((r) => (resolve = r));
}

// Self-referential pattern (11 lines)
const output = new Stream<Promise<U>>();
source.listen((value) => output.push(mapper(value)));
for await (const mapped of output) yield await mapped;
```

**When to use this pattern:**

- Event-driven logic (can't yield from callbacks)
- Need guaranteed cleanup (timers, listeners, resources)
- Async coordination (debounce, throttle, ordered execution)
- Eliminate manual state tracking

The primitive is powerful enough to implement itself. This is the elegance of minimal abstractions.

## Dynamic Configuration Pattern

Transformers can accept configuration either as **static arguments** or **dynamic event properties**. This enables runtime reconfiguration and self-describing events.

### Static Configuration (Default)

```typescript
// Config set at pipeline construction
stream
  .pipe(filter((x) => x > 5))
  .pipe(map((x) => x * 2))
  .pipe(buffer(10));
```

### Dynamic Configuration (Event-Driven)

```typescript
// Config carried by events
stream
  .pipe(map((x) => ({ value: x, predicate: (v) => v > 5 })))
  .pipe(filter) // No args = reads event.predicate
  .pipe(map((x) => ({ value: x.value, mapper: (v) => v * 2 })))
  .pipe(map); // No args = reads event.mapper
```

### The Convention

**Transformer with arguments** = Static configuration

```typescript
filter(predicate); // Static: predicate set at construction
map(mapper); // Static: mapper set at construction
buffer(size); // Static: size set at construction
```

**Transformer without arguments** = Dynamic configuration (reads from event)

```typescript
filter; // Dynamic: reads event.predicate
map; // Dynamic: reads event.mapper
buffer; // Dynamic: reads event.size
```

### Single Map Configures Pipeline

One map can configure multiple downstream transformers:

```typescript
stream
  .pipe(
    map((event) => ({
      value: event.data,
      predicate: (v) => v > event.threshold,
      mapper: (v) => v * event.multiplier,
      size: event.urgent ? 1 : 50,
    })),
  )
  .pipe(filter) // Uses event.predicate
  .pipe(map) // Uses event.mapper
  .pipe(buffer); // Uses event.size
```

### Type Safety

TypeScript enforces the entire pipeline contract at compile time:

```typescript
// ✅ Valid - all required properties present
stream
  .pipe(map(x => ({ value: x, predicate: (v) => v > 0 })))
  .pipe(filter)  // Compiles

// ❌ Error at filter - missing predicate
stream
  .pipe(map(x => ({ value: x })))
  .pipe(filter)  // Type error: missing 'predicate' property

// ❌ Error at map - config lost after buffer
stream
  .pipe(map(x => ({ value: x, predicate: ..., mapper: ... })))
  .pipe(filter)
  .pipe(buffer)  // Returns T[] - config lost
  .pipe(map)     // Type error: T[] doesn't have 'mapper'
```

### Pipeline Boundaries

Transformers that change structure create natural boundaries:

```typescript
// buffer creates boundary - must reshape after
stream
  .pipe(map(x => ({ value: x, predicate: ..., size: 10 })))
  .pipe(filter)
  .pipe(buffer)   // T[] - config lost
  .pipe(map(arr => ({ value: arr, mapper: ... })))  // Reshape
  .pipe(map)      // ✅ Works
```

**Boundary transformers:**

- `buffer` → arrays
- `flat` → unwraps arrays
- `zip` → tuples
- `merge` → union types

**User responsibility**: Reshape after boundary transformers to continue dynamic configuration.

### Real-World Examples

**Adaptive rate limiting:**

```typescript
requests
  .pipe(
    map((req) => ({
      value: req,
      bufferSize: req.user.tier === "premium" ? 1 : 100,
    })),
  )
  .pipe(buffer()); // Premium: instant, free: batched
```

**Dynamic routing:**

```typescript
events
  .pipe(
    map((e) => ({
      value: e,
      predicate: (v) => v.destination === currentNode,
    })),
  )
  .pipe(filter()); // Route based on event metadata
```

**Per-event execution strategy:**

```typescript
tasks
  .pipe(
    map((task) => ({
      value: task,
      execution: task.priority === "urgent" ? "sequential" : "parallel",
    })),
  )
  .pipe(map()); // Urgent: immediate, normal: workers
```

**Multi-tenant processing:**

```typescript
requests
  .pipe(
    map((req) => ({
      value: req,
      validation: tenants[req.tenantId].schema,
      rateLimit: tenants[req.tenantId].limit,
    })),
  )
  .pipe(validate()) // Per-tenant schemas
  .pipe(throttle()); // Per-tenant limits
```

### Why This Matters

**Events become instructions** - they carry both data and processing metadata. This enables:

- **Runtime reconfiguration**: Change behavior without rebuilding pipeline
- **Self-describing data**: Events carry their own processing rules
- **Adaptive systems**: Behavior changes based on event characteristics
- **Multi-tenant**: Different processing per tenant/user/context
- **A/B testing**: Different algorithms per experiment group

This pattern transforms streams into **programmable execution engines** where events control how they're processed.

## Forwarding Pattern

When you need to forward all values from one stream to another:

```typescript
// Verbose
source.listen((value) => target.push(value));

// Concise - bind push method
source.listen(target.push.bind(target));
```

**Why `.bind()`?** The `push` method is on the prototype (shared across all Stream instances for memory efficiency). Binding ensures `this` refers to the target stream.

**Common use case - connecting components:**

```typescript
class RPCClient {
  private requests = new Stream<Request>();

  constructor(private transport: Transport) {
    // Forward requests to transport
    this.requests.listen(transport.outgoing.push.bind(transport.outgoing));
  }
}
```

## API Reference

### Stream\<T>

#### Constructor

```typescript
new Stream<T>()
new Stream<T>(generatorFn: () => AsyncGenerator<T>)
new Stream<T>(sourceStream: Stream<T>)
```

Creates a new stream. Optionally accepts an async generator function or another stream as source.

**Lazy execution**: Generator functions execute only when the first listener is added.

**Automatic cleanup**: Generator stops and cleans up when all listeners are removed.

#### Methods

**`push(...values: T[]): void`**

Emits one or more values to all listeners. Automatically cleans up garbage-collected contexts.

```typescript
stream.push(1, 2, 3);
```

**`listen(callback: (value: T) => void, context?: AbortSignal | Stream<any> | object): Abort`**

Adds a listener with optional automatic cleanup. Returns cleanup function.

```typescript
// Manual cleanup
const cleanup = stream.listen((v) => console.log(v));
cleanup();

// AbortSignal
stream.listen((v) => console.log(v), controller.signal);

// Stream as signal
stream.listen((v) => console.log(v), stopSignal);

// WeakRef context (auto-cleanup on GC)
stream.listen((v) => (element.textContent = v), element);
```

**`pipe<OUTPUT extends Stream<any>>(transformer: Stream.Transformer<typeof this, OUTPUT>): OUTPUT`**

Applies a transformer function. Enables functional composition.

```typescript
stream.pipe(filter((x) => x > 0)).pipe(map((x) => x * 2));
```

**`clear(): void`**

Removes all listeners from the stream.

```typescript
stream.clear();
```

**`then(onfulfilled?: (value: T) => T | PromiseLike<T>): Promise<T>`**

Promise-like interface. Resolves with the next value.

```typescript
const firstValue = await stream;
```

**`withContext(context: object): AsyncGenerator<T>`**

Creates async iterator bound to context lifetime. Stops when context is GC'd.

```typescript
for await (const value of stream.withContext(element)) {
  element.textContent = value;
}
```

**`[Symbol.asyncIterator](): AsyncGenerator<T>`**

Async iteration support.

```typescript
for await (const value of stream) {
  console.log(value);
  if (done) break;
}
```

**`[Symbol.dispose](): void`**

Disposable pattern support. Calls `clear()`.

```typescript
using listener = stream.listen(handler);
```

#### Properties

**`hasListeners: boolean`** (readonly)

Returns true if stream has active listeners.

**`listenerAdded: Stream<void>`** (readonly)

Stream that emits when a listener is added.

**`listenerRemoved: Stream<void>`** (readonly)

Stream that emits when a listener is removed.

### Transformers

All transformers return a function that takes a `Stream<T>` and returns a transformed stream.

**`state<T>(initialValue: T): (stream: Stream<T>) => State<T>`**

Adds `.state.value` getter/setter for reactive state management.

**`gate<T>(): (stream: Stream<T>) => Gate<T>`**

Adds `.gate.open()`, `.gate.close()`, `.gate.isOpen` for flow control.

**`filter<T>(predicate: (value: T) => boolean | void | Promise<boolean | void>, options?: { strategy: "sequential" | "concurrent-unordered" | "concurrent-ordered" }): (stream: Stream<T>) => Stream<T>`**

Filters values based on predicate. Supports async and stateful filtering.

**`map<T, U>(mapper: (value: T) => U | Promise<U>, options?: { strategy: "sequential" | "concurrent-unordered" | "concurrent-ordered" }): (stream: Stream<T>) => Stream<U>`**

Transforms values. Supports async and stateful mapping.

**`merge<T, U>(...streams: Stream<U>[]): (stream: Stream<T>) => Stream<T | U>`**

Combines multiple streams into one unified flow.

**`flat<T>(depth?: number): (stream: Stream<T>) => Stream<FlatArray<T, depth>>`**

Flattens arrays into individual values.

**`zip<T, U>(...streams: Stream<U>[]): (stream: Stream<T>) => Stream<[T, ...U[]]>`**

Combines streams pairwise into tuples.

**`buffer<T>(size: number): (stream: Stream<T>) => Stream<T[]>`**

Collects values into arrays of specified size.

**`effect<T>(callback: (value: T) => void | Promise<void>, options?: { strategy: "sequential" | "concurrent-unordered" | "concurrent-ordered" }): (stream: Stream<T>) => Stream<T>`**

Execute side effects without transforming values. Supports stateful effects and strategy options for flow control.

**`branch<T>(target: Stream<T>): (stream: Stream<T>) => Stream<T>`**

Creates a parallel branch by forwarding values to target stream.

**`cache<T>(options?: CacheOptions<T>): (stream: Stream<T>) => Cache<T>`**

HOT transformer. Caches events in memory with configurable size and drop strategy.

### Types

```typescript
type Abort = (() => void) & Disposable;
type Transformer<T, U> = (stream: Stream<T>) => Stream<U>;
type State<T> = Stream<T> & { state: { value: T } };
type Gate<T> = Stream<T> & { gate: { open(): void; close(): void; readonly isOpen: boolean } };
type Cache<T> = Stream<T> & {
  cache: {
    readonly values: T[];
    readonly size: number | undefined;
    readonly dropStrategy: "oldest" | "newest";
    clear(): void;
  };
};
```

## Performance

- 1.6KB gzipped
- Zero dependencies
- Automatic memory management
- Tree-shakeable

## Browser Support

Chrome 84+, Firefox 79+, Safari 14.1+, Node.js 16+, Deno, Bun

## Ecosystem

**@soffinal/stream** provides the core primitives. Future packages will provide higher-level abstractions:

- `@soffinal/stream-kit` - High-level language for stream patterns (graph, correlation, etc.)
- Works with any framework: React, Vue, Svelte, Node, Deno, Bun
- Compiles down to stream primitives

The core library is stable and production-ready. Stream-kit will provide a more expressive language for complex patterns while remaining framework-agnostic.

## License

MIT © [Soffinal](https://github.com/soffinal)
