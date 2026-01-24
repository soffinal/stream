# branch

Creates a parallel branch by forwarding values to a target stream while passing them through unchanged.

## Type

```typescript
function branch<T>(target: Stream<T>): Stream.Transformer<Stream<T>, Stream<T>>
```

## Behavior

- **Pass-through**: All values continue down the main chain unchanged
- **Forwarding**: Values are also pushed to the target stream
- **Parallel**: Creates independent branches that can be monitored separately
- **Immediate**: Target stream is usable before the chain is built

## Use Cases

### 1. Monitoring & Logging

```typescript
const monitoring = new Stream<Event>();

const result = eventSource
  .pipe(filter(validateEvent))
  .pipe(branch(monitoring))  // Monitor filtered events
  .pipe(map(enrichEvent))
  .pipe(buffer(100));

// Separate monitoring
monitoring.listen((event) => {
  console.log('Valid event:', event);
  metrics.increment('valid_events');
});
```

### 2. Multiple Observation Points

```typescript
const rawEvents = new Stream<Event>();
const validEvents = new Stream<Event>();
const enrichedEvents = new Stream<EnrichedEvent>();

const output = eventSource
  .pipe(branch(rawEvents))
  .pipe(filter(validateEvent))
  .pipe(branch(validEvents))
  .pipe(map(enrichEvent))
  .pipe(branch(enrichedEvents))
  .pipe(cache({ ttl: 60000 }));

// Independent monitoring at each stage
rawEvents.listen(logRaw);
validEvents.listen(updateValidCount);
enrichedEvents.listen(sendToAnalytics);
```

### 3. Typed Branches with Transformer APIs

```typescript
// Declare branches with proper types
const cached = new Stream<number>().pipe(cache({ maxSize: 100 }));
const gated = new Stream<number>().pipe(gate());

const result = source
  .pipe(filter((n) => n > 0))
  .pipe(branch(cached))    // Branch with cache API
  .pipe(branch(gated))     // Branch with gate API
  .pipe(map((n) => n * 2));

// Access transformer APIs on branches
cached.cache.values;      // number[]
cached.cache.evicted.listen(handleEviction);
gated.gate.close();       // Control flow
```

### 4. Analytics & Metrics

```typescript
const analytics = new Stream<UserAction>();

const processed = userActions
  .pipe(filter(isValidAction))
  .pipe(branch(analytics))  // Send to analytics
  .pipe(map(normalizeAction))
  .pipe(buffer(10));

// Analytics pipeline
analytics
  .pipe(map(extractMetrics))
  .listen(sendToAnalytics);
```

### 5. Debugging & Development

```typescript
const debug = new Stream<any>();

const result = source
  .pipe(filter(validate))
  .pipe(branch(debug))  // Debug tap
  .pipe(map(transform))
  .pipe(buffer(5));

// Debug output
if (process.env.DEBUG) {
  debug.listen((value) => {
    console.log('After filter:', value);
  });
}
```

## Fluent Chains

Branch enables beautiful fluent chains without breaking them:

**Without branch (ugly):**
```typescript
const source = new Stream<number>();
const filtered = source.pipe(filter((n) => n > 0));
const doubled = filtered.pipe(map((n) => n * 2));
const buffered = doubled.pipe(buffer(3));

// Lost fluent style
filtered.listen(handleFiltered);
doubled.listen(handleDoubled);
```

**With branch (beautiful):**
```typescript
const filtered = new Stream<number>();
const doubled = new Stream<number>();

const buffered = source
  .pipe(filter((n) => n > 0))
  .pipe(branch(filtered))
  .pipe(map((n) => n * 2))
  .pipe(branch(doubled))
  .pipe(buffer(3));

// Clean separation
filtered.listen(handleFiltered);
doubled.listen(handleDoubled);
```

## Mental Model

Branch creates **parallel branches**, not sequential transformations:

```
source
  ↓
filter
  ↓
  ├─→ branch(monitoring) → monitoring.listen(...)
  ↓
map
  ↓
  ├─→ branch(analytics) → analytics.listen(...)
  ↓
buffer
  ↓
result
```

Each branch is independent:
- Main chain continues unchanged
- Branches can have their own transformers
- Branches don't affect each other

## Important Notes

### Branches Don't Inherit Types

```typescript
const cached = new Stream<number>().pipe(cache({ maxSize: 100 }));

const result = source
  .pipe(filter((n) => n > 0))
  .pipe(branch(cached))    // cached is Cache<number>
  .pipe(map((n) => n * 2)); // result is Stream<number> (not cached)

// ✅ Works - cached has cache API
cached.cache.values;

// ❌ Doesn't work - result doesn't have cache API
result.cache.values;
```

### Immediate Usability

Target streams are usable immediately:

```typescript
const monitoring = new Stream<number>();

// Can listen before chain is built
monitoring.listen(console.log);

// Build chain later
source.pipe(branch(monitoring));
```

## Patterns

### Conditional Branching

```typescript
const errors = new Stream<Error>();
const warnings = new Stream<Warning>();

const result = events
  .pipe(branch(errors))
  .pipe(branch(warnings))
  .pipe(process);

// Filter branches
errors.pipe(filter(isError)).listen(handleError);
warnings.pipe(filter(isWarning)).listen(handleWarning);
```

### Multi-Stage Pipeline

```typescript
const stage1 = new Stream<Data>();
const stage2 = new Stream<Data>();
const stage3 = new Stream<Data>();

const output = input
  .pipe(validateData)
  .pipe(branch(stage1))
  .pipe(enrichData)
  .pipe(branch(stage2))
  .pipe(aggregateData)
  .pipe(branch(stage3))
  .pipe(finalizeData);

// Monitor each stage
stage1.listen(logStage1);
stage2.listen(logStage2);
stage3.listen(logStage3);
```

### Side Effects

```typescript
const sideEffects = new Stream<Event>();

const result = events
  .pipe(filter(validate))
  .pipe(branch(sideEffects))
  .pipe(map(transform));

// Handle side effects separately
sideEffects.listen(async (event) => {
  await db.log(event);
  await cache.invalidate(event.key);
  await notifySubscribers(event);
});
```

## Performance

- **Overhead**: Minimal - just an additional `.push()` call
- **Memory**: O(1) - no buffering or caching
- **Listeners**: Each branch can have multiple independent listeners

## Related

- [cache](../cache/cache.md) - HOT caching with TTL
- [tap](../../patterns/tap/tap.md) - Side effects without branching
- [merge](../merge/merge.md) - Combine multiple streams
