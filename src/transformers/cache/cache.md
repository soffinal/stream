# cache

HOT transformer that caches stream values in memory with configurable size, drop strategy, and TTL.

## Type

```typescript
function cache<T>(options?: CacheOptions<T>): Stream.Transformer<Stream<T>, Cache<T>>

type CacheOptions<T> = {
  initialValues?: T[];
  maxSize?: number;
  dropStrategy?: 'oldest' | 'newest';
  ttl?: number;
  onEvict?: (value: T, reason: 'maxSize' | 'ttl') => void;
};

type Cache<T> = Stream<T> & {
  cache: {
    readonly values: T[];
    readonly size: number | undefined;
    readonly dropStrategy: 'oldest' | 'newest';
    readonly ttl: number | undefined;
    clear(): void;
  };
};
```

## Behavior

- **HOT**: Starts listening to source immediately, even without subscribers
- **Caching**: Stores values in memory for inspection or replay
- **Pass-through**: All values flow to listeners unchanged
- **Drop strategy**: Controls which values to drop when maxSize is exceeded
- **TTL**: Automatic eviction after time-to-live expires
- **Eviction callbacks**: React to cache evictions

## Use Cases

### 1. Inspect Stream History

```typescript
const events = source.pipe(cache({ maxSize: 100 }));

// Debug: Check what events happened
console.log(events.cache.values);

// Still get all new events
events.listen(handler);
```

### 2. Metrics & Monitoring

```typescript
const requests = requestStream.pipe(cache({ maxSize: 1000 }));

// Monitor without affecting stream
setInterval(() => {
  const recentRequests = requests.cache.values;
  console.log(`Request count: ${recentRequests.length}`);
  console.log(`Error rate: ${calculateErrorRate(recentRequests)}`);
}, 5000);

// Normal processing continues
requests.listen(handleRequest);
```

### 3. Time-Travel Debugging

```typescript
const stateChanges = stream.pipe(cache());

// Replay from any point
function replayFrom(index: number) {
  const history = stateChanges.cache.values;
  history.slice(index).forEach(applyChange);
}

// Reset to specific state
function resetToState(index: number) {
  const history = stateChanges.cache.values;
  resetApp();
  history.slice(0, index).forEach(applyChange);
}
```

### 4. Build Custom Patterns

```typescript
// Custom: Replay only to first listener
const cached = source.pipe(cache({ maxSize: 5 }));
let replayed = false;

const originalListen = cached.listen.bind(cached);
cached.listen = ((listener, context) => {
  if (!replayed) {
    cached.cache.values.forEach(listener);
    replayed = true;
  }
  return originalListen(listener, context);
}) as typeof cached.listen;
```

## Options

### initialValues

Pre-populate cache with values.

```typescript
const cached = stream.pipe(cache({ 
  initialValues: ['init', 'ready'] 
}));

console.log(cached.cache.values); // ['init', 'ready']
```

### maxSize

Limit cache size. When exceeded, drops values based on strategy.

```typescript
const cached = stream.pipe(cache({ maxSize: 3 }));

stream.push(1, 2, 3, 4, 5);
console.log(cached.cache.values); // [3, 4, 5] - oldest dropped
```

### dropStrategy

Controls which values to drop when maxSize is exceeded.

**'oldest' (default)**: Drop oldest values (FIFO, sliding window)

```typescript
const cached = stream.pipe(cache({ 
  maxSize: 3, 
  dropStrategy: 'oldest' 
}));

stream.push(1, 2, 3, 4, 5);
console.log(cached.cache.values); // [3, 4, 5]
```

**'newest'**: Drop newest values (keep initial values)

```typescript
const cached = stream.pipe(cache({ 
  maxSize: 3, 
  dropStrategy: 'newest' 
}));

stream.push(1, 2, 3, 4, 5);
console.log(cached.cache.values); // [1, 2, 3]
```

## Cache API

### values

Get snapshot of cached values.

```typescript
const snapshot = cached.cache.values; // T[]
```

### size

Get configured maxSize.

```typescript
const maxSize = cached.cache.size; // number | undefined
```

### dropStrategy

Get configured drop strategy.

```typescript
const strategy = cached.cache.dropStrategy; // 'oldest' | 'newest'
```

### clear()

Clear all cached values.

```typescript
cached.cache.clear();
console.log(cached.cache.values); // []
```

## HOT Behavior

Cache is a HOT transformer - it starts listening to the source immediately:

