# Spec: Enable Better Auth OpenAPI

> feature: enable-better-auth-openapi
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

Desenvolvedores precisam explorar e executar manualmente os endpoints de
autenticação local sem montar cada requisição fora do navegador.

## Histórias

<!-- História de usuário: quem precisa, o que precisa e por quê. -->

### US-159 — Consultar a referência da API de autenticação

Como desenvolvedor, quero abrir a referência OpenAPI do Better Auth, para
inspecionar e testar os endpoints de autenticação durante o fluxo local.

<!-- Critério de aceite: o resultado observável que um teste consegue checar.
     Escreva para GENTE: título e Então descrevem o que o usuário vê
     ("a tela avisa X"), não o detalhe técnico ("endpoint retorna 403") —
     o detalhe pode ir entre parênteses. -->

#### AC-355 — Referência interativa disponível

- **Dado** o serviço Identity configurado com Better Auth
- **Quando** a referência de autenticação é solicitada em `/api/auth/reference`
- **Então** a interface OpenAPI interativa é retornada com sucesso

## Fora de escopo

- Unificar a documentação do Better Auth com GraphQL ou outros serviços.
- Adicionar Swagger UI ou outra dependência de documentação.
- Alterar endpoints, persistência ou regras de autenticação existentes.

## Suposições

<!-- O que estamos ASSUMINDO sem confirmação. Status: aberta | confirmada | invalidada -->

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-131 | O caminho padrão `/api/auth/reference` atende ao teste manual local. | confirmada | O pedido é pelo plugin do Better Auth, cujo caminho oficial usa o `basePath` existente `/api/auth`. |

## Perguntas em aberto

<!-- O que ainda não sabemos. Status: aberta | respondida -->

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
Nenhuma.
