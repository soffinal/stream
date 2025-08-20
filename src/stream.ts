export type ValueOf<STREAM> = STREAM extends Stream<infer VALUE> ? VALUE : never;

/**
 * A reactive streaming library that provides async-first data structures with built-in event streams.
 *
 * @template VALUE - The type of values that flow through the stream
 *
 * @example
 * ```typescript
 * // Basic usage
 * const stream = new Stream<number>();
 * stream.listen(value => console.log(value));
 * stream.push(1, 2, 3);
 *
 * // With async generator
 * const timerStream = new Stream(async function* () {
 *   let count = 0;
 *   while (count < 5) {
 *     yield count++;
 *     await new Promise(resolve => setTimeout(resolve, 1000));
 *   }
 * });
 *
 * // Async iteration
 * for await (const value of stream) {
 *   console.log(value);
 *   if (value === 10) break;
 * }
 * ```
 */
export class Stream<VALUE = unknown> implements AsyncIterable<VALUE> {
  protected _listeners = new Set<(value: VALUE) => void>();
  protected _generatorFn: (() => AsyncGenerator<VALUE, void>) | undefined;
  protected _generator: AsyncGenerator<VALUE, void> | undefined;
  protected _listenerAdded: Stream<void> | undefined;
  protected _listenerRemoved: Stream<void> | undefined;
  /**
   * Creates a new Stream instance.
   *
   * @param generatorFn - Optional async generator function to produce values you can use it for creating stream with custom transformation
   *
   * @example
   * ```typescript
   * // Empty stream
   * const stream = new Stream<string>();
   *
   * // Stream with generator
   * const countdown = new Stream(async function* () {
   *   for (let i = 5; i > 0; i--) {
   *     yield i;
   *     await new Promise(resolve => setTimeout(resolve, 1000));
   *   }
   * });
   *
   * // Stream with custom transformer
   * function filter<VALUE>(source:Stream<VALUE>,predicate:(value:VALUE) => boolean):Stream<VALUE>{
   *  return new Stream<VALUE>(async function* () {
   *   for await (const value of source) {
   *     if (predicate(value)) yield value ;
   *   }
   *  });
   * }
   * const source = new Stream<number>();
   * const even = filter(source,v=> v % 2 === 0)
   * even.listen(console.log);
   * source.push(1, 2, 3, 4); // 2,4
   * ```
   */
  constructor();
  constructor(generatorFn: () => AsyncGenerator<VALUE, void>);
  constructor(generatorFn?: () => AsyncGenerator<VALUE, void>) {
    this._generatorFn = generatorFn;
  }
  /**
   * Returns true if the stream has active listeners.
   *
   * @example
   * ```typescript
   * const stream = new Stream<number>();
   * console.log(stream.hasListeners); // false
   *
   * const cleanup = stream.listen(value => console.log(value));
   * console.log(stream.hasListeners); // true
   *
   * cleanup();
   * console.log(stream.hasListeners); // false
   * ```
   */
  get hasListeners() {
    return this._listeners.size > 0;
  }
  /**
   * Stream that emits when a listener is added.
   *
   * @example
   * ```typescript
   * const stream = new Stream<number>();
   * stream.listenerAdded.listen(() => console.log('Listener added'));
   *
   * stream.listen(value => console.log(value)); // Triggers 'Listener added'
   * ```
   */
  get listenerAdded() {
    if (!this._listenerAdded) this._listenerAdded = new Stream<void>();
    return this._listenerAdded;
  }
  /**
   * Stream that emits when a listener is removed.
   *
   * @example
   * ```typescript
   * const stream = new Stream<number>();
   * stream.listenerRemoved.listen(() => console.log('Listener removed'));
   *
   * const cleanup = stream.listen(value => console.log(value));
   * cleanup(); // Triggers 'Listener removed'
   * ```
   */
  get listenerRemoved() {
    if (!this._listenerRemoved) this._listenerRemoved = new Stream<void>();
    return this._listenerRemoved;
  }
  async *[Symbol.asyncIterator](): AsyncGenerator<VALUE, void> {
    const queue: VALUE[] = [];
    let resolver: Function | undefined;

    const abort = this.listen((value) => {
      queue.push(value);
      resolver?.();
    });

    try {
      while (true) {
        if (queue.length) yield queue.shift()!;
        else await new Promise<void>((resolve) => (resolver = resolve));
      }
    } finally {
      abort();
      queue.length = 0;
      resolver = undefined;
      return;
    }
  }
  /**
   * Pushes one or more values to all listeners.
   *
   * @param value - The first value to push
   * @param values - Additional values to push
   *
   * @example
   * ```typescript
   * const stream = new Stream<number>();
   * stream.listen(value => console.log('Received:', value));
   *
   * stream.push(1); // Received: 1
   * stream.push(2, 3, 4); // Received: 2, Received: 3, Received: 4
   * ```
   */
  push(value: VALUE, ...values: VALUE[]) {
    values.unshift(value);
    for (const value of values) {
      for (const listener of this._listeners) {
        listener(value);
      }
    }
  }
  /**
   * Adds a listener to the stream.
   *
   * @param listener - Function to call when values are pushed
   * @param signal - Optional AbortSignal for cleanup
   * @returns Cleanup function to remove the listener
   *
   * @example
   * ```typescript
   * const stream = new Stream<string>();
   *
   * // Basic listener
   * const cleanup = stream.listen(value => console.log(value));
   *
   * // With AbortSignal
   * const controller = new AbortController();
   * stream.listen(value => console.log(value), controller.signal);
   * controller.abort(); // Removes listener
   *
   * // Manual cleanup
   * cleanup();
   * ```
   */
  listen(listener: (value: VALUE) => void, signal?: AbortSignal): () => void {
    if (signal?.aborted) return () => {};
    const self = this;

    signal?.addEventListener("abort", abort);

    self._listeners.add(listener);

    self._listenerAdded?.push();

    if (self._generatorFn && self._listeners.size === 1) {
      self._generator = self._generatorFn();
      (async () => {
        for await (const value of self._generator!) {
          self.push(value);
        }
      })();
    }
    return abort;
    function abort() {
      self._listeners.delete(listener);
      self._listenerRemoved?.push();
      if (self._listeners.size === 0) {
        self._generator?.return();
        self._generator = undefined;
      }
      signal?.removeEventListener("abort", abort);
    }
  }
  /**
   * Promise-like interface that resolves with the next value.
   *
   * @param onfulfilled - Optional transformation function
   * @returns Promise that resolves with the first value
   *
   * @example
   * ```typescript
   * const stream = new Stream<number>();
   *
   * setTimeout(()=>{
   *  stream.push(5);
   * })
   * // Wait for first value
   * const firstValue = await stream; // Resolves promises with 5
   *
   *
   * ```
   */
  then(onfulfilled?: ((value: VALUE) => VALUE | PromiseLike<VALUE>) | null): Promise<VALUE> {
    return new Promise<VALUE>((resolve) => {
      const abort = this.listen((value) => {
        resolve(value);
        abort();
      });
    }).then(onfulfilled);
  }
  /**
   * Filters values based on a predicate function.
   *
   * @param predicate - Function to test each value
   * @returns New stream with filtered values
   *
   * @example
   * ```typescript
   * const numbers = new Stream<number>();
   * const evens = numbers.filter(n => n % 2 === 0);
   *
   * evens.listen(n => console.log('Even:', n));
   * numbers.push(1, 2, 3, 4); // Even: 2, Even: 4
   *
   * // With accumulator
   * const increasing = numbers.filter(0, (prev, curr) =>
   *   [curr > prev, Math.max(prev, curr)]
   * );
   * ```
   */
  filter<FILTERED extends VALUE>(predicate: (value: VALUE) => value is FILTERED): Stream<FILTERED>;
  filter<FILTERED extends VALUE>(predicate: (value: VALUE) => boolean | Promise<boolean>): Stream<FILTERED>;
  filter<FILTERED extends VALUE, ACC>(
    initialValue: ACC,
    predicate: (accumulator: ACC, value: VALUE) => [boolean, ACC] | Promise<[boolean, ACC]>
  ): Stream<FILTERED>;
  filter(predicateOrInitial: any, predicate?: any): Stream<VALUE> {
    const source = this;
    if (typeof predicateOrInitial === "function") {
      return new Stream<VALUE>(async function* () {
        for await (const value of source) {
          if (await predicateOrInitial(value)) yield value;
        }
      });
    } else {
      return new Stream<VALUE>(async function* () {
        let accumulator = predicateOrInitial;
        for await (const value of source) {
          const [shouldPass, newAcc] = await predicate(accumulator, value);
          accumulator = newAcc;
          if (shouldPass) yield value;
        }
      });
    }
  }
  /**
   * Transforms values using a mapper function.
   *
   * @param mapper - Function to transform each value
   * @returns New stream with transformed values
   *
   * @example
   * ```typescript
   * const numbers = new Stream<number>();
   * const doubled = numbers.map(n => n * 2);
   *
   * doubled.listen(n => console.log('Doubled:', n));
   * numbers.push(1, 2, 3); // Doubled: 2, Doubled: 4, Doubled: 6
   *
   * // With accumulator (running sum)
   * const sums = numbers.map(0, (sum, n) => [sum + n, sum + n]);
   * ```
   */
  map<MAPPED>(mapper: (value: VALUE) => MAPPED | Promise<MAPPED>): Stream<MAPPED>;
  map<MAPPED, ACC>(
    initialValue: ACC,
    mapper: (accumulator: ACC, value: VALUE) => [MAPPED, ACC] | Promise<[MAPPED, ACC]>
  ): Stream<MAPPED>;
  map(mapperOrInitial: any, mapper?: any): Stream<any> {
    const source = this;
    if (typeof mapperOrInitial === "function") {
      return new Stream(async function* () {
        for await (const value of source) {
          yield await mapperOrInitial(value);
        }
      });
    } else {
      return new Stream(async function* () {
        let accumulator = mapperOrInitial;
        for await (const value of source) {
          const [mapped, newAcc] = await mapper(accumulator, value);
          accumulator = newAcc;
          yield mapped;
        }
      });
    }
  }
  /**
   * Groups values into batches based on a predicate.
   *
   * @param predicate - Function to determine when to emit a group
   * @returns New stream with grouped values
   *
   * @example
   * ```typescript
   * const numbers = new Stream<number>();
   * const batches = numbers.group(batch => batch.length === 3);
   *
   * batches.listen(batch => console.log('Batch:', batch));
   * numbers.push(1, 2, 3, 4, 5, 6); // Batch: [1,2,3], Batch: [4,5,6]
   *
   * // With accumulator (sum-based grouping)
   * const sumGroups = numbers.group(0, (sum, n) =>
   *   sum + n >= 10 ? [true, 0] : [false, sum + n]
   * );
   * ```
   */
  group(predicate: (accumulator: VALUE[], value: VALUE) => boolean | Promise<boolean>): Stream<VALUE[]>;
  group<ACC>(
    initialValue: ACC,
    predicate: (accumulator: ACC, value: VALUE) => [boolean, ACC] | Promise<[boolean, ACC]>
  ): Stream<ACC>;
  group(predicateOrInitial: any, predicate?: any): Stream<any> {
    const source = this;
    if (typeof predicateOrInitial === "function") {
      return new Stream(async function* () {
        const accumulator: VALUE[] = [];
        for await (const value of source) {
          accumulator.push(value);
          if (await predicateOrInitial([...accumulator], value)) {
            yield [...accumulator];
            accumulator.length = 0;
          }
        }
      });
    } else {
      return new Stream(async function* () {
        let accumulator = predicateOrInitial;
        for await (const value of source) {
          const [shouldEmit, newAcc] = await predicate(accumulator, value);
          if (shouldEmit) {
            yield accumulator;
            accumulator = predicateOrInitial; // Reset to initial
          } else {
            accumulator = newAcc;
          }
        }
      });
    }
  }
  /**
   * Merges this stream with other streams.
   *
   * @param streams - Other streams to merge with
   * @returns New stream with values from all streams
   *
   * @example
   * ```typescript
   * const stream1 = new Stream<string>();
   * const stream2 = new Stream<number>();
   * const merged = stream1.merge(stream2);
   *
   * merged.listen(msg => console.log('Merged:', msg));
   *
   * stream1.push('from stream1');
   * stream2.push(42);
   * // Output: Merged: from stream1,  Merged: 42
   * ```
   */
  merge<STREAMS extends [Stream<any>, ...Stream<any>[]]>(
    ...streams: STREAMS
  ): Stream<VALUE | ValueOf<STREAMS[number]>> {
    const source = this;
    return new Stream(async function* () {
      const queue: any[] = [];
      let resolver: Function;
      let activeStreams = streams.length + 1;

      async function consume(_generator: AsyncGenerator<any, void>) {
        try {
          for await (const value of _generator) {
            queue.push(value);
            resolver?.();
          }
        } finally {
          activeStreams--;
          resolver?.();
        }
      }

      const generators = [source, ...streams].map((stream) => {
        const _generator = stream[Symbol.asyncIterator]();
        consume(_generator);
        return _generator;
      });
      try {
        while (activeStreams > 0 || queue.length > 0) {
          if (queue.length > 0) {
            yield queue.shift()!;
          } else {
            await new Promise<void>((resolve) => (resolver = resolve));
          }
        }
      } finally {
        for (const _generator of generators) {
          await _generator.return();
        }
      }
    });
  }
  /**
   * Flattens array values in the stream.
   *
   * @param depth - Depth to flatten (default: 0)
   * @returns New stream with flattened values
   *
   * @example
   * ```typescript
   * const arrays = new Stream<number[]>();
   * const flattened = arrays.flat();
   *
   * flattened.listen(n => console.log('Flat:', n));
   * arrays.push([1, 2], [3, 4]); // Flat: 1, Flat: 2, Flat: 3, Flat: 4
   *
   * // Deep flattening
   * const nested = new Stream<number[][][]>();
   * const deepFlat = nested.flat(2);
   * ```
   */
  flat<DEPTH extends number = 0>(depth: DEPTH = 0 as DEPTH): Stream<FlatArray<VALUE, DEPTH>> {
    const source = this;
    return new Stream<FlatArray<VALUE, DEPTH>>(async function* () {
      for await (const value of source) {
        if (Array.isArray(value)) {
          const values = value.flat(depth);
          for (let i = 0; i < values.length; i++) {
            yield values[i]!;
          }
        } else {
          yield value as FlatArray<VALUE, DEPTH>;
        }
      }
    });
  }

