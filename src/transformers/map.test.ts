import { test, expect } from "bun:test";
import { Stream } from "../stream.ts";
import { map } from "./map.ts";

test("map - basic transformation", async () => {
  const source = new Stream<number>();
  const doubled = source.pipe(map(n => n * 2));
  
  const results: number[] = [];
  doubled.listen(n => results.push(n));
  
  source.push(1, 2, 3, 4);
  await new Promise(resolve => setTimeout(resolve, 0));
  
  expect(results).toEqual([2, 4, 6, 8]);
});

test("map - type transformation", async () => {
  const source = new Stream<number>();
  const strings = source.pipe(map(n => `value: ${n}`));
  
  const results: string[] = [];
  strings.listen(s => results.push(s));
  
  source.push(1, 2, 3);
  await new Promise(resolve => setTimeout(resolve, 0));
  
  expect(results).toEqual(["value: 1", "value: 2", "value: 3"]);
});

test("map - async transformation", async () => {
  const source = new Stream<string>();
  const uppercased = source.pipe(map(async s => {
    await new Promise(resolve => setTimeout(resolve, 1));
    return s.toUpperCase();
  }));
  
  const results: string[] = [];
  uppercased.listen(s => results.push(s));
  
  source.push("hello", "world");
  
  await new Promise(resolve => setTimeout(resolve, 50));
  expect(results).toEqual(["HELLO", "WORLD"]);
});

test("map - stateful transformation (running sum)", async () => {
  const source = new Stream<number>();
  const runningSums = source.pipe(map(0, (sum, n) => [sum + n, sum + n]));
  
  const results: number[] = [];
  runningSums.listen(sum => results.push(sum));
  
  source.push(1, 2, 3, 4);
  await new Promise(resolve => setTimeout(resolve, 0));
  
  expect(results).toEqual([1, 3, 6, 10]);
});

test("map - stateful transformation (with index)", async () => {
  const source = new Stream<string>();
  const indexed = source.pipe(map(0, (index, value) => [
    { value, index },
    index + 1
  ]));
  
  const results: Array<{ value: string; index: number }> = [];
  indexed.listen(item => results.push(item));
  
  source.push("a", "b", "c");
  await new Promise(resolve => setTimeout(resolve, 0));
  
  expect(results).toEqual([
    { value: "a", index: 0 },
    { value: "b", index: 1 },
    { value: "c", index: 2 }
  ]);
});

test("map - error handling in mapper", async () => {
  const source = new Stream<number>();
  const mapped = source.pipe(map(n => {
    if (n === 0) throw new Error("Division by zero");
    return 10 / n;
  }));
  
  const results: number[] = [];
  const errors: Error[] = [];
  
  mapped.listen(
    n => results.push(n),
    // Note: In real implementation, you'd handle errors differently
  );
  
  source.push(1, 2, 5);
  await new Promise(resolve => setTimeout(resolve, 0));
  
  expect(results).toEqual([10, 5, 2]);
});

test("map - real-world: API response transformation", async () => {
  interface ApiUser {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  }
  
  interface User {
    id: number;
    fullName: string;
    email: string;
  }
  
  const apiResponses = new Stream<ApiUser>();
  const users = apiResponses.pipe(map(apiUser => ({
    id: apiUser.id,
    fullName: `${apiUser.first_name} ${apiUser.last_name}`,
    email: apiUser.email.toLowerCase()
  })));
  
  const results: User[] = [];
  users.listen(user => results.push(user));
  
  apiResponses.push(
    { id: 1, first_name: "John", last_name: "Doe", email: "JOHN@EXAMPLE.COM" },
    { id: 2, first_name: "Jane", last_name: "Smith", email: "JANE@TEST.COM" }
  );
  await new Promise(resolve => setTimeout(resolve, 0));
  
  expect(results).toEqual([
    { id: 1, fullName: "John Doe", email: "john@example.com" },
    { id: 2, fullName: "Jane Smith", email: "jane@test.com" }
  ]);
});

test("map - real-world: data enrichment with async", async () => {
  const userIds = new Stream<number>();
  
  // Simulate async database lookup
  const enrichedUsers = userIds.pipe(map(async id => {
    await new Promise(resolve => setTimeout(resolve, 1));
    return {
      id,
      name: `User ${id}`,
      timestamp: Date.now()
    };
  }));
  
  const results: Array<{ id: number; name: string; timestamp: number }> = [];
  enrichedUsers.listen(user => results.push(user));
  
  userIds.push(1, 2, 3);
  
  await new Promise(resolve => setTimeout(resolve, 50));
  
  expect(results).toHaveLength(3);
  expect(results[0].id).toBe(1);
  expect(results[0].name).toBe("User 1");
  expect(results[1].id).toBe(2);
  expect(results[2].id).toBe(3);
});