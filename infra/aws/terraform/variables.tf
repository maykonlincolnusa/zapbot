variable "aws_region" {
  type        = string
  description = "AWS region."
  default     = "us-east-1"
}

variable "project_name" {
  type        = string
  description = "Project name prefix."
  default     = "zapbot-ai"
}

variable "environment" {
  type        = string
  description = "Environment name."
  default     = "prod"
}

variable "container_image" {
  type        = string
  description = "Full container image URI for the API."
}

variable "certificate_arn" {
  type        = string
  description = "ACM certificate ARN for HTTPS."
}

variable "app_url" {
  type        = string
  description = "Public frontend URL used by CORS and OpenRouter headers."
}

variable "db_name" {
  type        = string
  default     = "zapbot"
}

variable "db_username" {
  type        = string
  default     = "zapbot"
}

variable "db_instance_class" {
  type        = string
  default     = "db.t4g.micro"
}

variable "desired_count" {
  type        = number
  default     = 2
}

variable "api_cpu" {
  type    = number
  default = 512
}

variable "api_memory" {
  type    = number
  default = 1024
}
