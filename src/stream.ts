import { auditTime } from "./transformers/audit-time.ts";
import { buffer } from "./transformers/buffer.ts";
import { debounce } from "./transformers/debounce.ts";
import { delay } from "./transformers/delay.ts";
import { distinct } from "./transformers/distinct.ts";
import { filter } from "./transformers/filter.ts";
import { flat } from "./transformers/flat.ts";
import { map } from "./transformers/map.ts";
import { merge } from "./transformers/merge.ts";
import { pairwise } from "./transformers/pairwise.ts";
import { rateLimit } from "./transformers/rate-limit.ts";
import { sample } from "./transformers/sample.ts";
import { scan } from "./transformers/scan.ts";
import { skip } from "./transformers/skip.ts";
import { startWith } from "./transformers/start-with.ts";
import { take } from "./transformers/take.ts";
import { tap } from "./transformers/tap.ts";
import { throttle } from "./transformers/throttle.ts";
import { window } from "./transformers/window.ts";
import { zip } from "./transformers/zip.ts";

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
  protected _listeners: Set<(value: VALUE) => void> = new Set<(value: VALUE) => void>();
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
  get hasListeners(): boolean {
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
  get listenerAdded(): Stream<void> {
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
  listen(listener: (value: VALUE) => void, signal?: AbortSignal | Stream<any>): () => void {
    const self = this;
    let signalAbort: Function | undefined;

    if (signal instanceof AbortSignal) {
      if (signal?.aborted) return () => {};
      signal?.addEventListener("abort", abort);
      signalAbort = () => signal?.removeEventListener("abort", abort);
    } else {
      signalAbort = signal?.listen(abort);
    }

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
    function abort(): void {
      self._listeners.delete(listener);
      self._listenerRemoved?.push();
      if (self._listeners.size === 0) {
        self._generator?.return();
        self._generator = undefined;
      }
      signalAbort?.();
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
  filter<FILTERED extends VALUE>(predicate: filter.GuardPredicate<VALUE, FILTERED>): Stream<FILTERED>;
  filter<FILTERED extends VALUE>(predicate: filter.Predicate<VALUE>): Stream<FILTERED>;
  filter<FILTERED extends VALUE, ACC>(
    initialValue: ACC,
    predicate: filter.StatefulPredicate<VALUE, ACC>
  ): Stream<FILTERED>;
  filter(predicateOrInitial: any, predicate?: any): Stream<VALUE> {
    return filter<VALUE, any>(predicateOrInitial, predicate)(this);
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
  map<MAPPED>(mapper: map.Mapper<VALUE, MAPPED>): Stream<MAPPED>;
  map<MAPPED, ACC>(initialValue: ACC, mapper: map.StatefulMapper<VALUE, MAPPED, ACC>): Stream<MAPPED>;
  map(mapperOrInitial: any, mapper?: any): Stream<any> {
    return map<VALUE, any, any>(mapperOrInitial, mapper)(this);
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
  ): Stream<VALUE | merge.ValueOf<STREAMS[number]>> {
    return merge(...streams)(this);
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
    return flat(depth)(this);
  }

  /**
   * Emits only distinct values based on a key selector.
   *
   * @param keySelector - Optional function to extract comparison key from each value
   * @returns New stream with only distinct values
   *
   * @example
   * ```typescript
   * const numbers = new Stream<number>();
   * const unique = numbers.distinct();
   *
   * unique.listen(n => console.log('Unique:', n));
   * numbers.push(1, 2, 2, 3, 1); // Unique: 1, Unique: 2, Unique: 3
   *
   * // With key selector
   * const users = new Stream<{id: number, name: string}>();
   * const uniqueUsers = users.distinct(user => user.id);
   * ```
   */
  distinct(): Stream<VALUE>;
  distinct<KEY>(keySelector: distinct.KeySelector<VALUE, KEY>): Stream<VALUE>;
  distinct(keySelector?: any): Stream<VALUE> {
    return distinct<VALUE, any>(keySelector)(this);
  }

  /**
   * Executes a side effect for each value without modifying the stream.
   *
   * @param sideEffect - Function to execute for each value
   * @returns Same stream for chaining
   *
   * @example
   * ```typescript
   * const numbers = new Stream<number>();
   * const logged = numbers
   *   .tap(n => console.log('Processing:', n))
   *   .map(n => n * 2);
   *
   * numbers.push(1, 2, 3);
   * // Processing: 1, Processing: 2, Processing: 3
   * ```
   */
  tap(sideEffect: tap.SideEffect<VALUE>): Stream<VALUE> {
    return tap<VALUE>(sideEffect)(this);
  }

  /**
   * Takes values from the stream based on count, predicate, or signal.
   *
   * @param count - Number of values to take
   * @param predicate - Function to test each value
   * @param signal - Stream or AbortSignal to stop taking
   * @returns New stream with limited values
   *
   * @example
   * ```typescript
   * const numbers = new Stream<number>();
   * const first3 = numbers.take(3);
   *
   * first3.listen(n => console.log('First 3:', n));
   * numbers.push(1, 2, 3, 4, 5); // First 3: 1, First 3: 2, First 3: 3
   *
   * // With predicate
   * const untilNegative = numbers.take(n => n >= 0);
   * ```
   */
  take(count: number): Stream<VALUE>;
  take(predicate: take.Predicate<VALUE>): Stream<VALUE>;
  take<ACC>(initialValue: ACC, predicate: take.StatePredicate<VALUE, ACC>): Stream<VALUE>;
  take(signal: Stream<any>): Stream<VALUE>;
  take(signal: AbortSignal): Stream<VALUE>;
  take(arg: any, predicate?: any): Stream<VALUE> {
    return take<VALUE, any>(arg, predicate)(this);
  }

  /**
   * Skips values from the stream based on count, predicate, or signal.
   *
   * @param count - Number of values to skip
   * @param predicate - Function to test each value
   * @param signal - Stream or AbortSignal to start emitting
   * @returns New stream with skipped values
   *
   * @example
   * ```typescript
   * const numbers = new Stream<number>();
   * const afterFirst3 = numbers.skip(3);
   *
   * afterFirst3.listen(n => console.log('After 3:', n));
   * numbers.push(1, 2, 3, 4, 5); // After 3: 4, After 3: 5
   *
   * // Skip while condition is true
   * const afterNegatives = numbers.skip(n => n < 0);
   * ```
   */
  skip(count: number): Stream<VALUE>;
  skip(predicate: skip.Predicate<VALUE>): Stream<VALUE>;
  skip<ACC>(initialValue: ACC, predicate: skip.StatePredicate<VALUE, ACC>): Stream<VALUE>;
  skip(signal: Stream<any>): Stream<VALUE>;
  skip(signal: AbortSignal): Stream<VALUE>;
  skip(arg: any, predicate?: any): Stream<VALUE> {
    return skip<VALUE, any>(arg, predicate)(this);
  }

  /**
   * Scans values with an accumulator function, emitting intermediate results.
   *
   * @param initialValue - Initial accumulator value
   * @param accumulator - Function to accumulate values
   * @returns New stream with accumulated values
   *
   * @example
   * ```typescript
   * const numbers = new Stream<number>();
   * const sums = numbers.scan(0, (acc, n) => acc + n);
   *
   * sums.listen(sum => console.log('Sum:', sum));
   * numbers.push(1, 2, 3); // Sum: 0, Sum: 1, Sum: 3, Sum: 6
   *
   * // With index
   * const indexed = numbers.scan([], (acc, n, i) => [...acc, {value: n, index: i}]);
   * ```
   */
  scan<RESULT>(initialValue: RESULT, accumulator: scan.BasicAccumulator<VALUE, RESULT>): Stream<RESULT>;
  scan<RESULT>(initialValue: RESULT, accumulator: scan.IndexedAccumulator<VALUE, RESULT>): Stream<RESULT>;
  scan<RESULT>(initialValue: RESULT, accumulator: scan.ConditionalAccumulator<VALUE, RESULT>): Stream<RESULT>;
  scan<RESULT, STATE>(
    initialValue: RESULT,
    initialState: STATE,
    accumulator: scan.StatefulAccumulator<VALUE, RESULT, STATE>
  ): Stream<RESULT>;
  scan(initialValue: any, accumulatorOrState?: any, accumulator?: any): Stream<any> {
    return scan<VALUE, any, any>(initialValue, accumulatorOrState, accumulator)(this);
  }

  /**
   * Starts the stream with initial values.
   *
   * @param values - Initial values to emit first
   * @param valueFactory - Function that returns initial values
   * @returns New stream starting with the specified values
   *
   * @example
   * ```typescript
   * const numbers = new Stream<number>();
   * const withDefaults = numbers.startWith(0, -1);
   *
   * withDefaults.listen(n => console.log('Value:', n));
   * numbers.push(1, 2); // Value: 0, Value: -1, Value: 1, Value: 2
   *
   * // With factory function
   * const withTimestamp = numbers.startWith(() => [Date.now()]);
   * ```
   */
  startWith(...values: VALUE[]): Stream<VALUE>;
  startWith(valueFactory: startWith.ValueFactory<VALUE>): Stream<VALUE>;
  startWith(firstArg: any, ...restValues: any[]): Stream<VALUE> {
    return startWith<VALUE>(firstArg, ...restValues)(this);
  }

  /**
   * Debounces stream values by the specified time.
   *
   * @param ms - Milliseconds to debounce
   * @param delaySelector - Function to determine delay for each value
   * @returns New stream with debounced values
   *
   * @example
   * ```typescript
   * const searchInput = new Stream<string>();
   * const debounced = searchInput.debounce(300);
   *
   * debounced.listen(query => console.log('Search:', query));
   * // Only emits after 300ms of silence
   *
   * // Dynamic delay
   * const adaptive = searchInput.debounce(query => query.length * 100);
   * ```
   */
  debounce(ms: number): Stream<VALUE>;
  debounce(delaySelector: debounce.DelaySelector<VALUE>): Stream<VALUE>;
  debounce<ACC>(initialValue: ACC, delaySelector: debounce.StatefulDelaySelector<VALUE, ACC>): Stream<VALUE>;
  debounce(arg: any, delaySelector?: any): Stream<VALUE> {
    return debounce<VALUE, any>(arg, delaySelector)(this);
  }

  /**
   * Throttles stream values by the specified time.
   *
   * @param ms - Milliseconds to throttle
   * @param timeSelector - Function to determine throttle time for each value
   * @returns New stream with throttled values
   *
   * @example
   * ```typescript
   * const clicks = new Stream<MouseEvent>();
   * const throttled = clicks.throttle(1000);
   *
   * throttled.listen(event => console.log('Click allowed'));
   * // Only allows one click per second
   *
   * // Dynamic throttling
   * const adaptive = clicks.throttle(event => event.detail * 500);
   * ```
   */
  throttle(ms: number): Stream<VALUE>;
  throttle(timeSelector: throttle.TimeSelector<VALUE>): Stream<VALUE>;
  throttle<ACC>(initialValue: ACC, timeSelector: throttle.StatefulTimeSelector<VALUE, ACC>): Stream<VALUE>;
  throttle(arg: any, timeSelector?: any): Stream<VALUE> {
    return throttle<VALUE, any>(arg, timeSelector)(this);
  }

  /**
   * Delays stream values by the specified time.
   *
   * @param ms - Milliseconds to delay each value
   * @param delaySelector - Function to determine delay for each value
   * @returns New stream with delayed values
   *
   * @example
   * ```typescript
   * const numbers = new Stream<number>();
   * const delayed = numbers.delay(1000);
   *
   * delayed.listen(n => console.log('Delayed:', n));
   * numbers.push(1, 2, 3); // Each value delayed by 1 second
   *
   * // Variable delay
   * const variableDelay = numbers.delay(n => n * 100);
   * ```
   */
  delay(ms: number): Stream<VALUE>;
  delay(delaySelector: delay.DelaySelector<VALUE>): Stream<VALUE>;
  delay<ACC>(initialValue: ACC, delaySelector: delay.StatefulDelaySelector<VALUE, ACC>): Stream<VALUE>;
  delay(arg: any, delaySelector?: any): Stream<VALUE> {
    return delay<VALUE, any>(arg, delaySelector)(this);
  }

  /**
   * Audits stream values by time, emitting the last value after a period of silence.
   *
   * @param ms - Milliseconds to wait for silence
   * @param durationFn - Function to determine audit duration for each value
   * @param predicate - Function to determine if value should be audited
   * @returns New stream with audited values
   *
   * @example
   * ```typescript
   * const rapidFire = new Stream<number>();
   * const audited = rapidFire.auditTime(500);
   *
   * audited.listen(n => console.log('Audited:', n));
   * // Emits the last value after 500ms of silence
   *
   * // Dynamic audit time
   * const adaptive = rapidFire.auditTime(n => n * 100);
   * ```
   */
  auditTime(ms: number): Stream<VALUE>;
  auditTime(durationFn: auditTime.DurationFunction<VALUE>): Stream<VALUE>;
  auditTime<STATE>(
    initialState: STATE,
    accumulator: auditTime.StatefulDurationAccumulator<VALUE, STATE>
  ): Stream<VALUE>;
  auditTime(ms: number, predicate: auditTime.Predicate<VALUE>): Stream<VALUE>;
  auditTime<STATE>(
    initialState: STATE,
    accumulator: auditTime.StatefulPredicateAccumulator<VALUE, STATE>
  ): Stream<VALUE>;
  auditTime(arg1: any, arg2?: any): Stream<VALUE> {
    return auditTime<VALUE, any>(arg1, arg2)(this);
  }

  /**
   * Rate limits stream values to a maximum count within a time window.
   *
   * @param count - Maximum number of values allowed
   * @param windowMs - Time window in milliseconds
   * @param countSelector - Function to determine count limit for each value
   * @param windowSelector - Function to determine window size for each value
   * @returns New stream with rate-limited values
   *
   * @example
   * ```typescript
   * const requests = new Stream<Request>();
   * const limited = requests.rateLimit(5, 1000); // Max 5 per second
   *
   * limited.listen(req => processRequest(req));
   * // Only allows 5 requests per 1000ms window
   *
   * // Dynamic rate limiting
   * const adaptive = requests.rateLimit(req => req.priority, 1000);
   * ```
   */
  rateLimit(count: number, windowMs: number): Stream<VALUE>;
  rateLimit(count: number, windowSelector: rateLimit.WindowSelector<VALUE>): Stream<VALUE>;
  rateLimit(countSelector: rateLimit.CountSelector<VALUE>, windowMs: number): Stream<VALUE>;
  rateLimit(
    countSelector: rateLimit.CountSelector<VALUE>,
    windowSelector: rateLimit.WindowSelector<VALUE>
  ): Stream<VALUE>;
  rateLimit<ACC>(initialValue: ACC, selector: rateLimit.StatefulSelector<VALUE, ACC>): Stream<VALUE>;
  rateLimit(arg1: any, arg2?: any): Stream<VALUE> {
    return rateLimit<VALUE, any>(arg1, arg2)(this);
  }

  /**
   * Creates sliding windows of values.
   *
   * @param size - Window size or time in milliseconds
   * @param step - Step size for sliding window
   * @param sizeSelector - Function to determine window size
   * @param stepSelector - Function to determine step size
   * @param predicate - Function to determine when to emit window
   * @returns New stream with windowed arrays
   *
   * @example
   * ```typescript
   * const numbers = new Stream<number>();
   * const windows = numbers.window(3); // Windows of size 3
   *
   * windows.listen(win => console.log('Window:', win));
   * numbers.push(1, 2, 3, 4, 5); // Window: [1,2,3], Window: [4,5]
   *
   * // Sliding window with step
   * const sliding = numbers.window(3, 1); // Size 3, step 1
   * ```
   */
  window(size: number): Stream<VALUE[]>;
  window(size: number, step: number): Stream<VALUE[]>;
  window(sizeSelector: window.SizeSelector<VALUE>): Stream<VALUE[]>;
  window(sizeSelector: window.SizeSelector<VALUE>, step: number): Stream<VALUE[]>;
  window(size: number, stepSelector: window.StepSelector<VALUE>): Stream<VALUE[]>;
  window(sizeSelector: window.SizeSelector<VALUE>, stepSelector: window.StepSelector<VALUE>): Stream<VALUE[]>;
  window(predicate: window.Predicate<VALUE>): Stream<VALUE[]>;
  window<STATE>(initialState: STATE, selector: window.StatefulSelector<VALUE, STATE>): Stream<VALUE[]>;
  window(timeMs: number, isTime: true): Stream<VALUE[]>;
  window(size: number, timeMs: number, step?: number): Stream<VALUE[]>;
  window(arg1: any, arg2?: any, step?: number): Stream<VALUE[]> {
    return window<VALUE>(arg1, arg2, step)(this);
  }

  /**
   * Buffers values based on trigger, count, or selector.
   *
   * @param trigger - Stream that triggers buffer emission
   * @param count - Number of values to buffer
   * @param countSelector - Function to determine buffer size
   * @returns New stream with buffered arrays
   *
   * @example
   * ```typescript
   * const numbers = new Stream<number>();
   * const trigger = new Stream<void>();
   * const buffered = numbers.buffer(trigger);
   *
   * buffered.listen(buf => console.log('Buffer:', buf));
   * numbers.push(1, 2, 3);
   * trigger.push(); // Buffer: [1, 2, 3]
   *
   * // Fixed count buffer
   * const counted = numbers.buffer(5);
   * ```
   */
  buffer(trigger: Stream<any>): Stream<VALUE[]>;
  buffer(count: number): Stream<VALUE[]>;
  buffer(countSelector: buffer.BufferFunction<VALUE>): Stream<VALUE[]>;
  buffer<STATE>(initialState: STATE, selector: buffer.StatefulSelector<VALUE, STATE>): Stream<VALUE[]>;
  buffer(arg: any, selector?: any): Stream<VALUE[]> {
    return buffer<VALUE, any>(arg, selector)(this);
  }

  /**
   * Samples values based on trigger, interval, or predicate.
   *
   * @param trigger - Stream that triggers sampling
   * @param intervalMs - Milliseconds between samples
   * @param intervalSelector - Function to determine sample interval
   * @param predicate - Function to determine when to sample
   * @returns New stream with sampled values
   *
   * @example
   * ```typescript
   * const numbers = new Stream<number>();
   * const timer = new Stream<void>();
   * const sampled = numbers.sample(timer);
   *
   * sampled.listen(n => console.log('Sampled:', n));
   * numbers.push(1, 2, 3);
   * timer.push(); // Samples current value: 3
   *
   * // Fixed interval sampling
   * const timed = numbers.sample(1000); // Every second
   * ```
   */
  sample(trigger: Stream<any>): Stream<VALUE>;
  sample(intervalMs: number): Stream<VALUE>;
  sample(intervalSelector: sample.IntervalSelector<VALUE>): Stream<VALUE>;
  sample(predicate: sample.Predicate<VALUE>): Stream<VALUE>;
  sample<STATE>(initialState: STATE, selector: sample.StatefulSelector<VALUE, STATE>): Stream<VALUE>;
  sample(arg: any, selector?: any): Stream<VALUE> {
    return sample<VALUE, any>(arg, selector)(this);
  }

  /**
   * Emits pairs of consecutive values.
   *
   * @param predicate - Function to test each pair
   * @param mapper - Function to transform each pair
   * @returns New stream with pairs or transformed results
   *
   * @example
   * ```typescript
   * const numbers = new Stream<number>();
   * const pairs = numbers.pairwise();
   *
   * pairs.listen(([prev, curr]) => console.log('Pair:', prev, curr));
   * numbers.push(1, 2, 3); // Pair: 1 2, Pair: 2 3
   *
   * // Transform pairs
   * const diffs = numbers.pairwise((prev, curr) => curr - prev);
   * ```
   */
  pairwise(): Stream<[VALUE, VALUE]>;
  pairwise(predicate: pairwise.Predicate<VALUE>): Stream<[VALUE, VALUE]>;
  pairwise<STATE>(initialState: STATE, accumulator: pairwise.StatefulPredicate<VALUE, STATE>): Stream<[VALUE, VALUE]>;
  pairwise<RESULT>(mapper: pairwise.Mapper<VALUE, RESULT>): Stream<RESULT>;
  pairwise<STATE, RESULT>(
    initialState: STATE,
    accumulator: pairwise.StatefulMapper<VALUE, STATE, RESULT>
  ): Stream<RESULT>;
  pairwise(arg1?: any, arg2?: any): Stream<any> {
    return pairwise<VALUE, any, any>(arg1, arg2)(this);
  }

  /**
   * Zips this stream with other streams, combining values at the same index.
   *
   * @param other - Another stream to zip with
   * @param others - Multiple streams to zip with
   * @param combiner - Function to combine values from all streams
   * @returns New stream with combined values
   *
   * @example
   * ```typescript
   * const numbers = new Stream<number>();
   * const letters = new Stream<string>();
   * const zipped = numbers.zip(letters);
   *
   * zipped.listen(([num, letter]) => console.log('Pair:', num, letter));
   * numbers.push(1, 2);
   * letters.push('a', 'b'); // Pair: 1 a, Pair: 2 b
   *
   * // With combiner
   * const combined = numbers.zip(letters, (n, l) => `${n}${l}`);
   * ```
   */
  zip<OTHER>(other: Stream<OTHER>): Stream<[VALUE, OTHER]>;
  zip<STREAMS extends [Stream<any>, ...Stream<any>[]]>(
    ...others: STREAMS
  ): Stream<[VALUE, ...{ [K in keyof STREAMS]: STREAMS[K] extends Stream<infer U> ? U : never }]>;
  zip<OTHER, RESULT>(other: Stream<OTHER>, combiner: zip.Combiner<VALUE, OTHER, RESULT>): Stream<RESULT>;
  zip<STREAMS extends [Stream<any>, ...Stream<any>[]], RESULT>(
    others: STREAMS,
    combiner: zip.MultipleCombiner<VALUE, RESULT>
  ): Stream<RESULT>;
  zip<OTHER, STATE>(
    other: Stream<OTHER>,
    initialState: STATE,
    combiner: zip.StatefulCombiner<VALUE, OTHER, STATE>
  ): Stream<any>;
  zip(arg1: any, arg2?: any, arg3?: any): Stream<any> {
    return zip<VALUE, any, any>(arg1, arg2, arg3)(this);
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
