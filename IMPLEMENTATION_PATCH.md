# Stream.ts Implementation Changes

## 1. Add _startGenerator method (after withContext method, around line 310)

```typescript
/**
 * Starts the generator if it exists and has listeners
 */
protected _startGenerator(): void {
  if (!this._functionGenerator || this._generator || !this.hasListeners) return;
  
  this._generator = this._functionGenerator();
  (async () => {
    try {
      for await (const value of this._generator!) {
        this.push(value);
      }
    } catch (e) {
      // Generator stopped
    }
  })();
}
```

## 2. Add getSource method (after _startGenerator)

```typescript
/**
 * Gets the current source generator function.
 * Returns a new Stream that wraps the generator for composition.
 * 
 * @returns Stream wrapping current source, or undefined if no source
 * 
 * @example
 * ```typescript
 * const target = new Stream<number>();
 * target.setSource(source1);
 * 
 * // Add new source while preserving old one
 * const oldSource = target.getSource();
 * if (oldSource) {
 *   target.setSource(source2.pipe(merge(oldSource)));
 * }
 * ```
 */
getSource(): Stream<VALUE> | undefined {
  return this._functionGenerator ? new Stream(this._functionGenerator) : undefined;
}
```

## 3. Add setSource method (after getSource)

```typescript
/**
 * Sets or replaces the generator function for this stream.
 * If stream has active listeners, restarts the generator immediately.
 * 
 * @param streamOrFn - New generator function or stream to use as source
 * 
 * @example
 * ```typescript
 * const stream = new Stream<number>();
 * stream.listen(console.log);
 * 
 * // Set source dynamically
 * stream.setSource(source1);
 * 
 * // Add source while preserving old one
 * const oldSource = stream.getSource();
 * if (oldSource) {
 *   stream.setSource(source2.pipe(merge(oldSource)));
 * }
 * ```
 */
setSource(streamOrFn: Stream<VALUE> | Stream.FunctionGenerator<VALUE>): void {
  // Stop old generator
  if (this._generator) {
    this._generator.return();
    this._generator = undefined;
  }

  // Set new generator function
  this._functionGenerator = streamOrFn instanceof Stream 
    ? () => streamOrFn[Symbol.asyncIterator]() 
    : streamOrFn;

  // Restart generator if we have listeners
  if (this.hasListeners) {
    this._startGenerator();
  }
}
```

## 4. Modify listen method (around line 350)

REPLACE this code:
```typescript
if (self._functionGenerator && self._listeners.size === 1) {
  self._generator = self._functionGenerator();

  (async () => {
    for await (const value of self._generator!) {
      self.push(value);
    }
  })();
}
```

WITH:
```typescript
if (self._listeners.size === 1) {
  self._startGenerator();
}
```

## 5. Update autoBind in constructor (around line 160)

ADD these two lines to the autoBind section:
```typescript
this.getSource = this.getSource.bind(this);
this.setSource = this.setSource.bind(this);
```

The complete autoBind section should look like:
```typescript
if (Stream._config.autoBind) {
  this.push = this.push.bind(this);
  this.listen = this.listen.bind(this);
  this.then = this.then.bind(this);
  this.pipe = this.pipe.bind(this);
  this.clear = this.clear.bind(this);
  this.withContext = this.withContext.bind(this);
  this.getSource = this.getSource.bind(this);
  this.setSource = this.setSource.bind(this);
}
```

## Summary

These changes enable dynamic source management:
- `_startGenerator()` - Extracted logic for starting generators
- `getSource()` - Retrieve current source for composition
- `setSource()` - Replace source and restart if listeners exist
- Modified `listen()` - Uses `_startGenerator()` for consistency
