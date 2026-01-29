# zip

Combines multiple streams pairwise into tuples of synchronized values.

## Type

```typescript
function zip<T, U>(...streams: Stream<U>[]): Stream.Transformer<Stream<T>, Stream<[T, ...U[]]>>;
```

## Behavior

- **Synchronization**: Waits for all streams to emit before producing tuple
- **Shortest stream**: Stops when any stream ends
- **Order preserved**: Tuples maintain emission order
- **Type-safe**: Full TypeScript inference for tuple types

## Use Cases

### 1. Basic Pairing

```typescript
const numbers = new Stream<number>();
const strings = new Stream<string>();

const zipped = numbers.pipe(zip(strings));
// Type: Stream<[number, string]>

zipped.listen(([n, s]) => console.log(n, s));

numbers.push(1, 2, 3);
strings.push("a", "b", "c");
// Output: 1 "a", 2 "b", 3 "c"
```

### 2. Multiple Streams

```typescript
const stream1 = new Stream<number>();
const stream2 = new Stream<string>();
const stream3 = new Stream<boolean>();

const zipped = stream1.pipe(zip(stream2, stream3));
// Type: Stream<[number, string, boolean]>

stream1.push(1, 2);
stream2.push("a", "b");
stream3.push(true, false);
// Output: [1, "a", true], [2, "b", false]
```

### 3. Form Validation

```typescript
const email = new Stream<string>();
const password = new Stream<string>();

const credentials = email.pipe(zip(password));

credentials.listen(([e, p]) => {
  validateCredentials(e, p);
});
```

### 4. Data Correlation

```typescript
const timestamps = new Stream<number>();
const values = new Stream<number>();

const timeSeries = timestamps.pipe(zip(values));

timeSeries.listen(([time, value]) => {
  chart.addPoint(time, value);
});
```

## Performance

- **Overhead**: Minimal - just tuple creation
- **Memory**: O(n) - buffers values until all streams emit
- **Buffering**: Late emissions buffered until synchronized

## Related

- [merge](../merge/merge.md) - Combine streams with union types
- [buffer](../buffer/buffer.md) - Collect into arrays
- [map](../map/map.md) - Transform values
