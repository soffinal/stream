import { test, expect } from "bun:test";
import { Stream } from "../stream.ts";
import { scan } from "./scan.ts";

test("scan - basic accumulation", async () => {
  const source = new Stream<number>();
  const sums = source.pipe(scan(0, (acc, value) => acc + value));

  const results: number[] = [];
  sums.listen((value) => results.push(value));

  source.push(1, 2, 3, 4);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([0, 1, 3, 6, 10]); // Initial 0, then accumulated values
});

test("scan - string concatenation", async () => {
  const source = new Stream<string>();
  const concatenated = source.pipe(scan("", (acc, value) => acc + value));

  const results: string[] = [];
  concatenated.listen((value) => results.push(value));

  source.push("a", "b", "c");
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual(["", "a", "ab", "abc"]); // Initial empty string, then accumulated
});

test("scan - with index tracking", async () => {
  const source = new Stream<string>();
  const indexed = source.pipe(
    scan({ items: [] as { value: string; index: number }[], index: 0 }, (acc, value) => ({
      items: [...acc.items, { value, index: acc.index }],
      index: acc.index + 1,
    }))
  );

  const results: Array<{ items: Array<{ value: string; index: number }>; index: number }> = [];
  indexed.listen((value) => results.push(value));

  source.push("a", "b", "c");
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([
    { items: [], index: 0 }, // Initial state
    { items: [{ value: "a", index: 0 }], index: 1 },
    {
      items: [
        { value: "a", index: 0 },
        { value: "b", index: 1 },
      ],
      index: 2,
    },
    {
      items: [
        { value: "a", index: 0 },
        { value: "b", index: 1 },
        { value: "c", index: 2 },
      ],
      index: 3,
    },
  ]);
});

test("scan - conditional logic with state", async () => {
  const source = new Stream<number>();
  const conditionalSums = source.pipe(
    scan({ sum: 0, shouldInclude: true }, (acc, value) => ({
      sum: acc.shouldInclude ? acc.sum + value : acc.sum,
      shouldInclude: value % 2 === 0, // Only include even numbers
    }))
  );

  const results: Array<{ sum: number; shouldInclude: boolean }> = [];
  conditionalSums.listen((value) => results.push(value));

  source.push(1, 2, 3, 4);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([
    { sum: 0, shouldInclude: true }, // Initial state
    { sum: 1, shouldInclude: false }, // 1 is odd, don't include
    { sum: 1, shouldInclude: true }, // 2 is even, include
    { sum: 4, shouldInclude: false }, // 3 is odd, don't include
    { sum: 4, shouldInclude: true }, // 4 is even, include
  ]);
});

test("scan - running statistics", async () => {
  const source = new Stream<number>();
  const stats = source.pipe(
    scan({ count: 0, sum: 0, average: 0 }, (acc, value) => {
      const newCount = acc.count + 1;
      const newSum = acc.sum + value;
      return {
        count: newCount,
        sum: newSum,
        average: newSum / newCount,
      };
    })
  );

  const results: Array<{ count: number; sum: number; average: number }> = [];
  stats.listen((value) => results.push(value));

  source.push(2, 4, 6);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([
    { count: 0, sum: 0, average: 0 }, // Initial state
    { count: 1, sum: 2, average: 2 },
    { count: 2, sum: 6, average: 3 },
    { count: 3, sum: 12, average: 4 },
  ]);
});

