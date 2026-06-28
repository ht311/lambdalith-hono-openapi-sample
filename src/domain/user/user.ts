/**
 * User エンティティの生成・更新ロジック。
 * ID 採番・タイムスタンプ付与など、ドメインの不変条件を担保する。
 * サービスやリポジトリには依存しない純粋関数として実装する。
 */
import { randomUUID } from "node:crypto";
import type { CreateUserInput, UpdateUserInput, User } from "@/generated/schemas.js";

/**
 * 新規 User エンティティを生成する。
 * - id は Node.js 組み込みの crypto.randomUUID() で生成する（外部ライブラリ不要かつ RFC 4122 準拠）
 * - createdAt・updatedAt は同じ値で初期化する
 */
export function createUser(input: CreateUserInput): User {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    name: input.name,
    email: input.email,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 既存 User に部分更新を適用した新しいエンティティを返す。
 * - undefined のフィールドは変更しない（TypeSpec の optional に対応）
 * - updatedAt は常に現在時刻で上書きする
 * - 元のオブジェクトは変更しない（イミュータブル）
 */
export function applyUpdate(existing: User, input: UpdateUserInput): User {
  return {
    ...existing,
    ...(input.name !== undefined && { name: input.name }),
    ...(input.email !== undefined && { email: input.email }),
    updatedAt: new Date().toISOString(),
  };
}
