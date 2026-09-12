package dev.desafio.transaction.payment.configuration;

import dev.desafio.transaction.payment.adapter.asaas.AsaasPaymentProvider;
import dev.desafio.transaction.payment.adapter.mercadopago.MercadoPagoPaymentProvider;
import dev.desafio.transaction.payment.adapter.persistence.JpaPaymentRepository;
import dev.desafio.transaction.payment.adapter.persistence.JpaPaymentViewRepository;
import dev.desafio.transaction.payment.adapter.persistence.JpaProviderNotificationRepository;
import dev.desafio.transaction.payment.adapter.persistence.SpringDataPaymentEffectRepository;
import dev.desafio.transaction.payment.adapter.persistence.SpringDataPaymentInboxRepository;
import dev.desafio.transaction.payment.adapter.persistence.SpringDataPaymentOutboxRepository;
import dev.desafio.transaction.payment.adapter.persistence.SpringDataPaymentRecordRepository;
import dev.desafio.transaction.payment.adapter.persistence.SpringDataProviderNotificationRepository;
import dev.desafio.transaction.payment.adapter.provider.DeterministicPaymentProvider;
import dev.desafio.transaction.payment.application.PaymentHandler;
import dev.desafio.transaction.payment.application.PaymentProvider;
import dev.desafio.transaction.payment.application.PaymentRepository;
import dev.desafio.transaction.payment.application.ProviderNotificationHandler;
import dev.desafio.transaction.payment.application.command.AuthorizePaymentHandler;
import dev.desafio.transaction.payment.application.query.FindPaymentHandler;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties({MercadoPagoProperties.class, AsaasProperties.class})
public class PaymentConfiguration {
    @Bean
    @ConditionalOnProperty(name = "spring.datasource.url")
    PaymentRepository paymentRepository(
        SpringDataPaymentRecordRepository payments,
        SpringDataPaymentEffectRepository effects,
        SpringDataPaymentInboxRepository inbox,
        SpringDataPaymentOutboxRepository outbox
    ) {
        return new JpaPaymentRepository(payments, effects, inbox, outbox);
    }

    @Bean
    @ConditionalOnProperty(name = "spring.datasource.url")
    ProviderNotificationHandler.Repository providerNotificationRepository(
        SpringDataProviderNotificationRepository notifications,
        SpringDataPaymentRecordRepository payments,
        SpringDataPaymentEffectRepository effects,
        SpringDataPaymentOutboxRepository outbox
    ) {
        return new JpaProviderNotificationRepository(notifications, payments, effects, outbox);
    }

    @Bean
    @ConditionalOnProperty(name = "spring.datasource.url")
    JpaPaymentViewRepository paymentViewRepository(SpringDataPaymentRecordRepository payments) {
        return new JpaPaymentViewRepository(payments);
    }

    @Bean
    @ConditionalOnProperty(
        prefix = "payment.provider",
        name = "mode",
        havingValue = "mercado-pago"
    )
    PaymentProvider mercadoPagoPaymentProvider(MercadoPagoProperties properties) {
        return new MercadoPagoPaymentProvider(properties.validatedForMercadoPago());
    }

    @Bean
    @Profile({"local", "test"})
    @ConditionalOnProperty(
        prefix = "payment.provider",
        name = "mode",
        havingValue = "deterministic"
    )
    PaymentProvider deterministicPaymentProvider() {
        return new DeterministicPaymentProvider();
    }

    @Bean
    @ConditionalOnProperty(
        prefix = "payment.provider",
        name = "mode",
        havingValue = "asaas"
    )
    PaymentProvider asaasPaymentProvider(AsaasProperties properties) {
        return new AsaasPaymentProvider(properties.validatedForAsaas());
    }

    @Bean
    @ConditionalOnBean(PaymentRepository.class)
    PaymentHandler paymentHandler(PaymentRepository repository, PaymentProvider provider) {
        return new PaymentHandler(repository, provider);
    }

    @Bean
    @ConditionalOnBean(PaymentHandler.class)
    @ConditionalOnProperty(name = "payment.legacy-api.enabled", havingValue = "true")
    AuthorizePaymentHandler authorizePaymentHandler(PaymentHandler paymentHandler) {
        return new AuthorizePaymentHandler(paymentHandler);
    }

    @Bean
    @ConditionalOnProperty(name = "spring.datasource.url")
    FindPaymentHandler findPaymentHandler(JpaPaymentViewRepository views) {
        return new FindPaymentHandler(views::findByPaymentId);
    }

}
