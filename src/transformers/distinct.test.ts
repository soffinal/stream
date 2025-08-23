import { test, expect } from "bun:test";
import { Stream } from "../stream.ts";
import { distinct } from "./distinct.ts";

test("distinct - basic primitive deduplication", async () => {
  const source = new Stream<number>();
  const unique = source.pipe(distinct());

  const results: number[] = [];
  unique.listen((value) => results.push(value));

  source.push(1, 2, 2, 3, 1, 4, 3, 5);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([1, 2, 3, 4, 5]);
});

test("distinct - string deduplication", async () => {
  const source = new Stream<string>();
  const unique = source.pipe(distinct());

  const results: string[] = [];
  unique.listen((value) => results.push(value));

  source.push("a", "b", "a", "c", "b", "d");
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual(["a", "b", "c", "d"]);
});

test("distinct - with key selector", async () => {
  interface User {
    id: number;
    name: string;
    email: string;
  }

  const source = new Stream<User>();
  const uniqueUsers = source.pipe(distinct((user) => user.id));

  const results: User[] = [];
  uniqueUsers.listen((user) => results.push(user));

  source.push(
    { id: 1, name: "John", email: "john@example.com" },
    { id: 2, name: "Jane", email: "jane@example.com" },
    { id: 1, name: "John Updated", email: "john.new@example.com" }, // Duplicate ID
    { id: 3, name: "Bob", email: "bob@example.com" },
    { id: 2, name: "Jane Smith", email: "jane.smith@example.com" } // Duplicate ID
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([
    { id: 1, name: "John", email: "john@example.com" },
    { id: 2, name: "Jane", email: "jane@example.com" },
    { id: 3, name: "Bob", email: "bob@example.com" },
  ]);
});

test("distinct - async key selector", async () => {
  const source = new Stream<string>();
  const unique = source.pipe(
    distinct(async (value) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return value.toLowerCase();
    })
  );

  const results: string[] = [];
  unique.listen((value) => results.push(value));

  source.push("Hello", "WORLD", "hello", "World", "TEST");

  await new Promise((resolve) => setTimeout(resolve, 50));

  expect(results).toEqual(["Hello", "WORLD", "TEST"]);
});

test("distinct - complex key selector", async () => {
  interface Product {
    id: number;
    name: string;
    category: string;
    price: number;
  }

  const source = new Stream<Product>();
  // Distinct by category + price combination
  const unique = source.pipe(distinct((product) => `${product.category}-${product.price}`));

  const results: Product[] = [];
  unique.listen((product) => results.push(product));

  source.push(
    { id: 1, name: "Laptop A", category: "electronics", price: 1000 },
    { id: 2, name: "Book A", category: "books", price: 20 },
    { id: 3, name: "Laptop B", category: "electronics", price: 1000 }, // Same category+price
    { id: 4, name: "Book B", category: "books", price: 25 },
    { id: 5, name: "Laptop C", category: "electronics", price: 1200 }
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([
    { id: 1, name: "Laptop A", category: "electronics", price: 1000 },
    { id: 2, name: "Book A", category: "books", price: 20 },
    { id: 4, name: "Book B", category: "books", price: 25 },
    { id: 5, name: "Laptop C", category: "electronics", price: 1200 },
  ]);
});

test("distinct - real-world: event deduplication", async () => {
  interface ClickEvent {
    elementId: string;
    timestamp: number;
    userId: string;
  }

  const clickEvents = new Stream<ClickEvent>();
  // Deduplicate by elementId + userId (ignore timestamp)
  const uniqueClicks = clickEvents.pipe(distinct((event) => `${event.elementId}-${event.userId}`));

  const results: ClickEvent[] = [];
  uniqueClicks.listen((event) => results.push(event));

  const now = Date.now();

  clickEvents.push(
    { elementId: "button1", timestamp: now, userId: "user1" },
    { elementId: "button2", timestamp: now + 100, userId: "user1" },
    { elementId: "button1", timestamp: now + 200, userId: "user1" }, // Duplicate
    { elementId: "button1", timestamp: now + 300, userId: "user2" }, // Different user
    { elementId: "button2", timestamp: now + 400, userId: "user2" }
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([
    { elementId: "button1", timestamp: now, userId: "user1" },
    { elementId: "button2", timestamp: now + 100, userId: "user1" },
    { elementId: "button1", timestamp: now + 300, userId: "user2" },
    { elementId: "button2", timestamp: now + 400, userId: "user2" },
  ]);
});

test("distinct - real-world: API response deduplication", async () => {
  interface ApiResponse {
    id: string;
    data: any;
    etag: string;
  }

  const apiResponses = new Stream<ApiResponse>();
  // Deduplicate by etag (content hash)
  const uniqueResponses = apiResponses.pipe(distinct((response) => response.etag));

  const results: ApiResponse[] = [];
  uniqueResponses.listen((response) => results.push(response));

  apiResponses.push(
    { id: "req1", data: { name: "John" }, etag: "abc123" },
    { id: "req2", data: { name: "Jane" }, etag: "def456" },
    { id: "req3", data: { name: "John" }, etag: "abc123" }, // Same content
    { id: "req4", data: { name: "Bob" }, etag: "ghi789" },
    { id: "req5", data: { name: "Jane" }, etag: "def456" } // Same content
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([
    { id: "req1", data: { name: "John" }, etag: "abc123" },
    { id: "req2", data: { name: "Jane" }, etag: "def456" },
    { id: "req4", data: { name: "Bob" }, etag: "ghi789" },
  ]);
});

test("distinct - edge case: empty stream", async () => {
  const source = new Stream<number>();
  const unique = source.pipe(distinct());

  const results: number[] = [];
  unique.listen((value) => results.push(value));

  // No values pushed
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(results).toEqual([]);
});

test("distinct - edge case: all values are unique", async () => {
  const source = new Stream<number>();
  const unique = source.pipe(distinct());

  const results: number[] = [];
  unique.listen((value) => results.push(value));

  source.push(1, 2, 3, 4, 5);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([1, 2, 3, 4, 5]);
});

test("distinct - edge case: all values are duplicates", async () => {
  const source = new Stream<string>();
  const unique = source.pipe(distinct());

  const results: string[] = [];
  unique.listen((value) => results.push(value));

  source.push("same", "same", "same", "same");
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual(["same"]);
});

test("distinct - edge case: null and undefined values", async () => {
  const source = new Stream<string | null | undefined>();
  const unique = source.pipe(distinct());

  const results: Array<string | null | undefined> = [];
  unique.listen((value) => results.push(value));

  source.push("a", null, undefined, "a", null, "b", undefined);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual(["a", null, undefined, "b"]);
});
