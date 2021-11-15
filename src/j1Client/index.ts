import { URL } from 'url';
import { executeJ1QL } from './j1ql/executeJ1QL';
import { JupiterOneClient } from './types';

export function createJupiterOneClient(options: {
  apiBaseUrl: string;
  accountId: string;
  apiKey: string;
}) {
  const graphQLUrl = new URL('/graphql', options.apiBaseUrl);

  const j1Client: JupiterOneClient = {
    apiBaseUrl: options.apiBaseUrl,
    apiGraphQLUrl: graphQLUrl.toString(),
    credentials: {
      accountId: options.accountId,
      apiKey: options.apiKey,
    },
    executeJ1QL(context, options) {
      return executeJ1QL(context, j1Client, options);
    },
  };

  return j1Client;
}
