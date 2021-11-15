import { DocumentNode } from 'graphql';
import { print as graphqlAstToString } from 'graphql/language/printer';
import fetch from 'node-fetch';
import { LoggerContext } from '~/src/context';
import { JupiterOneClientConfig } from './types';

type GraphQLQuery<O> = {
  document: DocumentNode;
};

export function defineGraphQLQuery<O>(document: DocumentNode): GraphQLQuery<O> {
  return {
    document,
  };
}

export async function executeGraphQL<O>(
  context: LoggerContext,
  clientConfig: JupiterOneClientConfig,
  options: {
    query: GraphQLQuery<O>;
    variables: Record<string, any>;
  }
) {
  const query = graphqlAstToString(options.query.document);
  const response = await fetch(clientConfig.apiGraphQLUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'JupiterOne-Account': clientConfig.credentials.accountId,
      Authorization: `Bearer ${clientConfig.credentials.apiKey}`,
    },
    body: JSON.stringify({
      query,
      variables: options.variables,
    }),
  });

  const json = await response.json();
  return json as O;
}
