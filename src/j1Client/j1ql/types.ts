export type ExecuteResultType = 'list' | 'table' | 'tree';

export type J1QLPage<T> = {
  type: ExecuteResultType;
  data: T;
  totalCount?: number;
  cursor?: string;
};

export type JupiterOneJ1QLCursor<T> = {
  nextPage: () => Promise<J1QLPage<T> | null>;
  hasNextPage: () => boolean;
};