  /**
   * Applies a transformer function to this stream, enabling functional composition.
   * 
   * @param transformer - Function that takes a stream and returns a transformed stream
   * @returns New stream with the transformation applied
   * 
   * @example
   * ```typescript
   * const numbers = new Stream<number>();
   * 
   * // Using built-in transformers
   * const result = numbers
   *   .pipe(filter(n => n > 0))
   *   .pipe(map(n => n * 2))
   *   .pipe(group(batch => batch.length >= 3));
   * 
   * // Custom transformer
   * const throttle = <T>(ms: number) => (stream: Stream<T>) => 
   *   new Stream<T>(async function* () {
   *     let lastEmit = 0;
   *     for await (const value of stream) {
   *       const now = Date.now();
   *       if (now - lastEmit >= ms) {
   *         yield value;
   *         lastEmit = now;
   *       }
   *     }
   *   });
   * 
   * numbers.pipe(throttle(1000));
   * ```
   */
  pipe<OUTPUT>(transformer: (stream: Stream<VALUE>) => Stream<OUTPUT>): Stream<OUTPUT> {
    return transformer(this);
  }
}

/**
 * Transformer function interface for mapping stream values.
 * Supports both simple mapping and stateful mapping with accumulators.
 */
export interface MapFunction {
  <VALUE, MAPPED>(mapper: (value: VALUE) => MAPPED | Promise<MAPPED>): (stream: Stream<VALUE>) => Stream<MAPPED>;
  <VALUE, MAPPED, ACC>(
    initialValue: ACC,
    mapper: (accumulator: ACC, value: VALUE) => [MAPPED, ACC] | Promise<[MAPPED, ACC]>
  ): (stream: Stream<VALUE>) => Stream<MAPPED>;
}

