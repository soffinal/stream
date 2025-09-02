# Filter Transformer

The `filter` transformer selectively passes values through a stream based on predicate functions. It supports synchronous and asynchronous filtering, type guards, stateful operations, and multiple concurrency strategies.

## Quick Start

```typescript
import { Stream, filter } from "@soffinal/stream";

const numbers = new Stream<number>();

// Simple filtering
const positives = numbers.pipe(filter((n) => n > 0));

positives.listen(console.log);
numbers.push(-1, 2, -3, 4); // Outputs: 2, 4
```

## Basic Usage

### Synchronous Filtering

```typescript
// Basic predicate
stream.pipe(filter((value) => value > 10));

// Complex conditions
stream.pipe(filter((user) => user.active && user.age >= 18));

// Null/undefined filtering
stream.pipe(filter((value) => value != null));
```

### Type Guards

Filter supports TypeScript type guards for type narrowing:

```typescript
const mixed = new Stream<string | number>();

// Type narrows to Stream<number>
const numbers = mixed.pipe(filter((value): value is number => typeof value === "number"));

// Type narrows to Stream<string>
const strings = mixed.pipe(filter((value): value is string => typeof value === "string"));
```

## Asynchronous Filtering

### Sequential Processing (Default)

```typescript
const stream = new Stream<string>();

const validated = stream.pipe(
  filter(async (email) => {
    const isValid = await validateEmail(email);
    return isValid;
  })
);
```

### Concurrent Strategies

For expensive async predicates, choose a concurrency strategy:

#### Concurrent Unordered

Results emit as soon as they complete, potentially out of order:

```typescript
const stream = new Stream<string>();

const validated = stream.pipe(
  filter(
    async (url) => {
      const isReachable = await checkURL(url);
      return isReachable;
    },
    { strategy: "concurrent-unordered" }
  )
);

// URLs may emit in different order based on response times
```

#### Concurrent Ordered

Parallel processing but maintains original order:

```typescript
const stream = new Stream<User>();

const verified = stream.pipe(
  filter(
    async (user) => {
      const isVerified = await verifyUser(user.id);
      return isVerified;
    },
    { strategy: "concurrent-ordered" }
  )
);

// Users always emit in original order despite varying verification times
```

## Stateful Filtering

Maintain state across filter operations for complex logic:

### Basic Stateful Filtering

```typescript
const stream = new Stream<number>();

// Take only first 5 items
const limited = stream.pipe(
  filter({ count: 0 }, (state, value) => {
    if (state.count >= 5) return; // Terminate stream
    return [true, { count: state.count + 1 }];
  })
);
```

### Advanced State Management

```typescript
const stream = new Stream<string>();

// Deduplicate values
const unique = stream.pipe(
  filter({ seen: new Set<string>() }, (state, value) => {
    if (state.seen.has(value)) {
      return [false, state]; // Skip duplicate
    }

    const newSeen = new Set(state.seen);
    newSeen.add(value);
    return [true, { seen: newSeen }];
  })
);
```

### Complex Stateful Logic

```typescript
const events = new Stream<{ type: string; timestamp: number }>();

// Rate limiting: max 5 events per second
const rateLimited = events.pipe(
  filter(
    {
      timestamps: [] as number[],
      maxPerSecond: 5,
    },
    (state, event) => {
      const now = event.timestamp;
      const recent = state.timestamps.filter((t) => now - t < 1000);

      if (recent.length >= state.maxPerSecond) {
        return [false, { ...state, timestamps: recent }];
      }

      return [
        true,
        {
          ...state,
          timestamps: [...recent, now],
        },
      ];
    }
  )
);
```

## Stream Termination

Filters can terminate streams by returning `undefined`:

```typescript
const stream = new Stream<string>();

const untilStop = stream.pipe(
  filter((value) => {
    if (value === "STOP") return; // Terminates stream
    return value.length > 0;
  })
);

stream.push("hello", "world", "STOP", "ignored");
// Only "hello" and "world" are emitted
```