test("scan - real-world: running statistics", async () => {
  interface DataPoint {
    value: number;
    timestamp: number;
  }

  interface Statistics {
    count: number;
    sum: number;
    average: number;
    min: number;
    max: number;
  }

  const dataPoints = new Stream<DataPoint>();
  const runningStats = dataPoints.pipe(
    scan({ count: 0, sum: 0, average: 0, min: Infinity, max: -Infinity }, (stats, point) => ({
      count: stats.count + 1,
      sum: stats.sum + point.value,
      average: (stats.sum + point.value) / (stats.count + 1),
      min: Math.min(stats.min, point.value),
      max: Math.max(stats.max, point.value),
    }))
  );

  const results: Statistics[] = [];
  runningStats.listen((stats) => results.push(stats));

  const now = Date.now();
  dataPoints.push(
    { value: 10, timestamp: now },
    { value: 5, timestamp: now + 1000 },
    { value: 15, timestamp: now + 2000 }
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(results).toEqual([
    { count: 0, sum: 0, average: 0, min: Infinity, max: -Infinity }, // Initial state
    { count: 1, sum: 10, average: 10, min: 10, max: 10 },
    { count: 2, sum: 15, average: 7.5, min: 5, max: 10 },
    { count: 3, sum: 30, average: 10, min: 5, max: 15 },
  ]);
});

test("scan - real-world: shopping cart total", async () => {
  interface CartItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
  }

  interface CartState {
    items: CartItem[];
    totalItems: number;
    totalPrice: number;
  }

  const cartActions = new Stream<CartItem>();
  const cartState = cartActions.pipe(
    scan({ items: [] as CartItem[], totalItems: 0, totalPrice: 0 }, (cart, item) => ({
      items: [...cart.items, item],
      totalItems: cart.totalItems + item.quantity,
      totalPrice: cart.totalPrice + item.price * item.quantity,
    }))
  );

  const results: CartState[] = [];
  cartState.listen((state) => results.push(state));

  cartActions.push(
    { id: "1", name: "Laptop", price: 1000, quantity: 1 },
    { id: "2", name: "Mouse", price: 25, quantity: 2 },
    { id: "3", name: "Keyboard", price: 75, quantity: 1 }
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(results).toHaveLength(4); // Initial empty cart + 3 items
  expect(results[3]).toEqual({
    items: [
      { id: "1", name: "Laptop", price: 1000, quantity: 1 },
      { id: "2", name: "Mouse", price: 25, quantity: 2 },
      { id: "3", name: "Keyboard", price: 75, quantity: 1 },
    ],
    totalItems: 4,
    totalPrice: 1125,
  });
});

test("scan - real-world: message thread", async () => {
  interface Message {
    id: string;
    author: string;
    content: string;
    timestamp: number;
  }

  interface Thread {
    messages: Message[];
    participants: Set<string>;
    lastActivity: number;
  }

  const messages = new Stream<Message>();
  const thread = messages.pipe(
    scan({ messages: [] as Message[], participants: new Set<string>(), lastActivity: 0 }, (thread, message) => ({
      messages: [...thread.messages, message],
      participants: new Set([...thread.participants, message.author]),
      lastActivity: message.timestamp,
    }))
  );

  const results: Thread[] = [];
  thread.listen((state) => results.push(state));

  const now = Date.now();
  messages.push(
    { id: "1", author: "Alice", content: "Hello!", timestamp: now },
    { id: "2", author: "Bob", content: "Hi there!", timestamp: now + 1000 },
    { id: "3", author: "Alice", content: "How are you?", timestamp: now + 2000 }
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(results).toHaveLength(4); // Initial empty thread + 3 messages
  expect(results[3].messages).toHaveLength(3);
  expect(Array.from(results[3].participants)).toEqual(["Alice", "Bob"]);
  expect(results[3].lastActivity).toBe(now + 2000);
});

test("scan - edge case: empty stream", async () => {
  const source = new Stream<number>();
  const sums = source.pipe(scan(0, (acc, value) => acc + value));

  const results: number[] = [];
  sums.listen((value) => results.push(value));

  // No values pushed
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(results).toEqual([]);
});

test("scan - edge case: single value", async () => {
  const source = new Stream<number>();
  const sums = source.pipe(scan(10, (acc, value) => acc + value));

  const results: number[] = [];
  sums.listen((value) => results.push(value));

  source.push(5);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([10, 15]); // Initial value, then accumulated
});

test("scan - async accumulator", async () => {
  const source = new Stream<number>();
  const asyncSums = source.pipe(
    scan(0, async (acc, value) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return acc + value;
    })
  );

  const results: number[] = [];
  asyncSums.listen((value) => results.push(value));

  source.push(1, 2, 3);

  await new Promise((resolve) => setTimeout(resolve, 50));

  expect(results).toEqual([0, 1, 3, 6]); // Initial value, then accumulated
});
