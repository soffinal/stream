import { Stream } from "../stream.ts";

export const auditTime: auditTime.Transformer = <VALUE, STATE = any>(
  arg1: number | STATE | ((value: VALUE) => number | Promise<number>),
  arg2?: ((value: VALUE) => boolean | Promise<boolean>) | ((state: STATE, value: VALUE) => [number | boolean, number | STATE, STATE?] | Promise<[number | boolean, number | STATE, STATE?]>)
) => {
  return (stream: Stream<VALUE>): Stream<VALUE> => {
    if (typeof arg1 === 'number' && arg2 === undefined) {
      // Fixed duration audit
      const ms = arg1;
      return new Stream<VALUE>(async function* () {
        const queue: VALUE[] = [];
        let resolver: Function | undefined;
        let lastValue: VALUE | undefined;
        let timeoutId: NodeJS.Timeout | undefined;

        const streamAbort = stream.listen((value) => {
          lastValue = value;
          if (timeoutId) clearTimeout(timeoutId);

          timeoutId = setTimeout(() => {
            if (lastValue !== undefined) {
              queue.push(lastValue);
              resolver?.();
            }
          }, ms);
        });

        try {
          while (true) {
            if (queue.length) {
              yield queue.shift()!;
            } else {
              await new Promise((resolve) => (resolver = resolve));
            }
          }
        } finally {
          streamAbort();
          if (timeoutId) clearTimeout(timeoutId);
        }
      });
    }
    
    if (typeof arg1 === 'function' && arg2 === undefined) {
      // Dynamic duration audit
      const durationFn = arg1 as (value: VALUE) => number | Promise<number>;
      return new Stream<VALUE>(async function* () {
        const queue: VALUE[] = [];
        let resolver: Function | undefined;
        let lastValue: VALUE | undefined;
        let timeoutId: NodeJS.Timeout | undefined;

        const streamAbort = stream.listen(async (value) => {
          lastValue = value;
          if (timeoutId) clearTimeout(timeoutId);
          
          const duration = await durationFn(value);
          timeoutId = setTimeout(() => {
            if (lastValue !== undefined) {
              queue.push(lastValue);
              resolver?.();
            }
          }, duration);
        });

        try {
          while (true) {
            if (queue.length) {
              yield queue.shift()!;
            } else {
              await new Promise((resolve) => (resolver = resolve));
            }
          }
        } finally {
          streamAbort();
          if (timeoutId) clearTimeout(timeoutId);
        }
      });
    }
    
    if (typeof arg1 === 'number' && typeof arg2 === 'function') {
      // Predicate-based audit with fixed duration
      const ms = arg1;
      const predicate = arg2 as (value: VALUE) => boolean | Promise<boolean>;
      return new Stream<VALUE>(async function* () {
        const queue: VALUE[] = [];
        let resolver: Function | undefined;
        let lastValue: VALUE | undefined;
        let timeoutId: NodeJS.Timeout | undefined;

        const streamAbort = stream.listen(async (value) => {
          const shouldAudit = await predicate(value);
          if (!shouldAudit) return;
          
          lastValue = value;
          if (timeoutId) clearTimeout(timeoutId);

          timeoutId = setTimeout(() => {
            if (lastValue !== undefined) {
              queue.push(lastValue);
              resolver?.();
            }
          }, ms);
        });

        try {
          while (true) {
            if (queue.length) {
              yield queue.shift()!;
            } else {
              await new Promise((resolve) => (resolver = resolve));
            }
          }
        } finally {
          streamAbort();
          if (timeoutId) clearTimeout(timeoutId);
        }
      });
    }
    
    // Stateful operations
    const initialState = arg1 as STATE;
    const accumulator = arg2 as (state: STATE, value: VALUE) => [number | boolean, number | STATE, STATE?] | Promise<[number | boolean, number | STATE, STATE?]>;
    
    return new Stream<VALUE>(async function* () {
      const queue: VALUE[] = [];
      let resolver: Function | undefined;
      let lastValue: VALUE | undefined;
      let timeoutId: NodeJS.Timeout | undefined;
      let state = initialState;

      const streamAbort = stream.listen(async (value) => {
        const result = await accumulator(state, value);
        
        if (result.length === 2) {
          // Stateful duration control
          const [duration, newState] = result as [number, STATE];
          state = newState;
          
          lastValue = value;
          if (timeoutId) clearTimeout(timeoutId);

          timeoutId = setTimeout(() => {
            if (lastValue !== undefined) {
              queue.push(lastValue);
              resolver?.();
            }
          }, duration);
        } else {
          // Stateful predicate audit
          const [shouldAudit, duration, newState] = result as [boolean, number, STATE];
          state = newState;
          
          if (!shouldAudit) return;
          
          lastValue = value;
          if (timeoutId) clearTimeout(timeoutId);

          timeoutId = setTimeout(() => {
            if (lastValue !== undefined) {
              queue.push(lastValue);
              resolver?.();
            }
          }, duration);
        }
      });

      try {
        while (true) {
          if (queue.length) {
            yield queue.shift()!;
          } else {
            await new Promise((resolve) => (resolver = resolve));
          }
        }
      } finally {
        streamAbort();
        if (timeoutId) clearTimeout(timeoutId);
      }
    });
  };
};

export namespace auditTime {
  export type DurationFunction<VALUE> = (value: VALUE) => number | Promise<number>;
  export type Predicate<VALUE> = (value: VALUE) => boolean | Promise<boolean>;
  export type StatefulDurationAccumulator<VALUE, STATE> = (state: STATE, value: VALUE) => [number, STATE] | Promise<[number, STATE]>;
  export type StatefulPredicateAccumulator<VALUE, STATE> = (state: STATE, value: VALUE) => [boolean, number, STATE] | Promise<[boolean, number, STATE]>;
  export interface Transformer {
    <VALUE>(ms: number): (stream: Stream<VALUE>) => Stream<VALUE>;
    <VALUE>(durationFn: DurationFunction<VALUE>): (stream: Stream<VALUE>) => Stream<VALUE>;
    <VALUE, STATE>(initialState: STATE, accumulator: StatefulDurationAccumulator<VALUE, STATE>): (stream: Stream<VALUE>) => Stream<VALUE>;
    <VALUE>(ms: number, predicate: Predicate<VALUE>): (stream: Stream<VALUE>) => Stream<VALUE>;
    <VALUE, STATE>(initialState: STATE, accumulator: StatefulPredicateAccumulator<VALUE, STATE>): (stream: Stream<VALUE>) => Stream<VALUE>;
  }
}
