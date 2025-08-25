# Map Transformer

## The Adaptive Alchemist

Traditional mapping is a simple function application - transform input A to output B. But real-world transformation often requires **context, memory, and evolution**. The `map` transformer embodies **Adaptive Reactive Programming** - where the alchemist remembers previous transformations and evolves its craft.

## Design

### Why State-First Architecture?

```typescript
map(initialState, (state, value) => [transformed, newState]);
```

**State comes first** because transformation is contextual. We don't transform values in isolation - we transform them based on what we've learned, what we've seen, and where we're going. The state is the accumulated knowledge; the value is just the raw material.

### The Dual Return Pattern

```typescript
return [transformedValue, newState]; // Transform and evolve
```

**Every transformation teaches us something.** The dual return forces us to consider: "How does this transformation change our understanding?" Even if the state doesn't change, we must consciously decide that.

### Argument Order

```typescript
(state, value) => // Context first, content second
```

**Context shapes transformation.** A value of `5` might become `10` (double), `"5"` (stringify), or `{ count: 5, timestamp: now }` (enrich) - depending on the accumulated state. The transformer's history determines the value's destiny.

## The Adaptive Transformation System

### Level 1: Simple Alchemy

```typescript
// Traditional transformation - no memory, no learning
stream.pipe(map({}, (_, value) => [value * 2, {}]));
```

Even "simple" mapping uses the adaptive architecture. The empty state `{}` represents a state that doesn't need memory - but could develop it.

### Level 2: Contextual Transformation

```typescript
// The alchemist remembers and enriches
stream.pipe(
  map({ sum: 0, count: 0 }, (state, value) => {
    const newSum = state.sum + value;
    const newCount = state.count + 1;
    const average = newSum / newCount;

    return [
      { value, runningSum: newSum, runningAverage: average },
      { sum: newSum, count: newCount },
    ];
  })
);
```

### Level 3: Evolutionary Transformation

```typescript
// The alchemist adapts its formula based on patterns
stream.pipe(
  map({ multiplier: 1, trend: "stable" }, (state, value) => {
    // Adapt the transformation based on observed patterns
    const newMultiplier = value > 100 ? state.multiplier * 1.1 : state.multiplier * 0.9;
    const trend = newMultiplier > state.multiplier ? "growing" : "shrinking";

    return [value * newMultiplier, { multiplier: newMultiplier, trend }];
  })
);
```

**Adaptive transformation** - the formula itself evolves based on the data it processes.

### Level 4: Async with Order Preservation

```typescript
// The alchemist consults external sources while maintaining order
stream.pipe(
  map({ cache: new Map() }, async (state, value) => {
    if (state.cache.has(value)) {
      return [state.cache.get(value), state];
    }

    const enriched = await enrichWithAPI(value);
    state.cache.set(value, enriched); // Learn for next time
    return [enriched, state];
  })
);
```

**Async transformation with memory** - the alchemist doesn't just transform, it **builds institutional knowledge** while preserving the natural order of events.

## Essential Copy-Paste Transformers

### simpleMap - Gateway to Adaptation

```typescript
// For users transitioning from traditional mapping
const simpleMap = <T, U>(fn: (value: T) => U | Promise<U>) =>
  map<T, {}, U>({}, async (_, value) => {
    const result = await fn(value);
    return [result, {}];
  });

// Usage: familiar syntax, adaptive foundation
stream.pipe(simpleMap((x) => x * 2));
stream.pipe(simpleMap(async (user) => await enrichUser(user)));
```

**Design choice**: `simpleMap` is a **bridge**, not a replacement. It introduces users to the adaptive architecture while providing familiar syntax. The empty state `{}` is an invitation to evolution.

### withIndex - The Counting Alchemist

```typescript
const withIndex = <T>() =>
  map<T, { index: number }, { value: T; index: number }>({ index: 0 }, (state, value) => [
    { value, index: state.index },
    { index: state.index + 1 },
  ]);
```

`withIndex` demonstrates **sequential awareness** - the transformer knows its place in the stream's history and shares that knowledge.

### delay - The Patient Alchemist

```typescript
const delay = <T>(ms: number) =>
  map<T, {}, T>({}, async (_, value) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    return [value, {}];
  });
```

`delay` embodies **temporal transformation** - sometimes the most important transformation is time itself.

### pluck - The Focused Alchemist

```typescript
const pluck = <T, K extends keyof T>(key: K) => map<T, {}, T[K]>({}, (_, value) => [value[key], {}]);
```

`pluck` demonstrates **selective transformation** - the alchemist knows exactly what it wants and ignores everything else.

## The Order Preservation

Async transformations maintain order because **sequence matters**. Even if transformation B completes before transformation A, the stream waits. This isn't just about correctness - it's about **respecting the narrative** of the data.

```typescript
// Order is preserved even with varying async delays
stream.pipe(
  map({}, async (_, value) => {
    const delay = Math.random() * 1000; // Random processing time
    await new Promise((resolve) => setTimeout(resolve, delay));
    return [await processValue(value), {}];
  })
);
```

**Philosophy**: The stream is a story, and stories must be told in order.

## The State Evolution Pattern

State evolution follows a natural progression:

1. **Empty State** `{}` - The transformer starts innocent
2. **Simple State** `{ count: 0 }` - It learns to count
3. **Rich State** `{ sum: 0, count: 0, average: 0 }` - It develops complex understanding
4. **Intelligent State** `{ cache: Map, patterns: [], predictions: {} }` - It becomes wise

This mirrors how expertise develops in any field - from simple rules to nuanced understanding.

## Conclusion

The `map` transformer isn't just about changing values - it's about **intelligent transformation** that:

- **Remembers** previous transformations (state)
- **Learns** from patterns (adaptation)
- **Evolves** its approach over time (constraints)
- **Preserves** the narrative order (respect)
