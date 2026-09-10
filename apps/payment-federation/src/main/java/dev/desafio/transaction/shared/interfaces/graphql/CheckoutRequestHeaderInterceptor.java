package dev.desafio.transaction.shared.interfaces.graphql;

import org.springframework.graphql.server.WebGraphQlInterceptor;
import org.springframework.graphql.server.WebGraphQlRequest;
import org.springframework.graphql.server.WebGraphQlResponse;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.util.Optional;

@Component
public final class CheckoutRequestHeaderInterceptor implements WebGraphQlInterceptor {
    @Override
    public Mono<WebGraphQlResponse> intercept(WebGraphQlRequest request, Chain chain) {
        request.configureExecutionInput((input, builder) -> builder.graphQLContext(context -> {
            context.put("cartToken", header(request, "cart-token"));
            context.put("wooSession", header(request, "woocommerce-session"));
            context.put("cookie", header(request, "cookie"));
        }).build());
        return chain.next(request);
    }

    private static String header(WebGraphQlRequest request, String name) {
        return Optional.ofNullable(request.getHeaders().getFirst(name)).orElse("");
    }
}
