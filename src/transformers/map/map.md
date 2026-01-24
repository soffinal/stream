# map

Transform values flowing through a stream. Supports async transformations, type conversions, and stateful operations.

## Type

```typescript
function map<T, U>(
  mapper: (value: T) => U | Promise<U>,
  options?: { strategy?: "sequential" | "concurrent-unordered" | "concurrent-ordered" },
): Stream.Transformer<Stream<T>, Stream<U>>;

function map<T, STATE extends Record<string, unknown>, U>(
  initialState: STATE,
  mapper: (state: STATE, value: T) => [U, STATE] | Promise<[U, STATE]>,
): Stream.Transformer<Stream<T>, Stream<U>>;
```

## Behavior

- **Transform**: Converts each value to a new value
- **Type conversion**: Full TypeScript type inference
- **Async**: Supports async mappers with strategy options
- **Stateful**: Track state across values (optional)
- **Chainable**: Compose multiple transformations

## Use Cases

### 1. Simple Transformations

```typescript
stream.pipe(map((n) => n * 2));
stream.pipe(map((n) => n.toString()));
stream.pipe(map((user) => user.name));
```

### 2. Type Conversions

```typescript
const numbers = new Stream<number>();

const strings = numbers.pipe(map((n) => n.toString()));
const objects = numbers.pipe(map((n) => ({ value: n, squared: n * n })));
```

### 3. Async Transformations

```typescript
stream.pipe(
  map(async (url) => {
    const response = await fetch(url);
    return await response.json();
  }),
);
```

### 4. Stateful Transformations

```typescript
// Running sum
stream.pipe(
  map({ sum: 0 }, (state, value) => {
    const newSum = state.sum + value;
    return [newSum, { sum: newSum }];
  }),
);

// Add indices
stream.pipe(
  map({ index: 0 }, (state, value) => {
    const result = { item: value, index: state.index };
    return [result, { index: state.index + 1 }];
  }),
);
```

## Options

### strategy

Controls async mapper execution:

**'sequential' (default):**

```typescript
stream.pipe(
  map(async (v) => await process(v)),
);
// Values processed one at a time
```

**'concurrent-unordered':**

```typescript
stream.pipe(
  map(async (v) => await process(v), { strategy: "concurrent-unordered" }),
);
// All values processed concurrently, order not preserved
```

**'concurrent-ordered':**

```typescript
stream.pipe(
  map(async (v) => await process(v), { strategy: "concurrent-ordered" }),
);
// All values processed concurrently, order preserved
```

**Note:** Stateful maps are always sequential (no strategy option).

## Patterns

### Scan (Accumulate)

```typescript
const scan = <T, U>(fn: (acc: U, value: T) => U, initial: U) =>
  map<T, { acc: U }, U>({ acc: initial }, (state, value) => {
    const newAcc = fn(state.acc, value);
    return [newAcc, { acc: newAcc }];
  });

stream.pipe(scan((sum, n) => sum + n, 0)); // Running sum
```

### Enrich

```typescript
const enrich = <T>(enrichFn: (item: T) => Promise<any>) =>
  map(async (item: T) => {
    const enrichment = await enrichFn(item);
    return { ...item, ...enrichment };
  });

users.pipe(
  enrich(async (user) => ({
    avatar: await getAvatar(user.id),
  })),
);
```

### Sliding Window

```typescript
const slidingWindow = <T>(size: number) =>
  map<T, { window: T[] }, T[]>({ window: [] }, (state, value) => {
    const newWindow = [...state.window, value].slice(-size);
    return [newWindow, { window: newWindow }];
  });

stream.pipe(slidingWindow(3)); // Last 3 items
```

## Performance

- **Overhead**: Minimal - just mapper execution
- **Async**: Can add latency with slow mappers
- **Stateful**: Slightly more overhead for state management
- **Memory**: O(1) for stateless, O(state size) for stateful

## Related

- [filter](../filter/filter.md) - Remove values
- [flat](../flat/flat.md) - Flatten arrays
- [effect](../effect/effect.md) - Side effects without transformation
