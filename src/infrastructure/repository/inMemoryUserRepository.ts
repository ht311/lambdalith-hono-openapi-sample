/**
 * UserRepository のインメモリ実装。
 * Lambda はリクエスト間でコンテナを再利用するためデータは保持されるが、
 * コールドスタート（新規コンテナ起動）でリセットされる。
 * 本番では DynamoDB・RDS などの実装に差し替えること。
 */
import type { UserRepository } from "@/domain/user/userRepository.js";
import type { User } from "@/generated/schemas.js";

/** テスト等で独立したストアを持つインスタンスが必要な場合に使用する。 */
export function createInMemoryUserRepository(): UserRepository {
  const store = new Map<string, User>();
  return {
    findAll: () => Array.from(store.values()),
    findById: (id) => store.get(id),
    save: (user) => {
      store.set(user.id, user);
    },
    delete: (id) => store.delete(id),
  };
}

/** アプリケーション全体で共有するシングルトンインスタンス。 */
export const inMemoryUserRepository = createInMemoryUserRepository();
