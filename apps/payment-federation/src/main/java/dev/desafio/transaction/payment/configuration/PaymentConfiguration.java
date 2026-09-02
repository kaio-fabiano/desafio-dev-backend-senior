package dev.desafio.transaction.payment.configuration;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.desafio.transaction.payment.adapter.mercadopago.MercadoPagoPaymentProvider;
import dev.desafio.transaction.payment.adapter.messaging.PaymentConsumer;
import dev.desafio.transaction.payment.adapter.persistence.JdbcPaymentRepository;
import dev.desafio.transaction.payment.adapter.persistence.JdbcProviderNotificationRepository;
import dev.desafio.transaction.payment.adapter.provider.DeterministicPaymentProvider;
import dev.desafio.transaction.payment.adapter.wordpress.WordPressOrderPaymentAdapter;
import dev.desafio.transaction.payment.application.PaymentHandler;
import dev.desafio.transaction.payment.application.PaymentProvider;
import dev.desafio.transaction.payment.application.PaymentRepository;
import dev.desafio.transaction.payment.application.ProviderNotificationHandler;
import dev.desafio.transaction.payment.application.command.AuthorizePaymentHandler;
import dev.desafio.transaction.payment.application.command.OrderPaymentPort;
import dev.desafio.transaction.payment.application.query.FindPaymentHandler;
import dev.desafio.transaction.payment.application.query.PaymentView;
import dev.desafio.transaction.payment.domain.Payment;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;
import java.net.URI;
import java.util.Optional;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(MercadoPagoProperties.class)
public class PaymentConfiguration {
    private static final String FIND_PAYMENT_SQL = """
        select payment_id, operation_key, order_id, method, amount, currency,
               status, provider_reference, pix_code
          from payment_record
         where payment_id = ?
        """;

    @Bean
    @ConditionalOnProperty(name = "spring.datasource.url")
    PaymentRepository paymentRepository(DataSource dataSource) {
        return new JdbcPaymentRepository(dataSource);
    }

    @Bean
    @ConditionalOnProperty(name = "spring.datasource.url")
    ProviderNotificationHandler.Repository providerNotificationRepository(DataSource dataSource) {
        return new JdbcProviderNotificationRepository(dataSource);
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
    @ConditionalOnBean(PaymentRepository.class)
    PaymentHandler paymentHandler(PaymentRepository repository, PaymentProvider provider) {
        return new PaymentHandler(repository, provider);
    }

    @Bean
    @ConditionalOnBean(PaymentHandler.class)
    PaymentConsumer paymentConsumer(PaymentHandler paymentHandler) {
        return new PaymentConsumer(paymentHandler);
    }

    @Bean
    @ConditionalOnBean(PaymentHandler.class)
    AuthorizePaymentHandler authorizePaymentHandler(
        PaymentHandler paymentHandler,
        Optional<OrderPaymentPort> orders
    ) {
        return orders.map(orderPort -> new AuthorizePaymentHandler(paymentHandler, orderPort))
            .orElseGet(() -> new AuthorizePaymentHandler(paymentHandler));
    }

    @Bean
    @ConditionalOnProperty(name = "spring.datasource.url")
    FindPaymentHandler findPaymentHandler(JdbcTemplate jdbcTemplate) {
        return new FindPaymentHandler(paymentId -> jdbcTemplate.query(
            FIND_PAYMENT_SQL,
            (row, index) -> new PaymentView(
                row.getString("payment_id"),
                row.getString("operation_key"),
                row.getString("order_id"),
                Payment.Method.valueOf(row.getString("method")),
                row.getBigDecimal("amount"),
                row.getString("currency"),
                Payment.Status.valueOf(row.getString("status")),
                row.getString("provider_reference"),
                row.getString("pix_code")
            ),
            paymentId
        ).stream().findFirst());
    }

    @Bean
    @ConditionalOnProperty(name = "wordpress.graphql-url")
    OrderPaymentPort wordpressOrderPayment(ObjectMapper json) {
        return new WordPressOrderPaymentAdapter(
            URI.create(requiredEnvironment("WORDPRESS_GRAPHQL_URL")),
            requiredEnvironment("WPGRAPHQL_SITE_TOKEN"),
            json
        );
    }

    private static String requiredEnvironment(String name) {
        var value = System.getenv(name);
        if (value == null || value.isBlank()) throw new IllegalStateException(name + " is required");
        return value;
    }
}
