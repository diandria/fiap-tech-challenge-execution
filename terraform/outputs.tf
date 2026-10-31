output "executions_table" {
  description = "Executions table, read by the service as EXECUTIONS_TABLE."
  value       = aws_dynamodb_table.executions.name
}

output "execution_outbox_table" {
  description = "Outbox table, read by the service as EXECUTION_OUTBOX_TABLE."
  value       = aws_dynamodb_table.execution_outbox.name
}

output "processed_messages_table" {
  description = "Processed messages table, read by the service as PROCESSED_MESSAGES_TABLE."
  value       = aws_dynamodb_table.execution_processed_messages.name
}

output "table_arns" {
  description = "ARNs of the three tables, for the IAM policy of the service."
  value = [
    aws_dynamodb_table.executions.arn,
    aws_dynamodb_table.execution_outbox.arn,
    aws_dynamodb_table.execution_processed_messages.arn,
  ]
}
