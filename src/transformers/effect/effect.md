# effect

Side effects with identity map. Supports async operations, stateful tracking, and flow control strategies.

## Type

```typescript
function effect<T>(
  callback: (value: T) => void | Promise<void>,
  options?: { strategy?: "sequential" | "concurrent-unordered" | "concurrent-ordered" },
): Stream.Transformer<Stream<T>, Stream<T>>;

function effect<T, STATE extends Record<string, unknown>>(
  initialState: STATE,
  callback: (state: STATE, value: T) => STATE | Promise<STATE>,
): Stream.Transformer<Stream<T>, Stream<T>>;
```

## Behavior

- **Identity map**: Returns input value unchanged
- **Side effects**: Logging, metrics, I/O, mutations, async operations
- **Stateful**: Track state across values (optional)
- **Flow control**: Strategy options (sequential, concurrent-unordered, concurrent-ordered)

## Use Cases

### 1. Logging

```typescript
stream
  .pipe(filter((n) => n > 0))
  .pipe(effect((v) => console.log("After filter:", v)))
  .pipe(map((n) => n * 2))
  .pipe(effect((v) => console.log("After map:", v)));
```

### 2. Metrics

```typescript
stream.pipe(
  effect((value) => {
    metrics.increment("events_processed");
    metrics.gauge("last_value", value);
  }),
);
```

### 3. Database Writes

```typescript
stream.pipe(
  effect(async (value) => {
    await db.write(value);
    await cache.invalidate(value.key);
  }),
);
```

### 4. Stateful Counting

```typescript
stream.pipe(
  effect({ count: 0, sum: 0 }, (state, value) => {
    const newState = {
      count: state.count + 1,
      sum: state.sum + value,
    };
    console.log(`[${newState.count}] value: ${value}, avg: ${newState.sum / newState.count}`);
    return newState;
  }),
);
```

## Options

### strategy

Controls async effect execution:

**'sequential' (default):**

```typescript
stream.pipe(
  effect(async (v) => {
    await process(v);
  }),
);
// Values processed one at a time
```

**'concurrent-unordered':**

```typescript
stream.pipe(
  effect(async (v) => {
    await process(v);
  }, { strategy: "concurrent-unordered" }),
);
// All values processed concurrently, order not preserved
```

**'concurrent-ordered':**

```typescript
stream.pipe(
  effect(async (v) => {
    await process(v);
  }, { strategy: "concurrent-ordered" }),
);
// All values processed concurrently, order preserved
```

**Note:** Stateful effects are always sequential (no strategy option).

## Patterns

### Conditional Side Effects

```typescript
stream.pipe(
  effect((value) => {
    if (value > 100) {
      alert("High value detected!");
    }
  }),
);
```

### Multi-Step Side Effects

```typescript
stream.pipe(
  effect(async (value) => {
    await db.write(value);
    await cache.invalidate(value.key);
    await notifySubscribers(value);
  }),
);
```

### Stateful Aggregation

```typescript
stream.pipe(
  effect(
    {
      count: 0,
      sum: 0,
      min: Infinity,
      max: -Infinity,
    },
    (state, value) => {
      const newState = {
        count: state.count + 1,
        sum: state.sum + value,
        min: Math.min(state.min, value),
        max: Math.max(state.max, value),
      };

      if (newState.count % 100 === 0) {
        console.log("Stats:", {
          avg: newState.sum / newState.count,
          min: newState.min,
          max: newState.max,
        });
      }

      return newState;
    },
  ),
);
```

## Performance

- **Overhead**: Minimal - just callback execution
- **Async**: Can add latency if callback is slow
- **Stateful**: Slightly more overhead for state management
- **Memory**: O(1) for stateless, O(state size) for stateful

## Related

- [branch](../branch/branch.md) - Parallel branches for observation
- [map](../map/map.md) - Transform values
- [filter](../filter/filter.md) - Remove values