/**
 * Creates a map transformer for use with pipe().
 * 
 * @param mapper - Function to transform each value, or initial accumulator value
 * @param mapper - Optional mapper function when using accumulator
 * @returns Transformer function for pipe()
 * 
 * @example
 * ```typescript
 * const numbers = new Stream<number>();
 * 
 * // Simple mapping
 * const doubled = numbers.pipe(map(n => n * 2));
 * 
 * // Stateful mapping (running sum)
 * const sums = numbers.pipe(map(0, (sum, n) => [sum + n, sum + n]));
 * 
 * // Async mapping
 * const enriched = numbers.pipe(map(async n => {
 *   const data = await fetchData(n);
 *   return { value: n, data };
 * }));
 * ```
 */
export const map: MapFunction =
  <VALUE>(mapperOrInitial: any, mapper?: any) =>
  (stream: Stream<VALUE>) => {
    if (mapper) {
      return stream.map(mapperOrInitial, mapper);
    } else {
      return stream.map(mapperOrInitial);
    }
  };

/**
 * Transformer function interface for filtering stream values.
 * Supports type guards, boolean predicates, and stateful filtering.
 */
export interface FilterFunction {
  <VALUE, FILTERED extends VALUE>(predicate: (value: VALUE) => value is FILTERED): (
    stream: Stream<VALUE>
  ) => Stream<FILTERED>;
  <VALUE>(predicate: (value: VALUE) => boolean | Promise<boolean>): (stream: Stream<VALUE>) => Stream<VALUE>;
  <VALUE, ACC>(
    initialValue: ACC,
    predicate: (accumulator: ACC, value: VALUE) => [boolean, ACC] | Promise<[boolean, ACC]>
  ): (stream: Stream<VALUE>) => Stream<VALUE>;
}