```typescript
const stream = new Stream<number>();
const cached = stream.pipe(cache({ maxSize: 3 }));

// No listeners yet, but cache is active
stream.push(1, 2, 3, 4, 5);

console.log(cached.cache.values); // [3, 4, 5]

// Later: add listener
cached.listen(console.log); // Gets new values only
stream.push(6); // Logs: 6
```

## Memory Management

Cache lifecycle is tied to the source stream:

```typescript
{
  const source = new Stream<number>();
  const cached = source.pipe(cache());
  // Both source and cached stay alive together
}
// When source is GC'd, cached is GC'd too
```

## Patterns Built on Cache

- **[replay](../../patterns/replay/replay.md)**: Cache + replay to all listeners
- **consume**: Cache + consume once (use async iteration)

## Performance

- **Memory**: O(maxSize) or O(n) if unlimited
- **Time**: O(1) for push, O(n) for values snapshot
- **Overhead**: Minimal - just array operations

## Related

- [replay](../../patterns/replay/replay.md) - Replay cached values to late subscribers
- [buffer](../buffer/buffer.md) - Collect values into arrays
- [state](../state/state.md) - Single value state management


### ttl

Time-to-live in milliseconds. Values are automatically evicted after TTL expires.

```typescript
const cached = stream.pipe(cache({ ttl: 5000 })); // 5 seconds

stream.push(1, 2, 3);
// After 5 seconds, cache is automatically cleared
```

**Use cases:**
- Session management
- Rate limiting windows
- Metrics collection
- Temporary data

**Example: Rate Limiting**

```typescript
const requests = requestStream.pipe(cache({ 
  ttl: 60 * 1000 // 1 minute window
}));

// Check rate limit
if (requests.cache.values.length > 100) {
  throw new Error('Rate limit: max 100 requests per minute');
}
```

**Example: Session Timeout**

```typescript
const sessions = loginStream.pipe(cache({ 
  ttl: 30 * 60 * 1000, // 30 minutes
  onEvict: (session, reason) => {
    if (reason === 'ttl') {
      console.log(`Session ${session.id} expired`);
      session.cleanup();
    }
  }
}));
```

### onEvict

Callback invoked when a value is evicted from cache.

```typescript
const cached = stream.pipe(cache({
  maxSize: 10,
  ttl: 5000,
  onEvict: (value, reason) => {
    console.log(`Evicted ${value} due to ${reason}`);
  }
}));
```

**Eviction reasons:**
- `'maxSize'` - Evicted because cache exceeded maxSize
- `'ttl'` - Evicted because TTL expired

**Example: Cleanup Resources**

```typescript
const connections = connectionStream.pipe(cache({
  maxSize: 100,
  ttl: 60000,
  onEvict: (conn, reason) => {
    conn.close();
    metrics.record('connection_evicted', { reason });
  }
}));
```

**Example: Audit Log**

```typescript
const events = eventStream.pipe(cache({
  maxSize: 1000,
  onEvict: (event, reason) => {
    if (reason === 'maxSize') {
      // Archive to database before eviction
      db.archive(event);
    }
  }
}));
```

## Advanced Patterns

### Sliding Window Metrics

```typescript
const errors = errorStream.pipe(cache({ 
  ttl: 5 * 60 * 1000 // 5 minute window
}));

setInterval(() => {
  const errorRate = errors.cache.values.length;
  if (errorRate > 50) {
    alert.trigger('High error rate', { count: errorRate });
  }
}, 10000);
```

### LRU Cache with Cleanup

```typescript
const resources = resourceStream.pipe(cache({
  maxSize: 100,
  dropStrategy: 'oldest',
  onEvict: (resource, reason) => {
    resource.dispose();
    console.log(`Resource ${resource.id} evicted: ${reason}`);
  }
}));
```

### Time-Based Aggregation

```typescript
const metrics = metricStream.pipe(cache({ 
  ttl: 60000 // 1 minute buckets
}));

setInterval(() => {
  const bucket = metrics.cache.values;
  const avg = bucket.reduce((sum, m) => sum + m.value, 0) / bucket.length;
  report.send({ timestamp: Date.now(), average: avg });
}, 60000);
```

### Debounce with History

```typescript
const inputs = inputStream.pipe(cache({ 
  ttl: 300, // 300ms debounce
  maxSize: 10
}));

// Process only if no inputs in last 300ms
inputs.listen(() => {
  setTimeout(() => {
    if (inputs.cache.values.length === 0) {
      processInput();
    }
  }, 300);
});
```
