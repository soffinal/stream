import { map } from "../map";

/**
 * Extract object property
 *
 * @example
 * ```typescript
 * stream.pipe(pluck("name"))
 * ```
 */
export const pluck = <T, K extends keyof T>(key: K) => map<T, {}, T[K]>({}, (_, value) => [value[key], {}]);
