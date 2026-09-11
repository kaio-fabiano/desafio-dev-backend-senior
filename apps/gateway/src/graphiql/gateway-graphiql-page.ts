export default `<!DOCTYPE html>
<html lang="en">
  <head>
    <title>GraphiQL</title>
    <style>
      body {
        height: 100%;
        margin: 0;
        width: 100%;
        overflow: hidden;
      }

      #graphiql {
        height: 100vh;
      }
    </style>
    <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <link rel="stylesheet" href="https://unpkg.com/graphiql@3.8.3/graphiql.min.css" />
  </head>
  <body>
    <div id="graphiql">Loading...</div>
    <script src="https://unpkg.com/graphiql@3.8.3/graphiql.min.js"></script>
    <script src="https://unpkg.com/graphql-sse@2.6.1/umd/graphql-sse.min.js"></script>
    <script>
      const sessionHeaders = new Headers();
      const mergeHeaders = (headers) => {
        const merged = new Headers(sessionHeaders);
        new Headers(headers).forEach((value, name) => merged.set(name, value));
        return Object.fromEntries(merged);
      };
      const sessionFetch = async (url, init) => {
        const response = await fetch(url, {
          ...init,
          method: 'POST',
          headers: mergeHeaders(init?.headers),
        });
        ['woocommerce-session', 'cart-token'].forEach((name) => {
          const value = response.headers.get(name);
          if (!value) return;
          sessionHeaders.set(
            name,
            name === 'woocommerce-session' && !/^Session\\s/i.test(value)
              ? 'Session ' + value
              : value,
          );
        });
        return response;
      };
      const httpFetcher = GraphiQL.createFetcher({
        url: '/graphql',
        fetch: sessionFetch,
      });
      const fetcher = (request, options) => {
        const isSubscription = options?.documentAST?.definitions.some(
          ({ kind, name, operation }) =>
            kind === 'OperationDefinition' &&
            operation === 'subscription' &&
            name?.value === request.operationName,
        );
        if (!isSubscription) return httpFetcher(request, options);

        const client = graphqlSse.createClient({
          url: '/graphql/stream',
          headers: mergeHeaders(options?.headers),
        });
        return {
          subscribe(observer) {
            const disposeSubscription = client.subscribe(request, {
              next: (result) => observer.next(result),
              error: (error) => {
                client.dispose();
                observer.error(error);
              },
              complete: () => {
                client.dispose();
                observer.complete();
              },
            });
            return {
              unsubscribe() {
                disposeSubscription();
                client.dispose();
              },
            };
          },
        };
      };

      ReactDOM.render(
        React.createElement(GraphiQL, {
          fetcher,
          defaultEditorToolsVisibility: true,
          shouldPersistHeaders: true,
          isHeadersEditorEnabled: true,
        }),
        document.getElementById('graphiql'),
      );
    </script>
  </body>
</html>
`;
