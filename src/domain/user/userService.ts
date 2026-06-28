/**
 * ユーザーのユースケース実装。
 * リポジトリをファクトリ引数で受け取ることで、具体的な永続化実装に依存しない。
 * 各メソッドはユースケース単位で副作用（永続化）まで完結させる。
 */
import type { CreateUserInput, UpdateUserInput, User } from "@/generated/schemas.js";
import { UserNotFoundError } from "./errors.js";
import { applyUpdate, createUser } from "./user.js";
import type { UserRepository } from "./userRepository.js";

/**
 * UserService のファクトリ関数。
 * @param repo 永続化を担うリポジトリ実装（テスト時はモックを注入可能）
 */
export function createUserService(repo: UserRepository) {
  return {
    /** 全ユーザーを返す。 */
    list(): User[] {
      return repo.findAll();
    },

    /**
     * 指定 ID のユーザーを返す。
     * @throws {UserNotFoundError} ユーザーが存在しない場合
     */
    get(id: string): User {
      const user = repo.findById(id);
      if (!user) throw new UserNotFoundError(id);
      return user;
    },

    /** 新規ユーザーを作成して返す。 */
    create(input: CreateUserInput): User {
      const user = createUser(input);
      repo.save(user);
      return user;
    },

    /**
     * 指定 ID のユーザーを部分更新して返す。
     * @throws {UserNotFoundError} ユーザーが存在しない場合
     */
    update(id: string, input: UpdateUserInput): User {
      const existing = repo.findById(id);
      if (!existing) throw new UserNotFoundError(id);
      const updated = applyUpdate(existing, input);
      repo.save(updated);
      return updated;
    },

    /**
     * 指定 ID のユーザーを削除する。
     * @throws {UserNotFoundError} ユーザーが存在しない場合
     */
    remove(id: string): void {
      if (!repo.delete(id)) throw new UserNotFoundError(id);
    },
  };
}

/** createUserService の戻り値型。ハンドラ・テストの型注釈に使用する。 */
export type UserService = ReturnType<typeof createUserService>;
