/**
 * ユーザーリポジトリのポート定義。
 * ドメイン層がインフラ層（永続化実装）に依存しないよう、
 * 永続化の抽象を定義する。実装は infrastructure/ 配下に置く。
 */
import type { User } from "@/generated/schemas.js";

export interface UserRepository {
  /** 全ユーザーを返す。件数が多い場合は呼び出し側でページングを検討すること。 */
  findAll(): User[];

  /** 指定 ID のユーザーを返す。存在しない場合は undefined。 */
  findById(id: string): User | undefined;

  /**
   * ユーザーを保存する。
   * id が既に存在する場合は上書き（upsert）。作成・更新を区別しない。
   */
  save(user: User): void;

  /** 指定 ID のユーザーを削除する。削除できた場合は true、存在しない場合は false。 */
  delete(id: string): boolean;
}
