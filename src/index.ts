/**
 * AWS Lambda のエントリーポイント。
 * handle() は Lambda イベント（API Gateway v2 / Function URL 形式）を
 * Web 標準の Fetch API リクエストに変換して Hono アプリに渡す。
 * これにより、Hono は Lambda・Node.js・Cloudflare Workers など
 * あらゆるランタイムで同じコードを動かせる。
 */
import { handle } from "hono/aws-lambda";
import app from "./app.js";

export const handler = handle(app);
