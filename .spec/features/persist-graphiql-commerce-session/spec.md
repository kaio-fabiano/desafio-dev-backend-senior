# Spec: Persist graphiql commerce session

> feature: persist-graphiql-commerce-session
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

O GraphiQL encaminha o token de acesso, mas descarta os headers de sessão
devolvidos por `addToCart`. Assim, o checkout seguinte chega ao WooCommerce sem
o carrinho que acabou de ser criado.

## Histórias

<!-- História de usuário: quem precisa, o que precisa e por quê. -->

### US-163 — Manter o carrinho entre operações no GraphiQL

Como desenvolvedor, quero que o GraphiQL preserve automaticamente a sessão do
carrinho, para testar `addToCart`, checkout e SSE sem copiar headers manualmente.

<!-- Critério de aceite: o resultado observável que um teste consegue checar.
     Escreva para GENTE: título e Então descrevem o que o usuário vê
     ("a tela avisa X"), não o detalhe técnico ("endpoint retorna 403") —
     o detalhe pode ir entre parênteses. -->

#### AC-360 — Checkout reutiliza automaticamente a sessão criada pelo carrinho

- **Dado** que `addToCart` devolveu `woocommerce-session` e `cart-token`
- **Quando** o desenvolvedor executa o checkout ou abre uma subscription na
  mesma página do GraphiQL
- **Então** os dois headers são enviados automaticamente junto com os headers
  informados pelo desenvolvedor

## Fora de escopo

- Persistir tokens ou sessões fora da página aberta.
- Alterar o contrato GraphQL, o Gateway SSE ou o WooCommerce.
- Adicionar dependências.

## Suposições

<!-- O que estamos ASSUMINDO sem confirmação. Status: aberta | confirmada | invalidada -->

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-133 | Os headers de sessão do WooCommerce podem ser lidos em respostas same-origin do Gateway. | confirmada | O GraphiQL e `/graphql` usam a mesma origem, e ambos são headers HTTP comuns. |

## Perguntas em aberto

<!-- O que ainda não sabemos. Status: aberta | respondida -->

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
Nenhuma.
