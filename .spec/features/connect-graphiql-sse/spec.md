# Spec: Connect GraphiQL to GraphQL SSE

> feature: connect-graphiql-sse
> status: rascunho

<!--
  Como ler este arquivo (o formato é verificado por `onp-spec audit`):
  - US-xxx = história de usuário · AC-xxx = critério de aceite
    ASM-xxx = suposição · Q-xxx = pergunta em aberto
    São códigos de rastreio: ligam a especificação às tarefas e aos testes.
  - Toda história de usuário precisa de pelo menos um critério de aceite.
  - Todo critério de aceite precisa de Dado/Quando/Então completos.
  - Os códigos são únicos no projeto inteiro (nunca reutilize um número).
  - Suposições e Perguntas em aberto são OBRIGATÓRIAS: se não há nenhuma,
    escreva "Nenhuma." — mas desconfie: quase toda feature esconde uma.
-->

## Contexto

O Gateway expõe subscriptions por GraphQL over SSE, mas o GraphiQL embutido
tenta abrir subscriptions por WebSocket e não consegue acompanhar o checkout.

## Histórias

<!-- História de usuário: quem precisa, o que precisa e por quê. -->

### US-162 — Acompanhar eventos pelo GraphiQL

Como desenvolvedor, quero executar uma subscription no GraphiQL, para observar
as mudanças do checkout em tempo real sem usar terminal.

<!-- Critério de aceite: o resultado observável que um teste consegue checar.
     Escreva para GENTE: título e Então descrevem o que o usuário vê
     ("a tela avisa X"), não o detalhe técnico ("endpoint retorna 403") —
     o detalhe pode ir entre parênteses. -->

#### AC-359 — Subscription usa o endpoint SSE do Gateway

- **Dado** o GraphiQL aberto na rota `/graphql` e um token informado nos headers
- **Quando** a subscription `orderEvents` é executada
- **Então** o GraphiQL mantém o resultado atualizado através de `/graphql/stream`

## Fora de escopo

- Adicionar transporte WebSocket.
- Alterar o contrato da subscription ou a autenticação existente.
- Adicionar uma nova dependência de cliente GraphQL.

## Suposições

<!-- O que estamos ASSUMINDO sem confirmação. Status: aberta | confirmada | invalidada -->

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-132 | A página pode carregar GraphiQL e o bundle UMD de `graphql-sse` do mesmo CDN já usado pelo GraphiQL embutido. | confirmada | O GraphiQL atual já depende de assets do unpkg em desenvolvimento e `graphql-sse` 2.6.1 publica bundle UMD oficial. |

## Perguntas em aberto

<!-- O que ainda não sabemos. Status: aberta | respondida -->

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
Nenhuma.
