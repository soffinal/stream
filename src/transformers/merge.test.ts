import { test, expect } from "bun:test";
import { Stream } from "../stream.ts";
import { merge } from "./merge.ts";

test("merge - two streams", async () => {
  const stream1 = new Stream<number>();
  const stream2 = new Stream<number>();
  const merged = stream1.pipe(merge(stream2));
  
  const results: number[] = [];
  merged.listen(value => results.push(value));
  
  stream1.push(1, 3);
  stream2.push(2, 4);
  stream1.push(5);
  
  await new Promise(resolve => setTimeout(resolve, 10));
  
  expect(results.sort()).toEqual([1, 2, 3, 4, 5]);
});

test("merge - multiple streams", async () => {
  const stream1 = new Stream<string>();
  const stream2 = new Stream<string>();
  const stream3 = new Stream<string>();
  
  const merged = stream1.pipe(merge(stream2, stream3));
  
  const results: string[] = [];
  merged.listen(value => results.push(value));
  
  stream1.push("a");
  stream2.push("b");
  stream3.push("c");
  stream1.push("d");
  
  await new Promise(resolve => setTimeout(resolve, 10));
  
  expect(results).toEqual(["a", "b", "c", "d"]);
});

test("merge - different types", async () => {
  const numbers = new Stream<number>();
  const strings = new Stream<string>();
  const merged = numbers.pipe(merge(strings));
  
  const results: Array<number | string> = [];
  merged.listen(value => results.push(value));
  
  numbers.push(1);
  strings.push("hello");
  numbers.push(2);
  strings.push("world");
  
  await new Promise(resolve => setTimeout(resolve, 10));
  
  expect(results).toEqual([1, "hello", 2, "world"]);
});

test("merge - async generators", async () => {
  const stream1 = new Stream<number>(async function* () {
    yield 1;
    await new Promise(resolve => setTimeout(resolve, 10));
    yield 3;
  });
  
  const stream2 = new Stream<number>(async function* () {
    await new Promise(resolve => setTimeout(resolve, 5));
    yield 2;
    await new Promise(resolve => setTimeout(resolve, 10));
    yield 4;
  });
  
  const merged = stream1.pipe(merge(stream2));
  
  const results: number[] = [];
  merged.listen(value => results.push(value));
  
  // Start the generators
  stream1.listen(() => {});
  stream2.listen(() => {});
  
  await new Promise(resolve => setTimeout(resolve, 50));
  
  expect(results.sort()).toEqual([1, 2, 3, 4]);
});

test("merge - real-world: multiple event sources", async () => {
  interface UserEvent {
    type: string;
    userId: string;
    timestamp: number;
  }
  
  const clickEvents = new Stream<UserEvent>();
  const keyboardEvents = new Stream<UserEvent>();
  const scrollEvents = new Stream<UserEvent>();
  
  const allEvents = clickEvents.pipe(merge(keyboardEvents, scrollEvents));
  
  const results: UserEvent[] = [];
  allEvents.listen(event => results.push(event));
  
  const now = Date.now();
  
  clickEvents.push({ type: "click", userId: "user1", timestamp: now });
  keyboardEvents.push({ type: "keydown", userId: "user1", timestamp: now + 10 });
  scrollEvents.push({ type: "scroll", userId: "user1", timestamp: now + 20 });
  clickEvents.push({ type: "click", userId: "user2", timestamp: now + 30 });
  
  await new Promise(resolve => setTimeout(resolve, 10));
  
  expect(results).toHaveLength(4);
  expect(results.map(e => e.type)).toEqual(["click", "keydown", "scroll", "click"]);
});