/**
 * Creates a filter transformer for use with pipe().
 * 
 * @param predicate - Function to test each value, or initial accumulator value
 * @param predicate - Optional predicate function when using accumulator
 * @returns Transformer function for pipe()
 * 
 * @example
 * ```typescript
 * const numbers = new Stream<number>();
 * 
 * // Simple filtering
 * const positives = numbers.pipe(filter(n => n > 0));
 * 
 * // Type guard filtering
 * const strings = mixed.pipe(filter((x): x is string => typeof x === 'string'));
 * 
 * // Stateful filtering (only increasing values)
 * const increasing = numbers.pipe(filter(0, (prev, curr) => 
 *   [curr > prev, Math.max(prev, curr)]
 * ));
 * ```
 */
export const filter: FilterFunction =
  <VALUE>(predicateOrInitial: any, predicate?: any) =>
  (stream: Stream<VALUE>) => {
    if (predicate) {
      return stream.filter(predicateOrInitial, predicate);
    } else {
      return stream.filter(predicateOrInitial);
    }
  };

/**
 * Transformer function interface for grouping stream values into batches.
 * Supports both simple batching and stateful grouping with accumulators.
 */
export interface GroupFunction {
  <VALUE>(predicate: (accumulator: VALUE[], value: VALUE) => boolean | Promise<boolean>): (
    stream: Stream<VALUE>
  ) => Stream<VALUE[]>;
  <VALUE, ACC>(
    initialValue: ACC,
    predicate: (accumulator: ACC, value: VALUE) => [boolean, ACC] | Promise<[boolean, ACC]>
  ): (stream: Stream<VALUE>) => Stream<ACC>;
}

