import type { ReactElement, ReactNode } from "react";
import {
  render,
  type RenderOptions,
  type RenderResult,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

export interface RenderWithProvidersOptions extends Omit<
  RenderOptions,
  "wrapper"
> {
  /** Initial URL for the in-memory router. Defaults to "/". */
  route?: string;
  /** Supply a client to inspect or pre-populate the cache; a fresh one is created otherwise. */
  queryClient?: QueryClient;
}

export interface RenderWithProvidersResult extends RenderResult {
  queryClient: QueryClient;
}

/** A QueryClient tuned for tests: no retries so failures surface immediately, no GC timers. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

/**
 * Render a component inside the same providers App.tsx mounts (React Query and
 * the wouter router), but with an in-memory location so tests never touch
 * window.history. Page components under `src/pages` can be rendered directly.
 */
export function renderWithProviders(
  ui: ReactElement,
  {
    route = "/",
    queryClient = createTestQueryClient(),
    ...options
  }: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
  const { hook } = memoryLocation({ path: route, static: true });

  function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <Router hook={hook}>{children}</Router>
      </QueryClientProvider>
    );
  }

  return { ...render(ui, { wrapper: Providers, ...options }), queryClient };
}
