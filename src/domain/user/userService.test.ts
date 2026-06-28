import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryUserRepository } from "@/infrastructure/repository/inMemoryUserRepository.js";
import { UserNotFoundError } from "./errors.js";
import { createUserService } from "./userService.js";

describe("userService", () => {
  let service: ReturnType<typeof createUserService>;

  beforeEach(() => {
    service = createUserService(createInMemoryUserRepository());
  });

  describe("create / list", () => {
    it("ユーザーを作成して一覧取得できる", () => {
      service.create({ name: "Alice", email: "alice@example.com" });
      const users = service.list();
      expect(users).toHaveLength(1);
      expect(users[0].name).toBe("Alice");
    });

    it("複数ユーザーを作成できる", () => {
      service.create({ name: "Alice", email: "a@example.com" });
      service.create({ name: "Bob", email: "b@example.com" });
      expect(service.list()).toHaveLength(2);
    });
  });

  describe("get", () => {
    it("存在する id でユーザーを取得できる", () => {
      const created = service.create({ name: "Alice", email: "alice@example.com" });
      expect(service.get(created.id)).toEqual(created);
    });

    it("存在しない id で UserNotFoundError を throw する", () => {
      expect(() => service.get("nonexistent")).toThrow(UserNotFoundError);
    });
  });

  describe("update", () => {
    it("name を更新できる", () => {
      const created = service.create({ name: "Alice", email: "alice@example.com" });
      const updated = service.update(created.id, { name: "Alicia" });
      expect(updated.name).toBe("Alicia");
      expect(updated.email).toBe("alice@example.com");
    });

    it("存在しない id で UserNotFoundError を throw する", () => {
      expect(() => service.update("nonexistent", { name: "X" })).toThrow(UserNotFoundError);
    });
  });

  describe("remove", () => {
    it("ユーザーを削除できる", () => {
      const created = service.create({ name: "Alice", email: "alice@example.com" });
      service.remove(created.id);
      expect(() => service.get(created.id)).toThrow(UserNotFoundError);
    });

    it("存在しない id で UserNotFoundError を throw する", () => {
      expect(() => service.remove("nonexistent")).toThrow(UserNotFoundError);
    });
  });
});
