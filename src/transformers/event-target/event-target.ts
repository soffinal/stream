import { Stream } from "../../stream";

/**
 * Emits events from EventTarget.
 *
 * @example
 * ```typescript
 * const button = document.querySelector('button');
 *
 * new Stream()
 *   .pipe(eventTarget(button, 'click'))
 *   .listen(event => console.log('Clicked!', event));
 * ```
 */
export function eventTarget<VALUE, K extends keyof HTMLElementEventMap>(
  target: EventTarget,
  eventType: K,
): Stream.Transformer<Stream<VALUE>, Stream<VALUE | HTMLElementEventMap[K]>>;

export function eventTarget<VALUE, E extends Event = Event>(
  target: EventTarget,
  eventType: string,
): Stream.Transformer<Stream<VALUE>, Stream<VALUE | E>>;

export function eventTarget<VALUE, E extends Event = Event>(
  target: EventTarget,
  eventType: string,
): Stream.Transformer<Stream<VALUE>, Stream<VALUE | E>> {
  return function (source) {
    return new Stream<VALUE | E>((self) => {
      target.addEventListener(eventType, listener);

      return source.listen((v) => self.push(v)).addCleanup(() => target.removeEventListener(eventType, listener));

      function listener(e: Event) {
        self.push(e as E);
      }
    });
  };
}
