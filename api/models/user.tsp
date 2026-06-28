// @format は TypeSpec.OpenAPI（@typespec/openapi パッケージ）が提供するデコレータ。
// @minLength は TypeSpec 組み込みデコレータで using 宣言不要。
using TypeSpec.OpenAPI;

/** ユーザーリソース */
model User {
  /** ユーザー ID (UUID) */
  @format("uuid")
  id: string;

  /** 表示名 */
  @minLength(1)
  name: string;

  /** メールアドレス */
  @format("email")
  email: string;

  /** 作成日時 (ISO 8601) */
  createdAt: utcDateTime;

  /** 更新日時 (ISO 8601) */
  updatedAt: utcDateTime;
}

/** ユーザー作成リクエスト */
model CreateUserInput {
  @minLength(1)
  name: string;

  @format("email")
  email: string;
}

/** ユーザー更新リクエスト */
model UpdateUserInput {
  @minLength(1)
  name?: string;

  @format("email")
  email?: string;
}

/** エラーレスポンス */
model ErrorResponse {
  message: string;
}
