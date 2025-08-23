import { test, expect } from "bun:test";
import { Stream } from "../stream.ts";
import { rateLimit } from "./rate-limit.ts";

test("rateLimit - sliding window behavior", async () => {
  const source = new Stream<number>();
  const limited = source.pipe(rateLimit(2, 100)); // Max 2 per 100ms window

  const results: number[] = [];
  const timestamps: number[] = [];

  limited.listen((value) => {
    results.push(value);
    timestamps.push(Date.now());
  });

  const start = Date.now();

  // Push 5 items immediately - only first 2 should pass
  source.push(1, 2, 3, 4, 5);

  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(results).toEqual([1, 2]); // Only first 2 allowed

  // Wait for window to slide (110ms total)
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Push more items - should be allowed now
  source.push(6, 7, 8);

  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(results).toEqual([1, 2, 6, 7]); // 2 more allowed in new window

  // Verify timing - first 2 should be ~0ms, next 2 should be ~110ms later
  expect(timestamps[0] - start).toBeLessThan(20);
  expect(timestamps[1] - start).toBeLessThan(20);
  expect(timestamps[2] - start).toBeGreaterThan(100);
  expect(timestamps[3] - start).toBeGreaterThan(100);
});

test("rateLimit - continuous sliding window", async () => {
  const source = new Stream<number>();
  const limited = source.pipe(rateLimit(1, 50)); // Max 1 per 50ms

  const results: number[] = [];
  limited.listen((value) => results.push(value));

  // Push items at different intervals
  source.push(1); // t=0, allowed

  await new Promise((resolve) => setTimeout(resolve, 25));
  source.push(2); // t=25, blocked (within 50ms window)

  await new Promise((resolve) => setTimeout(resolve, 30));
  source.push(3); // t=55, allowed (outside 50ms window)

  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(results).toEqual([1, 3]); // 2 was blocked
});

test("rateLimit - dynamic count", async () => {
  const source = new Stream<{ priority: "high" | "low"; data: number }>();
  const limited = source.pipe(
    rateLimit(
      (item) => (item.priority === "high" ? 5 : 2), // High priority gets higher limit
      100
    )
  );

  const results: any[] = [];
  limited.listen((item) => results.push(item));

  // Push mixed priority items
  source.push(
    { priority: "low", data: 1 },
    { priority: "low", data: 2 },
    { priority: "low", data: 3 }, // Should be blocked
    { priority: "high", data: 4 },
    { priority: "high", data: 5 },
    { priority: "high", data: 6 }
  );

  await new Promise((resolve) => setTimeout(resolve, 10));

  expect(results).toEqual([
    { priority: "low", data: 1 },
    { priority: "low", data: 2 },
    { priority: "high", data: 4 },
    { priority: "high", data: 5 },
    { priority: "high", data: 6 },
  ]); // Low priority item 3 blocked, high priority items allowed
});

test("rateLimit - stateful rate limiting", async () => {
  interface User {
    id: string;
    action: string;
  }

  const source = new Stream<User>();
  const limited = source.pipe(
    rateLimit(
      { totalCount: 0 }, // Track total processed items
      (state, user) => {
        const newCount = state.totalCount + 1;
        const maxAllowed = user.id === "premium" ? 5 : 2;
        const shouldAllow = newCount <= maxAllowed;

        return [shouldAllow, maxAllowed, 100, { totalCount: newCount }]; // [boolean, count, windowMs, newState]
      }
    )
  );

  const results: User[] = [];
  limited.listen((user) => results.push(user));

  // Test dynamic limits based on user type
  source.push(
    { id: "user1", action: "read" }, // limit=2, allowed (1st item)
    { id: "user1", action: "write" }, // limit=2, allowed (2nd item)
    { id: "premium", action: "read" }, // limit=5, allowed (3rd item)
    { id: "premium", action: "write" }, // limit=5, allowed (4th item)
    { id: "premium", action: "delete" }, // limit=5, allowed (5th item)
    { id: "user1", action: "delete" } // limit=2, blocked (would be 6th item, exceeds limit=2)
  );

  await new Promise((resolve) => setTimeout(resolve, 10));

  expect(results).toEqual([
    { id: "user1", action: "read" },
    { id: "user1", action: "write" },
    { id: "premium", action: "read" },
    { id: "premium", action: "write" },
    { id: "premium", action: "delete" },
  ]); // Last user1 action blocked because total limit reached
});

test("rateLimit - real-world: API request throttling", async () => {
  interface ApiRequest {
    endpoint: string;
    method: string;
    timestamp: number;
  }

  const requests = new Stream<ApiRequest>();
  const throttled = requests.pipe(rateLimit(3, 1000)); // Max 3 requests per second

  const results: ApiRequest[] = [];
  const rejectedCount = { value: 0 };

  throttled.listen((req) => results.push(req));

  // Simulate burst of API requests
  const startTime = Date.now();
  for (let i = 1; i <= 10; i++) {
    requests.push({
      endpoint: `/api/data/${i}`,
      method: "GET",
      timestamp: Date.now(),
    });
  }

  await new Promise((resolve) => setTimeout(resolve, 50));

  // Should only allow first 3 requests
  expect(results.length).toBe(3);
  expect(results[0].endpoint).toBe("/api/data/1");
  expect(results[1].endpoint).toBe("/api/data/2");
  expect(results[2].endpoint).toBe("/api/data/3");

  // Wait for window to reset
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Send more requests - should be allowed now
  for (let i = 11; i <= 13; i++) {
    requests.push({
      endpoint: `/api/data/${i}`,
      method: "GET",
      timestamp: Date.now(),
    });
  }

  await new Promise((resolve) => setTimeout(resolve, 50));

  expect(results.length).toBe(6); // 3 original + 3 new
});

test("rateLimit - burst then steady state", async () => {
  const source = new Stream<string>();
  const limited = source.pipe(rateLimit(2, 100));

  const results: string[] = [];
  limited.listen((msg) => results.push(msg));

  // Initial burst
  source.push("burst1", "burst2", "burst3", "burst4");

  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(results).toEqual(["burst1", "burst2"]);

  // Steady state - one every 60ms (within rate limit)
  setTimeout(() => source.push("steady1"), 60);
  setTimeout(() => source.push("steady2"), 120);
  setTimeout(() => source.push("steady3"), 180);

  await new Promise((resolve) => setTimeout(resolve, 200));

  expect(results).toEqual(["burst1", "burst2", "steady2", "steady3"]);
});
