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
 * // 📦 COMPOSABLE TRANSFORMERS - Build your own from primitives
 *
 * // FILTERING PATTERNS
 *
 * const take = <T>(n: number) =>
 *   filter<T, { count: number }>({ count: 0 }, (state, value) => {
 *     if (state.count >= n) return;
 *     return [true, { count: state.count + 1 }];
 *   });
 *
 * const skip = <T>(n: number) =>
 *   filter<T, { count: number }>({ count: 0 }, (state, value) => {
 *     const newCount = state.count + 1;
 *     return [newCount > n, { count: newCount }];
 *   });
 *
 * const distinct = <T>() =>
 *   filter<T, { seen: Set<T> }>({ seen: new Set() }, (state, value) => {
 *     if (state.seen.has(value)) return [false, state];
 *     state.seen.add(value);
 *     return [true, state];
 *   });
 *
 * const throttle = <T>(ms: number) =>
 *   filter<T, { lastEmit: number }>({ lastEmit: 0 }, (state, value) => {
 *     const now = Date.now();
 *     if (now - state.lastEmit < ms) return [false, state];
 *     return [true, { lastEmit: now }];
 *   });
 *
 * const debounce = <T>(ms: number) =>
 *   filter<T, { timer: any }>({ timer: null }, (state, value) => {
 *     clearTimeout(state.timer);
 *     const timer = setTimeout(() => {}, ms);
 *     return [false, { timer }];
 *   });
 *
 * const tap = <T>(fn: (value: T) => void | Promise<void>) =>
 *   filter<T, {}>({}, async (_, value) => {
 *     await fn(value);
 *     return [true, {}];
 *   });
 *
 * // MAPPING PATTERNS
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
 * const pluck = <T, K extends keyof T>(key: K) =>
 *   map<T, {}, T[K]>({}, (_, value) => [value[key], {}]);
 *
 * // COMBINATION PATTERNS
 *
 * const combineLatest = <T, U>(other: Stream<U>) => (source: Stream<T>) =>
 *   source.pipe(store()).pipe(zip(other.pipe(store())));
 *
 * const startWith = <T>(...values: T[]) => (source: Stream<T>) =>
 *   source.pipe(store(values));
 *
 * // Usage: stream.pipe(filter(x => x > 0)).pipe(take(5)).pipe(scan((a, b) => a + b, 0))
 */
export class Stream<VALUE = unknown> implements AsyncIterable<VALUE> {
  protected _listeners: Map<
    (value: VALUE) => void,
    { weakRef: WeakRef<object>; controller: Stream.Controller } | undefined
  > = new Map();
  protected _functionGenerator: Stream.FunctionGenerator<VALUE> | undefined;
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
  constructor(stream: Stream<VALUE>);
  constructor(fn: Stream.FunctionGenerator<VALUE>);

