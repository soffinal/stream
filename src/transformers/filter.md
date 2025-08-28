# Filter Transformer

## The Adaptive Gatekeeper

Traditional filtering is binary and stateless - a value either passes or doesn't. But real-world filtering often requires **memory, learning, and evolution**. The `filter` transformer embodies **Adaptive Reactive Programming** - where the gatekeeper remembers, and can even decide when to stop.

## Design

### Why State-First Architecture?

```typescript
filter(initialState, (state, value) => [boolean, newState]);
```

**State comes first** because it's the foundation of adaptation. This isn't just filtering - it's **Adaptive gatekeeping** that evolves with each event.

### The Dual Return Pattern

```typescript
return [shouldPass, newState]; // Continue with evolution
return; // Terminate with wisdom
```

**Two outcomes, infinite possibilities:**

- `[boolean, state]` - The filter learns and continues
- `void` - The filter decides the stream has served its purpose

This mirrors human decision-making: we either let something through (and remember why), or we decide we've seen enough.

### Argument Order

```typescript
(state, value) => // State first, value second
```

**State precedes value** because context shapes perception. We don't judge events in isolation - we judge them based on what we've learned. The state is the accumulated transformations; the value is just the current moment.

## The Adaptive Constraint System

### Level 1: Simple Gatekeeping

```typescript
// Traditional filtering - no memory, no learning
stream.pipe(filter({}, (_, value) => [value > 0, {}]));
```

Even "simple" filtering uses the adaptive architecture. The empty state `{}` represents a gatekeeper that doesn't need memory - but could develop it.

### Level 2: Memory-Based Filtering

```typescript
// The gatekeeper remembers and counts
stream.pipe(
  filter({ count: 0 }, (state, value) => {
    const newCount = state.count + 1;
    return [newCount % 3 === 0, { count: newCount }]; // Every 3rd passes
  })
);
```

### Level 3: Termination

```typescript
// The gatekeeper knows when enough is enough
stream.pipe(
  filter({ seen: 0 }, (state, value) => {
    if (state.seen >= 10) return; // Wisdom: we've seen enough
    return [value > 0, { seen: state.seen + 1 }];
  })
);
```

**Stream termination** represents the ultimate adaptive behavior - knowing when to stop. This isn't just filtering; it's **stream lifecycle management**.

### Level 4: Async

```typescript
// The gatekeeper consults external validation
stream.pipe(
  filter({ cache: new Map() }, async (state, value) => {
    if (state.cache.has(value)) {
      return [state.cache.get(value), state]; // Remember previous decisions
    }

    const isValid = await validateAsync(value);
    state.cache.set(value, isValid); // Learn for next time
    return [isValid, state];
  })
);
```

**Async filtering with memory** - the gatekeeper doesn't just validate, it **builds institutional knowledge**.

## Essential Copy-Paste Transformers

### simpleFilter - Gateway to Adaptation

```typescript
// For users transitioning from traditional filtering
const simpleFilter = <T>(predicate: (value: T) => boolean | Promise<boolean>) =>
  filter<T, {}>({}, async (_, value) => {
    const shouldPass = await predicate(value);
    return [shouldPass, {}];
  });

// Usage: familiar syntax, adaptive foundation
stream.pipe(simpleFilter((x) => x > 0));
stream.pipe(simpleFilter(async (user) => await isValid(user)));
```

**Design choice**: `simpleFilter` is a **bridge**, not a replacement. It introduces users to the adaptive architecture while providing familiar syntax. The empty state `{}` is an invitation to evolution.

### take - The Counting Gatekeeper

```typescript
const take = <T>(n: number) =>
  filter<T, { count: number }>({ count: 0 }, (state, value) => {
    if (state.count >= n) return; // Wisdom: we have enough
    return [true, { count: state.count + 1 }];
  });
```

### distinct - The Memory Gatekeeper

```typescript
const distinct = <T>() =>
  filter<T, { seen: Set<T> }>({ seen: new Set() }, (state, value) => {
    if (state.seen.has(value)) return [false, state];
    state.seen.add(value);
    return [true, state];
  });
```

### tap - The Observer Gatekeeper

```typescript
const tap = <T>(fn: (value: T) => void | Promise<void>) =>
  filter<T, {}>({}, async (_, value) => {
    await fn(value);
    return [true, {}]; // Always pass through
  });

// Usage: Side effects without changing the stream
stream.pipe(tap((value) => console.log("Saw:", value)));
stream.pipe(tap(async (value) => await logToDatabase(value)));
```

## The Termination

Stream termination isn't failure - it's **purposeful completion**. When a filter returns `void`, it's saying: "I have served my purpose, and this stream's journey ends here."

```typescript
// A filter that knows its mission
const untilCondition = <T>(condition: (value: T) => boolean) =>
  filter<T, {}>({}, (_, value) => {
    if (condition(value)) return; // Mission complete
    return [true, {}];
  });
```

This represents a fundamental shift from infinite streams to **purpose-driven streams** that know when their work is done.

## Enhanced Pipe Integration

The new pipe architecture enables seamless integration:

```typescript
// Filter integrates with any transformer
const result = stream
  .pipe(filter({}, (_, v) => [v > 0, {}])) // Returns Stream<T>
  .pipe(map({}, (_, v) => [v.toString(), {}])) // Returns Stream<string>
  .pipe(toState("0")); // Returns State<string>

// Complex filtering chains
const processed = source
  .pipe(
    filter({ seen: 0 }, (state, v) => {
      if (state.seen >= 100) return; // Terminate after 100
      return [v > 0, { seen: state.seen + 1 }];
    })
  )
  .pipe(tap((v) => console.log("Positive:", v)))
  .pipe(
    filter({ count: 0 }, (state, v) => {
      return [state.count % 2 === 0, { count: state.count + 1 }]; // Every other
    })
  );
```

**Note**: Filters compose naturally because they all speak the same language - **adaptive constraints** that can terminate, remember, and evolve.

**Design insight**: Filtering State creates **conditional reactivity** - the derived state only reacts to values that pass the adaptive constraints.

## Conclusion

The `filter` transformer isn't just about removing unwanted values - it's about **intelligent gatekeeping** that:

- **Remembers** previous decisions (state)
- **Learns** from patterns (adaptation)
- **Evolves** behavior over time (constraints)
- **Knows** when to stop (termination)
