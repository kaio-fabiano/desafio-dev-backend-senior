# Tasks: Recover payment provider effects

> feature: recover-payment-provider-effects

## T-259 — Make payment provider effects retryable and observable [pendente]

- Refs: US-138, AC-296, AC-297
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/payment/adapter/axon/PaymentProviderEffectHandler.java, apps/payment-federation/src/test/java/dev/desafio/transaction/payment/application/axon/PaymentProviderEffectHandlerTest.java
- Notas: Follow Red, Green, Refactor. Bounded context: Payment. Use case: execute and recover provider payment/refund effects. Aggregate: Payment; the effect handler coordinates external execution and sends RecordPaymentOutcome, while aggregate invariants remain unchanged. Invariants: Axon observes the outcome future; an incomplete effect retries the same provider operation and operation key; a completed effect is never executed again; payment and refund results are not interchangeable. Consistency boundary: one Axon event handling attempt through provider result, ledger completion, and outcome-command completion. Affected ports: PaymentEffectLedger, PaymentProvider, and CommandGateway. Preserve public contracts and do not remove shared inbox/outbox persistence in this task.
