# LIÇÕES — mantido pelo motor (`onp-spec licoes`)

> Não edite à mão: qualquer escrita do motor sobrescreve este arquivo.
> Estado canônico em `.spec/licoes.json`; mutação só via `onp-spec licoes`.

## Confirmadas — carregue no Especificar/Projetar

Corroboradas em múltiplas features. Aplique como guia.

_nenhuma_

## Candidatas — em observação, NÃO aplicar ainda

Vistas em uma feature só. Registradas, não confiadas.

### L-001 — Create every task-mapped file before running the feature audit.
- sinal: `ARQUIVO_INEXISTENTE` · recorrência: 1 feature(s) · penalidades: 0
- features: marco-0-pocs
- última evidência: T-004 (marco-0-pocs, 2026-08-27T03:46:20.550Z)

### L-002 — Run verify after replacing acceptance-test scaffolds with executable proofs.
- sinal: `AC_SEM_PROVA` · recorrência: 1 feature(s) · penalidades: 0
- features: marco-0-pocs
- última evidência: AC-009 (marco-0-pocs, 2026-08-27T03:46:20.599Z)

### L-003 — Keep the parser keywords Dado, Quando, Então, Suposições, and Perguntas em aberto unchanged even when project prose is English.
- sinal: `AC_INCOMPLETO` · recorrência: 1 feature(s) · escopo: `spec` · penalidades: 0
- features: milestone-3-cart-order
- última evidência: AC-033 (milestone-3-cart-order, 2026-08-27T15:30:58.517Z)

### L-004 — Mark a task concluded only after its expected files and commit exist and onp-spec verify records PASS; an agent exit code alone is not completion.
- sinal: `TASK_CONCLUIDA_SEM_PROVA` · recorrência: 1 feature(s) · escopo: `execution` · penalidades: 0
- features: milestone-3-cart-order
- última evidência: T-021 (milestone-3-cart-order, 2026-08-27T15:31:07.802Z)

### L-005 — When a shared verification gate changes, refresh every affected feature proof before the final CI audit.
- sinal: `VERIFY_OBSOLETO` · recorrência: 1 feature(s) · penalidades: 0
- features: milestone-6-apollo-mcp
- última evidência: — (milestone-6-apollo-mcp, 2026-08-27T20:42:49.915Z)

### L-006 — When retiring a PoC, update every historical task mapping to the maintained production replacement in the same change.
- sinal: `ARQUIVO_INEXISTENTE` · recorrência: 1 feature(s) · penalidades: 0
- features: milestone-8-compliance-hardening
- última evidência: T-059 (milestone-8-compliance-hardening, 2026-08-28T05:09:49.050Z)

## Quarentena — aplicadas e falharam, ignorar

A falha recorreu mesmo com a lição aplicada. Revisão é do usuário.

_nenhuma_
