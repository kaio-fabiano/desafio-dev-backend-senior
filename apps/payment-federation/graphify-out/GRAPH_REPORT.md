# Graph Report - payment-federation  (2026-09-10)

## Corpus Check
- Corpus is ~47,905 words - fits in a single context window. You may not need a graph.

## Summary
- 2005 nodes · 6344 edges · 96 communities (75 shown, 19 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 346 edges (avg confidence: 0.82)
- Token cost: 456 input · 1,568 output

## Community Hubs (Navigation)
- Test Infrastructure and Axon
- Axon Commands and Events
- Checkout Operation Persistence
- Federation Configuration
- Transactional Persistence
- Integration Event Dispatch
- Inventory Rabbit Listener
- GraphQL Subscriptions
- Payment GraphQL API
- Transaction Outcomes
- Architecture Tests
- AMQP Topology Tests
- Provider Notification API
- Query Handlers
- Outbox Publishing
- Payment Application Ports
- Checkout GraphQL CQRS
- Effect Execution Lifecycle
- Transaction Event Queue
- GraphQL Security and Errors
- Integration Lifecycle E2E
- Inventory Persistence Entities
- Inventory Query Projection
- Inventory Axon Event Adapter
- Spring Data Repositories
- Inventory Projection Entity
- Transaction Application Flow
- Mercado Pago Client
- Payment Record Transitions
- Payment Runtime Configuration
- Nx Project Configuration
- Inventory Command Handling
- Transaction Subscription Tests
- Payment Persistence Base
- Commit Inventory Tests
- Application Integration Health
- Inventory JPA Operations
- Payment Effect Entity
- WooCommerce GraphQL Client
- Inventory Application Service
- WordPress HTTP Adapters
- Payment Transactional Processing
- Inventory Event Contracts
- Payment Consumer Acknowledgements
- Woo Checkout Requests
- Inventory Reservation Aggregate
- Payment JPA Repositories
- Mercado Pago Webhook Tests
- Checkout Command Handling
- Checkout Operation States
- Inventory Reliability Tests
- Mercado Pago Properties
- Inventory Operation Locking
- Inventory Result Events
- Inventory Claim Lifecycle
- Inventory Domain Adapters
- Inventory Event Publishing
- Inventory Processing Reliability
- AMQP Inbox Identity
- AMQP Inbox Lifecycle
- Inventory Reservation Commands
- Transaction Outcome Handler
- Mercado Pago Provider Tests
- Transaction Start with Axon
- Payment Rabbit Listener
- Checkout Operation Repository
- AMQP Outbox Lifecycle
- Payment Handler Tests
- Provider Effect Reconciliation
- Woo Inventory HTTP Adapter
- Refund Processing
- Application Runtime Configuration
- API Security Configuration
- Payment Inbox Lifecycle
- Provider Notification Lifecycle
- Checkout Input Validation
- Payment Redelivery Idempotency
- WooCommerce Adapter Tests
- Axon Payment Repository
- Inventory Outbox Repository
- Idempotent Payment Processing
- Inventory Integration Tests
- Payment Query Repository
- Payment Migration Architecture
- Event Sourced Entities
- Payment Provider Effects
- Transaction View Store
- Integration Event Validation
- Checkout Command Identity
- Gradle Wrapper
- Stock State
- Messaging Error Messages
- Persistence Error Messages
- Integration Event Contracts

## God Nodes (most connected - your core abstractions)
1. `Payment` - 67 edges
2. `Transaction` - 52 edges
3. `IntegrationEventEnvelope` - 45 edges
4. `Result` - 44 edges
5. `TransactionView` - 42 edges
6. `PaymentProvider` - 41 edges
7. `TransactionEvent` - 41 edges
8. `ChoreographedLifecycleE2ETest` - 36 edges
9. `PaymentView` - 34 edges
10. `CheckoutOperationEntity` - 34 edges

## Surprising Connections (you probably didn't know these)
- `InventoryInboxJpaRepository` --references--> `InventoryInboxEntity`  [EXTRACTED]
  src/main/java/dev/desafio/transaction/inventory/adapter/persistence/InventoryInboxJpaRepository.java → src/main/java/dev/desafio/transaction/inventory/adapter/persistence/InventoryInboxEntity.java
- `InventoryOperationJpaRepository` --references--> `InventoryOperationEntity`  [EXTRACTED]
  src/main/java/dev/desafio/transaction/inventory/adapter/persistence/InventoryOperationJpaRepository.java → src/main/java/dev/desafio/transaction/inventory/adapter/persistence/InventoryOperationEntity.java
- `JpaInventoryProjectionRepository` --references--> `InventoryReservationProjectionJpaRepository`  [EXTRACTED]
  src/main/java/dev/desafio/transaction/inventory/adapter/persistence/JpaInventoryProjectionRepository.java → src/main/java/dev/desafio/transaction/inventory/adapter/persistence/InventoryReservationProjectionJpaRepository.java
- `JpaInventoryViewRepository` --references--> `InventoryReservationProjectionJpaRepository`  [EXTRACTED]
  src/main/java/dev/desafio/transaction/inventory/adapter/persistence/JpaInventoryViewRepository.java → src/main/java/dev/desafio/transaction/inventory/adapter/persistence/InventoryReservationProjectionJpaRepository.java
- `InventoryResultEventJpaRepository` --references--> `InventoryResultEventEntity`  [EXTRACTED]
  src/main/java/dev/desafio/transaction/inventory/adapter/persistence/InventoryResultEventJpaRepository.java → src/main/java/dev/desafio/transaction/inventory/adapter/persistence/InventoryResultEventEntity.java

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Payment Federation Runtime Configuration** — src_main_resources_application_payment_federation, src_main_resources_application_oauth2_jwt_resource_server, src_main_resources_application_rabbitmq_reliable_messaging, src_main_resources_application_payment_provider, src_main_resources_application_health_probes [EXTRACTED 1.00]
- **Database Schema Governance** — src_main_resources_application_flyway_schema_management, src_main_resources_application_jpa_schema_validation, src_main_resources_application_test_database_schema_control [INFERRED 0.85]

## Communities (96 total, 19 thin omitted)

### Community 0 - "Test Infrastructure and Axon"
Cohesion: 0.05
Nodes (45): DriverManagerDataSource, EventMessage, org.axonframework.eventsourcing.eventstore.EventStorageEngine, org.junit.jupiter.api.AfterAll, org.junit.jupiter.api.BeforeAll, org.springframework.boot.autoconfigure.domain.EntityScan, org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration, org.springframework.boot.autoconfigure.ImportAutoConfiguration (+37 more)

### Community 1 - "Axon Commands and Events"
Cohesion: 0.06
Nodes (34): org.axonframework.messaging.commandhandling.annotation.Command, org.axonframework.messaging.core.unitofwork.ProcessingContext, org.axonframework.messaging.eventhandling.annotation.Event, org.axonframework.messaging.eventhandling.annotation.EventHandler, org.axonframework.messaging.eventhandling.gateway.EventAppender, ReleaseInventoryCommand, PaymentCommandHandler, Override (+26 more)

### Community 2 - "Checkout Operation Persistence"
Cohesion: 0.06
Nodes (14): CheckoutOperationEntity, Status, CheckoutOperationJpaRepository, Claim, Override, Status, JpaCheckoutOperationRepository, Override (+6 more)

### Community 3 - "Federation Configuration"
Cohesion: 0.07
Nodes (21): FederationSchemaFactory, org.springframework.amqp.core.Declarables, org.springframework.boot.autoconfigure.condition.ConditionalOnExpression, org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean, org.springframework.boot.autoconfigure.condition.ConditionalOnProperty, org.springframework.boot.autoconfigure.graphql.GraphQlSourceBuilderCustomizer, org.springframework.context.annotation.Bean, org.springframework.context.annotation.Configuration (+13 more)

### Community 4 - "Transactional Persistence"
Cohesion: 0.10
Nodes (24): com.fasterxml.jackson.databind.ObjectMapper, jakarta.persistence.EntityManager, org.springframework.transaction.PlatformTransactionManager, org.springframework.transaction.support.TransactionTemplate, TransactionTemplate, TransactionTemplate, JpaInventoryProjectionRepository, TransactionTemplate (+16 more)

### Community 5 - "Integration Event Dispatch"
Cohesion: 0.08
Nodes (12): BasicProperties, com.fasterxml.jackson.databind.JsonNode, IntegrationEventEnvelope, InventoryAmqpOutboxEntity, InventoryAmqpOutboxJpaRepository, InventoryAmqpOutboxEntity, Override, JpaInventoryOutbox (+4 more)

### Community 6 - "Inventory Rabbit Listener"
Cohesion: 0.10
Nodes (17): com.rabbitmq.client.Channel, org.axonframework.messaging.commandhandling.gateway.CommandGateway, org.springframework.amqp.core.Message, org.springframework.amqp.rabbit.annotation.RabbitListener, org.springframework.beans.factory.ObjectProvider, InventoryRabbitListener, OutgoingEvent, InventoryService (+9 more)

### Community 7 - "GraphQL Subscriptions"
Cohesion: 0.09
Nodes (19): org.axonframework.extension.reactor.messaging.queryhandling.gateway.ReactorQueryGateway, org.axonframework.messaging.core.annotation.Namespace, org.axonframework.messaging.eventhandling.processing.streaming.token.store.TokenStore, org.axonframework.messaging.queryhandling.QueryUpdateEmitter, org.springframework.boot.test.context.TestConfiguration, org.springframework.graphql.data.method.annotation.SubscriptionMapping, org.springframework.stereotype.Controller, reactor.core.publisher.Flux (+11 more)

### Community 8 - "Payment GraphQL API"
Cohesion: 0.10
Nodes (16): org.springframework.graphql.data.federation.EntityMapping, org.springframework.graphql.data.method.annotation.MutationMapping, org.springframework.graphql.data.method.annotation.QueryMapping, PaymentController, AuthorizePayment, PaymentRequested, AuthorizePaymentHandler, PaymentRequested (+8 more)

### Community 9 - "Transaction Outcomes"
Cohesion: 0.07
Nodes (22): Event, Outcome, INVENTORY_COMMIT_REJECTED, INVENTORY_COMMITTED, INVENTORY_REJECTED, INVENTORY_RESERVED, PAYMENT_APPROVED, PAYMENT_PENDING (+14 more)

### Community 10 - "Architecture Tests"
Cohesion: 0.10
Nodes (10): JavaClasses, org.junit.jupiter.api.DisplayName, org.junit.jupiter.api.Test, SonarConfigurationTest, AxonBaselineContractTest, ContextArchitectureTest, InventoryIntegrationEventHandlerTest, PaymentRequested (+2 more)

### Community 11 - "AMQP Topology Tests"
Cohesion: 0.11
Nodes (12): javax.sql.DataSource, org.springframework.amqp.rabbit.connection.CachingConnectionFactory, org.testcontainers.containers.GenericContainer, AmqpTopologyConfiguration, Declarables, MarketplaceAmqp, InventoryAmqpInboxJpaRepository, CachingConnectionFactory (+4 more)

### Community 12 - "Provider Notification API"
Cohesion: 0.10
Nodes (18): org.springframework.beans.factory.annotation.Autowired, org.springframework.http.ResponseEntity, org.springframework.web.bind.annotation.PostMapping, org.springframework.web.bind.annotation.RequestMapping, org.springframework.web.bind.annotation.RestController, AxonProviderNotificationHandler, Outcome, FunctionalInterface (+10 more)

### Community 13 - "Query Handlers"
Cohesion: 0.11
Nodes (10): org.axonframework.messaging.queryhandling.annotation.QueryHandler, org.springframework.boot.autoconfigure.condition.ConditionalOnBean, FindPaymentByTransactionHandler, PaymentViewRepository, GraphQlReadConfiguration, CheckoutOperationView, FindCheckoutOperationHandler, FindOwnedTransactionHandler (+2 more)

### Community 14 - "Outbox Publishing"
Cohesion: 0.11
Nodes (10): org.springframework.amqp.rabbit.core.RabbitTemplate, org.springframework.scheduling.annotation.Scheduled, OutboxPaymentIntegrationEventPublisher, PaymentIntegrationEventPublisher, ConfirmedAmqpPublisher, IntegrationEventJson, OutboxRelay, OutboxRelayScheduler (+2 more)

### Community 15 - "Payment Application Ports"
Cohesion: 0.11
Nodes (13): Override, OutgoingEvent, Payment, PaymentRequested, ProviderResult, Status, AUTHORIZED, PENDING (+5 more)

### Community 16 - "Checkout GraphQL CQRS"
Cohesion: 0.14
Nodes (13): java.security.Principal, org.axonframework.extension.reactor.messaging.commandhandling.gateway.ReactorCommandGateway, org.springframework.security.access.prepost.PreAuthorize, reactor.core.publisher.Mono, FindInventoryReservationByTransaction, FindPaymentByTransaction, CheckoutGraphQlController, OrderStateView (+5 more)

### Community 17 - "Effect Execution Lifecycle"
Cohesion: 0.12
Nodes (11): Override, Override, Status, Result, OutgoingEvent, ProcessingResult, Command, Override (+3 more)

### Community 18 - "Transaction Event Queue"
Cohesion: 0.12
Nodes (13): Override, Outcome, Status, TransactionEvent, TransactionEventHandler, FindTransactionHandler, FunctionalInterface, TransactionOutbox (+5 more)

### Community 19 - "GraphQL Security and Errors"
Cohesion: 0.10
Nodes (17): Chain, graphql.GraphQLError, graphql.schema.DataFetchingEnvironment, org.springframework.beans.factory.config.BeanPostProcessor, org.springframework.graphql.execution.DataFetcherExceptionResolverAdapter, org.springframework.graphql.server.WebGraphQlInterceptor, org.springframework.graphql.server.WebGraphQlRequest, org.springframework.graphql.server.WebGraphQlResponse (+9 more)

### Community 20 - "Integration Lifecycle E2E"
Cohesion: 0.19
Nodes (8): InventoryIntegrationEventHandler, PaymentIntegrationEventHandler, ChoreographedLifecycleE2ETest, Delivery, FunctionalInterface, Message, SuppressWarnings, JdbcTemplate

### Community 21 - "Inventory Persistence Entities"
Cohesion: 0.14
Nodes (9): jakarta.persistence.Entity, jakarta.persistence.Table, InventoryInboxEntity, InventoryAmqpInboxEntity, InventoryAmqpOutboxEntity, PaymentAmqpInboxEntity, PaymentAmqpOutboxEntity, TransactionAmqpOutboxEntity (+1 more)

### Community 22 - "Inventory Query Projection"
Cohesion: 0.11
Nodes (10): org.axonframework.messaging.queryhandling.annotation.Query, JpaInventoryViewRepository, Status, FindInventoryReservationByTransactionHandler, FindInventoryReservationQuery, FindInventoryReservationQueryHandler, InventoryProjectionRepository, InventoryReservationView (+2 more)

### Community 23 - "Inventory Axon Event Adapter"
Cohesion: 0.18
Nodes (10): InventoryCommitRejectedAxonEvent, InventoryCommittedAxonEvent, InventoryReleasedAxonEvent, InventoryReservationRejectedAxonEvent, InventoryReservedAxonEvent, InventoryProjectionHandler, History, PaymentRequested (+2 more)

### Community 24 - "Spring Data Repositories"
Cohesion: 0.17
Nodes (7): org.springframework.data.domain.Pageable, org.springframework.data.jpa.repository.JpaRepository, org.springframework.data.jpa.repository.Lock, org.springframework.data.jpa.repository.Query, org.springframework.data.jpa.repository.QueryHints, org.springframework.data.repository.NoRepositoryBean, AmqpInboxJpaRepository

### Community 25 - "Inventory Projection Entity"
Cohesion: 0.14
Nodes (6): InventoryReservationProjectionEntity, Status, InventoryReservationProjectionJpaRepository, InventoryReservationProjectionMapper, Override, Override

### Community 27 - "Mercado Pago Client"
Cohesion: 0.20
Nodes (8): com.mercadopago.client.payment.PaymentClient, com.mercadopago.client.payment.PaymentCreateRequest, com.mercadopago.core.MPRequestOptions, PaymentClient, Override, PaymentRequested, Status, MercadoPagoPaymentProvider

### Community 28 - "Payment Record Transitions"
Cohesion: 0.15
Nodes (6): Override, Status, PaymentRecordEntity, Method, CARD, PIX

### Community 29 - "Payment Runtime Configuration"
Cohesion: 0.26
Nodes (8): org.springframework.boot.context.properties.EnableConfigurationProperties, org.springframework.context.annotation.Profile, DeterministicPaymentProvider, PaymentHandler, FunctionalInterface, PaymentProvider, PaymentRepository, PaymentConfiguration

### Community 30 - "Nx Project Configuration"
Cohesion: 0.10
Nodes (20): executor, options, parallelism, executor, options, parallelism, name, command (+12 more)

### Community 31 - "Inventory Command Handling"
Cohesion: 0.15
Nodes (10): org.axonframework.messaging.commandhandling.annotation.CommandHandler, InventoryAxonEvents, InventoryEventSourcedEntity, Status, EventAppender, Status, ReleaseInventoryCommandHandler, EventAppender (+2 more)

### Community 32 - "Transaction Subscription Tests"
Cohesion: 0.20
Nodes (4): org.axonframework.messaging.eventhandling.gateway.EventGateway, SuppressWarnings, TransactionSubscriptionSseTest, TransactionSubscriptionSseTest.TestAxonConfiguration

### Community 33 - "Payment Persistence Base"
Cohesion: 0.19
Nodes (6): jakarta.persistence.PostLoad, jakarta.persistence.PostPersist, org.springframework.data.domain.Persistable, OutgoingEvent, Override, PaymentOutboxEntity

### Community 34 - "Commit Inventory Tests"
Cohesion: 0.15
Nodes (9): org.axonframework.test.fixture.AxonTestFixture, org.junit.jupiter.api.AfterEach, CommitInventoryCommand, CommitDecision, CommitInventoryCommandHandler, EventAppender, FunctionalInterface, Status (+1 more)

### Community 35 - "Application Integration Health"
Cohesion: 0.18
Nodes (7): org.junit.jupiter.api.BeforeEach, org.springframework.boot.test.context.SpringBootTest, org.springframework.boot.test.web.client.TestRestTemplate, PaymentFederationApplicationTest, BearerClaims, SuppressWarnings, OrderWorkflowGraphQlCompatibilityTest

### Community 36 - "Inventory JPA Operations"
Cohesion: 0.20
Nodes (8): InventoryInboxJpaRepository, InventoryOperationJpaRepository, InventoryResultEventJpaRepository, Claim, OutgoingEvent, Override, TransactionTemplate, JpaInventoryRepository

### Community 37 - "Payment Effect Entity"
Cohesion: 0.15
Nodes (10): Override, Status, PaymentEffectEntity, State, CLAIMED, COMPLETED, Effect, Type (+2 more)

### Community 38 - "WooCommerce GraphQL Client"
Cohesion: 0.23
Nodes (6): Call, Cart, GraphQlClient, FunctionalInterface, Override, WooCommerceGraphQlOrderAdapter

### Community 40 - "WordPress HTTP Adapters"
Cohesion: 0.20
Nodes (6): java.net.http.HttpClient, java.net.URI, Override, WordPressOrderPaymentAdapter, WpGraphqlAuthentication, HttpGraphQlClient

### Community 41 - "Payment Transactional Processing"
Cohesion: 0.25
Nodes (6): org.springframework.transaction.annotation.Transactional, Override, PaymentRequested, ProcessingResult, Status, JpaPaymentRepository

### Community 42 - "Inventory Event Contracts"
Cohesion: 0.25
Nodes (4): InventoryCommitRejectedEvent, InventoryCommittedEvent, InventoryReleasedEvent, InventoryReservedEvent

### Community 43 - "Payment Consumer Acknowledgements"
Cohesion: 0.15
Nodes (5): Acknowledgement, Delivery, FunctionalInterface, ProcessingResult, PaymentConsumer

### Community 44 - "Woo Checkout Requests"
Cohesion: 0.20
Nodes (6): AmbiguousResponseException, Order, Request, Session, WooCommerceOrderPort, CheckoutServiceTest

### Community 45 - "Inventory Reservation Aggregate"
Cohesion: 0.16
Nodes (8): InventoryReservation, Status, COMMIT_REJECTED, COMMITTED, REJECTED, RELEASED, RESERVED, InventoryReservationTest

### Community 46 - "Payment JPA Repositories"
Cohesion: 0.29
Nodes (7): Status, JpaProviderNotificationRepository, SpringDataPaymentEffectRepository, SpringDataPaymentInboxRepository, SpringDataPaymentOutboxRepository, SpringDataPaymentRecordRepository, SpringDataProviderNotificationRepository

### Community 47 - "Mercado Pago Webhook Tests"
Cohesion: 0.23
Nodes (3): Notification, MercadoPagoWebhookControllerTest, ProviderNotificationHandlerTest

### Community 48 - "Checkout Command Handling"
Cohesion: 0.18
Nodes (5): CheckoutCommandHandler, CheckoutCommand, CheckoutService, FunctionalInterface, TransactionCommands

### Community 49 - "Checkout Operation States"
Cohesion: 0.26
Nodes (8): Operation, Status, COMPLETED, CREATING_WOO, PENDING_WOO, WOO_CONFIRMED, Override, MemoryCheckoutRepository

### Community 50 - "Inventory Reliability Tests"
Cohesion: 0.24
Nodes (6): InventoryServiceTest, Claim, OutgoingEvent, Override, MemoryRepository, StoredOperation

### Community 51 - "Mercado Pago Properties"
Cohesion: 0.18
Nodes (5): org.springframework.boot.context.properties.ConfigurationProperties, MercadoPagoProperties, Mode, DETERMINISTIC, MERCADO_PAGO

### Community 52 - "Inventory Operation Locking"
Cohesion: 0.14
Nodes (4): InventoryOperationEntity, State, CLAIMED, COMPLETED

### Community 53 - "Inventory Result Events"
Cohesion: 0.23
Nodes (3): InventoryResultEventEntity, InventoryResultEventMapper, OutgoingEvent

### Community 54 - "Inventory Claim Lifecycle"
Cohesion: 0.21
Nodes (11): Claim, ClaimStatus, ACQUIRED, BUSY, COMPLETED, InventoryRepository, OutgoingEvent, Claim (+3 more)

### Community 55 - "Inventory Domain Adapters"
Cohesion: 0.22
Nodes (5): InsufficientStockException, Inventory, OutgoingEvent, ProcessingResult, WooInventoryAdapterTest

### Community 57 - "Inventory Processing Reliability"
Cohesion: 0.21
Nodes (6): OutgoingEvent, ProcessingResult, WorkInProgressException, FunctionalInterface, StockPort, ReservationRequested

### Community 58 - "AMQP Inbox Identity"
Cohesion: 0.27
Nodes (3): jakarta.persistence.Embeddable, AmqpInboxId, Override

### Community 59 - "AMQP Inbox Lifecycle"
Cohesion: 0.19
Nodes (6): jakarta.persistence.MappedSuperclass, AmqpInboxEntity, Disposition, BUSINESS_REJECTED, COMPLETED, PROCESSING

### Community 60 - "Inventory Reservation Commands"
Cohesion: 0.27
Nodes (4): ReserveInventoryCommand, InventoryReservationRejectedEvent, StockItem, StockItem

### Community 61 - "Transaction Outcome Handler"
Cohesion: 0.22
Nodes (5): Outcome, RecordTransactionOutcome, RecordTransactionOutcomeHandler, Status, TransactionEventSourcedEntity

### Community 63 - "Transaction Start with Axon"
Cohesion: 0.32
Nodes (3): ComponentBuilder, StartTransactionHandler, TransactionAxonTest

### Community 64 - "Payment Rabbit Listener"
Cohesion: 0.26
Nodes (4): org.slf4j.Logger, Delivery, ProcessingResult, PaymentRabbitListener

### Community 65 - "Checkout Operation Repository"
Cohesion: 0.27
Nodes (4): CheckoutOperationRepository, Claim, ClaimRequest, Claim

### Community 67 - "Payment Handler Tests"
Cohesion: 0.27
Nodes (3): AtomicRepository, OutgoingEvent, PaymentHandlerTest

### Community 68 - "Provider Effect Reconciliation"
Cohesion: 0.35
Nodes (3): InMemoryLedger, Override, PaymentProviderEffectHandlerTest

### Community 69 - "Woo Inventory HTTP Adapter"
Cohesion: 0.40
Nodes (3): java.net.http.HttpRequest, Override, WooInventoryAdapter

### Community 70 - "Refund Processing"
Cohesion: 0.24
Nodes (5): RefundRequested, Override, InMemoryRepository, Override, ProcessingResult

### Community 71 - "Application Runtime Configuration"
Cohesion: 0.24
Nodes (10): Deterministic Payment Provider for Local and Test Profiles, Flyway Schema Management, Graceful Shutdown, Health Probes, JPA Schema Validation, OAuth2 JWT Resource Server, Payment Federation Application, Payment Provider Configuration (+2 more)

### Community 72 - "API Security Configuration"
Cohesion: 0.36
Nodes (6): org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication, org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity, org.springframework.security.config.annotation.web.builders.HttpSecurity, org.springframework.security.oauth2.jwt.JwtDecoder, org.springframework.security.web.SecurityFilterChain, PaymentSecurityConfiguration

### Community 74 - "Provider Notification Lifecycle"
Cohesion: 0.28
Nodes (4): Outcome, Override, Status, ProviderNotificationEntity

### Community 76 - "Payment Redelivery Idempotency"
Cohesion: 0.33
Nodes (6): OutgoingEvent, Override, ProcessingResult, PaymentRedeliveryTest, RedeliveryRepository, SimulatedCrash

### Community 78 - "Axon Payment Repository"
Cohesion: 0.39
Nodes (3): Claim, Outcome, Override

### Community 80 - "Idempotent Payment Processing"
Cohesion: 0.39
Nodes (4): IdempotentRepository, Override, ProcessingResult, Status

### Community 84 - "Event Sourced Entities"
Cohesion: 0.47
Nodes (3): org.axonframework.eventsourcing.annotation.EventSourcingHandler, org.axonframework.eventsourcing.annotation.reflection.EntityCreator, org.axonframework.extension.spring.stereotype.EventSourced

### Community 89 - "Gradle Wrapper"
Cohesion: 0.83
Nodes (3): gradlew script, die(), warn()

### Community 90 - "Stock State"
Cohesion: 0.50
Nodes (4): StockState, AVAILABLE, INSUFFICIENT, RESERVED

## Knowledge Gaps
- **73 isolated node(s):** `$schema`, `name`, `projectType`, `sourceRoot`, `tags` (+68 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 280 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Payment` connect `Payment Application Ports` to `Test Infrastructure and Axon`, `Axon Commands and Events`, `Inventory Rabbit Listener`, `Payment GraphQL API`, `Architecture Tests`, `Provider Notification API`, `Outbox Publishing`, `Checkout GraphQL CQRS`, `Effect Execution Lifecycle`, `Inventory Query Projection`, `Mercado Pago Client`, `Payment Record Transitions`, `Payment Runtime Configuration`, `Payment Persistence Base`, `Payment Effect Entity`, `Payment Transactional Processing`, `Payment JPA Repositories`, `Mercado Pago Webhook Tests`, `Mercado Pago Provider Tests`, `Payment Handler Tests`, `Refund Processing`, `Idempotent Payment Processing`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Why does `Transaction` connect `Transaction Outcomes` to `Test Infrastructure and Axon`, `Inventory Rabbit Listener`, `GraphQL Subscriptions`, `AMQP Topology Tests`, `Checkout GraphQL CQRS`, `Transaction Event Queue`, `Event Sourced Entities`, `Inventory Persistence Entities`, `Inventory Query Projection`, `Integration Lifecycle E2E`, `Transaction Application Flow`, `Inventory Reservation Commands`, `Transaction Outcome Handler`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Why does `TransactionView` connect `GraphQL Subscriptions` to `Transaction Subscription Tests`, `Checkout Operation Persistence`, `Application Integration Health`, `Transactional Persistence`, `Query Handlers`, `Checkout GraphQL CQRS`, `Transaction Event Queue`, `Inventory Query Projection`, `Transaction View Store`, `Transaction Application Flow`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **What connects `$schema`, `name`, `projectType` to the rest of the system?**
  _73 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Test Infrastructure and Axon` be split into smaller, more focused modules?**
  _Cohesion score 0.05490734385724091 - nodes in this community are weakly interconnected._
- **Should `Axon Commands and Events` be split into smaller, more focused modules?**
  _Cohesion score 0.0568986568986569 - nodes in this community are weakly interconnected._
- **Should `Checkout Operation Persistence` be split into smaller, more focused modules?**
  _Cohesion score 0.06086956521739131 - nodes in this community are weakly interconnected._