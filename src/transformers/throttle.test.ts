import { test, expect } from "bun:test";
import { Stream } from "../stream.ts";
import { throttle } from "./throttle.ts";

test("throttle - basic fixed interval", async () => {
  const source = new Stream<number>();
  const throttled = source.pipe(throttle(100));
  
  const results: number[] = [];
  throttled.listen(value => results.push(value));
  
  source.push(1);
  source.push(2); // Should be throttled
  source.push(3); // Should be throttled
  
  await new Promise(resolve => setTimeout(resolve, 50));
  source.push(4); // Should be throttled
  
  await new Promise(resolve => setTimeout(resolve, 70));
  source.push(5); // Should pass through
  
  await new Promise(resolve => setTimeout(resolve, 50));
  
  expect(results).toEqual([1, 5]);
});

test("throttle - allows first value immediately", async () => {
  const source = new Stream<string>();
  const throttled = source.pipe(throttle(200));
  
  const results: string[] = [];
  throttled.listen(value => results.push(value));
  
  source.push("first");
  
  expect(results).toEqual(["first"]);
});

test("throttle - dynamic time selector", async () => {
  const source = new Stream<number>();
  const throttled = source.pipe(throttle(value => value * 50));
  
  const results: number[] = [];
  throttled.listen(value => results.push(value));
  
  source.push(1); // 50ms throttle
  source.push(2); // Should be throttled
  
  await new Promise(resolve => setTimeout(resolve, 70));
  source.push(4); // 200ms throttle, should pass
  source.push(5); // Should be throttled
  
  await new Promise(resolve => setTimeout(resolve, 50));
  
  expect(results).toEqual([1, 4]);
});

test("throttle - stateful time selector", async () => {
  const source = new Stream<number>();
  const throttled = source.pipe(throttle(100, (lastTime, value) => [
    Math.max(50, lastTime - 10), // Decreasing throttle time
    Math.max(50, lastTime - 10)
  ]));
  
  const results: number[] = [];
  throttled.listen(value => results.push(value));
  
  source.push(1);
  
  await new Promise(resolve => setTimeout(resolve, 60));
  source.push(2);
  
  await new Promise(resolve => setTimeout(resolve, 60));
  source.push(3);
  
  expect(results).toEqual([1, 2, 3]);
});

test("throttle - real-world: scroll events", async () => {
  interface ScrollEvent {
    scrollY: number;
    timestamp: number;
  }
  
  const scrollEvents = new Stream<ScrollEvent>();
  const throttledScroll = scrollEvents.pipe(throttle(16)); // ~60fps
  
  const scrollHandlers: ScrollEvent[] = [];
  throttledScroll.listen(event => {
    // Simulate expensive scroll handler
    scrollHandlers.push(event);
  });
  
  const now = Date.now();
  
  // Simulate rapid scroll events
  for (let i = 0; i < 10; i++) {
    scrollEvents.push({ scrollY: i * 100, timestamp: now + i });
  }
  
  await new Promise(resolve => setTimeout(resolve, 50));
  
  // Should only process first event and maybe one more
  expect(scrollHandlers.length).toBeLessThanOrEqual(3);
  expect(scrollHandlers[0].scrollY).toBe(0);
});

test("throttle - real-world: API rate limiting", async () => {
  interface ApiRequest {
    id: string;
    data: any;
  }
  
  const apiRequests = new Stream<ApiRequest>();
  const throttledRequests = apiRequests.pipe(throttle(1000)); // Max 1 request per second
  
  const processedRequests: ApiRequest[] = [];
  throttledRequests.listen(request => {
    // Simulate API call
    processedRequests.push(request);
  });
  
  // Simulate burst of requests
  apiRequests.push({ id: "req1", data: { action: "create" } });
  apiRequests.push({ id: "req2", data: { action: "update" } });
  apiRequests.push({ id: "req3", data: { action: "delete" } });
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  apiRequests.push({ id: "req4", data: { action: "read" } });
  
  await new Promise(resolve => setTimeout(resolve, 600));
  
  apiRequests.push({ id: "req5", data: { action: "create" } });
  
  await new Promise(resolve => setTimeout(resolve, 100));
  
  expect(processedRequests).toEqual([
    { id: "req1", data: { action: "create" } },
    { id: "req5", data: { action: "create" } }
  ]);
});

test("throttle - real-world: button click protection", async () => {
  interface ClickEvent {
    buttonId: string;
    timestamp: number;
  }
  
  const buttonClicks = new Stream<ClickEvent>();
  const throttledClicks = buttonClicks.pipe(throttle(500)); // Prevent double-clicks
  
  const actionExecutions: ClickEvent[] = [];
  throttledClicks.listen(click => {
    // Simulate action execution
    actionExecutions.push(click);
  });
  
  const now = Date.now();
  
  // Simulate rapid clicking
  buttonClicks.push({ buttonId: "submit", timestamp: now });
  buttonClicks.push({ buttonId: "submit", timestamp: now + 50 });
  buttonClicks.push({ buttonId: "submit", timestamp: now + 100 });
  
  await new Promise(resolve => setTimeout(resolve, 600));
  
  buttonClicks.push({ buttonId: "submit", timestamp: now + 700 });
  
  await new Promise(resolve => setTimeout(resolve, 100));
  
  expect(actionExecutions).toEqual([
    { buttonId: "submit", timestamp: now },
    { buttonId: "submit", timestamp: now + 700 }
  ]);
});

test("throttle - edge case: zero interval", async () => {
  const source = new Stream<number>();
  const throttled = source.pipe(throttle(0));
  
  const results: number[] = [];
  throttled.listen(value => results.push(value));
  
  source.push(1);
  source.push(2);
  source.push(3);
  
  await new Promise(resolve => setTimeout(resolve, 10));
  
  expect(results).toEqual([1, 2, 3]);
});

test("throttle - edge case: single value", async () => {
  const source = new Stream<string>();
  const throttled = source.pipe(throttle(100));
  
  const results: string[] = [];
  throttled.listen(value => results.push(value));
  
  source.push("single");
  
  await new Promise(resolve => setTimeout(resolve, 50));
  
  expect(results).toEqual(["single"]);
});