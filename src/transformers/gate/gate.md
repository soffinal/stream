# gate

Adds `.gate.open()`, `.gate.close()`, and `.gate.isOpen` for manual flow control.

## Type

```typescript
type Gate<T> = Stream<T> & {
  gate: {
    open(): void;
    close(): void;
    readonly isOpen: boolean;
  };
};

function gate<T>(): Stream.Transformer<Stream<T>, Gate<T>>;
```

## Behavior

- **Initial state**: Gate starts open
- **Open**: Values flow through normally
- **Closed**: Values are blocked (dropped, not buffered)
- **Real-time**: Gate state checked for each value
- **No buffering**: Blocked values are not queued

## Use Cases

### 1. Pause/Resume

```typescript
const stream = new Stream<number>().pipe(gate());

stream.listen((value) => console.log(value));

stream.push(1); // Logs: 1
stream.gate.close();
stream.push(2); // Blocked
stream.gate.open();
stream.push(3); // Logs: 3
```

### 2. Feature Flags

```typescript
const features = new Stream<Feature>().pipe(gate());

// Enable/disable features dynamically
if (config.enableNewFeatures) {
  features.gate.open();
} else {
  features.gate.close();
}
```

### 3. Circuit Breaker

```typescript
const requests = new Stream<Request>().pipe(gate());

requests.listen(async (req) => {
  try {
    await processRequest(req);
  } catch (error) {
    requests.gate.close(); // Stop processing on error
    setTimeout(() => requests.gate.open(), 5000); // Retry after 5s
  }
});
```

### 4. Conditional Processing

```typescript
const events = new Stream<Event>().pipe(gate());

// Process only during business hours
const now = new Date().getHours();
if (now >= 9 && now < 17) {
  events.gate.open();
} else {
  events.gate.close();
}
```

## Composition

```typescript
// Gate + State
const gatedState = new Stream<number>().pipe(state(0)).pipe(gate());

gatedState.state.value = 5; // Emits if open
gatedState.gate.close();
gatedState.state.value = 10; // Blocked

// Gate + Filter
const filtered = new Stream<number>().pipe(gate()).pipe(filter((n) => n > 0));

// Both gate and filter must pass
```

## Bypass Pattern

Direct `.push()` bypasses the gate:

```typescript
const stream = new Stream<number>().pipe(gate());

stream.listen((n) => console.log(n));

stream.gate.close();
source.push(1); // Blocked

stream.push(999); // Logs: 999 (bypasses gate!)
```

**Use cases:** Critical alerts, emergency notifications, debug messages.

## Performance

- **Overhead**: Minimal - just boolean check
- **Memory**: O(1) - no buffering
- **No events**: Gate state changes don't emit events

## Related

- [state](../state/state.md) - Reactive state management
- [filter](../filter/filter.md) - Conditional filtering
- [cache](../cache/cache.md) - Store values
