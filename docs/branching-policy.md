# Política de branches

## Branches

| Branch | Papel | Deploy |
|---|---|---|
| `main` | Produção (único ambiente) | Automático, após a integração contínua passar |
| `<tipo>/<escopo>` | Trabalho | Sem deploy; apenas integração contínua |

Não há branch de homologação. O projeto opera com um ambiente único, e o motivo está documentado junto do
fluxo de deploy: é consequência do contexto acadêmico, não decisão de arquitetura. Os testes que
ocupariam a homologação são feitos localmente, com a mesma imagem e o mesmo banco.

## Nomes de branch

```
<tipo>/<alteracao-que-sera-feita>
```

Tipos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.

O escopo descreve a alteração, em minúsculas separadas por hífen, sem número de tarefa. O nome precisa
fazer sentido para quem revisa sem ter o plano aberto.

| Bom | Ruim | Por quê |
|---|---|---|
| `feat/postgres-customer-repository` | `feat/m1-t4` | Número de tarefa não diz nada ao revisor |
| `docs/rfc-002-banco-de-dados` | `docs/rfc` | Genérico demais para distinguir de outras RFCs |
| `refactor/logger-estruturado` | `refactor/logs` | O que exatamente mudou nos registros? |
| `test/titularidade-ordem-de-servico` | `test/fix-tests` | "fix-tests" é sintoma, não escopo |

## Mensagens de commit

Formato curto de commits convencionais:

```
<tipo>: <mensagem pequena da alteração>
```

Minúscula, sem ponto final, sem escopo entre parênteses e sem corpo, salvo quando a mudança exige
explicar o porquê.

```
feat: add postgres customer repository
fix: prevent stock reservation rollback from skipping first item
docs: add rfc-002 database choice
refactor: replace console logs with structured logger
test: cover service order ownership validation
chore: remove mongoose dependency
```

## Commits atômicos

Um commit é uma mudança coerente que deixa o repositório em estado válido. O teste é simples: se este
commit for revertido sozinho, o repositório continua compilando e com os testes passando?

- Teste e implementação que o faz passar podem ir juntos, porque formam uma unidade
- Renomear arquivo e alterar seu conteúdo vão separados, senão o diff fica ilegível
- Formatação automática nunca vai junto com mudança de lógica

Nunca commitar: arquivos de ambiente, estado de infraestrutura, variáveis de infraestrutura (exceto os
exemplos) ou credencial de qualquer tipo.

## Fluxo

```
<tipo>/<escopo>  →  PR  →  revisão e aprovação  →  merge na main  →  deploy automático
```

Nunca commitar direto na `main`. Todo trabalho entra por PR, e o merge é feito por quem revisa.

## Regras de proteção da `main`

A configurar em cada um dos quatro repositórios:

- Bloquear push direto
- Exigir PR com ao menos uma aprovação
- Exigir que as verificações de integração contínua passem
- Exigir que a branch esteja atualizada com a `main` antes do merge

### Pré-requisito antes de ativar

A exigência de aprovação precisa de alguém além do autor, porque a plataforma não permite aprovar o
próprio PR. Num repositório com um colaborador só, ativar a regra trava o fluxo: nenhum PR consegue ser
aprovado, e o trabalho para.

Antes de ativar, confirmar que há ao menos um segundo colaborador com permissão de escrita capaz de
aprovar. Se não houver, a alternativa é ativar as demais regras (bloqueio de push direto e verificações
obrigatórias) e deixar a de aprovação para quando houver.

### Verificação

Depois de ativar, confirmar que a regra vale de fato. Configuração aplicada e não testada é configuração
que não existe.

```
git checkout main
# alterar qualquer arquivo
git commit -am "chore: teste de protecao"
git push origin main
```

O push precisa ser rejeitado pelo servidor. Se passar, a regra não está valendo. Depois, desfazer o
commit local com um reset para o estado remoto.

Guardar a mensagem de rejeição, porque ela é a evidência de que a proteção existe.
