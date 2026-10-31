provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "car-repair-shop"
      Phase       = "4"
      Service     = "execution"
      ManagedBy   = "terraform"
      Repository  = "fiap-tech-challenge-execution"
      Environment = var.environment
    }
  }
}
