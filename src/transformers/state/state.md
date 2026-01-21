# state

Adds `.state.value` getter/setter to a stream, enabling reactive state management.

## Type

```typescript
type State<T> = Stream<T> & {
  state: {
    value: T;
  };
};

function state<T>(initialValue: T): (source: Stream<T>) => State<T>;
```

## Usage

### Basic State

```typescript
const counter = new Stream<number>().pipe(state(0));

counter.listen((value) => {
  console.log("Counter:", value);
});

counter.state.value = 5; // Triggers listener, logs: "Counter: 5"
console.log(counter.state.value); // 5
```

### State from Source Stream

```typescript
const source = new Stream<number>();
const stateful = source.pipe(state(0));

stateful.listen((value) => {
  console.log("Value:", value);
});

source.push(10); // Logs: "Value: 10"
console.log(stateful.state.value); // 10
```

### Reactive UI Updates

```typescript
const user = new Stream<User | null>().pipe(state(null));

user.listen((u) => {
  if (u) {
    document.querySelector(".user-name")!.textContent = u.name;
  }
});

// Update state
user.state.value = { name: "Alice", email: "alice@example.com" };
```

### Derived State

```typescript
const count = new Stream<number>().pipe(state(0));
const doubled = count.pipe(map((n) => n * 2)).pipe(state(0));

doubled.listen((value) => {
  console.log("Doubled:", value);
});

count.state.value = 5; // Logs: "Doubled: 10"
```

## Behavior

- **Initial value**: Stream starts with `initialValue`
- **Getter**: `.state.value` returns current value
- **Setter**: `.state.value = x` updates value and triggers listeners
- **Source updates**: Values from source stream update internal state
- **Synchronous**: State updates are synchronous

## Composition

```typescript
// State + Gate
const gatedState = new Stream<number>()
  .pipe(state(0))
  .pipe(gate());

gatedState.state.value = 5; // Emits if gate is open
gatedState.gate.close();
gatedState.state.value = 10; // Blocked by gate

// State + Filter
const filtered = new Stream<number>()
  .pipe(state(0))
  .pipe(filter((n) => n > 0));

filtered.state.value = -5; // Filtered out
filtered.state.value = 5; // Passes through
```

## Use Cases

- **UI State Management**: Reactive component state
- **Form State**: Track form values with automatic updates
- **Application State**: Global state with reactive updates
- **Derived Values**: Compute values from other state
- **State Machines**: Track current state with transitions

## Notes

- State is always synchronous - no async delays
- Setting `.state.value` immediately triggers listeners
- Source stream values update internal state
- Composable with all other transformers
