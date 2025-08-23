import { Stream } from "../stream.ts";

export const window: window.Transformer =
  <VALUE, STATE>(
    sizeOrPredicateOrState:
      | number
      | ((value: VALUE, buffer: VALUE[]) => number | Promise<number>)
      | ((buffer: VALUE[], value: VALUE) => boolean | Promise<boolean>)
      | STATE,
    stepOrTimeMsOrSelector?:
      | number
      | ((value: VALUE, buffer: VALUE[]) => number | Promise<number>)
      | boolean
      | ((state: STATE, value: VALUE, buffer: VALUE[]) => any),
    step?: number
  ) =>
  (stream: Stream<VALUE>): Stream<VALUE[]> =>
    new Stream<VALUE[]>(async function* () {
      const buffer: VALUE[] = [];
      const timestamps: number[] = [];
      let windowStart = 0;
      let state =
        typeof sizeOrPredicateOrState !== "number" && typeof sizeOrPredicateOrState !== "function"
          ? sizeOrPredicateOrState
          : undefined;

      for await (const value of stream) {
        const now = Date.now();
        buffer.push(value);
        timestamps.push(now);

        if (typeof sizeOrPredicateOrState === "number") {
          if (stepOrTimeMsOrSelector === true) {
            // Time-based window (pure time)
            const timeMs = sizeOrPredicateOrState;
            // Remove expired items
            while (timestamps.length > 0 && now - timestamps[0]! > timeMs) {
              buffer.shift();
              timestamps.shift();
            }
            // Emit current window if not empty
            if (buffer.length > 0) {
              yield [...buffer];
            }
          } else if (typeof stepOrTimeMsOrSelector === "number" && step !== undefined) {
            // Size + time constraint window
            const size = sizeOrPredicateOrState;
            const timeMs = stepOrTimeMsOrSelector;
            const actualStep = step;

            // Remove items outside time window
            while (timestamps.length > 0 && now - timestamps[0]! > timeMs) {
              buffer.shift();
              timestamps.shift();
              windowStart = Math.max(0, windowStart - 1);
            }

            // Emit windows based on size and step
            while (buffer.length >= windowStart + size) {
              yield buffer.slice(windowStart, windowStart + size);
              windowStart += actualStep;
              if (actualStep <= 0) break;
            }
          } else {
            // Fixed size window with optional step selector
            const size = sizeOrPredicateOrState;

            let actualStep: number;
            if (typeof stepOrTimeMsOrSelector === "number") {
              // Fixed step
              actualStep = stepOrTimeMsOrSelector;
            } else if (typeof stepOrTimeMsOrSelector === "function") {
              // Dynamic step selector
              const stepSelector = stepOrTimeMsOrSelector as (value: VALUE, buffer: VALUE[]) => number | Promise<number>;
              actualStep = await stepSelector(value, buffer);
            } else {
              // Default step = size
              actualStep = size;
            }

            while (buffer.length >= windowStart + size) {
              yield buffer.slice(windowStart, windowStart + size);
              windowStart += actualStep;
              if (actualStep <= 0) break;
            }
          }
        } else if (typeof sizeOrPredicateOrState === "function") {
          if (sizeOrPredicateOrState.length === 2) {
            // Predicate-based window
            const predicate = sizeOrPredicateOrState as (buffer: VALUE[], value: VALUE) => boolean | Promise<boolean>;
            if (await predicate(buffer, value)) {
              yield [...buffer];
              buffer.length = 0;
              timestamps.length = 0;
              windowStart = 0;
            }
          } else {
            // Dynamic size window (with optional step)
            const sizeSelector = sizeOrPredicateOrState as (value: VALUE, buffer: VALUE[]) => number | Promise<number>;
            const size = await sizeSelector(value, buffer);

            let actualStep: number;
            if (typeof stepOrTimeMsOrSelector === "number") {
              // Fixed step
              actualStep = stepOrTimeMsOrSelector;
            } else if (typeof stepOrTimeMsOrSelector === "function") {
              // Dynamic step
              const stepSelector = stepOrTimeMsOrSelector as (value: VALUE, buffer: VALUE[]) => number | Promise<number>;
              actualStep = await stepSelector(value, buffer);
            } else {
              // Default step = size
              actualStep = size;
            }

            while (buffer.length >= windowStart + size && size > 0) {
              yield buffer.slice(windowStart, windowStart + size);
              windowStart += actualStep;
              if (actualStep <= 0) break;
            }
          }
        } else {
          // Stateful window
          const selector = stepOrTimeMsOrSelector as (state: STATE, value: VALUE, buffer: VALUE[]) => any;
          const result = await selector(state!, value, buffer);

          if (typeof result[0] === "boolean") {
            // Stateful predicate: [boolean, STATE]
            const [shouldEmit, newState] = result;
            state = newState;
            if (shouldEmit) {
              yield [...buffer];
              buffer.length = 0;
              timestamps.length = 0;
              windowStart = 0;
            }
          } else if (result.length === 2) {
            // Stateful size: [number, STATE]
            const [size, newState] = result;
            state = newState;
            const actualStep = size;

            while (buffer.length >= windowStart + size && size > 0) {
              yield buffer.slice(windowStart, windowStart + size);
              windowStart += actualStep;
              if (actualStep <= 0) break;
            }
          } else {
            // Stateful size with step: [number, number, STATE]
            const [size, actualStep, newState] = result;
            state = newState;

            while (buffer.length >= windowStart + size && size > 0) {
              yield buffer.slice(windowStart, windowStart + size);
              windowStart += actualStep;
              if (actualStep <= 0) break;
            }
          }
        }
      }
    });

export namespace window {
  export type SizeSelector<VALUE> = (value: VALUE, buffer: VALUE[]) => number | Promise<number>;
  export type StepSelector<VALUE> = (value: VALUE, buffer: VALUE[]) => number | Promise<number>;
  export type Predicate<VALUE> = (buffer: VALUE[], value: VALUE) => boolean | Promise<boolean>;
  export type StatefulSelector<VALUE, STATE> = (state: STATE, value: VALUE, buffer: VALUE[]) => [boolean, STATE] | [number, STATE] | [number, number, STATE] | Promise<[boolean, STATE] | [number, STATE] | [number, number, STATE]>;
  export interface Transformer {
    <VALUE>(size: number): (stream: Stream<VALUE>) => Stream<VALUE[]>;
    <VALUE>(size: number, step: number): (stream: Stream<VALUE>) => Stream<VALUE[]>;
    <VALUE>(sizeSelector: SizeSelector<VALUE>): (stream: Stream<VALUE>) => Stream<VALUE[]>;
    <VALUE>(sizeSelector: SizeSelector<VALUE>, step: number): (stream: Stream<VALUE>) => Stream<VALUE[]>;
    <VALUE>(size: number, stepSelector: StepSelector<VALUE>): (stream: Stream<VALUE>) => Stream<VALUE[]>;
    <VALUE>(sizeSelector: SizeSelector<VALUE>, stepSelector: StepSelector<VALUE>): (stream: Stream<VALUE>) => Stream<VALUE[]>;
    <VALUE>(predicate: Predicate<VALUE>): (stream: Stream<VALUE>) => Stream<VALUE[]>;
    <VALUE, STATE>(initialState: STATE, selector: StatefulSelector<VALUE, STATE>): (stream: Stream<VALUE>) => Stream<VALUE[]>;
    <VALUE>(timeMs: number, isTime: true): (stream: Stream<VALUE>) => Stream<VALUE[]>;
    <VALUE>(size: number, timeMs: number, step?: number): (stream: Stream<VALUE>) => Stream<VALUE[]>;
  }
}
