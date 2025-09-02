# Map Transformer

The `map` transformer transforms values flowing through a stream. It supports synchronous and asynchronous transformations, stateful operations, type conversions, and multiple concurrency strategies for optimal performance.

## Quick Start

```typescript
import { Stream, map } from "@soffinal/stream";

const numbers = new Stream<number>();

// Simple transformation
const doubled = numbers.pipe(map((n) => n * 2));

doubled.listen(console.log);
numbers.push(1, 2, 3); // Outputs: 2, 4, 6
```

## Basic Usage

### Synchronous Transformations

```typescript
// Number to string
stream.pipe(map((n) => n.toString()));

// Object property extraction
stream.pipe(map((user) => user.name));

// Complex transformations
stream.pipe(
  map((data) => ({
    id: data.id,
    name: data.name.toUpperCase(),
    timestamp: Date.now(),
  }))
);
```

### Type Transformations

Map excels at converting between types with full TypeScript inference:

```typescript
const numbers = new Stream<number>();

// number → string
const strings = numbers.pipe(map((n) => n.toString()));

// number → object
const objects = numbers.pipe(
  map((n) => ({
    value: n,
    squared: n * n,
    isEven: n % 2 === 0,
  }))
);

// Chained transformations
const result = numbers
  .pipe(map((n) => n * 2)) // number → number
  .pipe(map((n) => n.toString())) // number → string
  .pipe(map((s) => s.length)); // string → number
```

## Asynchronous Transformations

### Sequential Processing (Default)

```typescript
const urls = new Stream<string>();

const responses = urls.pipe(
  map(async (url) => {
    const response = await fetch(url);
    return await response.json();
  })
);

// Requests processed one at a time, maintaining order
```

### Concurrent Strategies

For expensive async operations, choose a concurrency strategy:

#### Concurrent Unordered

Transformations run in parallel, results emit as they complete:

```typescript
const ids = new Stream<string>();

const users = ids.pipe(
  map(
    async (id) => {
      const user = await fetchUser(id);
      return user;
    },
    { strategy: "concurrent-unordered" }
  )
);

// Users emit as API calls complete, potentially out of order
```

#### Concurrent Ordered

Parallel processing but maintains original order:

```typescript
const images = new Stream<string>();

const processed = images.pipe(
  map(
    async (imageUrl) => {
      const processed = await processImage(imageUrl);
      return processed;
    },
    { strategy: "concurrent-ordered" }
  )
);

// Images always emit in original order despite varying processing times
```

## Stateful Transformations

Maintain state across transformations for complex operations:

### Basic Stateful Mapping

```typescript
const numbers = new Stream<number>();

// Running sum
const runningSums = numbers.pipe(
  map({ sum: 0 }, (state, value) => {
    const newSum = state.sum + value;
    return [newSum, { sum: newSum }];
  })
);

numbers.push(1, 2, 3, 4);
// Outputs: 1, 3, 6, 10
```

### Indexing and Counting

```typescript
const items = new Stream<string>();

// Add indices
const indexed = items.pipe(
  map({ index: 0 }, (state, value) => {
    const result = { item: value, index: state.index };
    return [result, { index: state.index + 1 }];
  })
);

items.push("a", "b", "c");
// Outputs: {item: "a", index: 0}, {item: "b", index: 1}, {item: "c", index: 2}
```

### Complex State Management

```typescript
const events = new Stream<{ type: string; data: any }>();

// Event aggregation with history
const aggregated = events.pipe(
  map(
    {
      counts: new Map<string, number>(),
      history: [] as string[],
      total: 0,
    },
    (state, event) => {
      const newCounts = new Map(state.counts);
      const currentCount = newCounts.get(event.type) || 0;
      newCounts.set(event.type, currentCount + 1);

      const newHistory = [...state.history, event.type].slice(-10); // Keep last 10
      const newTotal = state.total + 1;

      const result = {
        event: event.type,
        count: currentCount + 1,
        totalEvents: newTotal,
        recentHistory: newHistory,
      };

      return [
        result,
        {
          counts: newCounts,
          history: newHistory,
          total: newTotal,
        },
      ];
    }
  )
);
```

### Async Stateful Transformations

```typescript
const requests = new Stream<string>();

// Caching with async operations
const cached = requests.pipe(
  map(
    {
      cache: new Map<string, any>(),
    },
    async (state, url) => {
      // Check cache first
      if (state.cache.has(url)) {
        return [state.cache.get(url), state];
      }

      // Fetch and cache
      const data = await fetch(url).then((r) => r.json());
      const newCache = new Map(state.cache);
      newCache.set(url, data);

      return [data, { cache: newCache }];
    }
  )
);
```

## Performance Considerations

### When to Use Concurrency

- **Sequential**: Default choice, maintains order, lowest overhead
- **Concurrent-unordered**: Use when order doesn't matter and transformations are expensive
- **Concurrent-ordered**: Use when order matters but transformations are expensive

### Benchmarking Example

```typescript
const urls = Array.from({ length: 100 }, (_, i) => `https://api.example.com/item/${i}`);
const stream = new Stream<string>();

