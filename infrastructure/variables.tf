variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-northeast-1"
}

variable "function_name" {
  description = "Lambda function name"
  type        = string
  default     = "lambdalith-hono-users-api"
}

variable "allowed_origins" {
  description = "CORS allowed origins. Use [\"*\"] for development only."
  type        = list(string)
  default     = ["*"] # サンプル用。本番ではフロントエンドの URL を指定すること
}
