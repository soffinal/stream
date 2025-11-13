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
 *
 * @example
 * // 📦 COPY-PASTE TRANSFORMERS LIBRARY - Essential transformers for immediate use
 *
 * // FILTERING TRANSFORMERS
 *
 * const take = <T>(n: number) =>
 *   filter<T, { count: number }>({ count: 0 }, (state, value) => {
 *     if (state.count >= n) return;
 *     return [true, { count: state.count + 1 }];
 *   });
 *
 * const distinct = <T>() =>
 *   filter<T, { seen: Set<T> }>({ seen: new Set() }, (state, value) => {
 *     if (state.seen.has(value)) return [false, state];
 *     state.seen.add(value);
 *     return [true, state];
 *   });
 *
 * const tap = <T>(fn: (value: T) => void | Promise<void>) =>
 *   filter<T, {}>({}, async (_, value) => {
 *     await fn(value);
 *     return [true, {}];
 *   });
 *
 * // MAPPING TRANSFORMERS
 *
 * const withIndex = <T>() =>
 *   map<T, { index: number }, { value: T; index: number }>(
 *     { index: 0 },
 *     (state, value) => [
 *       { value, index: state.index },
 *       { index: state.index + 1 }
 *     ]
 *   );
 *
 * const delay = <T>(ms: number) =>
 *   map<T, {}, T>({}, async (_, value) => {
 *     await new Promise(resolve => setTimeout(resolve, ms));
 *     return [value, {}];
 *   });
 *
 * const scan = <T, U>(fn: (acc: U, value: T) => U, initial: U) =>
 *   map<T, { acc: U }, U>({ acc: initial }, (state, value) => {
 *     const newAcc = fn(state.acc, value);
 *     return [newAcc, { acc: newAcc }];
 *   });
 *
 * // STATE CONVERTER
 * const toState = <T>(initialValue: T) => (stream: Stream<T>) => {
 *   return new State(initialValue, stream);
 * };
 *
 * // Usage: stream.pipe(filter(x => x > 0)).pipe(take(5)).pipe(toState(0));
 */
export class Stream<VALUE = unknown> implements AsyncIterable<VALUE> {
  protected _listeners: Map<(value: VALUE) => void, WeakRef<object> | undefined> = new Map();
  protected _generatorFn: Stream.FunctionGenerator<VALUE> | undefined;
  protected _generator: AsyncGenerator<VALUE, void> | undefined;
  protected _listenerAdded: Stream<void> | undefined;
  protected _listenerRemoved: Stream<void> | undefined;

  /**
   * Creates a new Stream instance.
   *
   * @param generatorFn - Optional async generator function to produce values you can use it for creating stream with custom transformation
   *
   * @see {@link Stream} - Complete copy-paste transformers library
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
  constructor(stream: Stream.FunctionGenerator<VALUE> | Stream<VALUE>);
  constructor(stream?: Stream.FunctionGenerator<VALUE> | Stream<VALUE>) {
    this._generatorFn = stream instanceof Stream ? () => stream[Symbol.asyncIterator]() : stream;
  }

  /**
   * Returns true if the stream has active listeners.
   *
   * @see {@link Stream} - Complete copy-paste transformers library
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
  get hasListeners(): boolean {
    return this._listeners.size > 0;
  }

  /**
   * Stream that emits when a listener is added.
   *
   * @see {@link Stream} - Complete copy-paste transformers library
   *
   * @example
   * ```typescript
   * const stream = new Stream<number>();
   * stream.listenerAdded.listen(() => console.log('Listener added'));
   *
   * stream.listen(value => console.log(value)); // Triggers 'Listener added'
   * ```
   */
  get listenerAdded(): Stream<void> {
    if (!this._listenerAdded) this._listenerAdded = new Stream<void>();
    return this._listenerAdded;
  }