// Sequential: ~10 seconds (100ms per request)
const sequential = stream.pipe(map(async (url) => await fetch(url)));

// Concurrent-unordered: ~1 second (parallel requests)
const concurrent = stream.pipe(
  map(async (url) => await fetch(url), {
    strategy: "concurrent-unordered",
  })
);
```

### Memory Management

For stateful transformations, manage memory carefully:

```typescript
// Good: Bounded state
map(
  {
    recentItems: [] as T[],
    maxSize: 100,
  },
  (state, value) => {
    const newItems = [...state.recentItems, value].slice(-state.maxSize);
    return [
      processItems(newItems),
      {
        recentItems: newItems,
        maxSize: state.maxSize,
      },
    ];
  }
);

// Avoid: Unbounded growth
map({ history: [] }, (state, value) => {
  // This grows indefinitely!
  return [value, { history: [...state.history, value] }];
});
```

## Error Handling

Handle transformation errors gracefully:

```typescript
const stream = new Stream<string>();

const safe = stream.pipe(
  map(async (data) => {
    try {
      return await riskyTransformation(data);
    } catch (error) {
      console.error("Transformation failed:", error);
      return { error: error.message, original: data };
    }
  })
);
```

## Common Patterns

### Enrichment

```typescript
const enrich = <T>(enrichFn: (item: T) => Promise<any>) =>
  map(async (item: T) => {
    const enrichment = await enrichFn(item);
    return { ...item, ...enrichment };
  });

users.pipe(
  enrich(async (user) => ({
    avatar: await getAvatar(user.id),
    permissions: await getPermissions(user.role),
  }))
);
```

### Batching

```typescript
const batch = <T>(size: number) =>
  map<T, { buffer: T[] }, T[]>({ buffer: [] }, (state, value) => {
    const newBuffer = [...state.buffer, value];

    if (newBuffer.length >= size) {
      return [newBuffer, { buffer: [] }];
    }

    return [null, { buffer: newBuffer }];
  }).pipe(filter((batch) => batch !== null));

stream.pipe(batch(5)); // Emit arrays of 5 items
```

### Debouncing with State

```typescript
const debounce = <T>(ms: number) =>
  map<T, { lastValue: T | null; timer: any }, T | null>(
    {
      lastValue: null,
      timer: null,
    },
    (state, value) => {
      if (state.timer) clearTimeout(state.timer);

      const timer = setTimeout(() => {
        // This would need additional mechanism to emit
      }, ms);

      return [null, { lastValue: value, timer }];
    }
  );
```

### Windowing

```typescript
const slidingWindow = <T>(size: number) =>
  map<T, { window: T[] }, T[]>({ window: [] }, (state, value) => {
    const newWindow = [...state.window, value].slice(-size);
    return [newWindow, { window: newWindow }];
  });

stream.pipe(slidingWindow(3)); // Always emit last 3 items
```

## Advanced Patterns

### Conditional Transformation

```typescript
const conditionalMap = <T, U>(condition: (value: T) => boolean, transform: (value: T) => U) =>
  map((value: T) => (condition(value) ? transform(value) : value));

stream.pipe(
  conditionalMap(
    (n) => n > 10,
    (n) => n * 2
  )
);
```

### Multi-step Processing

```typescript
const pipeline = <T>(steps: Array<(value: any) => any>) =>
  map((value: T) => steps.reduce((acc, step) => step(acc), value));

stream.pipe(
  pipeline([(x) => x.toString(), (x) => x.toUpperCase(), (x) => x.split(""), (x) => x.reverse(), (x) => x.join("")])
);
```

## Type Signatures

```typescript
// Simple mapper with optional concurrency
map<VALUE, MAPPED>(
  mapper: (value: VALUE) => MAPPED | Promise<MAPPED>,
  options?: { strategy: "sequential" | "concurrent-unordered" | "concurrent-ordered" }
): (stream: Stream<VALUE>) => Stream<MAPPED>

// Stateful mapper (always sequential)
map<VALUE, STATE, MAPPED>(
  initialState: STATE,
  mapper: (state: STATE, value: VALUE) => [MAPPED, STATE] | Promise<[MAPPED, STATE]>
): (stream: Stream<VALUE>) => Stream<MAPPED>
```

## Best Practices

1. **Choose the right strategy**: Use sequential for simple transformations, concurrent for expensive async operations
2. **Manage state size**: Keep stateful transformation state bounded to prevent memory leaks
3. **Handle errors gracefully**: Wrap risky transformations in try-catch blocks
4. **Leverage TypeScript**: Use proper typing for better development experience and runtime safety
5. **Consider performance**: Profile your transformations to choose optimal concurrency strategies
6. **Compose transformations**: Chain multiple simple maps rather than one complex transformation
7. **Use immutable updates**: Always return new state objects in stateful transformations

The map transformer is the workhorse of stream processing, enabling powerful data transformations that scale from simple synchronous operations to complex stateful async processing with optimal performance characteristics.
