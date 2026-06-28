/**
 * ユーザードメインのエラー定義。
 * HTTP ステータスへのマッピングはプレゼンテーション層が担う。
 * ドメイン層はエラーの意味のみを表現し、HTTP の知識を持たない。
 */

/** 操作対象のユーザーが存在しない場合にスローされる。 */
export class UserNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`User not found: ${id}`);
    this.name = "UserNotFoundError";
  }
}
