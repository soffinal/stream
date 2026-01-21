# gate

Adds flow control to a stream with `.gate.open()` and `.gate.close()` methods.

## Type

```typescript
type Gate<T> = Stream<T> & {
  gate: {
    open(): void;
    close(): void;
    readonly isOpen: boolean;
  };
};

function gate<T>(): (source: Stream<T>) => Gate<T>;
```

## Usage

### Basic Flow Control

```typescript
const source = new Stream<number>();
const gated = source.pipe(gate());

gated.listen((value) => {
  console.log("Value:", value);
});

source.push(1); // Logs: "Value: 1"
gated.gate.close();
source.push(2); // Blocked, nothing logged
gated.gate.open();
source.push(3); // Logs: "Value: 3"
```

### Standalone Gate

```typescript
const events = new Stream<string>().pipe(gate());

events.listen((msg) => console.log(msg));

events.push("Hello"); // Logs: "Hello"
events.gate.close();
events.push("World"); // Blocked
```

### Conditional Gating

```typescript
const stream = new Stream<number>().pipe(gate());

stream.listen((value) => {
  console.log("Processing:", value);
});

// Open gate only during business hours
const now = new Date().getHours();
if (now >= 9 && now < 17) {
  stream.gate.open();
} else {
  stream.gate.close();
}
```

### Check Gate Status

```typescript
const gated = new Stream<number>().pipe(gate());

console.log(gated.gate.isOpen); // true (starts open)

gated.gate.close();
console.log(gated.gate.isOpen); // false

gated.gate.open();
console.log(gated.gate.isOpen); // true
```

## Behavior

- **Initial state**: Gate starts **open**
- **Open**: Values flow through normally
- **Closed**: Values are blocked (not emitted to listeners)
- **Real-time**: Gate state checked when each value arrives
- **No buffering**: Blocked values are dropped, not queued

## Composition

```typescript
// Gate + State
const gatedState = new Stream<number>()
  .pipe(state(0))
  .pipe(gate());

gatedState.state.value = 5; // Emits if open
gatedState.gate.close();
gatedState.state.value = 10; // Blocked

// Gate + Filter
const filtered = new Stream<number>()
  .pipe(gate())
  .pipe(filter((n) => n > 0));

filtered.gate.close();
// Both gate and filter must pass

// Multiple Gates
const doubleGated = new Stream<number>()
  .pipe(gate())
  .pipe(gate());

// Both gates must be open for values to flow
```

## Use Cases

- **Pause/Resume**: Pause event processing temporarily
- **Feature Flags**: Enable/disable features dynamically
- **Rate Limiting**: Close gate after quota exceeded
- **Conditional Processing**: Process events only when conditions met
- **Backpressure**: Close gate when downstream is overwhelmed
- **Circuit Breaker**: Close gate on errors, reopen after recovery

## Notes

- Gate starts **open** by default
- Blocked values are **dropped**, not buffered
- Gate state is checked in real-time for each value
- Composable with all other transformers
- No events emitted when gate state changes
