import { beforeEach, describe, expect, it } from "vitest";
import type { User } from "@/generated/schemas.js";
import { createInMemoryUserRepository } from "./inMemoryUserRepository.js";

function makeUser(overrides?: Partial<User>): User {
  const now = new Date().toISOString();
  return {
    id: "test-id",
    name: "Alice",
    email: "alice@example.com",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("inMemoryUserRepository", () => {
  let repo: ReturnType<typeof createInMemoryUserRepository>;

  beforeEach(() => {
    repo = createInMemoryUserRepository();
  });

  it("save で保存し findById で取得できる", () => {
    const user = makeUser({ id: "a" });
    repo.save(user);
    expect(repo.findById("a")).toEqual(user);
  });

  it("findById は存在しない id で undefined を返す", () => {
    expect(repo.findById("nonexistent")).toBeUndefined();
  });

  it("findAll は保存した全件を返す", () => {
    repo.save(makeUser({ id: "a" }));
    repo.save(makeUser({ id: "b" }));
    expect(repo.findAll()).toHaveLength(2);
  });

  it("findAll は空の場合に空配列を返す", () => {
    expect(repo.findAll()).toEqual([]);
  });

  it("delete は存在する id で true を返し取得できなくなる", () => {
    repo.save(makeUser({ id: "a" }));
    expect(repo.delete("a")).toBe(true);
    expect(repo.findById("a")).toBeUndefined();
  });

  it("delete は存在しない id で false を返す", () => {
    expect(repo.delete("nonexistent")).toBe(false);
  });

  it("save で同じ id を上書きできる", () => {
    repo.save(makeUser({ id: "a", name: "Alice" }));
    repo.save(makeUser({ id: "a", name: "Alicia" }));
    expect(repo.findById("a")?.name).toBe("Alicia");
    expect(repo.findAll()).toHaveLength(1);
  });
});
