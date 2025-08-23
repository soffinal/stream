import { test, expect } from "bun:test";
import { Stream } from "../stream.ts";
import { auditTime } from "./audit-time.ts";

test("auditTime - basic audit", async () => {
  const source = new Stream<number>();
  const audited = source.pipe(auditTime(100));
  
  const results: number[] = [];
  audited.listen(value => results.push(value));
  
  source.push(1, 2, 3);
  
  await new Promise(resolve => setTimeout(resolve, 120));
  
  expect(results).toEqual([3]); // Should emit last value after silence
});

test("auditTime - multiple audit periods", async () => {
  const source = new Stream<string>();
  const audited = source.pipe(auditTime(50));
  
  const results: string[] = [];
  audited.listen(value => results.push(value));
  
  source.push("a", "b");
  
  await new Promise(resolve => setTimeout(resolve, 70));
  
  source.push("c", "d");
  
  await new Promise(resolve => setTimeout(resolve, 70));
  
  expect(results).toEqual(["b", "d"]);
});

test("auditTime - real-world: search suggestions", async () => {
  const searchQueries = new Stream<string>();
  const auditedQueries = searchQueries.pipe(auditTime(200));
  
  const suggestions: string[] = [];
  auditedQueries.listen(query => {
    // Simulate fetching suggestions after user stops typing
    suggestions.push(`suggestions for: ${query}`);
  });
  
  // Simulate rapid typing
  searchQueries.push("j", "ja", "jav", "java", "javas", "javascript");
  
  await new Promise(resolve => setTimeout(resolve, 250));
  
  expect(suggestions).toEqual(["suggestions for: javascript"]);
});