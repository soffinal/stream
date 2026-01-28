# queue

**HOT transformer that provides a consumable cache - values are removed as they're iterated.**

## Signature

```typescript
function queue<T>(options?: queue.Options<T>): (stream: Stream<T>) => Queue<T>;
```

## Behavior

`queue` wraps `cache` internally and adds consumption semantics:

- **HOT**: Starts listening immediately (like cache)
- **Consumable**: Values are shifted (removed) as they're yielded
- **Inspectable**: Exposes cache API for monitoring queue state

## Use Cases

### 1. Async Producer/Consumer

Decouple producer and consumer - push before consumer is ready:

```typescript
const source = new Stream<Task>();
const tasks = source.pipe(queue({ size: 100 }));

// Producer starts immediately (pushes before consumer ready)
for (let i = 0; i < 50; i++) {
  source.push({ id: i, work: "process" });
}

// Consumer starts later (processes queued tasks)
setTimeout(async () => {
  for await (const task of tasks) {
    await processTask(task);
    console.log("Queue size:", tasks.cache.values.length);
  }
}, 1000);
```

### 2. Bounded Buffer

Limit memory usage with size and drop strategy:

```typescript
const events = new Stream<Event>();
const buffer = events.pipe(
  queue({
    size: 1000,
    dropStrategy: "oldest", // Drop old events when full
  }),
);

// Producer can push unlimited events
for (let i = 0; i < 10000; i++) {
  events.push({ id: i });
}

// Consumer processes bounded queue
for await (const event of buffer) {
  await process(event);
}
```

### 3. Rate Limiting

Control consumption rate while buffering incoming events:

```typescript
const requests = new Stream<Request>();
const q = requests.pipe(queue({ size: 500 }));

// Fast producer (unlimited rate)
for (let i = 0; i < 10000; i++) {
  requests.push({ id: i });
}

// Slow consumer (rate limited by processing time)
for await (const req of q) {
  await processRequest(req); // Takes 100ms
  // Automatically rate limited - processes 10 req/sec
}
```

### 4. Backpressure Monitoring

Monitor queue size to detect backpressure:

```typescript
const stream = new Stream<Data>();
const q = stream.pipe(queue({ size: 100 }));

// Monitor queue size
setInterval(() => {
  const size = q.cache.values.length;
  if (size > 80) {
    console.warn("Queue nearly full:", size);
  }
}, 1000);

// Consumer
for await (const data of q) {
  await process(data);
}
```

## Comparison

| Transformer    | HOT           | Consumable | Persistent | Use Case                     |
| -------------- | ------------- | ---------- | ---------- | ---------------------------- |
| `microbatch()` | One microtask | No         | No         | Push before listen           |
| `cache()`      | Yes           | No         | Yes        | Event replay, monitoring     |
| `queue()`      | Yes           | Yes        | Yes        | Producer/consumer, buffering |
| `buffer(n)`    | No            | No         | No         | Fixed-size batches           |

## API

### Queue Properties

Exposes all cache properties:

```typescript
const q = stream.pipe(queue({ size: 100 }));

q.cache.values; // Current queue contents (array)
q.cache.size; // Max size (100)
q.cache.dropStrategy; // 'oldest' or 'newest'
q.cache.ttl; // Time-to-live in ms
q.cache.clear(); // Clear queue
```

### Options

Same as `cache` options:

```typescript
type Options<T> = {
  size?: number; // Maximum queue size
  dropStrategy?: "oldest" | "newest"; // What to drop when full
  ttl?: number; // Time-to-live in milliseconds
};
```

## Examples

### Basic Queue

```typescript
const source = new Stream<number>();
const q = source.pipe(queue());

source.push(1, 2, 3);

for await (const value of q) {
  console.log(value); // 1, 2, 3
  console.log(q.cache.values.length); // 2, 1, 0
}
```

### With Transformations

```typescript
const source = new Stream<number>();
const processed = source
  .pipe(filter((n) => n > 0))
  .pipe(map((n) => n * 2))
  .pipe(queue({ size: 50 }));

source.push(-1, 2, 3);

for await (const value of processed) {
  console.log(value); // 4, 6
}
```

### Multiple Consumers (Round-Robin)

```typescript
const source = new Stream<Task>();
const q = source.pipe(queue({ size: 100 }));

// Consumer 1
(async () => {
  for await (const task of q) {
    await worker1.process(task);
  }
})();

// Consumer 2
(async () => {
  for await (const task of q) {
    await worker2.process(task);
  }
})();

// Both consumers compete for tasks (round-robin)
// Task 1 → worker1, Task 2 → worker2, Task 3 → worker1, etc.
```

### Broadcasting (Not Round-Robin)

For broadcasting, listen to the consumer stream, not the queue:

```typescript
const source = new Stream<Task>();
const q = source.pipe(queue({ size: 100 }));

// Single consumer
const consumer = new Stream<Task>(q);

// Multiple listeners receive ALL tasks (broadcast)
consumer.listen((task) => logger.log(task)); // Gets all
consumer.listen((task) => metrics.track(task)); // Gets all
consumer.listen((task) => worker.process(task)); // Gets all
```

### Graceful Shutdown

```typescript
const source = new Stream<Data>();
const q = source.pipe(queue());

const stop = new AbortController();

// Consumer with cleanup
(async () => {
  try {
    for await (const data of q) {
      if (stop.signal.aborted) break;
      await process(data);
    }
  } finally {
    console.log("Remaining in queue:", q.cache.values.length);
    q.cache.clear();
  }
})();

// Graceful shutdown
setTimeout(() => stop.abort(), 5000);
```

### Monitoring Queue Health

```typescript
const source = new Stream<Event>();
const q = source.pipe(queue({ size: 1000 }));

// Health check
setInterval(() => {
  const size = q.cache.values.length;
  const utilization = (size / 1000) * 100;

  console.log(`Queue: ${size}/1000 (${utilization.toFixed(1)}%)`);

  if (utilization > 90) {
    console.error("Queue nearly full - backpressure detected!");
  }
}, 1000);
```

## Implementation Details

**HOT behavior:**

- Listener added immediately when `pipe(queue())` is called
- Captures all values pushed before consumer starts iterating
- Persists until explicitly cleared or stream ends

**Consumption:**

- Values are shifted (removed) from queue as they're yielded
- Multiple consumers share the same queue (first-come-first-served)
- Queue size decreases as values are consumed

**Memory management:**

- Respects `size` option (drops values when full)
- `dropStrategy` controls which values to drop ('oldest' or 'newest')
- `ttl` option auto-expires old values (time-to-live in milliseconds)
- Call `queue.cache.clear()` to empty queue manually

## Notes

- **Wraps cache internally**: `queue` creates a cache, you don't need to pipe cache first
- **Consumable**: Unlike cache, values are removed as they're read
- **Shared queue**: Multiple consumers compete for values (round-robin, not broadcast)
- **For broadcasting**: Listen to consumer stream, not queue directly
- **Backpressure**: Monitor `queue.cache.values.length` to detect slow consumers

## See Also

- [cache](../cache/cache.md) - Non-consumable HOT transformer
- [microbatch](../microbatch/microbatch.md) - One-shot HOT transformer
- [buffer](../buffer/buffer.md) - Fixed-size batching
