/**
 * /users エンドポイントのルートハンドラ。
 * バリデーション（zValidator）とサービス呼び出しのみを担い、
 * ビジネスロジックはドメイン層（UserService）に委譲する。
 */
import { zValidator } from "@hono/zod-validator";
import type { Context } from "hono";
import { Hono } from "hono";
import { UserNotFoundError } from "@/domain/user/errors.js";
import { createUserService } from "@/domain/user/userService.js";
import { CreateUserInputSchema, UpdateUserInputSchema } from "@/generated/schemas.js";
import { inMemoryUserRepository } from "@/infrastructure/repository/inMemoryUserRepository.js";

// 合成ルート: リポジトリ実装をサービスに注入する
export const userService = createUserService(inMemoryUserRepository);

const users = new Hono();

/**
 * UserNotFoundError を 404 にマップし、それ以外は再スローする。
 * ドメインエラーと予期しない例外を区別するためのガード。
 */
function handleNotFound(err: unknown, c: Context) {
  if (err instanceof UserNotFoundError) {
    return c.json({ message: "User not found" }, 404);
  }
  throw err;
}

/**
 * zValidator のエラーフック。
 * デフォルトの 400 ではなく TypeSpec 定義の ErrorResponse 形式（422）で返す。
 */
function validationHook(
  result: { success: boolean; error?: { issues: { message?: string }[] } },
  c: Context
) {
  if (!result.success) {
    return c.json({ message: result.error?.issues[0]?.message ?? "Validation error" }, 422);
  }
}

/** GET /users — 登録済みユーザーの一覧を返す。レスポンス: 200 + User[] */
users.get("/", (c) => {
  return c.json(userService.list());
});

/** POST /users — 新規ユーザーを作成する。レスポンス: 201 + User | 422 + ErrorResponse */
users.post("/", zValidator("json", CreateUserInputSchema, validationHook), (c) => {
  const user = userService.create(c.req.valid("json"));
  return c.json(user, 201);
});

/** GET /users/:id — 指定 ID のユーザーを返す。レスポンス: 200 + User | 404 + ErrorResponse */
users.get("/:id", (c) => {
  try {
    return c.json(userService.get(c.req.param("id")));
  } catch (err) {
    return handleNotFound(err, c);
  }
});

/** PUT /users/:id — 指定 ID のユーザーを部分更新する。レスポンス: 200 + User | 404 + ErrorResponse | 422 + ErrorResponse */
users.put("/:id", zValidator("json", UpdateUserInputSchema, validationHook), (c) => {
  try {
    return c.json(userService.update(c.req.param("id"), c.req.valid("json")));
  } catch (err) {
    return handleNotFound(err, c);
  }
});

/** DELETE /users/:id — 指定 ID のユーザーを削除する。レスポンス: 204 | 404 + ErrorResponse */
users.delete("/:id", (c) => {
  try {
    userService.remove(c.req.param("id"));
    return c.body(null, 204);
  } catch (err) {
    return handleNotFound(err, c);
  }
});

export default users;
