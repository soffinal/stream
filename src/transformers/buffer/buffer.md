# buffer

Collects values into arrays of specified size before emitting.

## Type

```typescript
function buffer<T>(size: number): Stream.Transformer<Stream<T>, Stream<T[]>>;
```

## Behavior

- **Accumulation**: Collects values until buffer size reached
- **Emission**: Emits full buffer as array only
- **No partial buffers**: Incomplete buffers not emitted (unless stream completes)
- **Type**: Transforms `Stream<T>` to `Stream<T[]>`

## Use Cases

### 1. Basic Buffering

```typescript
const stream = new Stream<number>();
const buffered = stream.pipe(buffer(3));

buffered.listen((arr) => console.log(arr));

stream.push(1, 2, 3, 4, 5, 6);
// Output: [1, 2, 3], [4, 5, 6]
```

### 2. Batch Processing

```typescript
const events = new Stream<Event>();
const batched = events.pipe(buffer(10));

batched.listen(async (batch) => {
  await processBatch(batch); // Process 10 events at once
});
```

### 3. Batch API Calls

```typescript
const requests = new Stream<Request>();
const batched = requests.pipe(buffer(5));

batched.listen(async (batch) => {
  await api.batchInsert(batch);
});
```

### 4. With Transformations

```typescript
const numbers = new Stream<number>();

const result = numbers
  .pipe(filter((n) => n > 0))
  .pipe(buffer(5))
  .pipe(map((arr) => arr.reduce((sum, n) => sum + n, 0)));

result.listen((sum) => console.log("Sum of 5:", sum));
```

## Performance

- **Overhead**: Minimal - just array operations
- **Memory**: O(size) - stores values until buffer full
- **Synchronous**: Emits immediately when buffer full

## Related

- [flat](../flat/flat.md) - Flatten arrays into values
- [zip](../zip/zip.md) - Combine streams pairwise
- [cache](../cache/cache.md) - Store values with size limit
