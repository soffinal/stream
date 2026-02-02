import { Stream } from "../../stream";

export function runner<VALUE>(): Stream.Transformer<Stream<VALUE>, Stream<VALUE> & { runner: runner.Runner }> {
  return (source) => {
    let onRun: Stream<void> | undefined;
    let onStop: Stream<void> | undefined;
    let isRunning = false;

    let ctrl: Stream.Controller | undefined;

    const output = new Stream<VALUE>();

    Object.defineProperty(output, "runner", {
      value: {
        run,
        stop,
        get isRunning() {
          return isRunning;
        },
        get onRun() {
          if (!onRun) onRun = new Stream<void>();
          return onRun;
        },
        get onStop() {
          if (!onStop) onStop = new Stream<void>();
          return onStop;
        },
      },
      enumerable: true,
      configurable: false,
    });

    return output as never;

    function run() {
      if (isRunning) return;
      isRunning = true;
      if (onRun) onRun.push();
      ctrl = source.listen(output.push.bind(output));
    }
    function stop() {
      if (!isRunning) return;
      isRunning = false;
      if (onStop) onStop.push();
      ctrl?.abort();
    }
  };
}

export namespace runner {
  export type Runner = {
    run: () => void;
    stop: () => void;
    readonly onRun: Stream<void>;
    readonly onStop: Stream<void>;
    readonly isRunnig: boolean;
  };
}
