import { test, expect } from "bun:test";
import { Stream } from "../stream.ts";
import { startWith } from "./start-with.ts";

test("startWith - single static value", async () => {
  const source = new Stream<number>();
  const withDefault = source.pipe(startWith([0]));

  const results: number[] = [];
  withDefault.listen((value) => results.push(value));

  source.push(1, 2, 3);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([0, 1, 2, 3]);
});

test("startWith - multiple static values", async () => {
  const source = new Stream<number>();
  const withDefaults = source.pipe(startWith([0, -1, -2]));

  const results: number[] = [];
  withDefaults.listen((value) => results.push(value));

  source.push(1, 2, 3);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([0, -1, -2, 1, 2, 3]);
});

test("startWith - factory function returning single value", async () => {
  const source = new Stream<number>();
  const withTimestamp = source.pipe(startWith(() => [Date.now()]));

  const results: number[] = [];
  withTimestamp.listen((value) => results.push(value));

  source.push(1, 2);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toHaveLength(3);
  expect(typeof results[0]).toBe("number");
  expect(results[1]).toBe(1);
  expect(results[2]).toBe(2);
});

test("startWith - factory function returning multiple values", async () => {
  const source = new Stream<string>();
  const withHeaders = source.pipe(startWith(() => ["header1", "header2", "header3"]));

  const results: string[] = [];
  withHeaders.listen((value) => results.push(value));

  source.push("data1", "data2");
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual(["header1", "header2", "header3", "data1", "data2"]);
});

test("startWith - async factory function", async () => {
  const source = new Stream<string>();
  const withAsyncDefaults = source.pipe(
    startWith(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return ["async1", "async2"];
    })
  );

  const results: string[] = [];
  withAsyncDefaults.listen((value) => results.push(value));

  source.push("data1", "data2");
  await new Promise((resolve) => setTimeout(resolve, 50));

  expect(results).toEqual(["async1", "async2", "data1", "data2"]);
});

test("startWith - factory function with empty array", async () => {
  const source = new Stream<number>();
  const withEmpty = source.pipe(startWith(() => [] as number[]));

  const results: number[] = [];
  withEmpty.listen((value) => results.push(value));

  source.push(1, 2, 3);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([1, 2, 3]);
});

test("startWith - different types", async () => {
  const source = new Stream<string | number>();
  const withMixed = source.pipe(startWith(["start", 42]));

  const results: (string | number)[] = [];
  withMixed.listen((value) => results.push(value));

  source.push("hello", 100, "world");
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual(["start", 42, "hello", 100, "world"]);
});

test("startWith - real-world: default configuration", async () => {
  interface Config {
    theme: string;
    language: string;
  }

  const configUpdates = new Stream<Partial<Config>>();
  const config = configUpdates.pipe(startWith([{ theme: "light", language: "en" } as Partial<Config>]));

  const results: Partial<Config>[] = [];
  config.listen((cfg) => results.push(cfg));

  configUpdates.push({ theme: "dark" }, { language: "es" });
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([{ theme: "light", language: "en" }, { theme: "dark" }, { language: "es" }]);
});

test("startWith - real-world: loading states", async () => {
  interface LoadingState {
    status: "loading" | "success" | "error";
    data?: any;
  }

  const dataUpdates = new Stream<LoadingState>();
  const withInitialLoading = dataUpdates.pipe(startWith([{ status: "loading" } as LoadingState]));

  const results: LoadingState[] = [];
  withInitialLoading.listen((state) => results.push(state));

  dataUpdates.push({ status: "success", data: { users: ["Alice", "Bob"] } }, { status: "error" });
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([
    { status: "loading" },
    { status: "success", data: { users: ["Alice", "Bob"] } },
    { status: "error" },
  ]);
});

test("startWith - real-world: CSV with headers", async () => {
  const csvData = new Stream<string>();
  const withHeaders = csvData.pipe(startWith(["Name,Age,Email"]));

  const results: string[] = [];
  withHeaders.listen((row) => results.push(row));

  csvData.push("John,25,john@example.com", "Jane,30,jane@example.com");
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual(["Name,Age,Email", "John,25,john@example.com", "Jane,30,jane@example.com"]);
});

test("startWith - real-world: dynamic session info", async () => {
  interface SessionEvent {
    type: string;
    timestamp: number;
    userId?: string;
  }

  const sessionEvents = new Stream<SessionEvent>();
  const withSessionStart = sessionEvents.pipe(
    startWith(() => [
      {
        type: "session_start",
        timestamp: Date.now(),
        userId: "user123",
      } as SessionEvent,
    ])
  );

  const results: SessionEvent[] = [];
  withSessionStart.listen((event) => results.push(event));

  const now = Date.now();
  sessionEvents.push({ type: "page_view", timestamp: now + 1000 }, { type: "click", timestamp: now + 2000 });
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toHaveLength(3);
  expect(results[0].type).toBe("session_start");
  expect(results[0].userId).toBe("user123");
  expect(results[1].type).toBe("page_view");
  expect(results[2].type).toBe("click");
});

test("startWith - real-world: API response with metadata", async () => {
  interface APIResponse<T> {
    data: T;
    metadata: {
      timestamp: number;
      version: string;
    };
  }

  const apiResponses = new Stream<APIResponse<any>>();
  const withInitialMeta = apiResponses.pipe(
    startWith(() => [
      {
        data: null,
        metadata: {
          timestamp: Date.now(),
          version: "1.0.0",
        },
      },
    ])
  );

  const results: APIResponse<any>[] = [];
  withInitialMeta.listen((response) => results.push(response));

  apiResponses.push(
    {
      data: { users: ["Alice"] },
      metadata: { timestamp: Date.now() + 1000, version: "1.0.0" },
    },
    {
      data: { posts: ["Post 1"] },
      metadata: { timestamp: Date.now() + 2000, version: "1.0.0" },
    }
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toHaveLength(3);
  expect(results[0].data).toBe(null);
  expect(results[0].metadata.version).toBe("1.0.0");
  expect(results[1].data.users).toEqual(["Alice"]);
  expect(results[2].data.posts).toEqual(["Post 1"]);
});

test("startWith - edge case: empty stream", async () => {
  const source = new Stream<number>();
  const withDefaults = source.pipe(startWith([1, 2, 3]));

  const results: number[] = [];
  withDefaults.listen((value) => results.push(value));

  // No values pushed to source
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([]); // startWith only emits when source emits
});

test("startWith - edge case: single source value", async () => {
  const source = new Stream<string>();
  const withPrefix = source.pipe(startWith(["prefix"]));

  const results: string[] = [];
  withPrefix.listen((value) => results.push(value));

  source.push("data");
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual(["prefix", "data"]);
});

test("startWith - edge case: factory function called only once", async () => {
  let callCount = 0;
  const source = new Stream<number>();
  const withCounter = source.pipe(
    startWith(() => {
      callCount++;
      return [callCount];
    })
  );

  const results: number[] = [];
  withCounter.listen((value) => results.push(value));

  source.push(1, 2, 3);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(callCount).toBe(1); // Factory called only once
  expect(results).toEqual([1, 1, 2, 3]); // First 1 is from factory, rest from source
});
