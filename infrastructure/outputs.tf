output "function_url" {
  description = "Lambda Function URL"
  value       = aws_lambda_function_url.api.function_url
}

output "function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.api.function_name
}
