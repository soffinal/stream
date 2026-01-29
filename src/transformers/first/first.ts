import { take } from "../take/take";

/**
 * Emit only first value
 * 
 * @example
 * ```typescript
 * stream.pipe(first())
 * ```
 */
export const first = <T>() => take<T>(1);
