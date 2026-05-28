import { Skeleton } from '@/components/ui/skeleton';

export function PageSkeleton() {
  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto flex max-w-7xl gap-5">
        <Skeleton className="hidden h-[calc(100vh-3rem)] w-64 rounded-2xl lg:block" />
        <main className="flex-1 space-y-5">
          <Skeleton className="h-20 rounded-2xl" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-36 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-2xl" />
        </main>
      </div>
    </div>
  );
}
