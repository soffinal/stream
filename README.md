# @soffinal/stream

[![npm version](https://badge.fury.io/js/@soffinal%2Fstream.svg)](https://badge.fury.io/js/@soffinal%2Fstream)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Build reusable components with type-safe events**

Stream provides primitives for building libraries and core features that expose type-safe events. Perfect for library authors and application developers building shared components.

**When to use:**
- Building npm packages
- Creating internal core features  
- Components with multiple event consumers
- Decoupled, event-driven architecture

**When not to use:**
- Simple business logic
- One-off features
- Linear CRUD operations

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

**[📖 Tutorial: Real-World Examples →](TUTORIAL.md)**

## Core Concepts

### 1. Stream - Push & Pull

```typescript
// Push: Emit values manually
const stream = new Stream<number>();
stream.listen((n) => console.log(n));
stream.push(1, 2, 3);

// Pull: Generate values from async source
const countdown = new Stream(async function* () {
  for (let i = 5; i > 0; i--) {
    yield i;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
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

## Philosophy

**You bring your own utilities:**

This library provides control flow primitives for reactive programming.

```typescript
import { memoize, debounce } from "lodash";
import { Stream, map, filter } from "@soffinal/stream";

stream
  .pipe(map(memoize(expensiveOp))) // lodash memoization
  .pipe(filter(debounce(validate, 300))) // lodash debounce
  .pipe(map(customLib.transform)); // any library
```

**2 primitives**: `Stream` + `pipe`

**11 transformers**: `state`, `gate`, `filter`, `map`, `merge`, `flat`, `zip`, `buffer`, `cache`, `branch`, `effect`

**Hot transformer rule**: `cache` is hot (starts listening immediately). Hot transformers MUST cache - computation happens once, late subscribers get cached results without re-computation.

Everything else you compose yourself. Stream provides the plumbing, you provide the logic.

**Efficient by design**: Transformers execute once per value. Multiple listeners share the same computation:

```typescript
const expensive = source.pipe(map(async (v) => await heavyComputation(v)));

expensive.listen((v) => updateUI(v));
expensive.listen((v) => logToAnalytics(v));
expensive.listen((v) => saveToCache(v));
// heavyComputation() runs ONCE per value, not 3 times
```

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
stream.pipe(map(x => x * 2))

// Concurrent - all at once, main thread, unordered
stream.pipe(map(async x => await fetch(x), { execution: 'concurrent' }))

// Concurrent-ordered - all at once, main thread, maintains order
stream.pipe(map(async x => await fetch(x), { execution: 'concurrent-ordered' }))

// Parallel - Web Workers, unordered (fastest for CPU-intensive)
stream.pipe(map(x => heavyComputation(x), { execution: 'parallel' }))

// Parallel-ordered - Web Workers, maintains order
stream.pipe(map(x => heavyComputation(x), { execution: 'parallel-ordered' }))
```

**With args (for parallel strategies):**

```typescript
stream.pipe(map((x, args) => x * args.multiplier, {
  execution: 'parallel',
  args: { multiplier: 2 }
}))
```

**Worker Pool**: Parallel strategies use a shared pool of 4 Web Workers. Functions are registered once (not serialized per event) for optimal performance.

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
stream.pipe(effect(async (v) => {
  await db.write(v);
  await sleep(100);
}));

// Stateful side effect
stream.pipe(effect({ count: 0 }, (state, v) => {
  console.log(`[${state.count}]`, v);
  return { count: state.count + 1 };
}));

// Strategy for flow control
stream.pipe(effect(async (v) => {
  await db.write(v);
}, { strategy: 'sequential' })); // Wait for each effect
```

**[📖 Full Documentation →](src/transformers/effect/effect.md)**

### branch - Parallel Branches

```typescript
const monitoring = new Stream<number>();
const analytics = new Stream<number>();

const result = source
  .pipe(filter((n) => n > 0))
  .pipe(branch(monitoring))   // Branch for monitoring
  .pipe(map((n) => n * 2))
  .pipe(branch(analytics))    // Branch for analytics
  .pipe(buffer(3));

// Independent branches
monitoring.listen(logMetrics);
analytics.listen(sendToAnalytics);
```

**[📖 Full Documentation →](src/transformers/branch/branch.md)**

### cache - HOT Caching (HOT)

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
const cached = stream.pipe(cache({ 
  maxSize: 10, 
  dropStrategy: 'oldest' // or 'newest'
}));
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

### Visual Schema

```
source → [gate] → gated → [filter] → filtered → [map] → mapped
  ↓                 ↓                   ↓                  ↓
push(1)         push(2)             push(3)           push(4)
  |                 |                   |                  |
  └─→ all          └─→ skip gate       └─→ skip 2        └─→ skip all
```

This gives you **surgical control** over which transformations apply to each value.

## Write Your Own

A transformer is just a function:

```typescript
const double = (stream: Stream<number>) =>
  new Stream(async function* () {
    for await (const n of stream) yield n * 2;
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
type Cache<T> = Stream<T> & { cache: { readonly values: T[]; readonly size: number | undefined; readonly dropStrategy: 'oldest' | 'newest'; clear(): void } };
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
