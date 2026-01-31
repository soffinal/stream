import { Stream } from "../../stream";
import { state } from "../state";
import { gate } from "../gate";
import { snapshot } from "./snapshot";
import { map } from "../sequential";

describe("snapshot", () => {
  it("captures current capabilities", () => {
    const s = new Stream<number>()
      .pipe(state(0))
      .pipe(snapshot("v1"));

    expect(s.v1.state.value).toBe(0);
    s.v1.state.value = 5;
    expect(s.v1.state.value).toBe(5);
  });

  it("creates nested snapshots", () => {
    const s = new Stream<number>()
      .pipe(state(0))
      .pipe(snapshot("v1"))
      .pipe(map((v) => v * 2))
      .pipe(state(0))
      .pipe(snapshot("v2"));

    s.v1.state.value = 10;
    expect(s.v1.state.value).toBe(10);

    s.v2.state.value = 20;
    expect(s.v2.state.value).toBe(20);

    expect(s.v2.v1.state.value).toBe(10);
  });

  it("captures multiple capabilities", () => {
    const s = new Stream<number>()
      .pipe(state(0))
      .pipe(gate())
      .pipe(snapshot("checkpoint"));

    expect(s.checkpoint.state.value).toBe(0);
    expect(s.checkpoint.gate.isOpen).toBe(true);

    s.checkpoint.state.value = 42;
    expect(s.checkpoint.state.value).toBe(42);

    s.checkpoint.gate.close();
    expect(s.checkpoint.gate.isOpen).toBe(false);
  });

  it("preserves capability tree", async () => {
    const s = new Stream<number>()
      .pipe(state(0))
      .pipe(snapshot("v1"))
      .pipe(map((v) => v * 2))
      .pipe(state(0))
      .pipe(snapshot("v2"))
      .pipe(map((v) => v + 10))
      .pipe(state(0))
      .pipe(snapshot("v3"));

    const results: number[] = [];
    s.listen((v) => results.push(v));

    s.v3.v2.v1.state.value = 5;
    await new Promise((r) => setTimeout(r, 10));

    expect(results).toContain(20); // 5 * 2 + 10
  });
});
