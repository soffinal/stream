import { test, expect } from "bun:test";
import { Stream } from "../stream.ts";
import { debounce } from "./debounce.ts";

test("debounce - basic fixed delay", async () => {
  const source = new Stream<string>();
  const debounced = source.pipe(debounce(100));

  const results: string[] = [];
  debounced.listen((value) => results.push(value));

  source.push("a");
  source.push("b");
  source.push("c");

  // Should only emit the last value after delay
  await new Promise((resolve) => setTimeout(resolve, 150));

  expect(results).toEqual(["c"]);
});

test("debounce - multiple emissions with gaps", async () => {
  const source = new Stream<number>();
  const debounced = source.pipe(debounce(50));

  const results: number[] = [];
  debounced.listen((value) => results.push(value));

  source.push(1);
  source.push(2);

  await new Promise((resolve) => setTimeout(resolve, 70));

  source.push(3);
  source.push(4);

  await new Promise((resolve) => setTimeout(resolve, 70));

  expect(results).toEqual([2, 4]);
});

test("debounce - dynamic delay selector", async () => {
  const source = new Stream<string>();
  const debounced = source.pipe(debounce((value) => value.length * 20));

  const results: string[] = [];
  debounced.listen((value) => results.push(value));

  source.push("a"); // 20ms delay
  source.push("hello"); // 100ms delay

  await new Promise((resolve) => setTimeout(resolve, 120));

  expect(results).toEqual(["hello"]);
});

test("debounce - stateful delay selector", async () => {
  const source = new Stream<number>();
  const debounced = source.pipe(
    debounce(0, (count, value) => [
      Math.min(count * 10 + 20, 100), // Increasing delay, max 100ms
      count + 1,
    ])
  );

  const results: number[] = [];
  debounced.listen((value) => results.push(value));

  source.push(1);
  source.push(2);
  source.push(3);

  await new Promise((resolve) => setTimeout(resolve, 150));

  expect(results).toEqual([3]);
});

test("debounce - real-world: search input", async () => {
  const searchInput = new Stream<string>();
  const debouncedSearch = searchInput.pipe(debounce(300));

  const searchQueries: string[] = [];
  debouncedSearch.listen((query) => {
    // Simulate API call
    searchQueries.push(query);
  });

  // Simulate rapid typing
  searchInput.push("j");
  searchInput.push("ja");
  searchInput.push("jav");
  searchInput.push("java");
  searchInput.push("javas");
  searchInput.push("javascript");

  // Should only trigger search for final query
  await new Promise((resolve) => setTimeout(resolve, 350));

  expect(searchQueries).toEqual(["javascript"]);
});

test("debounce - real-world: resize events", async () => {
  interface ResizeEvent {
    width: number;
    height: number;
  }

  const resizeEvents = new Stream<ResizeEvent>();
  const debouncedResize = resizeEvents.pipe(debounce(250));

  const layoutUpdates: ResizeEvent[] = [];
  debouncedResize.listen((event) => {
    // Simulate expensive layout recalculation
    layoutUpdates.push(event);
  });

  // Simulate rapid resize events
  resizeEvents.push({ width: 800, height: 600 });
  resizeEvents.push({ width: 850, height: 650 });
  resizeEvents.push({ width: 900, height: 700 });
  resizeEvents.push({ width: 1000, height: 800 });

  await new Promise((resolve) => setTimeout(resolve, 300));

  expect(layoutUpdates).toEqual([{ width: 1000, height: 800 }]);
});

test("debounce - real-world: form validation", async () => {
  interface FormData {
    email: string;
    isValid?: boolean;
  }

  const formInput = new Stream<FormData>();
  const debouncedValidation = formInput.pipe(debounce(200));

  const validationResults: FormData[] = [];
  debouncedValidation.listen(async (data) => {
    // Simulate async validation
    await new Promise((resolve) => setTimeout(resolve, 10));
    validationResults.push({
      ...data,
      isValid: data.email.includes("@") && data.email.includes("."),
    });
  });

  // Simulate user typing email
  formInput.push({ email: "u" });
  formInput.push({ email: "us" });
  formInput.push({ email: "user" });
  formInput.push({ email: "user@" });
  formInput.push({ email: "user@ex" });
  formInput.push({ email: "user@example" });
  formInput.push({ email: "user@example.com" });

  await new Promise((resolve) => setTimeout(resolve, 250));

  expect(validationResults).toHaveLength(1);
  expect(validationResults[0].email).toBe("user@example.com");
  expect(validationResults[0].isValid).toBe(true);
});

test("debounce - edge case: zero delay", async () => {
  const source = new Stream<number>();
  const debounced = source.pipe(debounce(0));

  const results: number[] = [];
  debounced.listen((value) => results.push(value));

  source.push(1);
  source.push(2);
  source.push(3);

  await new Promise((resolve) => setTimeout(resolve, 10));

  expect(results).toEqual([3]);
});

test("debounce - edge case: single value", async () => {
  const source = new Stream<string>();
  const debounced = source.pipe(debounce(50));

  const results: string[] = [];
  debounced.listen((value) => results.push(value));

  source.push("single");

  await new Promise((resolve) => setTimeout(resolve, 70));

  expect(results).toEqual(["single"]);
});
