export interface TableNames {
  executions: string;
  outbox: string;
  processedMessages: string;
}

/** Table names from the environment, with the names the Terraform creates as defaults. */
export function readTableNames(env: Record<string, string | undefined> = process.env): TableNames {
  return {
    executions: env.EXECUTIONS_TABLE ?? 'car-repair-shop-executions',
    outbox: env.EXECUTION_OUTBOX_TABLE ?? 'car-repair-shop-execution-outbox',
    processedMessages: env.PROCESSED_MESSAGES_TABLE ?? 'car-repair-shop-execution-processed-messages',
  };
}
