import { Stream } from "../../stream";
import { map } from "../map";

/**
 * Execute side effects without transforming values.
 * Supports stateful effects and strategy options for flow control.
 *
 * @example
 * ```typescript
 * // Simple side effect
 * stream.pipe(effect((v) => console.log(v)))
 *
 * // Stateful side effect
 * stream.pipe(effect({ count: 0 }, (state, v) => {
 *   console.log(`[${state.count}]`, v);
 *   return { count: state.count + 1 };
 * }))
 *
 * // Strategy for flow control
 * stream.pipe(effect(async (v) => {
 *   await db.write(v);
 *   await sleep(100);
 * }, { strategy: 'sequential' })) // Wait for each effect
 * ```
 */
export const effect: effect.Effect = <VALUE, STATE extends Record<string, unknown>, ARGS = any>(
  initialStateOrCallback: STATE | effect.Callback<VALUE>,
  statefulCallbackOrOptions?: effect.StatefulCallback<VALUE, STATE> | effect.Options,
): Stream.Transformer<Stream<VALUE>, Stream<VALUE>> => {
  const [callback, options, initialState, statfulCallback] =
    typeof initialStateOrCallback === "function"
      ? [initialStateOrCallback, statefulCallbackOrOptions as effect.Options<ARGS>, undefined, undefined]
      : [
          undefined,
          undefined,
          initialStateOrCallback,
          statefulCallbackOrOptions as effect.StatefulCallback<VALUE, STATE>,
        ];

  if (callback) {
    return map<VALUE, VALUE, ARGS>(async (value, args) => {
      await callback(value, args);
      return value;
    }, options);
  }

  return map<VALUE, STATE, VALUE>(initialState, async (state, value) => {
    return [value, await statfulCallback(state, value)];
  });
};

export namespace effect {
  export type Options<ARGS = any> = map.Options<ARGS>;
  export type Callback<VALUE = unknown, ARGS = any> = (value: VALUE, args: ARGS) => any | Promise<any>;
  export type StatefulCallback<VALUE = unknown, STATE extends Record<string, unknown> = {}> = (
    state: STATE,
    value: VALUE,
  ) => STATE | Promise<STATE>;

  export interface Effect {
    <VALUE, ARGS>(
      callback: Callback<VALUE, ARGS>,
      options?: Options<ARGS>,
    ): Stream.Transformer<Stream<VALUE>, Stream<VALUE>>;

    // Stateful operations must be sequential
    <VALUE, STATE extends Record<string, unknown> = {}>(
      initialState: STATE,
      callback: StatefulCallback<VALUE, STATE>,
    ): Stream.Transformer<Stream<VALUE>, Stream<VALUE>>;
  }
}
