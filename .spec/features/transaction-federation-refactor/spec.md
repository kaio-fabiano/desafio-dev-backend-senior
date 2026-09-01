# Spec: Order workflow boundary refactor

> feature: transaction-federation-refactor
> status: rascunho

## Contexto

O Commerce subgraph atual mistura um processo próprio — idempotência, saga e
eventos — com wrappers de catálogo, carrinho e pedidos já fornecidos por
WordPress, WooCommerce, WPGraphQL e WooGraphQL. Ele deve ser transformado numa
Order Workflow Federation enxuta. Payment permanece focado no agregado
financeiro; Inventory permanece um participante separado dentro do runtime Java.

## Histórias

### US-068 — Usar capacidades comerciais nativas

Como mantenedor, quero resolver comércio pelos plugins instalados, para evitar
proxies e modelos comerciais duplicados.

#### AC-139 — Operações comerciais pertencem ao WordPress

- **Dado** o supergraph com WordPress federado nativamente
- **Quando** um cliente consulta ou altera catálogo, carrinho ou pedido autoritativo
- **Então** os plugins resolvem a operação sem wrapper equivalente no Order Workflow

#### AC-140 — Workflow delega o checkout

- **Dado** um carrinho autenticado e uma chave inédita
- **Quando** o cliente inicia checkout pelo Order Workflow
- **Então** ele reserva a chave e delega a criação ao checkout nativo do WooGraphQL

### US-069 — Preservar um domínio próprio de workflow

Como operador, quero um serviço enxuto para o ciclo de vida distribuído do
pedido, para que essa responsabilidade não pertença a WooCommerce nem Payment.

#### AC-141 — Order Workflow é um serviço independente

- **Dado** o inventário de runtimes e o supergraph
- **Quando** a arquitetura é composta
- **Então** existe uma Order Workflow Federation responsável somente por operação, saga, outbox/inbox e stream

#### AC-142 — Workflow não possui modelos comerciais

- **Dado** a persistência do Order Workflow
- **Quando** suas entidades são inspecionadas
- **Então** ela contém apenas operação, referência ao pedido, estado técnico e eventos, sem produto, carrinho, pedido ou estoque autoritativo

### US-070 — Preservar idempotência e coreografia

Como cliente, quero repetir checkout com a mesma chave sem duplicar pedido ou
cobrança, para que retries sejam seguros.

#### AC-143 — Idempotência concorrente ponta a ponta

- **Dado** duas requisições concorrentes do mesmo usuário, chave e comando
- **Quando** ambas iniciam checkout
- **Então** observam a mesma operação e no máximo um pedido e uma cobrança são criados

#### AC-144 — Reutilização conflitante é recusada

- **Dado** uma chave vinculada a usuário ou comando
- **Quando** ela é reutilizada por outro usuário ou com parâmetros diferentes
- **Então** o conflito é recusado sem novo efeito comercial

#### AC-145 — Participantes comunicam-se por RabbitMQ

- **Dado** Order Workflow, Payment e Inventory
- **Quando** a saga progride ou uma mensagem é entregue novamente
- **Então** eventos versionados, inbox e outbox preservam coreografia e idempotência sem chamada direta entre participantes

### US-071 — Preservar eventos via SSE

Como comprador, quero assinar eventos pela chave antes de criar o pedido, para
acompanhar a progressão até o estado final.

#### AC-146 — Subscription pode preceder o checkout

- **Dado** uma chave ainda sem operação
- **Quando** seu futuro proprietário assina e depois inicia checkout com a mesma chave
- **Então** o Order Workflow mantém o stream e entrega a progressão até o estado final

#### AC-147 — Stream protege ownership

- **Dado** uma chave de outro usuário
- **Quando** um usuário autenticado tenta assinar seus eventos
- **Então** nenhum evento do proprietário é exposto

### US-072 — Manter Payment financeiro e extensível

Como mantenedor, quero Payment focado no agregado financeiro e numa porta para
provedor real, sem absorver checkout, workflow ou inventário.

#### AC-148 — Payment depende de uma porta de provedor

- **Dado** o módulo Payment Java
- **Quando** autoriza, consulta ou compensa pagamento
- **Então** domain/application dependem de uma porta e não importam SDK externo

#### AC-149 — Inventory permanece participante separado

- **Dado** Payment e Inventory no mesmo runtime Java
- **Quando** um pagamento é aprovado
- **Então** Inventory reage via RabbitMQ e usa WooCommerce nativo sem chamada direta do Payment

### US-073 — Justificar toda extensão customizada

Como avaliador, quero saber por que cada código customizado existe, para
confirmar que capacidades prontas foram preferidas.

#### AC-150 — ADR registra alternativas e lacunas

- **Dado** a arquitetura implementada
- **Quando** os ADRs são consultados
- **Então** registram capacidade nativa, lacuna comprovada, alternativas, consequências e condição de remoção

#### AC-151 — Gates permanecem verdes

- **Dado** a refatoração completa
- **Quando** ESLint, testes, composição, verify e audit CI executam
- **Então** todos passam sem testes pulados nem wrappers comerciais redundantes

## Fora de escopo

- Remover o serviço de Order Workflow.
- Mover checkout, saga ou SSE para Payment.
- Escolher ou integrar o provedor real nesta primeira refatoração.
- Refatorar infraestrutura cloud, custos ou autoscaling.
- Criar outro container para Inventory.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-053 | Commerce será renomeado e reduzido para Order Workflow, não removido. | confirmada | Confirmada explicitamente em 2026-09-01. |
| ASM-054 | Payment e Inventory compartilham runtime Java, mas são participantes assíncronos separados. | confirmada | Confirmada em 2026-09-01. |
| ASM-055 | O provedor real será escolhido numa feature posterior com sandbox e compliance explícitos. | confirmada | Requisito registrado pelo usuário. |

## Perguntas em aberto

Nenhuma para iniciar esta refatoração. A seleção do provedor de pagamento será
decidida antes da feature específica de integração.
