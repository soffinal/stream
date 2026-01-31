# snapshot

Captures all current capabilities under a named property, creating a capability history tree.

## Usage

```typescript
import { Stream } from "@soffinal/stream";
import { state, snapshot, map, gate } from "@soffinal/stream/transformers";

const s = new Stream<number>()
  .pipe(state(0))
  .pipe(snapshot("v1"))
  .pipe(map(v => v * 2))
  .pipe(state(0))
  .pipe(snapshot("v2"));

// Access capabilities at different points
s.state.value = 100;      // Current state
s.v1.state.value = 10;    // v1 state
s.v2.state.value = 50;    // v2 state
s.v2.v1.state.value = 10; // v1 through v2
```

## Type Signature

```typescript
function snapshot<NAME extends string>(
  name: NAME
): <INPUT extends Stream<any>>(
  source: INPUT
) => INPUT & { [K in NAME]: Prettify<Omit<INPUT, keyof Stream<any>>> }
```

## Features

### Capability Preservation

Captures all capabilities at the point of snapshot:

```typescript
const s = new Stream<number>()
  .pipe(state(0))
  .pipe(gate())
  .pipe(snapshot("checkpoint"));

s.checkpoint.state.value = 42;
s.checkpoint.gate.close();
```

### Nested Snapshots

Creates a capability tree where each snapshot contains all previous snapshots:

```typescript
const s = new Stream<number>()
  .pipe(state(0))
  .pipe(snapshot("v1"))
  .pipe(map(v => v * 2))
  .pipe(state(0))
  .pipe(snapshot("v2"))
  .pipe(map(v => v + 10))
  .pipe(state(0))
  .pipe(snapshot("v3"));

// Capability tree:
// s
// ├── state (current)
// ├── v1 { state }
// ├── v2 { state, v1 { state } }
// └── v3 { state, v2 { state, v1 { state } } }

s.v3.v2.v1.state.value = 5; // Access v1 through v3
```

### Type Safety

TypeScript infers the complete capability structure:

```typescript
const s: Stream<number> & {
    state: State<number>;
    v1: {
        state: State<number>;
    };
    v2: {
        state: State<number>;
        v1: {
            state: State<number>;
        };
    };
}
```

## Use Cases

### Version Control

```typescript
const pipeline = new Stream<Data>()
  .pipe(state(initialData))
  .pipe(snapshot("draft"))
  .pipe(validate())
  .pipe(state(initialData))
  .pipe(snapshot("validated"))
  .pipe(publish())
  .pipe(state(initialData))
  .pipe(snapshot("published"));

// Access different versions
pipeline.draft.state.value      // Draft version
pipeline.validated.state.value  // Validated version
pipeline.published.state.value  // Published version
```

### Time-Travel Debugging

```typescript
const s = new Stream<Event>()
  .pipe(cache())
  .pipe(snapshot("t1"))
  .pipe(process())
  .pipe(cache())
  .pipe(snapshot("t2"))
  .pipe(transform())
  .pipe(cache())
  .pipe(snapshot("t3"));

// Replay from any point
console.log(s.t1.cache.values); // Events at t1
console.log(s.t2.cache.values); // Events at t2
console.log(s.t3.cache.values); // Events at t3
```

### Rollback

```typescript
const s = new Stream<number>()
  .pipe(state(0))
  .pipe(snapshot("checkpoint"))
  .pipe(map(v => v * 2))
  .pipe(state(0));

s.state.value = 100;

// Rollback to checkpoint
s.state.value = s.checkpoint.state.value;
```

### Multi-Level Control

```typescript
const flow = new Stream<Event>()
  .pipe(gate())
  .pipe(snapshot("master"))
  .pipe(filter(x => x.valid))
  .pipe(gate())
  .pipe(snapshot("filtered"))
  .pipe(map(x => x.data))
  .pipe(gate());

// Control at different levels
flow.master.gate.close();    // Close master gate
flow.filtered.gate.close();  // Close filtered gate
flow.gate.close();           // Close current gate
```

## How It Works

1. **Captures capabilities**: Extracts all non-Stream properties from source
2. **Creates named property**: Adds snapshot under specified name
3. **Preserves everything**: All capabilities (including previous snapshots) are captured
4. **Type inference**: TypeScript tracks the complete capability tree

## Key Insight

Snapshots create a **capability history tree** where each snapshot contains all previous snapshots. This enables:

- Version control
- Time-travel debugging
- Rollback/replay
- Multi-level state management
- Capability history

**With one primitive (snapshot), complexity disappears. It's just composition.**