/**
 * Creates a group transformer for use with pipe().
 * 
 * @param predicate - Function to determine when to emit a group, or initial accumulator value
 * @param predicate - Optional predicate function when using accumulator
 * @returns Transformer function for pipe()
 * 
 * @example
 * ```typescript
 * const numbers = new Stream<number>();
 * 
 * // Group by count
 * const batches = numbers.pipe(group(batch => batch.length >= 5));
 * 
 * // Group by sum
 * const sumGroups = numbers.pipe(group(0, (sum, n) => 
 *   sum + n >= 100 ? [true, 0] : [false, sum + n]
 * ));
 * 
 * // Time-based grouping
 * const timeGroups = events.pipe(group([], (window, event) => {
 *   const now = Date.now();
 *   const recent = window.filter(e => now - e.timestamp < 5000);
 *   return [recent.length >= 10, [...recent, event]];
 * }));
 * ```
 */
export const group: GroupFunction =
  <VALUE>(predicateOrInitial: any, predicate?: any) =>
  (stream: Stream<VALUE>) => {
    if (predicate) {
      return stream.group(predicateOrInitial, predicate);
    } else {
      return stream.group(predicateOrInitial);
    }
  };

/**
 * Transformer function interface for merging multiple streams.
 * Combines values from all streams into a single output stream.
 */