### Conditional Termination

```typescript
const numbers = new Stream<number>();

const untilNegative = numbers.pipe(
  filter({ sum: 0 }, (state, value) => {
    const newSum = state.sum + value;
    if (newSum < 0) return; // Terminate when sum goes negative

    return [value > 0, { sum: newSum }];
  })
);
```

## Performance Considerations

### When to Use Concurrency

- **Sequential**: Default choice, maintains order, lowest overhead
- **Concurrent-unordered**: Use when order doesn't matter and predicates are expensive
- **Concurrent-ordered**: Use when order matters but predicates are expensive

### Memory Management

Stateful filters maintain state objects. For large datasets:

```typescript
// Good: Bounded state
filter({ count: 0, limit: 1000 }, (state, value) => {
  if (state.count >= state.limit) return;
  return [predicate(value), { ...state, count: state.count + 1 }];
});

// Avoid: Unbounded state growth
filter({ history: [] }, (state, value) => {
  // This grows indefinitely!
  return [true, { history: [...state.history, value] }];
});
```

## Error Handling

Errors in predicates will propagate and potentially terminate the stream:

```typescript
const stream = new Stream<number>();

const safe = stream.pipe(
  filter((value) => {
    try {
      return riskyPredicate(value);
    } catch (error) {
      console.error("Filter error:", error);
      return false; // Skip problematic values
    }
  })
);
```

## Common Patterns

### Throttling

```typescript
const throttle = <T>(ms: number) =>
  filter<T, { lastEmit: number }>({ lastEmit: 0 }, (state, value) => {
    const now = Date.now();
    if (now - state.lastEmit < ms) {
      return [false, state];
    }
    return [true, { lastEmit: now }];
  });

stream.pipe(throttle(1000)); // Max one value per second
```

### Sampling

```typescript
const sample = <T>(n: number) =>
  filter<T, { count: number }>({ count: 0 }, (state, value) => {
    const shouldEmit = (state.count + 1) % n === 0;
    return [shouldEmit, { count: state.count + 1 }];
  });

stream.pipe(sample(3)); // Every 3rd value
```

### Windowing

```typescript
const slidingWindow = <T>(size: number) =>
  filter<T, { window: T[] }>({ window: [] }, (state, value) => {
    const newWindow = [...state.window, value].slice(-size);
    const shouldEmit = newWindow.length === size;

    return [shouldEmit, { window: newWindow }];
  });

stream.pipe(slidingWindow(5)); // Emit when window is full
```

## Type Signatures

```typescript
// Simple predicate with optional concurrency
filter<VALUE>(
  predicate: (value: VALUE) => boolean | void | Promise<boolean | void>,
  options?: { strategy: "sequential" | "concurrent-unordered" | "concurrent-ordered" }
): (stream: Stream<VALUE>) => Stream<VALUE>

// Type guard predicate (synchronous only)
filter<VALUE, FILTERED extends VALUE>(
  predicate: (value: VALUE) => value is FILTERED
): (stream: Stream<VALUE>) => Stream<FILTERED>

// Stateful predicate (always sequential)
filter<VALUE, STATE>(
  initialState: STATE,
  predicate: (state: STATE, value: VALUE) => [boolean, STATE] | void
): (stream: Stream<VALUE>) => Stream<VALUE>
```

## Best Practices

1. **Choose the right strategy**: Use sequential for simple predicates, concurrent for expensive async operations
2. **Manage state size**: Keep stateful filter state bounded to prevent memory leaks
3. **Handle errors gracefully**: Wrap risky predicates in try-catch blocks
4. **Use type guards**: Leverage TypeScript's type narrowing for better type safety
5. **Consider termination**: Use `return undefined` to cleanly terminate streams when conditions are met

The filter transformer is a powerful tool for stream processing that scales from simple synchronous predicates to complex stateful async operations with optimal performance characteristics.
