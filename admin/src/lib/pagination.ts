// Shared shape for the API's paginated directory endpoints.
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// Params the paginated admin lists accept.
export interface DirectoryParams {
  page: number;
  limit: number;
  search?: string;
  filter?: string;
}

export const DEFAULT_PAGE_SIZE = 10;

// Build the query string for a directory request (omits empty values).
export function directoryQuery(params: DirectoryParams): Record<string, string> {
  const q: Record<string, string> = {
    page: String(params.page),
    limit: String(params.limit),
  };
  if (params.search?.trim()) q.search = params.search.trim();
  if (params.filter?.trim()) q.filter = params.filter.trim();
  return q;
}
