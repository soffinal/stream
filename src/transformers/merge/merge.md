# Merge Transformer

## Temporal Orchestration

The `merge` transformer combines multiple streams into one unified flow while preserving temporal order - like conducting multiple instruments into a single symphony.

**Core Concept**: Multiple streams → One unified stream with union types

## Usage

```typescript
stream.pipe(merge(...otherStreams));
```

- **Input**: `Stream<T>` + `Stream<U>[]`
- **Output**: `Stream<T | U>`
- **Order**: Maintains chronological sequence across all streams

## Basic Example

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
// Output: 1, 2, "a", "b" (in temporal order)
```

## Multiple Streams

```typescript
const events = new Stream<Event>();
const errors = new Stream<Error>();
const logs = new Stream<LogEntry>();

const allActivity = events.pipe(merge(errors, logs));
// Type: Stream<Event | Error | LogEntry>

// All streams flow into one unified timeline
```

## Type Safety

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
    case "user" /* handle user event */:
      break;
    case "system" /* handle system event */:
      break;
  }
});
```
