import { Sanitizer } from "@shared/utils/sanitizer";

describe("Sanitizer.sanitize", () => {
  describe("NoSQL injection defense", () => {
    it("strips top-level $ operator keys", () => {
      const input = { name: "test", $where: "malicious", $gt: 5 };
      expect(Sanitizer.sanitize(input)).toEqual({ name: "test" });
    });

    it("strips nested $ operator keys recursively", () => {
      const input = { user: { name: "test", $ne: null } };
      expect(Sanitizer.sanitize(input)).toEqual({ user: { name: "test" } });
    });

    it("strips dot-notation keys", () => {
      const input = { name: "test", "user.role": "admin" };
      expect(Sanitizer.sanitize(input)).toEqual({ name: "test" });
    });

    it("strips operators inside arrays", () => {
      const input = [{ $where: "bad", name: "ok" }, { name: "second" }];
      expect(Sanitizer.sanitize(input)).toEqual([
        { name: "ok" },
        { name: "second" },
      ]);
    });
  });

  describe("prototype pollution defense", () => {
    it("strips 'constructor' key", () => {
      const input = { name: "test", constructor: "evil" };
      expect(Sanitizer.sanitize(input)).toEqual({ name: "test" });
    });

    it("strips 'prototype' key", () => {
      const input = { name: "test", prototype: "evil" };
      expect(Sanitizer.sanitize(input)).toEqual({ name: "test" });
    });
  });

  describe("input preservation", () => {
    it("preserves harmless keys", () => {
      const input = { name: "test", age: 30, active: true, tags: ["a", "b"] };
      expect(Sanitizer.sanitize(input)).toEqual(input);
    });

    it("returns primitives unchanged", () => {
      expect(Sanitizer.sanitize("string")).toBe("string");
      expect(Sanitizer.sanitize(42)).toBe(42);
      expect(Sanitizer.sanitize(true)).toBe(true);
      expect(Sanitizer.sanitize(null)).toBe(null);
      expect(Sanitizer.sanitize(undefined)).toBe(undefined);
    });

    it("handles deeply nested safe structures", () => {
      const input = { a: { b: { c: { d: "value" } } } };
      expect(Sanitizer.sanitize(input)).toEqual(input);
    });
  });
});
