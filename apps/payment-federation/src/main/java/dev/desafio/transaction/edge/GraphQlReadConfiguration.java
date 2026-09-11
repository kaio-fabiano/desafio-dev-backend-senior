package dev.desafio.transaction.edge;

import dev.desafio.transaction.inventory.application.query.FindInventoryReservationByTransactionHandler;
import dev.desafio.transaction.inventory.application.query.InventoryViewRepository;
import dev.desafio.transaction.payment.application.query.FindPaymentByTransactionHandler;
import dev.desafio.transaction.payment.application.query.PaymentViewRepository;
import dev.desafio.transaction.transaction.application.query.FindCheckoutOperationHandler;
import dev.desafio.transaction.transaction.application.query.FindOwnedTransactionHandler;
import dev.desafio.transaction.transaction.application.query.FindTransactionByWooOrderHandler;
import dev.desafio.transaction.transaction.application.query.TransactionReadRepository;
import dev.desafio.transaction.transaction.application.checkout.CheckoutService;
import dev.desafio.transaction.transaction.adapter.axon.CheckoutCommandHandler;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Optional;

@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(name = "spring.datasource.url")
public class GraphQlReadConfiguration {
    @Bean
    CheckoutCommandHandler checkoutCommandHandler(Optional<CheckoutService> checkout) {
        return new CheckoutCommandHandler(checkout);
    }

    @Bean
    @ConditionalOnBean(TransactionReadRepository.class)
    FindCheckoutOperationHandler findCheckoutOperationHandler(TransactionReadRepository views) {
        return new FindCheckoutOperationHandler(views);
    }

    @Bean
    @ConditionalOnBean(TransactionReadRepository.class)
    FindOwnedTransactionHandler findOwnedTransactionHandler(TransactionReadRepository views) {
        return new FindOwnedTransactionHandler(views);
    }

    @Bean
    @ConditionalOnBean(TransactionReadRepository.class)
    FindTransactionByWooOrderHandler findTransactionByWooOrderHandler(TransactionReadRepository views) {
        return new FindTransactionByWooOrderHandler(views);
    }

    @Bean
    @ConditionalOnBean(PaymentViewRepository.class)
    FindPaymentByTransactionHandler findPaymentByTransactionHandler(PaymentViewRepository views) {
        return new FindPaymentByTransactionHandler(views);
    }

    @Bean
    @ConditionalOnBean(InventoryViewRepository.class)
    FindInventoryReservationByTransactionHandler findInventoryReservationByTransactionHandler(
        InventoryViewRepository views
    ) {
        return new FindInventoryReservationByTransactionHandler(views);
    }
}
