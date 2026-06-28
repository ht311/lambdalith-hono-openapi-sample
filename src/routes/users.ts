/**
 * /users エンドポイントのルートハンドラ。
 * TypeSpec で定義した API 契約に従い、CRUD 操作を実装する。
 */

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { CreateUserInputSchema, UpdateUserInputSchema } from "../generated/schemas.js";
import { userRepository } from "../repository/userRepository.js";

const users = new Hono();

/**
 * GET /users
 * 登録済みユーザーの一覧を返す。
 * レスポンス: 200 + User[]
 */
users.get("/", (c) => {
  return c.json(userRepository.findAll());
});

/**
 * POST /users
 * 新規ユーザーを作成する。
 * zValidator でリクエストボディを Zod スキーマで検証し、
 * バリデーション失敗時は TypeSpec 定義の ErrorResponse 形式（422）で返す。
 * レスポンス: 201 + User | 422 + ErrorResponse
 */
users.post(
  "/",
  // zValidator の第3引数（フック）でバリデーション失敗時の挙動を上書きする
  zValidator("json", CreateUserInputSchema, (result, c) => {
    if (!result.success) {
      // TypeSpec 定義の ErrorResponse 形式（422）で返す
      return c.json({ message: result.error.issues[0]?.message ?? "Validation error" }, 422);
    }
  }),
  (c) => {
    const input = c.req.valid("json");
    const user = userRepository.create(input);
    return c.json(user, 201);
  }
);

/**
 * GET /users/:id
 * 指定 ID のユーザーを返す。
 * レスポンス: 200 + User | 404 + ErrorResponse
 */
users.get("/:id", (c) => {
  const user = userRepository.findById(c.req.param("id"));
  if (!user) return c.json({ message: "User not found" }, 404);
  return c.json(user);
});

/**
 * PUT /users/:id
 * 指定 ID のユーザーを部分更新する。
 * zValidator でリクエストボディを検証し、バリデーション失敗時は 422 で返す。
 * レスポンス: 200 + User | 404 + ErrorResponse | 422 + ErrorResponse
 */
users.put(
  "/:id",
  // zValidator の第3引数（フック）でバリデーション失敗時の挙動を上書きする
  zValidator("json", UpdateUserInputSchema, (result, c) => {
    if (!result.success) {
      // TypeSpec 定義の ErrorResponse 形式（422）で返す
      return c.json({ message: result.error.issues[0]?.message ?? "Validation error" }, 422);
    }
  }),
  (c) => {
    const updated = userRepository.update(c.req.param("id"), c.req.valid("json"));
    if (!updated) return c.json({ message: "User not found" }, 404);
    return c.json(updated);
  }
);

/**
 * DELETE /users/:id
 * 指定 ID のユーザーを削除する。
 * レスポンス: 204 | 404 + ErrorResponse
 */
users.delete("/:id", (c) => {
  const deleted = userRepository.delete(c.req.param("id"));
  if (!deleted) return c.json({ message: "User not found" }, 404);
  return c.body(null, 204);
});

export default users;
