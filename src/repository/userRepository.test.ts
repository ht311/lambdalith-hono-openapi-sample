import { beforeEach, describe, expect, it } from "vitest";
import { userRepository } from "./userRepository.js";

beforeEach(() => {
  for (const user of userRepository.findAll()) {
    userRepository.delete(user.id);
  }
});

describe("userRepository.create", () => {
  it("id・createdAt・updatedAt が付与される", () => {
    const user = userRepository.create({ name: "Alice", email: "alice@example.com" });
    expect(user.id).toBeDefined();
    expect(user.name).toBe("Alice");
    expect(user.email).toBe("alice@example.com");
    expect(user.createdAt).toBeDefined();
    expect(user.updatedAt).toBeDefined();
  });

  it("異なるユーザーには異なる id が付与される", () => {
    const a = userRepository.create({ name: "Alice", email: "a@example.com" });
    const b = userRepository.create({ name: "Bob", email: "b@example.com" });
    expect(a.id).not.toBe(b.id);
  });
});

describe("userRepository.findAll", () => {
  it("空の場合は空配列を返す", () => {
    expect(userRepository.findAll()).toEqual([]);
  });

  it("作成したユーザーを全件返す", () => {
    userRepository.create({ name: "Alice", email: "a@example.com" });
    userRepository.create({ name: "Bob", email: "b@example.com" });
    expect(userRepository.findAll()).toHaveLength(2);
  });
});

describe("userRepository.findById", () => {
  it("存在するユーザーを返す", () => {
    const created = userRepository.create({ name: "Alice", email: "a@example.com" });
    const found = userRepository.findById(created.id);
    expect(found).toEqual(created);
  });

  it("存在しない id は undefined を返す", () => {
    expect(userRepository.findById("nonexistent")).toBeUndefined();
  });
});

describe("userRepository.update", () => {
  it("name のみ更新する", () => {
    const created = userRepository.create({ name: "Alice", email: "a@example.com" });
    const updated = userRepository.update(created.id, { name: "Alicia" });
    expect(updated?.name).toBe("Alicia");
    expect(updated?.email).toBe("a@example.com");
  });

  it("email のみ更新する", () => {
    const created = userRepository.create({ name: "Alice", email: "a@example.com" });
    const updated = userRepository.update(created.id, { email: "new@example.com" });
    expect(updated?.email).toBe("new@example.com");
    expect(updated?.name).toBe("Alice");
  });

  it("updatedAt が更新される", async () => {
    const created = userRepository.create({ name: "Alice", email: "a@example.com" });
    await new Promise((r) => setTimeout(r, 5));
    const updated = userRepository.update(created.id, { name: "Alicia" });
    expect(updated?.updatedAt).not.toBe(created.updatedAt);
  });

  it("存在しない id は undefined を返す", () => {
    expect(userRepository.update("nonexistent", { name: "X" })).toBeUndefined();
  });
});

describe("userRepository.delete", () => {
  it("存在するユーザーを削除して true を返す", () => {
    const created = userRepository.create({ name: "Alice", email: "a@example.com" });
    expect(userRepository.delete(created.id)).toBe(true);
    expect(userRepository.findById(created.id)).toBeUndefined();
  });

  it("存在しない id は false を返す", () => {
    expect(userRepository.delete("nonexistent")).toBe(false);
  });
});
