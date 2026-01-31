import { Stream } from "../../stream";

export function snapshot<NAME extends string>(
  name: NAME,
): <INPUT extends Stream<any>>(source: INPUT) => INPUT & { [K in NAME]: INPUT } {
  return (source) => {
    const output = new Stream(source) as any;

    Object.defineProperty(output, name, {
      value: source,
      enumerable: true,
      configurable: false,
    });

    return output;
  };
}
