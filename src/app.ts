/**
 * Hono アプリケーションの設定ファイル。
 * ミドルウェア・ルート・OpenAPI ドキュメントのエンドポイントを登録する。
 */

import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import users from "./routes/users.js";
import openapiSpec from "../generated/openapi.yaml";

const app = new Hono();

// セキュリティヘッダーを全リクエストに付与する（XSS・クリックジャッキング対策など）
app.use("*", secureHeaders());

app.route("/users", users);

// TypeSpec で生成した OpenAPI 仕様を配信する
app.get("/openapi.json", (c) => c.json(openapiSpec));

// Scalar による API リファレンス UI
app.get("/docs", Scalar({ url: "/openapi.json" }));

// 予期しない例外をキャッチし、TypeSpec の ErrorResponse 形式（{ message: string }）で返す
app.onError((err, c) => {
  console.error(err);
  return c.json({ message: "Internal Server Error" }, 500);
});

export default app;
