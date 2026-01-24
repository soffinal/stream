# merge

Combines multiple streams into one unified flow with union types.

## Type

```typescript
function merge<T, U>(...streams: Stream<U>[]): Stream.Transformer<Stream<T>, Stream<T | U>>;
```

## Behavior

- **Union types**: Output type is union of all input types
- **Temporal order**: Values emit in chronological order
- **Multiple sources**: Combine any number of streams
- **Type-safe**: Full TypeScript inference

## Use Cases

### 1. Combine Different Types

```typescript
const numbers = new Stream<number>();
const strings = new Stream<string>();

const combined = numbers.pipe(merge(strings));
// Type: Stream<number | string>

combined.listen((value) => {
  if (typeof value === "number") {
    console.log("Number:", value);
  } else {
    console.log("String:", value);
  }
});

numbers.push(1, 2);
strings.push("a", "b");
// Output: 1, 2, "a", "b"
```

### 2. Event Aggregation

```typescript
const userEvents = new Stream<UserEvent>();
const systemEvents = new Stream<SystemEvent>();
const errorEvents = new Stream<ErrorEvent>();

const allEvents = userEvents.pipe(merge(systemEvents, errorEvents));
// Type: Stream<UserEvent | SystemEvent | ErrorEvent>

allEvents.listen((event) => {
  logEvent(event);
});
```

### 3. Multiple Data Sources

```typescript
const api1 = new Stream<Data>();
const api2 = new Stream<Data>();
const cache = new Stream<Data>();

const allData = api1.pipe(merge(api2, cache));

allData.listen(processData);
```

### 4. Discriminated Unions

```typescript
interface UserEvent {
  type: "user";
  data: any;
}
interface SystemEvent {
  type: "system";
  data: any;
}

const userEvents = new Stream<UserEvent>();
const systemEvents = new Stream<SystemEvent>();

const allEvents = userEvents.pipe(merge(systemEvents));

allEvents.listen((event) => {
  switch (event.type) {
    case "user":
      handleUserEvent(event);
      break;
    case "system":
      handleSystemEvent(event);
      break;
  }
});
```

## Performance

- **Overhead**: Minimal - just forwarding values
- **Memory**: O(1) - no buffering
- **Listeners**: Single listener per merged stream

## Related

- [zip](../zip/zip.md) - Combine streams pairwise
- [branch](../branch/branch.md) - Create parallel branches
- [flat](../flat/flat.md) - Flatten arrays
