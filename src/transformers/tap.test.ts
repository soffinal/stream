import { test, expect } from "bun:test";
import { Stream } from "../stream.ts";
import { tap } from "./tap.ts";

test("tap - basic side effect", async () => {
  const source = new Stream<number>();
  const sideEffects: number[] = [];
  const tapped = source.pipe(tap(value => sideEffects.push(value * 2)));
  
  const results: number[] = [];
  tapped.listen(value => results.push(value));
  
  source.push(1, 2, 3);
  await new Promise(resolve => setTimeout(resolve, 0));
  
  expect(results).toEqual([1, 2, 3]); // Original values unchanged
  expect(sideEffects).toEqual([2, 4, 6]); // Side effects executed
});

test("tap - logging side effect", async () => {
  const source = new Stream<string>();
  const logs: string[] = [];
  const tapped = source.pipe(tap(value => logs.push(`Processing: ${value}`)));
  
  const results: string[] = [];
  tapped.listen(value => results.push(value));
  
  source.push("hello", "world");
  await new Promise(resolve => setTimeout(resolve, 0));
  
  expect(results).toEqual(["hello", "world"]);
  expect(logs).toEqual(["Processing: hello", "Processing: world"]);
});

test("tap - async side effect", async () => {
  const source = new Stream<number>();
  const asyncEffects: number[] = [];
  
  const tapped = source.pipe(tap(async value => {
    await new Promise(resolve => setTimeout(resolve, 1));
    asyncEffects.push(value);
  }));
  
  const results: number[] = [];
  tapped.listen(value => results.push(value));
  
  source.push(1, 2);
  
  expect(results).toEqual([1, 2]); // Immediate
  
  await new Promise(resolve => setTimeout(resolve, 50));
  expect(asyncEffects).toEqual([1, 2]); // After async completion
});

test("tap - real-world: analytics tracking", async () => {
  interface UserAction {
    type: string;
    userId: string;
    timestamp: number;
  }
  
  const userActions = new Stream<UserAction>();
  const analyticsEvents: UserAction[] = [];
  
  const tracked = userActions.pipe(tap(action => {
    // Simulate analytics tracking
    analyticsEvents.push({
      ...action,
      timestamp: Date.now() // Update timestamp for tracking
    });
  }));
  
  const results: UserAction[] = [];
  tracked.listen(action => results.push(action));
  
  const originalAction = { type: "click", userId: "user1", timestamp: 123456 };
  userActions.push(originalAction);
  
  expect(results).toEqual([originalAction]); // Original unchanged
  expect(analyticsEvents).toHaveLength(1);
  expect(analyticsEvents[0].type).toBe("click");
});

test("tap - real-world: debugging pipeline", async () => {
  const source = new Stream<number>();
  const debugLogs: Array<{ stage: string; value: any }> = [];
  
  const pipeline = source
    .pipe(tap(value => debugLogs.push({ stage: "input", value })))
    .pipe(map(x => x * 2))
    .pipe(tap(value => debugLogs.push({ stage: "after-map", value })))
    .pipe(filter(x => x > 5))
    .pipe(tap(value => debugLogs.push({ stage: "after-filter", value })));
  
  const results: number[] = [];
  pipeline.listen(value => results.push(value));
  
  source.push(1, 3, 5);
  await new Promise(resolve => setTimeout(resolve, 0));
  
  expect(results).toEqual([6, 10]);
  expect(debugLogs).toEqual([
    { stage: "input", value: 1 },
    { stage: "after-map", value: 2 },
    { stage: "input", value: 3 },
    { stage: "after-map", value: 6 },
    { stage: "after-filter", value: 6 },
    { stage: "input", value: 5 },
    { stage: "after-map", value: 10 },
    { stage: "after-filter", value: 10 }
  ]);
});

test("tap - edge case: error in side effect", async () => {
  const source = new Stream<number>();
  const tapped = source.pipe(tap(value => {
    if (value === 2) throw new Error("Side effect error");
  }));
  
  const results: number[] = [];
  tapped.listen(value => results.push(value));
  
  source.push(1, 2, 3);
  await new Promise(resolve => setTimeout(resolve, 0));
  
  // Stream should continue despite side effect error
  expect(results).toEqual([1, 2, 3]);
});