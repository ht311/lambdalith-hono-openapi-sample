import { describe, expect, it } from "vitest";
import { applyUpdate, createUser } from "./user.js";

describe("createUser", () => {
  it("id・createdAt・updatedAt が付与される", () => {
    const user = createUser({ name: "Alice", email: "alice@example.com" });
    expect(user.id).toBeDefined();
    expect(user.name).toBe("Alice");
    expect(user.email).toBe("alice@example.com");
    expect(user.createdAt).toBeDefined();
    expect(user.updatedAt).toBeDefined();
  });

  it("createdAt と updatedAt が同じ値で初期化される", () => {
    const user = createUser({ name: "Alice", email: "alice@example.com" });
    expect(user.createdAt).toBe(user.updatedAt);
  });

  it("異なる呼び出しで異なる id が生成される", () => {
    const a = createUser({ name: "Alice", email: "a@example.com" });
    const b = createUser({ name: "Bob", email: "b@example.com" });
    expect(a.id).not.toBe(b.id);
  });
});

describe("applyUpdate", () => {
  const base = {
    id: "1",
    name: "Alice",
    email: "alice@example.com",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  it("name のみ更新する", () => {
    const updated = applyUpdate(base, { name: "Alicia" });
    expect(updated.name).toBe("Alicia");
    expect(updated.email).toBe("alice@example.com");
  });

  it("email のみ更新する", () => {
    const updated = applyUpdate(base, { email: "new@example.com" });
    expect(updated.email).toBe("new@example.com");
    expect(updated.name).toBe("Alice");
  });

  it("updatedAt が更新される", async () => {
    await new Promise((r) => setTimeout(r, 5));
    const updated = applyUpdate(base, { name: "Alicia" });
    expect(updated.updatedAt).not.toBe(base.updatedAt);
  });

  it("createdAt は変更されない", () => {
    const updated = applyUpdate(base, { name: "Alicia" });
    expect(updated.createdAt).toBe(base.createdAt);
  });

  it("空の更新でも updatedAt が変わる", async () => {
    await new Promise((r) => setTimeout(r, 5));
    const updated = applyUpdate(base, {});
    expect(updated.updatedAt).not.toBe(base.updatedAt);
  });
});
