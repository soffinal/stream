import { test, expect } from "bun:test";
import { Stream } from "../stream.ts";
import { take } from "./take.ts";

test("take - basic count limit", async () => {
  const source = new Stream<number>();
  const limited = source.pipe(take(3));
  
  const results: number[] = [];
  limited.listen(value => results.push(value));
  
  source.push(1, 2, 3, 4, 5, 6);
  await new Promise(resolve => setTimeout(resolve, 0));
  
  expect(results).toEqual([1, 2, 3]);
});

test("take - predicate based", async () => {
  const source = new Stream<number>();
  const untilNegative = source.pipe(take(n => n >= 0));
  
  const results: number[] = [];
  untilNegative.listen(value => results.push(value));
  
  source.push(1, 2, 3, -1, 4, 5);
  await new Promise(resolve => setTimeout(resolve, 0));
  
  expect(results).toEqual([1, 2, 3]);
});

test("take - async predicate", async () => {
  const source = new Stream<string>();
  const untilLong = source.pipe(take(async s => {
    await new Promise(resolve => setTimeout(resolve, 1));
    return s.length < 5;
  }));
  
  const results: string[] = [];
  untilLong.listen(value => results.push(value));
  
  source.push("hi", "test", "hello", "world");
  
  await new Promise(resolve => setTimeout(resolve, 50));
  
  expect(results).toEqual(["hi", "test"]);
});

test("take - stateful predicate", async () => {
  const source = new Stream<number>();
  // Take while sum is less than 10
  const untilSum = source.pipe(take(0, (sum, value) => [
    sum + value < 10,
    sum + value
  ]));
  
  const results: number[] = [];
  untilSum.listen(value => results.push(value));
  
  source.push(2, 3, 2, 4, 1, 5);
  await new Promise(resolve => setTimeout(resolve, 0));
  
  expect(results).toEqual([2, 3, 2]);
});

test("take - with AbortSignal", async () => {
  const source = new Stream<string>();
  const controller = new AbortController();
  const limited = source.pipe(take(controller.signal));
  
  const results: string[] = [];
  limited.listen(value => results.push(value));
  
  source.push("a", "b");
  
  controller.abort();
  
  source.push("c", "d");
  await new Promise(resolve => setTimeout(resolve, 0));
  
  expect(results).toEqual([]);
});

test("take - with Stream signal", async () => {
  const source = new Stream<number>();
  const stopSignal = new Stream<void>();
  const limited = source.pipe(take(stopSignal));
  
  const results: number[] = [];
  limited.listen(value => results.push(value));
  
  source.push(1, 2);
  
  stopSignal.push();
  
  source.push(3, 4);
  await new Promise(resolve => setTimeout(resolve, 0));
  
  expect(results).toEqual([]);
});

test("take - real-world: pagination", async () => {
  interface PageItem {
    id: number;
    title: string;
  }
  
  const items = new Stream<PageItem>();
  const firstPage = items.pipe(take(10)); // First 10 items
  
  const results: PageItem[] = [];
  firstPage.listen(item => results.push(item));
  
  // Simulate loading 15 items
  for (let i = 1; i <= 15; i++) {
    items.push({ id: i, title: `Item ${i}` });
  }
  await new Promise(resolve => setTimeout(resolve, 0));
  
  expect(results).toHaveLength(10);
  expect(results[0]).toEqual({ id: 1, title: "Item 1" });
  expect(results[9]).toEqual({ id: 10, title: "Item 10" });
});

test("take - real-world: form validation attempts", async () => {
  interface ValidationAttempt {
    field: string;
    value: string;
    isValid: boolean;
  }
  
  const validationAttempts = new Stream<ValidationAttempt>();
  // Stop after first successful validation
  const untilValid = validationAttempts.pipe(take(attempt => !attempt.isValid));
  
  const results: ValidationAttempt[] = [];
  untilValid.listen(attempt => results.push(attempt));
  
  validationAttempts.push(
    { field: "email", value: "invalid", isValid: false },
    { field: "email", value: "still@invalid", isValid: false },
    { field: "email", value: "valid@example.com", isValid: true },
    { field: "email", value: "another@example.com", isValid: true }
  );
  
  expect(results).toEqual([
    { field: "email", value: "invalid", isValid: false },
    { field: "email", value: "still@invalid", isValid: false }
  ]);
});

test("take - real-world: rate limiting with budget", async () => {
  interface ApiRequest {
    endpoint: string;
    cost: number;
  }
  
  const requests = new Stream<ApiRequest>();
  // Take requests until budget (100) is exhausted
  const withinBudget = requests.pipe(take(0, (spent, request) => [
    spent + request.cost <= 100,
    spent + request.cost
  ]));
  
  const results: ApiRequest[] = [];
  withinBudget.listen(request => results.push(request));
  
  requests.push(
    { endpoint: "/users", cost: 30 },
    { endpoint: "/posts", cost: 40 },
    { endpoint: "/comments", cost: 25 },
    { endpoint: "/analytics", cost: 50 } // This would exceed budget
  );
  
  expect(results).toEqual([
    { endpoint: "/users", cost: 30 },
    { endpoint: "/posts", cost: 40 },
    { endpoint: "/comments", cost: 25 }
  ]);
});

test("take - edge case: take zero", async () => {
  const source = new Stream<number>();
  const none = source.pipe(take(0));
  
  const results: number[] = [];
  none.listen(value => results.push(value));
  
  source.push(1, 2, 3);
  await new Promise(resolve => setTimeout(resolve, 0));
  
  expect(results).toEqual([]);
});

test("take - edge case: take more than available", async () => {
  const source = new Stream<string>();
  const many = source.pipe(take(10));
  
  const results: string[] = [];
  many.listen(value => results.push(value));
  
  source.push("a", "b", "c");
  
  expect(results).toEqual(["a", "b", "c"]);
});

test("take - edge case: empty stream", async () => {
  const source = new Stream<number>();
  const limited = source.pipe(take(5));
  
  const results: number[] = [];
  limited.listen(value => results.push(value));
  
  // No values pushed
  expect(results).toEqual([]);
});

test("take - edge case: predicate always true", async () => {
  const source = new Stream<number>();
  const unlimited = source.pipe(take(() => true));
  
  const results: number[] = [];
  unlimited.listen(value => results.push(value));
  
  source.push(1, 2, 3, 4, 5);
  
  expect(results).toEqual([1, 2, 3, 4, 5]);
});

test("take - edge case: predicate always false", async () => {
  const source = new Stream<number>();
  const none = source.pipe(take(() => false));
  
  const results: number[] = [];
  none.listen(value => results.push(value));
  
  source.push(1, 2, 3);
  await new Promise(resolve => setTimeout(resolve, 0));
  
  expect(results).toEqual([]);
});