# microbatch

**Temporarily HOT transformer that captures values pushed before listener is added, then becomes a passthrough.**

## Signature

```typescript
function microbatch<T>(): (stream: Stream<T>) => Stream<T>
```

## Behavior

**Two phases:**

1. **HOT phase (first microtask):** Captures all values pushed synchronously, emits them in next microtask
2. **COLD phase (after first microtask):** Becomes a direct passthrough (no batching)

## Use Cases

### 1. Push Before Listen

Avoid intermediate variables by pushing values before adding listener:

```typescript
const source = new Stream<number>();
const batched = source.pipe(microbatch());

// Push before listener exists
source.push(1, 2, 3);

// Listener receives all values
batched.listen(v => console.log(v)); // 1, 2, 3
```

### 2. Initialization Pattern

Capture configuration/setup values during initialization:

```typescript
const config = new Stream<Config>();
const settings = config.pipe(microbatch());

// Setup phase - push multiple configs
config.push({ theme: 'dark' });
config.push({ lang: 'en' });
config.push({ timezone: 'UTC' });

// Later - listener receives all
settings.listen(cfg => applyConfig(cfg));
```

### 3. Coalesce Rapid Events

Batch synchronous events into single microtask:

```typescript
const events = new Stream<Event>();
const batched = events.pipe(microbatch());

// Rapid synchronous events
for (let i = 0; i < 1000; i++) {
  events.push({ id: i });
}

// Processed in one microtask
batched.listen(e => process(e)); // Called 1000 times, but in one microtask
```

## Timing

```typescript
const source = new Stream<number>();
const batched = source.pipe(microbatch());

// T=0: HOT listener active
source.push(1, 2, 3); // Queued

// T=0+: Microtask fires
// - HOT listener aborted
// - Values emitted: 1, 2, 3
// - COLD listener activated

batched.listen(v => console.log(v)); // Receives: 1, 2, 3

// T=later: COLD phase (direct passthrough)
source.push(4); // Immediately passed through (no batching)
```

## Comparison

| Transformer | Behavior | Lifetime | Use Case |
|-------------|----------|----------|----------|
| `microbatch()` | HOT → COLD | One microtask | Push before listen |
| `cache()` | HOT | Persistent | Event replay |
| `buffer(n)` | COLD | Persistent | Fixed-size batches |
| `queue()` | HOT | Configurable | Async producer/consumer |

## Implementation Details

**HOT phase:**
- Listener added immediately when `pipe(microbatch())` is called
- Captures all values pushed in same event loop iteration
- Aborts after first microtask (always, even if no values pushed)

**COLD phase:**
- Direct passthrough (no queuing)
- Normal stream behavior
- Activated after HOT listener aborts

## Examples

### Basic Usage

```typescript
const source = new Stream<number>();
const batched = source.pipe(microbatch());

source.push(1, 2, 3);
batched.listen(v => console.log(v));
// Output: 1, 2, 3
```

### With Transformations

```typescript
const source = new Stream<number>();
const processed = source
  .pipe(microbatch())
  .pipe(filter(n => n > 0))
  .pipe(map(n => n * 2));

source.push(-1, 2, 3);
processed.listen(v => console.log(v));
// Output: 4, 6
```

### Continuous Usage

```typescript
const source = new Stream<number>();
const batched = source.pipe(microbatch());

// HOT phase
source.push(1, 2, 3);
batched.listen(v => console.log('HOT:', v));
// Output: HOT: 1, HOT: 2, HOT: 3

// COLD phase (after microtask)
setTimeout(() => {
  source.push(4, 5);
  // Output: HOT: 4, HOT: 5 (immediate passthrough)
}, 10);
```

## Notes

- **One-time HOT behavior:** Only the first microtask is HOT, then becomes COLD
- **Self-cleaning:** HOT listener always aborts after first microtask (no memory leaks)
- **Type-preserving:** Returns `Stream<T>`, not `Stream<T[]>`
- **Transparent:** Batching is implementation detail, user sees individual values

## See Also

- [cache](../cache/cache.md) - Persistent HOT transformer
- [buffer](../buffer/buffer.md) - Fixed-size batching
- [effect](../effect/effect.md) - Side effects with execution strategies
