import { type APIRequestContext } from '@playwright/test';
import superjson, { type SuperJSONResult } from 'superjson';

type TrpcBatchItem = {
  result?: { data: SuperJSONResult };
  error?: SuperJSONResult;
};

type TrpcErrorShape = { message: string; data: { code: string; httpStatus: number } };

export type TrpcCallResult = {
  status: number;
  /** Deserialized procedure output, when the call succeeded. */
  data?: unknown;
  /** tRPC error code (e.g. `UNAUTHORIZED`), when the call failed. */
  errorCode?: string;
};

async function parseBatch(
  response: Awaited<ReturnType<APIRequestContext['get']>>,
): Promise<TrpcCallResult> {
  const [item] = (await response.json()) as TrpcBatchItem[];
  if (!item) throw new Error(`Empty tRPC batch response (HTTP ${response.status()})`);
  if (item.error) {
    const shape = superjson.deserialize<TrpcErrorShape>(item.error);
    return { status: response.status(), errorCode: shape.data.code };
  }
  return {
    status: response.status(),
    data: item.result ? superjson.deserialize(item.result.data) : undefined,
  };
}

/**
 * Calls a tRPC mutation over HTTP exactly like the app's client does: a
 * one-item batch (`?batch=1`) with a SuperJSON-serialized input. Bypasses the
 * UI, so it exercises the server-side auth checks directly. Auth comes from
 * the cookies of `request` (use `page.request` to reuse the test's
 * storageState).
 */
export async function trpcMutation(
  request: APIRequestContext,
  path: string,
  input: unknown,
): Promise<TrpcCallResult> {
  const response = await request.post(`/api/trpc/${path}?batch=1`, {
    data: { 0: superjson.serialize(input) },
  });
  return parseBatch(response);
}

/** Calls a tRPC query over HTTP (GET, one-item batch, SuperJSON input). */
export async function trpcQuery(
  request: APIRequestContext,
  path: string,
  input?: unknown,
): Promise<TrpcCallResult> {
  const batchInput = JSON.stringify({ 0: superjson.serialize(input) });
  const response = await request.get(
    `/api/trpc/${path}?batch=1&input=${encodeURIComponent(batchInput)}`,
  );
  return parseBatch(response);
}
