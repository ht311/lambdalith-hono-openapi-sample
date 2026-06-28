/**
 * ローカル開発用サーバー。Lambda 環境では使用しない。
 *
 * @hono/node-server は devDependency であり、本番バンドルには含まれない。
 * Lambda デプロイ時は src/index.ts（hono/aws-lambda）がエントリーポイントになる。
 *
 * 起動: pnpm dev
 */
import { serve } from "@hono/node-server";
import app from "./app.js";

const port = Number(process.env.PORT ?? 3000);

serve({ fetch: app.fetch, port }, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`API docs: http://localhost:${port}/docs`);
});
