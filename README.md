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

## Testes

```bash
npm test                # unitários e de integração (o Testcontainers sobe DynamoDB local e LocalStack)
npm run test:coverage   # com relatório de cobertura; o mínimo é 80%
```

Os testes de integração seguem o padrão GIVEN / WHEN / THEN.
