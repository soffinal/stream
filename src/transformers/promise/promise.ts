import { Stream } from "../../stream";

/**
 * Emits the result of a promise (fulfilled or rejected).
 *
 * @example
 * ```typescript
 * new Stream()
 *   .pipe(promise(fetch('/api/data')))
 *   .listen(result => {
 *     if (result.status === 'fulfilled') {
 *       console.log('Success:', result.value);
 *     } else {
 *       console.error('Error:', result.reason);
 *     }
 *   });
 * ```
 */
export function promise<VALUE, U>(
  p: Promise<U>,
): Stream.Transformer<Stream<VALUE>, Stream<VALUE | promise.PromiseResult<U>>> {
  return function (source) {
    return new Stream<VALUE | promise.PromiseResult<U>>(async function* (this) {
      p.then(
        (value) => this.push({ status: "fulfilled", value }),
        (reason) => this.push({ status: "rejected", reason }),
      );

      yield* source;
    });
  };
}

export namespace promise {
  export type PromiseResult<T> = { status: "fulfilled"; value: T } | { status: "rejected"; reason: unknown };

  export function isFulfilled<T>(result: PromiseResult<T>): result is { status: "fulfilled"; value: T } {
    return result.status === "fulfilled";
  }

  export function isRejected<T>(result: PromiseResult<T>): result is { status: "rejected"; reason: unknown } {
    return result.status === "rejected";
  }
}
