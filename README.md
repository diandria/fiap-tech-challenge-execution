# Execution Service

Fila de execução da oficina: diagnóstico e reparo de cada ordem de serviço. É um dos três
microsserviços do Tech Challenge da Fase 4, ao lado do OS Service e do Billing Service.

As ordens entram na fila quando o OS Service pede o diagnóstico e, depois do pagamento, o reparo. O
mecânico inicia e conclui a etapa atual de cada ordem e registra o andamento de cada serviço. Cada passo
volta para o OS Service pelas filas da saga. Os dados ficam no DynamoDB.

> Este README cresce junto com o serviço. A documentação de arquitetura do sistema inteiro, com as
> decisões e os diagramas, fica no repositório do OS Service, em `docs/architecture/`.

## Repositórios

| Repositório | Papel |
|---|---|
| [fiap-tech-challenge](https://github.com/diandria/fiap-tech-challenge) | OS Service e documentação central |
| [fiap-tech-challenge-billing](https://github.com/diandria/fiap-tech-challenge-billing) | Billing Service |
| fiap-tech-challenge-execution | Este serviço |
| [fiap-tech-challenge-infra-k8s](https://github.com/diandria/fiap-tech-challenge-infra-k8s) | Cluster, gateway, filas e observabilidade |
| [fiap-tech-challenge-infra-db](https://github.com/diandria/fiap-tech-challenge-infra-db) | Banco do OS Service |
| [fiap-tech-challenge-lambda](https://github.com/diandria/fiap-tech-challenge-lambda) | Funções de autenticação e notificação |

## Execução local

Pré-requisitos: Docker e Node.js 22.

```bash
cp .env.example .env
npm install
docker compose up -d
npm run db:create-tables
```

Sobe `app` (porta 3002), `dynamodb` (DynamoDB local, porta 8000) e `localstack` (porta 4568). As portas
são diferentes das dos outros serviços, para os três poderem rodar juntos. `db:create-tables` cria no
DynamoDB local as mesmas tabelas que o Terraform cria na AWS.

| Rota | Para que serve |
|---|---|
| `GET /health` | Vivacidade; não consulta o banco |
| `GET /ready` | Prontidão; responde 503 se a tabela de execuções não responde |
| `GET /metrics` | Métricas no formato do Prometheus |
| `GET /docs` | Swagger |
| `GET /executions` | Fila do mecânico: em andamento primeiro, depois a fila, cada uma da mais antiga para a mais nova |
| `GET /executions/{serviceOrderId}` | Execução de uma ordem, com etapa, status e tarefas |
| `POST /executions/{serviceOrderId}/start` | Inicia a etapa atual (diagnóstico ou reparo) |
| `POST /executions/{serviceOrderId}/finish` | Conclui a etapa atual |

Quem pode chamar cada rota está em [docs/authorization-matrix.md](docs/authorization-matrix.md).

## Kubernetes

Os manifestos ficam em `k8s/` e seguem os do OS Service e do Billing, no namespace
`car-repair-shop-execution`, que o `infra-k8s` cria junto com o cluster.

| Recurso | Nome | Detalhe |
|---|---|---|
| ConfigMap | `execution-config` | Variáveis fixas, inclusive os nomes das tabelas |
| Service | `execution-api` | NLB interno; o API Gateway chega nele pela tag `service.k8s.aws/stack = car-repair-shop-execution/execution-api` |
| Deployment | `execution-api` | Probes em `/health` e `/ready`, rolling update de 25% |
| HPA | `execution-api` | De 2 a 4 réplicas por CPU, cabendo no cluster compartilhado com os outros serviços |
| PodDisruptionBudget | `execution-api` | Pelo menos uma réplica durante a drenagem de um node |

Não há Job de migração: o DynamoDB não tem schema a migrar, e as tabelas vêm do Terraform deste repositório.
O pipeline de deploy cria o ConfigMap `execution-runtime` (URLs das filas da saga) e o Secret
`execution-secret` (`JWT_SECRET`). O pod acessa o DynamoDB com o papel do node, sem credencial própria. O CI
valida os manifestos com `kubeconform -strict`.

## Infraestrutura

As tabelas do Execution são provisionadas por este repositório, na pasta `terraform/`, com estado próprio
(`execution/terraform.tfstate`, no mesmo bucket dos outros repositórios). Nenhum outro estado é lido: o
DynamoDB não precisa de rede nem de security group, então um `apply` aqui não depende de nada. Filas,
cluster e registro de imagens são plataforma compartilhada e ficam no `infra-k8s`.

| Tabela | Chave | Detalhe |
|---|---|---|
| `car-repair-shop-executions` | `serviceOrderId` | Índice `status-queuedAt`, que serve a fila do mecânico |
| `car-repair-shop-execution-outbox` | `messageId` | Respostas à saga esperando publicação |
| `car-repair-shop-execution-processed-messages` | `messageId` | Comandos já tratados; expiram em 30 dias pelo atributo `expiresAt` |

As três usam cobrança por requisição e a criptografia padrão do DynamoDB. A recuperação ponto a ponto fica
desligada porque o ambiente é recriado a cada ciclo; em produção, ela seria ligada na tabela de execuções.
`scripts/dynamodb/tables.ts` cria as mesmas tabelas no DynamoDB local, e os nomes e o índice precisam
continuar iguais aos do Terraform.

As pipelines de infraestrutura só rodam quando `terraform/` muda:

| Workflow | Quando | O que faz |
|---|---|---|
| `Infra CI` | Pull request | `fmt`, `validate`, `tflint` e `trivy`; não precisa de credencial |
| `Infra CD` | Merge na `main` | `apply` e confirmação de que a tabela de execuções está ativa e tem o índice da fila |
| `Infra destroy` | Manual, digitando `production` | `destroy` do ambiente |

O `Infra CD` e o `Infra destroy` usam os segredos `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` e
`AWS_SESSION_TOKEN` do repositório, que precisam ser atualizados a cada sessão do Learner Lab.

## Testes

```bash
npm test                # unitários e de integração (o Testcontainers sobe DynamoDB local e LocalStack)
npm run test:coverage   # com relatório de cobertura; o mínimo é 80%
```

Os testes de integração seguem o padrão GIVEN / WHEN / THEN.
