import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import users, { userService } from "./users.js";

const app = new Hono();
app.route("/users", users);

type JsonRecord = Record<string, unknown>;

beforeEach(() => {
  for (const user of userService.list()) {
    userService.remove(user.id);
  }
});

describe("POST /users", () => {
  it("有効なボディで 201 + User を返す", async () => {
    const res = await app.request("/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Alice", email: "alice@example.com" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as JsonRecord;
    expect(body.id).toBeDefined();
    expect(body.name).toBe("Alice");
    expect(body.email).toBe("alice@example.com");
  });

  it("name が空で 422 を返す", async () => {
    const res = await app.request("/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "", email: "alice@example.com" }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as JsonRecord;
    expect(body.message).toBeDefined();
  });

  it("email が不正で 422 を返す", async () => {
    const res = await app.request("/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Alice", email: "not-an-email" }),
    });
    expect(res.status).toBe(422);
  });
});

describe("GET /users", () => {
  it("空の場合は 200 + 空配列を返す", async () => {
    const res = await app.request("/users");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("登録済みユーザーを含む配列を返す", async () => {
    userService.create({ name: "Alice", email: "alice@example.com" });
    const res = await app.request("/users");
    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonRecord[];
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Alice");
  });
});

describe("GET /users/:id", () => {
  it("存在する id で 200 + User を返す", async () => {
    const user = userService.create({ name: "Alice", email: "alice@example.com" });
    const res = await app.request(`/users/${user.id}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonRecord;
    expect(body.id).toBe(user.id);
  });

  it("存在しない id で 404 を返す", async () => {
    const res = await app.request("/users/nonexistent");
    expect(res.status).toBe(404);
  });
});

describe("PUT /users/:id", () => {
  it("有効なボディで 200 + 更新された User を返す", async () => {
    const user = userService.create({ name: "Alice", email: "alice@example.com" });
    const res = await app.request(`/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Alicia" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonRecord;
    expect(body.name).toBe("Alicia");
    expect(body.email).toBe("alice@example.com");
  });

  it("存在しない id で 404 を返す", async () => {
    const res = await app.request("/users/nonexistent", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "X" }),
    });
    expect(res.status).toBe(404);
  });

  it("name・email 両方省略（空ボディ相当）で 200 を返す（TypeSpec では両フィールドともオプション）", async () => {
    const user = userService.create({ name: "Alice", email: "alice@example.com" });
    const res = await app.request(`/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
  });
});

describe("DELETE /users/:id", () => {
  it("存在する id で 204 を返す", async () => {
    const user = userService.create({ name: "Alice", email: "alice@example.com" });
    const res = await app.request(`/users/${user.id}`, { method: "DELETE" });
    expect(res.status).toBe(204);
  });

  it("存在しない id で 404 を返す", async () => {
    const res = await app.request("/users/nonexistent", { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});
