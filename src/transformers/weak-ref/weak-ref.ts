import { Stream } from "../../stream";

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
  const ref = new WeakRef(object);
  const unregisterToken = {};
  return function (source) {
    return new Stream<VALUE | Stream.Controller.Aborted>((self) => {
      if (!ref.deref()) {
        self.push(Stream.Controller.ABORTED);
        return;
      }

      const registry = new FinalizationRegistry(() => {
        self.push(Stream.Controller.ABORTED);
      });

      const target = ref.deref();
      if (!target) {
        self.push(Stream.Controller.ABORTED);
        return;
      }

      registry.register(target, undefined, unregisterToken);

      return source.listen((v) => self.push(v)).addCleanup(() => registry.unregister(unregisterToken));
    });
  };
}