export interface MergeFunction {
  <STREAMS extends [Stream<any>, ...Stream<any>[]]>(...streams: STREAMS): <VALUE>(
    stream: Stream<VALUE>
  ) => Stream<VALUE | ValueOf<STREAMS[number]>>;
}

/**
 * Creates a merge transformer for use with pipe().
 * 
 * @param streams - Additional streams to merge with the source stream
 * @returns Transformer function for pipe()
 * 
 * @example
 * ```typescript
 * const stream1 = new Stream<string>();
 * const stream2 = new Stream<number>();
 * const stream3 = new Stream<boolean>();
 * 
 * // Merge multiple streams
 * const merged = stream1.pipe(merge(stream2, stream3));
 * // Type: Stream<string | number | boolean>
 * 
 * merged.listen(value => {
 *   console.log('Received:', value); // Could be string, number, or boolean
 * });
 * 
 * stream1.push('hello');
 * stream2.push(42);
 * stream3.push(true);
 * ```
 */
export const merge: MergeFunction =
  <STREAMS extends [Stream<any>, ...Stream<any>[]]>(...streams: STREAMS) =>
  <VALUE>(stream: Stream<VALUE>) =>
    stream.merge(...streams);

/**
 * Transformer function interface for flattening array values in streams.
 * Supports configurable depth for nested array flattening.
 */
export interface FlatFunction {
  (): <VALUE>(stream: Stream<VALUE>) => Stream<FlatArray<VALUE, 0>>;
  <DEPTH extends number>(depth: DEPTH): <VALUE>(stream: Stream<VALUE>) => Stream<FlatArray<VALUE, DEPTH>>;
}

/**
 * Creates a flat transformer for use with pipe().
 * 
 * @param depth - Optional depth to flatten (default: 0 for single level)
 * @returns Transformer function for pipe()
 * 
 * @example
 * ```typescript
 * const arrays = new Stream<number[]>();
 * 
 * // Flatten single level
 * const flattened = arrays.pipe(flat());
 * arrays.push([1, 2], [3, 4]); // Emits: 1, 2, 3, 4
 * 
 * // Flatten multiple levels
 * const nested = new Stream<number[][][]>();
 * const deepFlat = nested.pipe(flat(2));
 * nested.push([[[1, 2]], [[3, 4]]]); // Emits: 1, 2, 3, 4
 * 
 * // Mixed content (non-arrays pass through)
 * const mixed = new Stream<number | number[]>();
 * const result = mixed.pipe(flat());
 * mixed.push(1, [2, 3], 4); // Emits: 1, 2, 3, 4
 * ```
 */
export const flat: FlatFunction = ((depth?: any) => (stream: Stream<any>) =>
  depth !== undefined ? stream.flat(depth) : stream.flat()) as FlatFunction;
