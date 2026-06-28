terraform {
  required_version = ">= 1.6"

  # 本番環境では remote backend を設定すること（例: S3 + DynamoDB）
  # backend "s3" {
  #   bucket         = "your-tfstate-bucket"
  #   key            = "lambdalith-hono/terraform.tfstate"
  #   region         = "ap-northeast-1"
  #   dynamodb_table = "terraform-lock"
  #   encrypt        = true
  # }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}
