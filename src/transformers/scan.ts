import { Stream } from "../stream.ts";

export const scan: scan.Transformer =
  <VALUE, RESULT>(
    initialValue: RESULT,
    scanner: scan.Scanner<VALUE, RESULT>
  ) =>
  (stream: Stream<VALUE>): Stream<RESULT> =>
    new Stream<RESULT>(async function* () {
      let acc = initialValue;
      let first = true;

      for await (const value of stream) {
        if (first) {
          yield acc;
          first = false;
        }

        acc = await scanner(acc, value);
        yield acc;
      }
    });

export namespace scan {
  export type Scanner<VALUE, RESULT> = (acc: RESULT, value: VALUE) => RESULT | Promise<RESULT>;
  export interface Transformer {
    <VALUE, RESULT>(initialValue: RESULT, scanner: Scanner<VALUE, RESULT>): (
      stream: Stream<VALUE>
    ) => Stream<RESULT>;
  }
}
