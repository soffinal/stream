# @soffinal/stream

[![npm version](https://badge.fury.io/js/@soffinal%2Fstream.svg)](https://badge.fury.io/js/@soffinal%2Fstream)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Composable reactive primitives for TypeScript**

Minimal reactive streaming library: type-safe events, stateful transformations, async iteration, automatic cleanup.

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
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
});

// Both: Push to a pull-based stream
const messages = new Stream(async function* () {
  const ws = new WebSocket("ws://localhost");
  while (ws.readyState === WebSocket.OPEN) {
    yield await new Promise(resolve => {
      ws.onmessage = e => resolve(e.data);
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

## Write Your Own

A transformer is just a function:

```typescript
const double = (stream: Stream<number>) =>
  new Stream(async function* () {
    for await (const n of stream) yield n * 2;
  });

stream.pipe(double);
```

## API

### Stream\<T>

- `push(...values: T[])` - Emit values
- `listen(callback, context?)` - Add listener
- `pipe(transformer)` - Transform stream
- `clear()` - Remove all listeners

### Async

- `await stream` - Wait for next value
- `for await (const value of stream)` - Iterate

## Philosophy

**2 primitives**: `Stream` + `pipe`

**6 transformers**: `state`, `gate`, `filter`, `map`, `merge`, `flat`

Everything else you compose yourself.

**Efficient by design**: Transformers execute once per value. Multiple listeners share the same computation:

```typescript
const expensive = source.pipe(map(async v => await heavyComputation(v)));

expensive.listen(v => updateUI(v));
expensive.listen(v => logToAnalytics(v));
expensive.listen(v => saveToCache(v));
// heavyComputation() runs ONCE per value, not 3 times
```

## Performance

- 1.6KB gzipped
- Zero dependencies
- Automatic memory management
- Tree-shakeable

## Browser Support

Chrome 84+, Firefox 79+, Safari 14.1+, Node.js 16+, Deno, Bun

## License

MIT © [Soffinal](https://github.com/soffinal)
