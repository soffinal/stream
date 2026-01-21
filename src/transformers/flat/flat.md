# Flat Transformer

## Event Multiplication

The `flat` transformer converts array events into individual events - essentially `Array.prototype.flat()` for streams.

**Core Concept**: 1 array event → N individual events

## Usage

```typescript
stream.pipe(flat(depth?));
```

- **Input**: `Stream<T[]>`
- **Output**: `Stream<T>`
- **Transformation**: Each array becomes separate events

## Basic Example

```typescript
const arrayStream = new Stream<number[]>();
const flattened = arrayStream.pipe(flat());

arrayStream.push([1, 2, 3]);
// Emits: 1, 2, 3 as separate events

flattened.listen((value) => console.log(value));
// Logs: 1, 2, 3
```

## Depth Control

```typescript
const nested = new Stream<number[][]>();
const flattened = nested.pipe(flat(1)); // Flatten 2 levels

nested.push([
  [1, 2],
  [3, 4],
]);
// Emits: 1, 2, 3, 4 as separate events
```

## Common Pattern

```typescript
// Map then flatten
const sentences = new Stream<string>();
const characters = sentences.pipe(map({}, (_, s) => [s.split(""), {}])).pipe(flat());

sentences.push("hello");
// Emits: 'h', 'e', 'l', 'l', 'o' as separate events
```

That's it. Simple event multiplication for arrays.
