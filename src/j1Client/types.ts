import { LoggerContext } from '~/src/context';
import { JupiterOneJ1QLCursor } from './j1ql/types';

export type JupiterOneClientConfig = {
  apiBaseUrl: string;
  apiGraphQLUrl: string;
  credentials: JupiterOneCredentials;
};

export type ExecuteJ1QLInput = {
  query: string;
  variables: Record<string, any>;
  includeDeleted: boolean;
};

export type JupiterOneClient = Readonly<JupiterOneClientConfig> & {
  executeJ1QL<T>(
    context: LoggerContext,
    options: ExecuteJ1QLInput
  ): JupiterOneJ1QLCursor<T>;
};

export type JupiterOneCredentials = {
  readonly apiKey: string;
  readonly accountId: string;
};
