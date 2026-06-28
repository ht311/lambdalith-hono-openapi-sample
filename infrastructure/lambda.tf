# Lambda deployment package (ZIP)
# Run `pnpm build` to generate dist/ before deploying
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../dist"
  output_path = "${path.module}/function.zip"
  excludes    = ["function.zip"]
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${var.function_name}"
  retention_in_days = 30
}

resource "aws_lambda_function" "api" {
  function_name    = var.function_name
  role             = aws_iam_role.lambda_exec.arn
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  runtime = "nodejs22.x"
  handler = "index.handler"

  memory_size = 256
  timeout     = 30

  depends_on = [aws_cloudwatch_log_group.api]

  logging_config {
    log_format = "JSON"
    log_group  = aws_cloudwatch_log_group.api.name
  }

  # 環境変数を追加する場合はここで設定（シークレットは Secrets Manager ARN を渡す）
  # environment {
  #   variables = {
  #     NODE_ENV   = "production"
  #     SECRET_ARN = aws_secretsmanager_secret.api.arn
  #   }
  # }
}

# Lambda Function URL（パブリックアクセス、サンプル用）
resource "aws_lambda_function_url" "api" {
  function_name      = aws_lambda_function.api.function_name
  authorization_type = "NONE"

  cors {
    # サンプル用: すべてのオリジンを許可。本番では allowed_origins 変数を設定すること
    allow_origins = var.allowed_origins
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization"]
  }
}
