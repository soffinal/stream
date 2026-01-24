# filter

Remove values from a stream based on a predicate. Supports async predicates, type guards, and stateful filtering.

## Type

```typescript
function filter<T>(
  predicate: (value: T) => boolean | void | Promise<boolean | void>,
  options?: { strategy?: "sequential" | "concurrent-unordered" | "concurrent-ordered" },
): Stream.Transformer<Stream<T>, Stream<T>>;

function filter<T, STATE extends Record<string, unknown>>(
  initialState: STATE,
  predicate: (state: STATE, value: T) => [boolean, STATE] | void | Promise<[boolean, STATE] | void>,
): Stream.Transformer<Stream<T>, Stream<T>>;
```

## Behavior

- **Selective**: Only values passing predicate are emitted
- **Type guards**: Supports TypeScript type narrowing
- **Async**: Supports async predicates with strategy options
- **Stateful**: Track state across values (optional)
- **Termination**: Return `undefined` to stop stream

## Use Cases

### 1. Simple Filtering

```typescript
stream.pipe(filter((n) => n > 0));
stream.pipe(filter((user) => user.active && user.age >= 18));
stream.pipe(filter((value) => value != null));
```

### 2. Type Guards

```typescript
const mixed = new Stream<string | number>();

const numbers = mixed.pipe(filter((v): v is number => typeof v === "number"));
const strings = mixed.pipe(filter((v): v is string => typeof v === "string"));
```

### 3. Async Validation

```typescript
stream.pipe(
  filter(async (email) => {
    return await validateEmail(email);
  }),
);
```

### 4. Stateful Filtering

```typescript
// Take first 5 values
stream.pipe(
  filter({ count: 0 }, (state, value) => {
    if (state.count >= 5) return; // Terminate
    return [true, { count: state.count + 1 }];
  }),
);

// Deduplicate
stream.pipe(
  filter({ seen: new Set() }, (state, value) => {
    if (state.seen.has(value)) return [false, state];
    const newSeen = new Set(state.seen);
    newSeen.add(value);
    return [true, { seen: newSeen }];
  }),
);
```

## Options

### strategy

Controls async predicate execution:

**'sequential' (default):**

```typescript
stream.pipe(
  filter(async (v) => await validate(v)),
);
// Values processed one at a time
```

**'concurrent-unordered':**

```typescript
stream.pipe(
  filter(async (v) => await validate(v), { strategy: "concurrent-unordered" }),
);
// All values processed concurrently, order not preserved
```

**'concurrent-ordered':**

```typescript
stream.pipe(
  filter(async (v) => await validate(v), { strategy: "concurrent-ordered" }),
);
// All values processed concurrently, order preserved
```

**Note:** Stateful filters are always sequential (no strategy option).

## Patterns

### Throttle

```typescript
const throttle = <T>(ms: number) =>
  filter<T, { lastEmit: number }>({ lastEmit: 0 }, (state, value) => {
    const now = Date.now();
    if (now - state.lastEmit < ms) return [false, state];
    return [true, { lastEmit: now }];
  });

stream.pipe(throttle(1000)); // Max one per second
```

### Take

```typescript
const take = <T>(n: number) =>
  filter<T, { count: number }>({ count: 0 }, (state, value) => {
    if (state.count >= n) return;
    return [true, { count: state.count + 1 }];
  });

stream.pipe(take(10)); // First 10 values
```

### Sample

```typescript
const sample = <T>(n: number) =>
  filter<T, { count: number }>({ count: 0 }, (state, value) => {
    const shouldEmit = (state.count + 1) % n === 0;
    return [shouldEmit, { count: state.count + 1 }];
  });

stream.pipe(sample(3)); // Every 3rd value
```

## Performance

- **Overhead**: Minimal - just predicate execution
- **Async**: Can add latency with slow predicates
- **Stateful**: Slightly more overhead for state management
- **Memory**: O(1) for stateless, O(state size) for stateful

## Related

- [map](../map/map.md) - Transform values
- [gate](../gate/gate.md) - Manual flow control
- [effect](../effect/effect.md) - Side effects without filtering
