import gql from 'graphql-tag';
import fetch from 'node-fetch';
import { DeferredResponseOption } from '~/src/codegen/j1-graphql-types';
import { LoggerContext } from '~/src/context';
import {
  defineGraphQLQuery,
  executeGraphQL,
} from '~/src/j1Client/executeGraphQL';
import { ExecuteJ1QLInput, JupiterOneClientConfig } from '~/src/j1Client/types';
import { J1QLPage, JupiterOneJ1QLCursor } from './types';

export enum DeferredQueryJobStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export type DeferredQueryJobInProgressState = {
  status: DeferredQueryJobStatus.IN_PROGRESS;
  correlationId: string;
};
export type DeferredQueryJobCompletedState = {
  status: DeferredQueryJobStatus.COMPLETED;
  correlationId: string;
  url: string;
};
export type DeferredQueryJobFailedState = {
  status: DeferredQueryJobStatus.FAILED;
  correlationId: string;
  error: string;
};

export type DeferredQueryJobState =
  | DeferredQueryJobInProgressState
  | DeferredQueryJobCompletedState
  | DeferredQueryJobFailedState;

const graphqlQueries = {
  deferredJ1QL: defineGraphQLQuery<{
    data?: {
      queryV1?: {
        type: 'deferred';
        url: string;
      };
    };
  }>(gql`
    query J1QL(
      $query: String!
      $variables: JSON
      $remember: Boolean
      $deferredResponse: DeferredResponseOption
      $includeDeleted: Boolean = true
      $cursor: String
    ) {
      queryV1(
        query: $query
        variables: $variables
        remember: $remember
        includeDeleted: $includeDeleted
        deferredResponse: $deferredResponse
        cursor: $cursor
      ) {
        type
        url
      }
    }
  `),
};

async function sleep(durationMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

enum CursorStatus {
  NOT_STARTED,
  READY,
  PENDING,
  DONE,
}

function calculateSleepDuration(attemptNum: number, delay: number) {
  return delay * Math.pow(1.05, attemptNum);
}

async function waitForQueryPageReady(
  context: LoggerContext,
  options: {
    input: ExecuteJ1QLInput;
    stateFileUrl: string;
  }
) {
  const MAX_ATTEMPTS = 25;
  const DELAY = 300;
  let attemptNum = 0;
  const startTimestamp = Date.now();
  do {
    attemptNum++;
    const response = await fetch(options.stateFileUrl);
    if (response.ok) {
      const body = (await response.json()) as DeferredQueryJobState;
      switch (body.status) {
        case DeferredQueryJobStatus.IN_PROGRESS:
          await sleep(calculateSleepDuration(attemptNum, DELAY));
          continue;
        case DeferredQueryJobStatus.FAILED:
          throw new Error(`Query failed`);
        case DeferredQueryJobStatus.COMPLETED:
          context.logger.info(
            {
              MediaQueryList: options.input.query,
              durationMs: Date.now() - startTimestamp,
            },
            'J1QL query results ready'
          );
          return {
            pageContentUrl: body.url,
          };
        default:
          throw new Error(
            `Unexpected query status (status=${(body as any).status})`
          );
      }
    } else {
      throw new Error(
        `J1QL query response not available (status=${response.status} - ${response.statusText})`
      );
    }
  } while (attemptNum < MAX_ATTEMPTS);
  throw new Error(`J1QL query did not complet after ${MAX_ATTEMPTS} attempts`);
}

async function startQueryWithCursor(
  context: LoggerContext,
  clientConfig: JupiterOneClientConfig,
  options: ExecuteJ1QLInput,
  cursor: string | undefined
) {
  const input = {
    deferredResponse: DeferredResponseOption.Force,
    query: options.query,
    variables: options.variables,
    includeDeleted: options.includeDeleted,
    cursor,
  };

  context.logger.info(input, 'Starting deferred J1QL query');

  const result = await executeGraphQL(context, clientConfig, {
    query: graphqlQueries.deferredJ1QL,
    variables: input,
  });

  const stateFileUrl = result.data?.queryV1?.url;

  if (!stateFileUrl) {
    throw new Error(
      `J1QL deferred query response did not return URL. Response: ${JSON.stringify(
        result,
        null,
        2
      )}`
    );
  }

  return { stateFileUrl };
}

export function executeJ1QL<T>(
  context: LoggerContext,
  clientConfig: JupiterOneClientConfig,
  options: ExecuteJ1QLInput
): JupiterOneJ1QLCursor<T> {
  let cursorStatus: CursorStatus = CursorStatus.NOT_STARTED;
  let lastCursor: string | undefined;

  const fetchNextPageFromLastCursor = async () => {
    cursorStatus = CursorStatus.PENDING;
    const { stateFileUrl } = await startQueryWithCursor(
      context,
      clientConfig,
      options,
      lastCursor
    );
    const { pageContentUrl } = await waitForQueryPageReady(context, {
      input: options,
      stateFileUrl,
    });
    const pageResponse = await fetch(pageContentUrl);
    if (!pageResponse.ok) {
      throw new Error(
        `J1QL page not available (status=${pageResponse.status} - ${pageResponse.statusText})`
      );
    }

    const content = (await pageResponse.json()) as J1QLPage<T>;
    cursorStatus = CursorStatus.READY;
    lastCursor = content.cursor;
    return content;
  };

  return {
    hasNextPage() {
      return cursorStatus !== CursorStatus.DONE;
    },

    async nextPage() {
      switch (cursorStatus) {
        case CursorStatus.READY:
          if (lastCursor === undefined) {
            cursorStatus = CursorStatus.DONE;
            return null;
          } else {
            break;
          }
        case CursorStatus.NOT_STARTED:
          break;
        case CursorStatus.DONE:
          throw new Error('J1QL cursor is empty');
        case CursorStatus.PENDING:
          throw new Error('Currently fetching a page');
      }
      return fetchNextPageFromLastCursor();
    },
  };
}