  /**
   * Stream that emits when a listener is removed.
   *
   * @see {@link Stream} - Complete copy-paste transformers library
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
  get listenerRemoved(): Stream<void> {
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
   * Automatically removes listeners whose context objects have been garbage collected.
   *
   * @see {@link Stream} - Complete copy-paste transformers library
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
  push(value: VALUE, ...values: VALUE[]): void {
    values.unshift(value);
    const deadListeners = [];
    for (const value of values) {
      for (const [listener, ctx] of this._listeners) {
        if (ctx && !ctx.deref()) {
          deadListeners.push(listener);
          continue;
        }
        listener(value);
      }
    }
    for (const listener of deadListeners) {
      this._listeners.delete(listener);
    }
  }

  /**
   * Creates an async iterator bound to a context object's lifetime.
   * Automatically stops iteration when the context is garbage collected.
   *
   * @param context - Object whose lifetime controls the iteration
   * @returns Async generator that stops when context is GC'd
   *
   * @see {@link Stream} - Complete copy-paste transformers library
   *
   * @example
   * ```typescript
   * const stream = new Stream<number>();
   * const element = document.createElement('div');
   *
   * (async () => {
   *   for await (const value of stream.withContext(element)) {
   *     element.textContent = String(value);
   *   }
   * })();
   *
   * // When element is removed and GC'd, iteration stops automatically
   * ```
   */
  async *withContext(context: object) {
    const ref = new WeakRef(context);
    try {
      for await (const value of this) {
        if (!ref.deref()) break;
        yield value;
      }
    } finally {
      return;
    }
  }

  /**
   * Adds a listener to the stream with optional automatic cleanup.
   *
   * @param listener - Function to call when values are pushed
   * @param signalOrStreamOrContext - Optional cleanup mechanism:
   *   - AbortSignal: Remove listener when signal is aborted
   *   - Stream: Remove listener when stream emits
   *   - Object: Remove listener when object is garbage collected (WeakRef)
   * @returns Cleanup function to remove the listener
   *
   * @see {@link Stream} - Complete copy-paste transformers library
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
   * // With Stream
   * const stopSignal = new Stream<void>();
   * stream.listen(value => console.log(value), stopSignal);
   * stopSignal.push(); // Removes listener
   *
   * // With DOM element (auto-cleanup when GC'd)
   * const element = document.createElement('div');
   * stream.listen(value => element.textContent = value, element);
   * // Listener automatically removed when element is garbage collected
   *
   * // Manual cleanup
   * cleanup();
   * ```
   */
  listen(listener: (value: VALUE) => void): () => void;
  listen(listener: (value: VALUE) => void, signal: AbortSignal): () => void;
  listen(listener: (value: VALUE) => void, stream: Stream<any>): () => void;
  listen(listener: (value: VALUE) => void, context: object): () => void;
  listen(listener: (value: VALUE) => void, signalOrStreamOrContext?: AbortSignal | Stream<any> | object): () => void {
    const self = this;
    let signalAbort: Function | undefined;
    let context: WeakRef<object> | undefined;

    if (signalOrStreamOrContext instanceof AbortSignal) {
      if (signalOrStreamOrContext?.aborted) return () => {};
      signalOrStreamOrContext?.addEventListener("abort", abort);
      signalAbort = () => signalOrStreamOrContext?.removeEventListener("abort", abort);
    } else if (signalOrStreamOrContext instanceof Stream) {
      signalAbort = signalOrStreamOrContext?.listen(abort);
    } else if (signalOrStreamOrContext) {
      context = new WeakRef(signalOrStreamOrContext);
    }

    self._listeners.set(listener, context);

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
    function abort(): void {
      self._listeners.delete(listener);
      self._listenerRemoved?.push();
      if (self._listeners.size === 0) {
        self._generator?.return();
        self._generator = undefined;
      }
      signalAbort?.();
      signalAbort = undefined;
      context = undefined;
    }
  }

  /**
   * Promise-like interface that resolves with the next value.
   *
   * @param onfulfilled - Optional transformation function
   * @returns Promise that resolves with the first value
   *
   * @see {@link Stream} - Complete copy-paste transformers library
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
   * Applies a transformer function to this stream, enabling functional composition.
   *
   * @param transformer - Function that takes a stream and returns any output type
   * @returns The result of the transformer function
   *
   * @see {@link Stream} - Complete copy-paste transformers library
   *
   * @example
   * ```typescript
   * const numbers = new Stream<number>();
   *
   * // Chain transformers
   * const result = numbers
   *   .pipe(filter({}, (_, n) => [n > 0, {}]))
   *   .pipe(map({}, (_, n) => [n * 2, {}]))
   *   .pipe(toState(0));
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
   * // Transform to any type
   * const stringResult = numbers.pipe(throttle(1000));
   * const stateResult = numbers.pipe(toState(0));
   * ```
   */
  pipe<OUTPUT extends Stream<any>>(transformer: (stream: this) => OUTPUT): OUTPUT {
    return transformer(this);
  }
}

export namespace Stream {
  export type ValueOf<STREAM> = STREAM extends Stream<infer VALUE> ? VALUE : never;
  export type FunctionGenerator<VALUE> = () => AsyncGenerator<VALUE, void>;
}
