import { test, expect } from "bun:test";
import { Stream } from "../stream.ts";
import { skip } from "./skip.ts";

test("skip - basic count", async () => {
  const source = new Stream<number>();
  const skipped = source.pipe(skip(2));

  const results: number[] = [];
  skipped.listen((value) => results.push(value));

  source.push(1, 2, 3, 4, 5);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([3, 4, 5]);
});

test("skip - zero count", async () => {
  const source = new Stream<number>();
  const skipped = source.pipe(skip(0));

  const results: number[] = [];
  skipped.listen((value) => results.push(value));

  source.push(1, 2, 3);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([1, 2, 3]);
});

test("skip - count larger than stream", async () => {
  const source = new Stream<number>();
  const skipped = source.pipe(skip(10));

  const results: number[] = [];
  skipped.listen((value) => results.push(value));

  source.push(1, 2, 3);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([]);
});

test("skip - predicate based", async () => {
  const source = new Stream<number>();
  const afterNegatives = source.pipe(skip((n) => n < 0));

  const results: number[] = [];
  afterNegatives.listen((value) => results.push(value));

  source.push(-1, -2, 0, 1, -3, 2);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([0, 1, 2]); // Skip negative values, emit non-negative
});

test("skip - async predicate", async () => {
  const source = new Stream<string>();
  const afterShort = source.pipe(
    skip(async (s) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return s.length < 3;
    })
  );

  const results: string[] = [];
  afterShort.listen((value) => results.push(value));

  source.push("a", "bb", "ccc", "d", "eee");
  await new Promise((resolve) => setTimeout(resolve, 50));

  expect(results).toEqual(["ccc", "eee"]); // Skip short strings, emit long ones
});

test("skip - stateful predicate", async () => {
  const source = new Stream<number>();
  const skipUntilSum = source.pipe(
    skip(0, (sum, value) => {
      const newSum = sum + value;
      return [newSum < 10, newSum]; // Skip until sum >= 10
    })
  );

  const results: number[] = [];
  skipUntilSum.listen((value) => results.push(value));

  source.push(2, 3, 4, 1, 5, 2);
  await new Promise((resolve) => setTimeout(resolve, 0));


  expect(results).toEqual([1, 5, 2]); // Sum becomes 10 at value 1, so start emitting from 1
});

test("skip - stateful with complex state", async () => {
  interface State {
    count: number;
    seenEven: boolean;
  }

  const source = new Stream<number>();
  const skipUntilEvenAfter3 = source.pipe(
    skip({ count: 0, seenEven: false }, (state, value) => {
      const newCount = state.count + 1;
      const isEven = value % 2 === 0;
      const newSeenEven = state.seenEven || isEven;
      const shouldSkip = newCount <= 3 || !newSeenEven;

      return [shouldSkip, { count: newCount, seenEven: newSeenEven }];
    })
  );

  const results: number[] = [];
  skipUntilEvenAfter3.listen((value) => results.push(value));

  source.push(1, 3, 5, 2, 7, 9, 4);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([2, 7, 9, 4]); // Skip until after 3rd item AND we've seen an even number
});

test("skip - stream signal", async () => {
  const source = new Stream<number>();
  const trigger = new Stream<void>();
  const skipUntilTrigger = source.pipe(skip(trigger));

  const results: number[] = [];
  skipUntilTrigger.listen((value) => results.push(value));

  source.push(1, 2, 3);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(results).toEqual([]); // Nothing emitted yet

  trigger.push();
  source.push(4, 5, 6);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([4, 5, 6]); // Only values after trigger
});

test("skip - abort signal", async () => {
  const source = new Stream<number>();
  const controller = new AbortController();
  const skipUntilAbort = source.pipe(skip(controller.signal));

  const results: number[] = [];
  skipUntilAbort.listen((value) => results.push(value));

  source.push(1, 2, 3);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(results).toEqual([]); // Nothing emitted yet

  controller.abort();
  source.push(4, 5, 6);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([4, 5, 6]); // Only values after abort
});

