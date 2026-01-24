# Composable Patterns

Build your own transformers from primitives. All patterns are tested and ready to copy-paste.

**22 patterns available**

## Quick Reference

- [audit](#audit) - Emit first value, then ignore until quiet period
- [combineLatest](#combineLatest) - Sync latest from multiple streams
- [debounce](#debounce) - Delay emissions until quiet period
- [delay](#delay) - Delay each emission
- [distinct](#distinct) - Remove duplicate values
- [first](#first) - Emit only first value
- [partition](#partition) - Partition into two streams
- [pluck](#pluck) - Extract object property
- [replay](#replay) - Replay cached values to late subscribers
- [sample](#sample) - Sample on another stream
- [scan](#scan) - Accumulate values over time (like Array.reduce but emits each step)
- [skip](#skip) - Skip first N values
- [skipWhile](#skipWhile) - Skip while condition is true
- [startWith](#startWith) - Prepend initial values
- [take](#take) - Take first N values
- [takeUntil](#takeUntil) - Take until notifier stream emits
- [takeWhile](#takeWhile) - Take while condition is true
- [tap](#tap) - Side effects without transformation
- [throttle](#throttle) - Rate limit emissions - emit at most once per time period
- [timeout](#timeout) - Emit error if no value within time period
- [window](#window) - Collect values into time-based windows
- [withIndex](#withIndex) - Add index to values

---

## audit

Emit first value, then ignore until quiet period

**Usage:**

```typescript
stream.pipe(audit(300)) // Emit first, ignore for 300ms
```

**Implementation:**

```typescript
export const audit = <T>(ms: number) => (source: Stream<T>) => {
  const output = new Stream<T>(async function* () {
    let timer: any = null;
    let canEmit = true;

    for await (const value of source) {
      if (canEmit) {
        output.push(value);
        canEmit = false;
        clearTimeout(timer);
        timer = setTimeout(() => (canEmit = true), ms);
      }
    }
  });

  return output;
};
```

---

## combineLatest

Sync latest from multiple streams

**Usage:**

```typescript
stream.pipe(combineLatest())
```

**Implementation:**

```typescript
export const combineLatest = <T, U>(other: Stream<U>) => (source: Stream<T>) =>
  source.pipe(cache({ maxSize: 1 })).pipe(zip(other.pipe(cache({ maxSize: 1 }))));
```

---

## debounce

Delay emissions until quiet period

**Usage:**

```typescript
stream.pipe(debounce())
```

**Implementation:**

```typescript
export const debounce =
  <T>(ms: number) =>
  (source: Stream<T>) => {
    const output = new Stream<T>(async function* () {
      let timer: any = null;

      for await (const value of source) {
        clearTimeout(timer);
        timer = setTimeout(() => output.push(value), ms);
      }
    });

    return output;
  };
```

---

## delay

Delay each emission

**Usage:**

```typescript
stream.pipe(delay())
```

**Implementation:**

```typescript
export const delay = <T>(ms: number) => (source: Stream<T>) =>
  new Stream<T>(async function* () {
    for await (const value of source) {
      await new Promise(resolve => setTimeout(resolve, ms));
      yield value;
    }
  });
```

---

## distinct

Remove duplicate values

**Usage:**

```typescript
stream.pipe(distinct())
```

**Implementation:**

```typescript
export const distinct = <T>() =>
  filter<T, { seen: Set<T> }>({ seen: new Set() }, (state, value) => {
    if (state.seen.has(value)) return [false, state];
    state.seen.add(value);
    return [true, state];
  });

```

---

## first

Emit only first value

**Usage:**

```typescript
stream.pipe(first())
```

**Implementation:**

```typescript
export const first = <T>() => take<T>(1);

```

---

## partition

Partition into two streams

**Usage:**

```typescript
stream.pipe(partition())
```

**Implementation:**

```typescript
export const partition = <T>(predicate: (value: T) => boolean) => (source: Stream<T>) => {
  const pass = source.pipe(filter(predicate));
  const fail = source.pipe(filter((v) => !predicate(v)));
  return [pass, fail] as const;
};

```

---

## pluck

Extract object property

**Usage:**

```typescript
stream.pipe(pluck())
```

**Implementation:**

```typescript
export const pluck = <T, K extends keyof T>(key: K) =>
  map<T, {}, T[K]>({}, (_, value) => [value[key], {}]);

```

---

## replay

Replay cached values to late subscribers

**Usage:**

```typescript
stream.pipe(replay({ maxSize: 10 }))
```

**Implementation:**

```typescript
export function replay<T>(options?: CacheOptions<T>): Stream.Transformer<Stream<T>, Stream<T>> {
  return (source: Stream<T>) => {
    const cached = source.pipe(cache(options));
    const originalListen = cached.listen.bind(cached);
    cached.listen = ((listener: (value: T) => void, context?: any) => {
      cached.cache.values.forEach((v) => listener(v));
      return originalListen(listener, context);
    }) as typeof cached.listen;
    return cached;
  };
}
```

---

## sample

Sample on another stream

**Usage:**

```typescript
stream.pipe(sample())
```

**Implementation:**

```typescript
export const sample = <T>(sampler: Stream<any>) => (source: Stream<T>) =>
  new Stream<T>(async function* () {
    let latest: T | undefined;
    source.listen((value) => (latest = value));
    for await (const _ of sampler) {
      if (latest !== undefined) yield latest;
    }
  });

```

---

## scan

Accumulate values over time (like Array.reduce but emits each step)

**Usage:**

```typescript
stream.pipe(scan())
```

**Implementation:**

```typescript
export const scan = <T, U>(fn: (acc: U, value: T) => U, initial: U) =>
  map<T, { acc: U }, U>({ acc: initial }, (state, value) => {
    const newAcc = fn(state.acc, value);
    return [newAcc, { acc: newAcc }];
  });

```

---

## skip

Skip first N values

**Usage:**

```typescript
stream.pipe(skip())
```

**Implementation:**

```typescript
export const skip = <T>(n: number) =>
  filter<T, { count: number }>({ count: 0 }, (state, value) => {
    const newCount = state.count + 1;
    return [newCount > n, { count: newCount }];
  });

```

---

## skipWhile

Skip while condition is true

**Usage:**

```typescript
stream.pipe(skipWhile())
```

**Implementation:**

```typescript
export const skipWhile = <T>(predicate: (value: T) => boolean) =>
  filter<T, { skipping: boolean }>({ skipping: true }, (state, value) => {
    if (state.skipping && !predicate(value)) {
      return [true, { skipping: false }];
    }
    return [!state.skipping, state];
  });

```

---

## startWith

Prepend initial values

**Usage:**

```typescript
stream.pipe(startWith())
```

**Implementation:**

```typescript
export const startWith = <T>(...values: T[]) => (source: Stream<T>) =>
  source.pipe(replay({ initialValues: values }));
```

---

## take

Take first N values

**Usage:**

```typescript
stream.pipe(take())
```

**Implementation:**

```typescript
export const take = <T>(n: number) =>
  filter<T, { count: number }>({ count: 0 }, (state, value) => {
    if (state.count >= n) return;
    return [true, { count: state.count + 1 }];
  });

```

---

## takeUntil

Take until notifier stream emits

**Usage:**

```typescript
stream.pipe(takeUntil())
```

**Implementation:**

```typescript
export const takeUntil = <T>(notifier: Stream<any>) => (source: Stream<T>) =>
  new Stream<T>(async function* () {
    let stopped = false;
    notifier.listen(() => (stopped = true));
    for await (const value of source) {
      if (stopped) break;
      yield value;
    }
  });

```

---

## takeWhile

Take while condition is true

**Usage:**

```typescript
stream.pipe(takeWhile())
```

**Implementation:**

```typescript
export const takeWhile = <T>(predicate: (value: T) => boolean) =>
  filter<T, {}>({}, (_, value) => {
    if (!predicate(value)) return;
    return [true, {}];
  });

```

---

## tap

Side effects without transformation

**Usage:**

```typescript
stream.pipe(tap())
```

**Implementation:**

```typescript
export const tap = <T>(fn: (value: T) => void | Promise<void>) =>
  map<T, T>(async (value) => {
    await fn(value);
    return value;
  });
```

---

## throttle

Rate limit emissions - emit at most once per time period

**Usage:**

```typescript
stream.pipe(throttle())
```

**Implementation:**

```typescript
export const throttle = <T>(ms: number) =>
  filter<T, { lastEmit: number }>({ lastEmit: 0 }, (state, value) => {
    const now = Date.now();
    if (now - state.lastEmit < ms) return [false, state];
    return [true, { lastEmit: now }];
  });

```

---

## timeout

Emit error if no value within time period

**Usage:**

```typescript
stream.pipe(timeout(1000, new Error('Timeout')))
```

**Implementation:**

```typescript
export const timeout = <T>(ms: number, error: Error = new Error('Timeout')) => (source: Stream<T>) =>
  new Stream<T>(async function* () {
    let timer: any = null;
    let timedOut = false;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timedOut = true;
        throw error;
      }, ms);
    };

    resetTimer();

    try {
      for await (const value of source) {
        if (timedOut) break;
        resetTimer();
        yield value;
      }
    } finally {
      clearTimeout(timer);
    }
  });
```

---

## window

Collect values into time-based windows

**Usage:**

```typescript
stream.pipe(window(1000)) // Emit array every 1 second
```

**Implementation:**

```typescript
export const window = <T>(ms: number) => (source: Stream<T>) => {
  const output = new Stream<T[]>(async function* () {
    let buffer: T[] = [];
    let timer: any = null;

    const flush = () => {
      if (buffer.length > 0) {
        output.push([...buffer]);
        buffer = [];
      }
    };

    timer = setInterval(flush, ms);

    for await (const value of source) {
      buffer.push(value);
    }

    clearInterval(timer);
    flush(); // Emit remaining values
  });

  return output;
};
```

---

## withIndex

Add index to values

**Usage:**

```typescript
stream.pipe(withIndex())
```

**Implementation:**

```typescript
export const withIndex = <T>() =>
  map<T, { index: number }, { value: T; index: number }>(
    { index: 0 },
    (state, value) => [
      { value, index: state.index },
      { index: state.index + 1 }
    ]
  );

```

---

