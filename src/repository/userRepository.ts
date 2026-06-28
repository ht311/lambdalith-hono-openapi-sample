import { randomUUID } from "node:crypto";
import type { CreateUserInput, UpdateUserInput, User } from "../generated/schemas.js";

/**
 * インメモリのユーザーストア。
 * Lambda はリクエストごとにコンテナが再利用されるが、
 * コールドスタート（新規コンテナ起動）でデータがリセットされる。
 * 本番では DynamoDB・RDS などのデータストアに置き換えること。
 */
const store = new Map<string, User>();

export const userRepository = {
  /**
   * 全ユーザーを返す。
   */
  findAll(): User[] {
    return Array.from(store.values());
  },

  /**
   * 指定 ID のユーザーを返す。存在しない場合は undefined。
   */
  findById(id: string): User | undefined {
    return store.get(id);
  },

  /**
   * 新規ユーザーを作成してストアに保存する。
   * UUID は Node.js 組み込みの crypto.randomUUID() で生成する。
   */
  create(input: CreateUserInput): User {
    const now = new Date().toISOString();
    const user: User = {
      id: randomUUID(),
      name: input.name,
      email: input.email,
      createdAt: now,
      updatedAt: now,
    };
    store.set(user.id, user);
    return user;
  },

  /**
   * 指定 ID のユーザーを部分更新する。
   * 存在しない場合は undefined を返す。
   */
  update(id: string, input: UpdateUserInput): User | undefined {
    const existing = store.get(id);
    if (!existing) return undefined;
    const updated: User = {
      ...existing,
      ...(input.name !== undefined && { name: input.name }),
      ...(input.email !== undefined && { email: input.email }),
      updatedAt: new Date().toISOString(),
    };
    store.set(id, updated);
    return updated;
  },

  /**
   * 指定 ID のユーザーを削除する。
   * 削除成功時は true、存在しない場合は false を返す。
   */
  delete(id: string): boolean {
    return store.delete(id);
  },
};