test("skip - real-world: skip header rows", async () => {
  const csvRows = new Stream<string>();
  const dataRows = csvRows.pipe(skip(1)); // Skip header

  const results: string[] = [];
  dataRows.listen((row) => results.push(row));

  csvRows.push("Name,Age,Email", "John,25,john@example.com", "Jane,30,jane@example.com");
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual(["John,25,john@example.com", "Jane,30,jane@example.com"]);
});

test("skip - real-world: skip loading states", async () => {
  interface AppState {
    status: "loading" | "ready" | "error";
    data?: any;
  }

  const states = new Stream<AppState>();
  const readyStates = states.pipe(skip((state) => state.status === "loading"));

  const results: AppState[] = [];
  readyStates.listen((state) => results.push(state));

  states.push(
    { status: "loading" },
    { status: "loading" },
    { status: "ready", data: { users: [] } },
    { status: "loading" }, // This should not be skipped - only initial loading states
    { status: "error" }
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([{ status: "ready", data: { users: [] } }, { status: "error" }]);
});

test("skip - real-world: skip warmup period", async () => {
  interface SensorReading {
    temperature: number;
    timestamp: number;
  }

  const readings = new Stream<SensorReading>();
  const startTime = Date.now();
  const warmupMs = 1000;

  const stableReadings = readings.pipe(skip((reading) => reading.timestamp - startTime < warmupMs));

  const results: SensorReading[] = [];
  stableReadings.listen((reading) => results.push(reading));

  readings.push(
    { temperature: 20.1, timestamp: startTime + 100 },
    { temperature: 19.8, timestamp: startTime + 500 },
    { temperature: 20.5, timestamp: startTime + 1200 },
    { temperature: 20.3, timestamp: startTime + 1500 }
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([
    { temperature: 20.5, timestamp: startTime + 1200 },
    { temperature: 20.3, timestamp: startTime + 1500 },
  ]);
});

test("skip - real-world: skip until authentication", async () => {
  interface User {
    id: string;
    name: string;
    authenticated: boolean;
  }

  const userEvents = new Stream<User>();
  const authenticatedEvents = userEvents.pipe(
    skip({ hasAuth: false }, (state, user) => {
      const newHasAuth = state.hasAuth || user.authenticated;
      return [!newHasAuth, { hasAuth: newHasAuth }];
    })
  );

  const results: User[] = [];
  authenticatedEvents.listen((user) => results.push(user));

  userEvents.push(
    { id: "1", name: "Guest", authenticated: false },
    { id: "2", name: "Anonymous", authenticated: false },
    { id: "3", name: "John", authenticated: true },
    { id: "4", name: "Jane", authenticated: false }, // Should not be skipped
    { id: "5", name: "Bob", authenticated: true }
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([
    { id: "3", name: "John", authenticated: true },
    { id: "4", name: "Jane", authenticated: false },
    { id: "5", name: "Bob", authenticated: true },
  ]);
});

test("skip - edge case: empty stream", async () => {
  const source = new Stream<number>();
  const skipped = source.pipe(skip(5));

  const results: number[] = [];
  skipped.listen((value) => results.push(value));

  // No values pushed
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([]);
});

test("skip - edge case: single value with count", async () => {
  const source = new Stream<number>();
  const skipped = source.pipe(skip(1));

  const results: number[] = [];
  skipped.listen((value) => results.push(value));

  source.push(42);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([]);
});

test("skip - edge case: predicate never matches", async () => {
  const source = new Stream<number>();
  const skipped = source.pipe(skip((n) => n > 100)); // Never true for our test data

  const results: number[] = [];
  skipped.listen((value) => results.push(value));

  source.push(1, 2, 3, 4, 5);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([1, 2, 3, 4, 5]);
});
