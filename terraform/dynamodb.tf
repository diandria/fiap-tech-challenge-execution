# The three tables of the Execution Service. The names and the index are the
# ones the code reads (EXECUTIONS_TABLE and the like) and the ones
# scripts/dynamodb/tables.ts creates locally; the three have to agree.
#
# On demand, with no provisioned capacity: the environment sits idle most of
# the time. Encrypted at rest with the AWS-owned key, the DynamoDB default.
# Point-in-time recovery is off, as the environment is recreated every cycle;
# a real environment would turn it on for the executions table.

# One item per service order. The index serves the mechanic's queue: items
# by status, oldest first.
resource "aws_dynamodb_table" "executions" {
  name         = "car-repair-shop-executions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "serviceOrderId"

  attribute {
    name = "serviceOrderId"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "queuedAt"
    type = "S"
  }

  global_secondary_index {
    name            = "status-queuedAt"
    hash_key        = "status"
    range_key       = "queuedAt"
    projection_type = "ALL"
  }
}

# Replies waiting to be published, written in the same transaction as the
# change that produced them.
resource "aws_dynamodb_table" "execution_outbox" {
  name         = "car-repair-shop-execution-outbox"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "messageId"

  attribute {
    name = "messageId"
    type = "S"
  }
}

# Ids of commands already handled. They expire after 30 days, far beyond the
# five-minute deduplication window of the FIFO queues.
resource "aws_dynamodb_table" "execution_processed_messages" {
  name         = "car-repair-shop-execution-processed-messages"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "messageId"

  attribute {
    name = "messageId"
    type = "S"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }
}
