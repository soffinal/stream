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
export const effect: effect.Effect = <VALUE, STATE extends Record<string, unknown>>(
  initialStateOrCallback: STATE | effect.Callback<VALUE>,
  statefulCallbackOrOptions?: effect.StatefulCallback<VALUE, STATE> | effect.Options,
): Stream.Transformer<Stream<VALUE>, Stream<VALUE>> => {
  if (typeof statefulCallbackOrOptions === "function" && typeof initialStateOrCallback !== "function") {
    return map<VALUE, STATE, VALUE>(initialStateOrCallback, async (state, value) => {
      return [value, await statefulCallbackOrOptions(state, value)];
    });
  }

  return map<VALUE, VALUE>(async (value) => {
    await (initialStateOrCallback as effect.Callback<VALUE>)(value);
    return value;
  }, statefulCallbackOrOptions as effect.Options);
};

export namespace effect {
  export type Options = { strategy: "sequential" | "concurrent-unordered" | "concurrent-ordered" };
  export type Callback<VALUE = unknown> = (value: VALUE) => any | Promise<any>;
  export type StatefulCallback<VALUE = unknown, STATE extends Record<string, unknown> = {}> = (
    state: STATE,
    value: VALUE,
  ) => STATE | Promise<STATE>;

  export interface Effect {
    <VALUE>(callback: Callback<VALUE>, options?: Options): Stream.Transformer<Stream<VALUE>, Stream<VALUE>>;

    // Stateful operations must be sequential
    <VALUE, STATE extends Record<string, unknown> = {}>(
      initialState: STATE,
      callback: StatefulCallback<VALUE, STATE>,
    ): Stream.Transformer<Stream<VALUE>, Stream<VALUE>>;
  }
}
