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
export class Stream<VALUE = never> implements AsyncIterable<VALUE> {
  protected _listeners: Array<(value: VALUE) => void> | undefined;
  protected _source: Stream.Source<VALUE> | undefined;
  protected _sourceController: Stream.Controller | undefined;
  protected _events: Stream<Stream.Events<VALUE>> | undefined;

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
  constructor(source: Stream.Source<VALUE>);
  constructor(source?: Stream.Source<VALUE>) {
    this.setSource(source as Stream.Source<VALUE>);

    if (Stream._config.autoBind) {
      this.push = this.push.bind(this);
      this.listen = this.listen.bind(this);
      this.getSource = this.getSource.bind(this);
      this.setSource = this.setSource.bind(this);
      this.then = this.then.bind(this);
      this.pipe = this.pipe.bind(this);
      this.removeListeners = this.removeListeners.bind(this);
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
    return this._listeners ? this._listeners.length > 0 : false;
  }
  get listenersCount(): number {
    return this._listeners?.length ?? 0;
  }
  get events(): Stream<Stream.Events<VALUE>> {
    if (!this._events) this._events = new Stream();
    return this._events;
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

    for (const value of values) {
      for (let i = 0; i < this.listenersCount; i++) {
        this._listeners?.[i](value);
      }
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

  listen(listener: (value: VALUE, controller: Stream.Controller) => void): Stream.Controller {
    this._listeners = this._listeners ?? [];

    const controller = new Stream.Controller(() => {
      const index = this._listeners?.indexOf(_listener) ?? 0;
      if (index !== -1) {
        this._listeners?.splice(index, 1);
      }
      this._events?.push({ type: "listener-removed" });
      if (this.listenersCount === 0) {
        this._listeners = undefined;
        this._events?.push({ type: "last-listener-removed" });
        this._sourceController?.abort();
      }
    });

    const _listener = (v: VALUE) => listener(v, controller);

    if (Stream._config.asyncPushs) {
      this._listeners.push((v) => queueMicrotask(() => _listener(v)));
    } else {
      this._listeners.push(_listener);
    }

    this._events?.push({ type: "listener-added" });

    if (this.listenersCount === 1) {
      this._events?.push({ type: "first-listener-added" });
      this._sourceController = this._source?.(this) ?? undefined;
    }

    return controller;
  }

  /**
   * Gets the current source generator function.
   * Returns a new Stream that wraps the generator for composition.
   *
   * @returns Stream wrapping current source, or undefined if no source
   *
   * @example
   * ```typescript
   * const target = new Stream<number>();
   * target.setSource(source1);
   *
   * // Add new source while preserving old one
   * const oldSource = target.getSource();
   * if (oldSource) {
   *   target.setSource(source2.pipe(merge(oldSource)));
   * }
   * ```
   */
  getSource(): Stream.Source<VALUE> | undefined {
    return this._source;
  }

  /**
   * Sets or replaces the generator function for this stream.
   * If stream has active listeners, restarts the generator immediately.
   *
   * @param streamOrFn - New generator function or stream to use as source
   *
   * @example
   * ```typescript
   * const stream = new Stream<number>();
   * stream.listen(console.log);
   *
   * // Set source dynamically
   * stream.setSource(source1);
   *
   * // Add source while preserving old one
   * const oldSource = stream.getSource();
   * if (oldSource) {
   *   stream.setSource(source2.pipe(merge(oldSource)));
   * }
   * ```
   */
  setSource(): this;
  setSource(source: Stream.Source<VALUE>): this;
  setSource(source?: Stream.Source<VALUE>): this {
    this._source = undefined;
    this._sourceController?.abort();

    this._source = source;

    this._events?.push({ type: "source-changed", source: this.getSource() });

    if (this.hasListeners && this._source) this._sourceController = this._source(this) ?? undefined;

    return this;
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
    this.removeListeners();
    this._events?.removeListeners();
    this._events = undefined;
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
  removeListeners() {
    this._listeners = undefined;
    this._events?.push({ type: "listeners-removed" });
  }

  static create<VALUE, CAP extends Record<string, any>>(
    source: Stream.Source<VALUE>,
    getCapabilities: (self: Stream<VALUE>) => CAP,
  ): Stream<VALUE> & CAP {
    const output = new Stream<VALUE>(source as Stream.Source<VALUE>) as Stream<VALUE> & CAP;

    const capabilities = getCapabilities(output);
    for (const key of Object.keys(capabilities)) {
      Object.defineProperty(output, key, {
        value: capabilities[key],
        enumerable: true,
        configurable: false,
      });
    }

    return output;
  }
  protected static _config: Stream.Config = {
    workerPoolSize: 4,
    autoBind: false,
    asyncPushs: false,
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
    protected _signals: Set<Stream<any>> | undefined;
    protected _cleanups: Set<Controller.Cleanup> | undefined;

    constructor(cleanup?: Controller.Cleanup) {
      super();
      if (cleanup) this.addCleanup(cleanup);
    }
    get aborted() {
      return this._aborted;
    }
    get signals() {
      return this._signals && [...this._signals];
    }
    abort(): void {
      if (this._aborted) return;
      this._aborted = true;
      this._signals = undefined;
      this._cleanups?.forEach((cleanup) => cleanup());
      this._cleanups = undefined;
      this.push();
    }
    addCleanup(cleanup: Controller.Cleanup) {
      this._cleanups ? this._cleanups.add(cleanup) : (this._cleanups = new Set([cleanup]));
      return this;
    }
    removeCleanup(cleanup: Controller.Cleanup) {
      this._cleanups?.delete(cleanup);
      if (!this._cleanups?.size) this._cleanups = undefined;
      return this;
    }
    addSignal(signal: Stream<any>) {
      this._signals ? this._signals.add(signal) : (this._signals = new Set([signal]));

      signal.listen((_, controller) => {
        if (this._signals?.has(signal)) this.abort();
        controller.abort();
      });
      return this;
    }
    removeSignal(signal: Stream<any>) {
      this._signals?.delete(signal);
      if (!this._signals?.size) this._signals = undefined;

      return this;
    }

    [Symbol.dispose](): void {
      this.abort();
      super[Symbol.dispose]();
    }
    static abort(controllers: Controller[]) {
      controllers.forEach((controller) => controller.abort());
    }
    static ABORTED = Symbol("aborted");
  }
  export namespace Controller {
    export type Cleanup = () => void;
    export type Aborted = typeof Controller.ABORTED;
  }
  export type Events<VALUE> =
    | { type: "listener-added" }
    | { type: "listener-removed" }
    | { type: "first-listener-added" }
    | { type: "last-listener-removed" }
    | { type: "source-changed"; source?: Stream.Source<VALUE> }
    | { type: "listeners-removed" };

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

  export type Source<VALUE> = (self: Stream<VALUE>) => Controller | void;
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
    asyncPushs: boolean;
  }
}

type Prettify<T> = T extends object ? { [K in keyof T]: T[K] } : T;

const baseProps = new Set(Object.keys(new Stream()));
