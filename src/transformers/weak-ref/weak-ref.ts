import { Stream } from "../../stream";

let counter = 0n;
/**
 * Emits ABORTED when object is garbage collected.
 * Useful for automatic cleanup based on object lifetime.
 *
 * @example
 * ```typescript
 * const element = document.createElement('div');
 *
 * stream
 *   .pipe(weakRef(element))
 *   .listen(value => {
 *     if (value === Stream.Controller.ABORTED) {
 *       console.log('Element GC\'d');
 *     } else {
 *       element.textContent = String(value);
 *     }
 *   });
 * ```
 */
export function weakRef<VALUE>(
  object: object,
): Stream.Transformer<Stream<VALUE>, Stream<VALUE | Stream.Controller.Aborted>> {
  return function (source) {
    return new Stream<VALUE | Stream.Controller.Aborted>(async function* (this) {
      const ref = new WeakRef(object);

      if (!ref.deref()) {
        this.push(Stream.Controller.ABORTED);
        return;
      }
      const id = counter++;
      const registry = new FinalizationRegistry((heldValue) => {
        if (heldValue === id) this.push(Stream.Controller.ABORTED);
      });
      registry.register(object, id, object);
      yield* source;
    });
  };
}
