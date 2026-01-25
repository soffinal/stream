# map

Transform stream values with multiple execution strategies.

## Execution Strategies

- **sequential** (default): Process one at a time on main thread
- **concurrent**: Process all concurrently on main thread, emit as completed (unordered)
- **concurrent-ordered**: Process all concurrently on main thread, maintain order
- **parallel**: Process in Web Workers, emit as completed (unordered, fastest)
- **parallel-ordered**: Process in Web Workers, maintain order

## Basic Usage

```typescript
// Simple transformation
stream.pipe(map(x => x * 2))

// Async transformation
stream.pipe(map(async x => await fetch(x)))

// Type transformation
stream.pipe(map((x: number) => x.toString()))
```

## Execution Strategies

### Sequential (Default)

Process one value at a time on the main thread:

```typescript
stream.pipe(map(async x => {
  await delay(100);
  return x * 2;
}))
// Values: [1, 2, 3]
// Time: ~300ms (100ms each, sequential)
// Output: [2, 4, 6] (in order)
```

### Concurrent

Process all values concurrently on main thread, emit as completed:

```typescript
stream.pipe(map(async x => {
  await delay(x * 10);
  return x * 2;
}, { execution: 'concurrent' }))
// Values: [3, 1, 2]
// Delays: [30ms, 10ms, 20ms]
// Output: [2, 4, 6] (fastest first: 1, 2, 3)
```

### Concurrent-Ordered

Process all values concurrently on main thread, maintain original order:

```typescript
stream.pipe(map(async x => {
  await delay(x * 10);
  return x * 2;
}, { execution: 'concurrent-ordered' }))
// Values: [3, 1, 2]
// Delays: [30ms, 10ms, 20ms]
// Time: ~30ms (all concurrent, wait for slowest)
// Output: [6, 2, 4] (original order maintained)
```

### Parallel

Process in Web Workers, emit as completed (fastest for CPU-intensive):

```typescript
stream.pipe(map(x => {
  // Heavy computation
  return fibonacci(x);
}, { execution: 'parallel' }))
// Offloads to worker pool
// Output: Results as they complete (unordered)
```

### Parallel-Ordered

Process in Web Workers, maintain order:

```typescript
stream.pipe(map(x => {
  return fibonacci(x);
}, { execution: 'parallel-ordered' }))
// Offloads to worker pool
// Output: Results in original order
```

## With Args

Pass static arguments to worker functions:

```typescript
stream.pipe(map((x, args) => x * args.multiplier, {
  execution: 'parallel',
  args: { multiplier: 2, offset: 10 }
}))

// Args are sent once to workers (not per event)
// Efficient for high-frequency streams
```

## Stateful Transformation

Maintain state across transformations:

```typescript
// Running sum
stream.pipe(map({ sum: 0 }, (state, x) => {
  const newSum = state.sum + x;
  return [newSum, { sum: newSum }];
}))
// Input: [1, 2, 3]
// Output: [1, 3, 6]

// With history
stream.pipe(map({ history: [] }, (state, x) => {
  const newHistory = [...state.history, x];
  return [
    { value: x, count: newHistory.length },
    { history: newHistory }
  ];
}))
```

## Performance Guide

### When to Use Each Strategy

**Sequential**: 
- Default, simplest
- When order matters and operations are fast
- When operations must be sequential (database transactions)

**Concurrent**:
- I/O-bound operations (fetch, database queries)
- When order doesn't matter
- Multiple independent async operations

**Concurrent-Ordered**:
- I/O-bound operations where order matters
- API calls that must return in order
- Faster than sequential when operations overlap

**Parallel**:
- CPU-intensive operations (image processing, calculations)
- When order doesn't matter
- Heavy computations that block main thread

**Parallel-Ordered**:
- CPU-intensive operations where order matters
- Processing queue of heavy tasks
- Maintains order while offloading CPU work

### Performance Comparison

```typescript
// Sequential: 300ms total
stream.pipe(map(async x => {
  await delay(100);
  return x;
}))
// [1, 2, 3] → 100ms + 100ms + 100ms = 300ms

// Concurrent-Ordered: 100ms total
stream.pipe(map(async x => {
  await delay(100);
  return x;
}, { execution: 'concurrent-ordered' }))
// [1, 2, 3] → All start at once, wait 100ms = 100ms

// Parallel: Offloads CPU work
stream.pipe(map(x => heavyCalc(x), { execution: 'parallel' }))
// Main thread stays responsive
```

## Worker Pool

Parallel strategies use a singleton WorkerPool:

- **4 workers** shared across all streams
- **Function registration**: Functions registered once (not serialized per event)
- **Automatic fallback**: Falls back to concurrent if workers unavailable
- **Round-robin**: Load balancing across workers

### How It Works

```typescript
// Function registered once
const { execute } = WorkerPool.register(mapper, args);

// Only values sent per event
stream.listen(value => {
  execute(value).then(result => output.push(result));
});
```

### Benefits

- ✅ Function serialized once (not per event)
- ✅ Args cached in workers
- ✅ Smaller messages (just value)
- ✅ Better performance for high-frequency streams
- ✅ No worker limit issues (pool manages resources)

## Type Safety

Full TypeScript inference:

```typescript
const numbers = new Stream<number>();

// Type: Stream<string>
const strings = numbers.pipe(map(x => x.toString()));

// Type: Stream<boolean>
const bools = strings.pipe(map(x => x.length > 1));

// With args - fully typed
const doubled = numbers.pipe(map((x, args) => x * args.multiplier, {
  execution: 'parallel',
  args: { multiplier: 2 } // Type inferred
}));
```

## See Also

- [filter](../filter/filter.md) - Uses map internally for execution strategies
- [effect](../effect/effect.md) - Uses map internally for execution strategies
