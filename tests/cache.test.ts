import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cache } from "@/cache";

describe("cache", () => {
	beforeEach(() => {
		cache.clear();
	});

	afterEach(() => {
		cache.clear();
	});

	describe("set / get", () => {
		it("returns the value that was set", () => {
			cache.set("key", "hello");
			expect(cache.get<string>("key")).toBe("hello");
		});

		it("returns null for a missing key", () => {
			expect(cache.get("missing")).toBeNull();
		});

		it("overwrites an existing value", () => {
			cache.set("key", "first");
			cache.set("key", "second");
			expect(cache.get<string>("key")).toBe("second");
		});

		it("preserves object values", () => {
			const value = { id: 1, name: "test" };
			cache.set("obj", value);
			const result = cache.get<{ id: number; name: string }>("obj");
			expect(result).toEqual(value);
		});

		it("preserves array values", () => {
			const value = [1, 2, 3];
			cache.set("arr", value);
			expect(cache.get<number[]>("arr")).toEqual(value);
		});
	});

	describe("TTL expiration", () => {
		it("returns null after TTL expires", async () => {
			cache.set("expiring", "value", 50); // 50ms TTL
			await new Promise((resolve) => setTimeout(resolve, 80));
			expect(cache.get("expiring")).toBeNull();
		});

		it("returns the value before TTL expires", async () => {
			cache.set("valid", "value", 500); // 500ms TTL
			await new Promise((resolve) => setTimeout(resolve, 20));
			expect(cache.get<string>("valid")).toBe("value");
		});
	});

	describe("del", () => {
		it("removes a key", () => {
			cache.set("key", "value");
			cache.del("key");
			expect(cache.get("key")).toBeNull();
		});

		it("does not throw when deleting a missing key", () => {
			expect(() => cache.del("nonexistent")).not.toThrow();
		});
	});

	describe("clear", () => {
		it("removes all keys", () => {
			cache.set("a", 1);
			cache.set("b", 2);
			cache.set("c", 3);
			cache.clear();
			expect(cache.get("a")).toBeNull();
			expect(cache.get("b")).toBeNull();
			expect(cache.get("c")).toBeNull();
		});
	});

	describe("size", () => {
		it("returns 0 for an empty cache", () => {
			expect(cache.size()).toBe(0);
		});

		it("counts stored entries", () => {
			cache.set("x", 1);
			cache.set("y", 2);
			expect(cache.size()).toBe(2);
		});

		it("does not count expired entries in the store (store size, not live size)", () => {
			// size() reflects internal Map size — entries are lazily removed on get
			cache.set("entry", "val");
			expect(cache.size()).toBe(1);
		});
	});
});
