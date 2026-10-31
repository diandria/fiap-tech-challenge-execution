# Matriz de rotas e perfis do Execution

Quais rotas o Execution expõe, quais são protegidas e quem pode chamar cada uma. A fonte é
`src/frameworks/http/routes/`; toda rota montada em `src/app.ts` aparece aqui.

O Execution não emite token. Ele valida o token de funcionário emitido em `POST /auth/login` no OS Service,
com o mesmo segredo de assinatura, sem chamar outro serviço. As claims usadas são `type: "staff"`, `userId`
e `role`. Token sem `type`, com `type` desconhecido ou sem o identificador do ator é recusado com 401. Token
de cliente é válido, mas nenhuma rota daqui aceita cliente.

## Rotas

| Método | Rota | Público | Mecânico | Admin | Atendente | Cliente |
|---|---|---|---|---|---|---|
| GET | `/health` | sim | sim | sim | sim | sim |
| GET | `/ready` | sim | sim | sim | sim | sim |
| GET | `/metrics` | sim | sim | sim | sim | sim |
| GET | `/docs` | sim | sim | sim | sim | sim |
| GET | `/executions` | 401 | sim | sim | 403 | 403 |
| GET | `/executions/{serviceOrderId}` | 401 | sim | sim | 403 | 403 |
| POST | `/executions/{serviceOrderId}/start` | 401 | sim | sim | 403 | 403 |
| POST | `/executions/{serviceOrderId}/finish` | 401 | sim | sim | 403 | 403 |
| PATCH | `/executions/{serviceOrderId}/tasks/{serviceId}` | 401 | sim | sim | 403 | 403 |
| GET | `/executions/stats/average-task-duration` | 401 | 403 | sim | sim | 403 |

Os perfis são os mesmos das rotas que estas substituem no OS Service: mecânico e admin movem a ordem e cada
serviço; atendente e admin consultam a média de duração.

## Regras das ações

- **A etapa vem da execução, não da requisição.** `start` e `finish` agem sobre a etapa atual da ordem
  (diagnóstico ou reparo), então o mecânico não consegue pular etapa.
- **Cada ação vira uma resposta à saga**, gravada junto com a mudança: `DiagnosisStarted`,
  `DiagnosisCompleted`, `RepairStarted` e `RepairCompleted`.
- **Cada serviço do reparo** começa uma vez e termina uma vez, depois de começar, e só com o reparo em
  andamento; fora disso, 400. Serviço que não faz parte do reparo responde 404. Essas marcações não geram
  resposta à saga.
- **Transição inválida responde 400**, por exemplo iniciar uma etapa que não está na fila.
- **Duas ações ao mesmo tempo na mesma ordem**: a segunda bate na versão da execução e responde 409.