  constructor(streamOrFn?: Stream.FunctionGenerator<VALUE> | Stream<VALUE>) {
    this._functionGenerator = streamOrFn instanceof Stream ? () => streamOrFn[Symbol.asyncIterator]() : streamOrFn;

    if (Stream._config.autoBind) {
      this.push = this.push.bind(this);
      this.listen = this.listen.bind(this);
      this.then = this.then.bind(this);
      this.pipe = this.pipe.bind(this);
      this.clear = this.clear.bind(this);
      this.withContext = this.withContext.bind(this);
    }
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

    const controller = this.listen((value) => {
      queue.push(value);
      resolver?.();
    });

    try {
      while (true) {
        if (queue.length) yield queue.shift()!;
        else await new Promise<void>((r) => (resolver = r));
      }
    } finally {
      controller.abort();
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
        if (ctx && !ctx.weakRef.deref()) {
          ctx.controller.abort();
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
  async *withContext(context: object): AsyncGenerator<VALUE, void> {
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
   * @param signal - Optional cleanup mechanism:
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
  listen(listener: (value: VALUE) => void): Stream.Controller;
  listen(listener: (value: VALUE) => void, signal: AbortSignal): Stream.Controller;
  listen(listener: (value: VALUE) => void, stream: Stream<any>): Stream.Controller;
  listen(listener: (value: VALUE) => void, context: object): Stream.Controller;
  listen(listener: (value: VALUE) => void, signal?: AbortSignal | Stream<any> | object): Stream.Controller {
    const self = this;
    let abortSignal: Function | undefined;
    let weakRef: WeakRef<object> | undefined;

    const controller = new Stream.Controller(abort);

    if (signal instanceof AbortSignal) {
      if (signal?.aborted) return controller;

      signal?.addEventListener("abort", controller.abort);
      abortSignal = () => signal?.removeEventListener("abort", controller.abort);
    } else if (signal instanceof Stream) {
      abortSignal = signal?.listen(controller.abort).abort;
    } else if (signal) {
      weakRef = new WeakRef(signal);
    }

    self._listeners.set(listener, weakRef ? { weakRef, controller } : undefined);

    self._listenerAdded?.push();

    if (self._functionGenerator && self._listeners.size === 1) {
      self._generator = self._functionGenerator();

      (async () => {
        for await (const value of self._generator!) {
          self.push(value);
        }
      })();
    }

    return controller;
    function abort(): void {
      self._listeners.delete(listener);
      self._listenerRemoved?.push();
      if (self._listeners.size === 0) {
        self._generator?.return();
        self._generator = undefined;
      }
      abortSignal?.();
      abortSignal = undefined;
      weakRef = undefined;
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
      const controller = this.listen((value) => {
        resolve(value);
        controller.abort();
      });
    }).then(onfulfilled);
  }
  pipe<OUTPUT extends Stream<any>>(
    transformer: Stream.Transformer<this, OUTPUT>,
  ): Stream<Stream.ValueOf<OUTPUT>> & Prettify<Omit<this & OUTPUT, keyof Stream<any>>> {
    const output = transformer(this);

    for (const key in output) {
      if (baseProps.has(key)) continue;
      if (output.hasOwnProperty(key) && this.hasOwnProperty(key)) {
        throw new Error(
          `Capability override detected: "${key}" already exists. ` +
            `Use snapshot() to preserve multiple instances of the same capability transformer.`,
        );
      }
    }
    for (const key in this) {
      if (!(key in output)) {
        Object.defineProperty(output, key, Object.getOwnPropertyDescriptor(this, key)!);
      }
    }

    return output as never;
  }
  [Symbol.dispose](): void {
    this.clear();
  }
  /**
   * Removes all listeners from the stream.
   *
   * @see {@link Stream} - Complete copy-paste transformers library
   *
   * @example
   * ```typescript
   * const stream = new Stream<number>();
   * stream.listen(value => console.log(value));
   *
   * console.log(stream.hasListeners); // true
   * stream.clear();
   * console.log(stream.hasListeners); // false
   * ```
   */
  clear() {
    this._listeners.clear();
    this._listenerAdded?.clear();
    this._listenerRemoved?.clear();
    this._listenerAdded = undefined;
    this._listenerRemoved = undefined;
  }
  protected static _config: Stream.Config = {
    workerPoolSize: 4,
    autoBind: true,
  };
  /**
   * Configure global Stream behavior.
   *
   * @example
   * ```typescript
   * // Default: Convenience (auto-bind enabled)
   * Stream.config = { autoBind: true };
   * const stream = new Stream<number>();
   * source.listen(stream.push); // Works!
   *
   * // Performance: Manual binding (auto-bind disabled)
   * Stream.config = { autoBind: false };
   * const stream = new Stream<number>();
   * source.listen(stream.push.bind(stream)); // Must bind
   *
   * // Trade-off:
   * // autoBind: true  → ~600 bytes per stream, zero mental overhead
   * // autoBind: false → zero overhead, must remember to bind
   * ```
   */
  static set config(config: Partial<Stream.Config>) {
    Stream._config = { ...Stream._config, ...config };
  }
  /**
   * Get current configuration.
   *
   * @returns Current configuration object
   *
   * @example
   * ```typescript
   * const config = Stream.getConfig();
   * console.log(config.workerPoolSize); // 4 (default)
   * ```
   */
  static get config(): Readonly<Stream.Config> {
    return { ...Stream._config };
  }
}

export namespace Stream {
  export class Controller extends Stream<void> {
    protected _aborted = false;

    constructor(private cleanup: () => void) {
      super();
      this.abort = this.abort.bind(this);
    }
    get aborted() {
      return this._aborted;
    }
    abort(): void {
      if (this._aborted) return;
      this._aborted = true;
      this.push(); // Notify observers
      this.cleanup();
    }

    [Symbol.dispose](): void {
      this.abort();
      super[Symbol.dispose]();
    }
  }
  /**
   * Extracts the value type from a Stream type.
   *
   * @example
   * ```typescript
   * type NumberStream = Stream<number>;
   * type Value = Stream.ValueOf<NumberStream>; // number
   * ```
   */
  export type ValueOf<STREAM> = STREAM extends Stream<infer VALUE> ? VALUE : never;
  /**
   * Function that returns an async generator to produce stream values.
   * Used for iteration-based transformers.
   *
   * @example
   * ```typescript
   * const countdown = new Stream(async function* () {
   *   for (let i = 5; i > 0; i--) {
   *     yield i;
   *     await new Promise(resolve => setTimeout(resolve, 1000));
   *   }
   * });
   * ```
   */
  export type FunctionGenerator<VALUE> = () => AsyncGenerator<VALUE, void>;

  /**
   * Function that transforms one stream into another.
   *
   * @example
   * ```typescript
   * const double: Stream.Transformer<Stream<number>, Stream<number>> =
   *   (stream) => new Stream(async function* () {
   *     for await (const value of stream) {
   *       yield value * 2;
   *     }
   *   });
   *
   * stream.pipe(double);
   * ```
   */
  export type Transformer<INPUT extends Stream<any>, OUTPUT extends Stream<any> = INPUT> = (stream: INPUT) => OUTPUT;
  export interface Config {
    /**
     * Number of Web Workers in the pool for parallel execution.
     * Configure based on your hardware capabilities.
     *
     * @default 4
     * @example
     * ```typescript
     * // High-end hardware
     * Stream.configure({ workerPoolSize: 16 });
     *
     * // Restricted hardware (IoT, embedded)
     * Stream.configure({ workerPoolSize: 2 });
     * ```
     */
    workerPoolSize: number;
    /**
     * Auto-bind methods in constructor for use as callbacks.
     * When true: All methods work as callbacks (convenience, ~600 bytes overhead)
     * When false: Must manually bind when passing as callbacks (performance, zero overhead)
     * @default true
     */
    autoBind: boolean;
  }
}

type Prettify<T> = T extends object ? { [K in keyof T]: T[K] } : T;

const baseProps = new Set(Object.keys(new Stream()));
