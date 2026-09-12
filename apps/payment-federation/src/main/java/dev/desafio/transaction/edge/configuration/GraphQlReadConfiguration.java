package dev.desafio.transaction.edge.configuration;

import dev.desafio.transaction.inventory.application.query.FindInventoryReservationByTransactionHandler;
import dev.desafio.transaction.inventory.application.query.InventoryViewRepository;
import dev.desafio.transaction.payment.application.query.FindPaymentByTransactionHandler;
import dev.desafio.transaction.payment.application.query.PaymentViewRepository;
import dev.desafio.transaction.transaction.application.query.FindCheckoutOperationHandler;
import dev.desafio.transaction.transaction.application.query.FindOwnedTransactionHandler;
import dev.desafio.transaction.transaction.application.query.FindTransactionByWooOrderHandler;
import dev.desafio.transaction.transaction.application.query.TransactionReadRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

// Deliberately avoids @ConditionalOnBean here: it only reliably matches bean
// definitions already processed by the context, and across sibling
// @Configuration classes (as opposed to real auto-configuration classes) that
// order is not guaranteed. The class-level @ConditionalOnProperty plus plain
// constructor-parameter injection below is what actually forces Spring to
// create the upstream repository bean first.
@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(name = "spring.datasource.url")
public class GraphQlReadConfiguration {
    @Bean
    FindCheckoutOperationHandler findCheckoutOperationHandler(TransactionReadRepository views) {
        return new FindCheckoutOperationHandler(views);
    }

    @Bean
    FindOwnedTransactionHandler findOwnedTransactionHandler(TransactionReadRepository views) {
        return new FindOwnedTransactionHandler(views);
    }

    @Bean
    FindTransactionByWooOrderHandler findTransactionByWooOrderHandler(TransactionReadRepository views) {
        return new FindTransactionByWooOrderHandler(views);
    }

    @Bean
    FindPaymentByTransactionHandler findPaymentByTransactionHandler(PaymentViewRepository views) {
        return new FindPaymentByTransactionHandler(views);
    }

    @Bean
    FindInventoryReservationByTransactionHandler findInventoryReservationByTransactionHandler(
        InventoryViewRepository views
    ) {
        return new FindInventoryReservationByTransactionHandler(views);
    }
}
