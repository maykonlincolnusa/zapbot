resource "random_password" "db" {
  length  = 32
  special = true
}

resource "aws_db_subnet_group" "main" {
  name       = local.name
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_secretsmanager_secret" "app" {
  name                    = "${local.name}/app"
  kms_key_id              = aws_kms_key.main.arn
  recovery_window_in_days = 30
}

resource "aws_db_instance" "postgres" {
  identifier                          = local.name
  engine                              = "postgres"
  engine_version                      = "16"
  instance_class                      = var.db_instance_class
  allocated_storage                   = 20
  max_allocated_storage               = 200
  db_name                             = var.db_name
  username                            = var.db_username
  password                            = random_password.db.result
  db_subnet_group_name                = aws_db_subnet_group.main.name
  vpc_security_group_ids              = [aws_security_group.rds.id]
  storage_encrypted                   = true
  kms_key_id                          = aws_kms_key.main.arn
  backup_retention_period             = 14
  deletion_protection                 = true
  multi_az                            = true
  publicly_accessible                 = false
  auto_minor_version_upgrade          = true
  performance_insights_enabled        = true
  performance_insights_kms_key_id     = aws_kms_key.main.arn
  iam_database_authentication_enabled = true
  skip_final_snapshot                 = false
  final_snapshot_identifier           = "${local.name}-final"
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    DATABASE_URL              = "postgresql://${var.db_username}:${urlencode(random_password.db.result)}@${aws_db_instance.postgres.address}:5432/${var.db_name}"
    DB_SSL                    = "true"
    DB_SSL_REJECT_UNAUTHORIZED = "false"
    JWT_SECRET                = random_password.jwt.result
    OPENROUTER_API_KEY        = "replace-in-secrets-manager"
    WHATSAPP_API_TOKEN        = "replace-in-secrets-manager"
    WHATSAPP_PHONE_NUMBER_ID  = "replace-in-secrets-manager"
    WHATSAPP_VERIFY_TOKEN     = "replace-in-secrets-manager"
  })
}

resource "random_password" "jwt" {
  length  = 48
  special = true
}
