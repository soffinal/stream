# state

Adds `.state.value` getter/setter for reactive state management with automatic dependency tracking.

## Type

```typescript
type State<T> = Stream<T> & {
  state: {
    value: T;
  };
};

function state<T>(initialValue: T): Stream.Transformer<Stream<T>, State<T>>;
```

## Behavior

- **Reactive**: `.state.value` setter triggers listeners
- **Getter**: `.state.value` returns current value
- **Source updates**: Values from source stream update state
- **Synchronous**: State updates are immediate
- **Dependency tracking**: Works with `effect()` for automatic reactivity

## Use Cases

### 1. Basic State

```typescript
const counter = new Stream<number>().pipe(state(0));

counter.listen((value) => console.log(value));

counter.state.value = 5; // Logs: 5
console.log(counter.state.value); // 5
```

### 2. UI State

```typescript
const user = new Stream<User | null>().pipe(state(null));

user.listen((u) => {
  if (u) {
    document.querySelector(".user-name")!.textContent = u.name;
  }
});

user.state.value = { name: "Alice", email: "alice@example.com" };
```

### 3. Derived State

```typescript
const count = new Stream<number>().pipe(state(0));
const doubled = count.pipe(map((n) => n * 2)).pipe(state(0));

doubled.listen((value) => console.log("Doubled:", value));

count.state.value = 5; // Logs: "Doubled: 10"
```

### 4. Reactive Effects

```typescript
import { effect } from "@soffinal/stream";

const counter = new Stream<number>().pipe(state(0));
const user = new Stream<string>().pipe(state("Alice"));

// Auto-tracks dependencies
const cleanup = effect(() => {
  console.log(`${user.state.value}: ${counter.state.value}`);
});

counter.state.value = 5; // Logs: "Alice: 5"
user.state.value = "Bob"; // Logs: "Bob: 5"

cleanup(); // Stop effect
```

## Composition

```typescript
// State + Gate
const gatedState = new Stream<number>().pipe(state(0)).pipe(gate());

gatedState.state.value = 5; // Emits if gate is open
gatedState.gate.close();
gatedState.state.value = 10; // Blocked by gate

// State + Filter
const filtered = new Stream<number>().pipe(state(0)).pipe(filter((n) => n > 0));

filtered.state.value = -5; // Filtered out
filtered.state.value = 5; // Passes through
```

## Bypass Pattern

Direct `.push()` bypasses state updates:

```typescript
const status = new Stream<string>().pipe(state("idle"));

status.listen((s) => console.log(s));

status.state.value = "loading"; // State becomes "loading", logs "loading"
status.push("Retrying..."); // Logs "Retrying...", state stays "loading"

console.log(status.state.value); // "loading"
```

**Use cases:** Temporary notifications, loading indicators, validation messages.

## Performance

- **Overhead**: Minimal - just getter/setter
- **Synchronous**: No async delays
- **Memory**: O(1) - stores single value

## Related

- [gate](../gate/gate.md) - Manual flow control
- [cache](../cache/cache.md) - Store multiple values
- [effect](../effect/effect.md) - Reactive side effects
