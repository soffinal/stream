import { Stream } from "../../stream";
import { replay } from "../replay/replay";

/**
 * Prepend initial values
 *
 * @example
 * ```typescript
 * stream.pipe(startWith(0, 1, 2))
 * ```
 */
export const startWith =
  <T>(...values: T[]) =>
  (source: Stream<T>) =>
    source.pipe(replay({ initialValues: values }));