test("merge - real-world: multiple API endpoints", async () => {
  interface ApiResponse {
    source: string;
    data: any;
  }
  
  const userApi = new Stream<ApiResponse>();
  const productApi = new Stream<ApiResponse>();
  const orderApi = new Stream<ApiResponse>();
  
  const allResponses = userApi.pipe(merge(productApi, orderApi));
  
  const results: ApiResponse[] = [];
  allResponses.listen(response => results.push(response));
  
  userApi.push({ source: "users", data: { id: 1, name: "John" } });
  productApi.push({ source: "products", data: { id: 101, name: "Laptop" } });
  orderApi.push({ source: "orders", data: { id: 201, userId: 1, productId: 101 } });
  userApi.push({ source: "users", data: { id: 2, name: "Jane" } });
  
  await new Promise(resolve => setTimeout(resolve, 10));
  
  expect(results).toEqual([
    { source: "users", data: { id: 1, name: "John" } },
    { source: "products", data: { id: 101, name: "Laptop" } },
    { source: "orders", data: { id: 201, userId: 1, productId: 101 } },
    { source: "users", data: { id: 2, name: "Jane" } }
  ]);
});

test("merge - real-world: notification channels", async () => {
  interface Notification {
    channel: string;
    message: string;
    priority: "low" | "medium" | "high";
  }
  
  const emailNotifications = new Stream<Notification>();
  const pushNotifications = new Stream<Notification>();
  const smsNotifications = new Stream<Notification>();
  
  const allNotifications = emailNotifications.pipe(merge(pushNotifications, smsNotifications));
  
  const results: Notification[] = [];
  allNotifications.listen(notification => results.push(notification));
  
  emailNotifications.push({ channel: "email", message: "Welcome!", priority: "low" });
  pushNotifications.push({ channel: "push", message: "New message", priority: "medium" });
  smsNotifications.push({ channel: "sms", message: "Urgent alert", priority: "high" });
  
  await new Promise(resolve => setTimeout(resolve, 10));
  
  expect(results).toHaveLength(3);
  expect(results.find(n => n.channel === "sms")?.priority).toBe("high");
});

test("merge - edge case: empty streams", async () => {
  const stream1 = new Stream<number>();
  const stream2 = new Stream<number>();
  const merged = stream1.pipe(merge(stream2));
  
  const results: number[] = [];
  merged.listen(value => results.push(value));
  
  // No values pushed to either stream
  await new Promise(resolve => setTimeout(resolve, 10));
  
  expect(results).toEqual([]);
});

test("merge - edge case: one stream only", async () => {
  const stream1 = new Stream<string>();
  const stream2 = new Stream<string>();
  const merged = stream1.pipe(merge(stream2));
  
  const results: string[] = [];
  merged.listen(value => results.push(value));
  
  stream1.push("a", "b", "c");
  // stream2 never emits
  
  await new Promise(resolve => setTimeout(resolve, 10));
  
  expect(results).toEqual(["a", "b", "c"]);
});

test("merge - edge case: single stream merge", async () => {
  const stream1 = new Stream<number>();
  const stream2 = new Stream<number>();
  const merged = stream1.pipe(merge(stream2));
  
  const results: number[] = [];
  merged.listen(value => results.push(value));
  
  stream1.push(1, 2);
  stream2.push(3, 4);
  
  await new Promise(resolve => setTimeout(resolve, 10));
  
  expect(results.sort()).toEqual([1, 2, 3, 4]);
});

test("merge - timing and order preservation within stream", async () => {
  const stream1 = new Stream<string>();
  const stream2 = new Stream<string>();
  const merged = stream1.pipe(merge(stream2));
  
  const results: string[] = [];
  merged.listen(value => results.push(value));
  
  // Push in specific order
  stream1.push("1a");
  stream1.push("1b");
  stream2.push("2a");
  stream1.push("1c");
  stream2.push("2b");
  
  await new Promise(resolve => setTimeout(resolve, 10));
  
  // Order within each stream should be preserved
  const stream1Results = results.filter(r => r.startsWith("1"));
  const stream2Results = results.filter(r => r.startsWith("2"));
  
  expect(stream1Results).toEqual(["1a", "1b", "1c"]);
  expect(stream2Results).toEqual(["2a", "2b"]);
});