# flat

Flattens arrays into individual values.

## Type

```typescript
function flat<T>(depth?: number): Stream.Transformer<Stream<T>, Stream<FlatArray<T, depth>>>;
```

## Behavior

- **Array to values**: Each array becomes separate events
- **Depth control**: Optional depth parameter for nested arrays
- **Order preserved**: Values emit in array order
- **Type-safe**: Full TypeScript inference

## Use Cases

### 1. Basic Flattening

```typescript
const arrays = new Stream<number[]>();
const numbers = arrays.pipe(flat());

numbers.listen((n) => console.log(n));

arrays.push([1, 2, 3]);
// Output: 1, 2, 3
```

### 2. Nested Arrays

```typescript
const nested = new Stream<number[][]>();
const flattened = nested.pipe(flat(1));

flattened.listen((n) => console.log(n));

nested.push([
  [1, 2],
  [3, 4],
]);
// Output: 1, 2, 3, 4
```

### 3. Map then Flatten

```typescript
const sentences = new Stream<string>();
const characters = sentences.pipe(map((s) => s.split(""))).pipe(flat());

characters.listen((c) => console.log(c));

sentences.push("hello");
// Output: 'h', 'e', 'l', 'l', 'o'
```

### 4. Batch Processing

```typescript
const batches = new Stream<Request[]>();
const requests = batches.pipe(flat());

requests.listen(processRequest);

batches.push([req1, req2, req3]); // Each processed individually
```

## Performance

- **Overhead**: Minimal - just array iteration
- **Memory**: O(1) - no buffering
- **Synchronous**: All values emitted immediately

## Related

- [map](../map/map.md) - Transform values
- [buffer](../buffer/buffer.md) - Collect into arrays
- [merge](../merge/merge.md) - Combine streams
