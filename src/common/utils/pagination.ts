import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().trim().optional()
});

export type PaginationQuery = z.infer<typeof paginationSchema>;

export function toPrismaPagination(query: PaginationQuery) {
  return {
    skip: (query.page - 1) * query.limit,
    take: query.limit
  };
}

export function buildPaginatedResult<T>(items: T[], total: number, query: PaginationQuery) {
  return {
    items,
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit)
    }
  };
}
