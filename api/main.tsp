import "@typespec/http";
import "@typespec/openapi";
import "@typespec/openapi3";
import "./models/user.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

@service
@info(#{
  title: "User Management API",
  version: "1.0.0",
})
namespace UserManagement;

@route("/users")
interface Users {
  /** ユーザー一覧取得 */
  @get
  list(): {
    @statusCode statusCode: 200;
    @body body: User[];
  };

  /** ユーザー作成 */
  @post
  create(@body body: CreateUserInput): {
    @statusCode statusCode: 201;
    @body body: User;
  } | {
    @statusCode statusCode: 422;
    @body body: ErrorResponse;
  };

  /** ユーザー取得 */
  @get
  @route("/{id}")
  get(@path id: string): {
    @statusCode statusCode: 200;
    @body body: User;
  } | {
    @statusCode statusCode: 404;
    @body body: ErrorResponse;
  };

  /** ユーザー更新 */
  @put
  @route("/{id}")
  update(@path id: string, @body body: UpdateUserInput): {
    @statusCode statusCode: 200;
    @body body: User;
  } | {
    @statusCode statusCode: 404;
    @body body: ErrorResponse;
  };

  /** ユーザー削除 */
  @delete
  @route("/{id}")
  remove(@path id: string): {
    @statusCode statusCode: 204;
  } | {
    @statusCode statusCode: 404;
    @body body: ErrorResponse;
  };
}
