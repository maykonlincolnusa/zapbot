output "alb_dns_name" {
  value = aws_lb.main.dns_name
}

output "secret_arn" {
  value     = aws_secretsmanager_secret.app.arn
  sensitive = true
}

output "rds_endpoint" {
  value = aws_db_instance.postgres.address
}
