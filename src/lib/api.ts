// Same-origin request helper for the Sites app Function.
export class ApiError extends Error {
  constructor(message: string, readonly code: string, readonly status: number = 0) {
    super(message);
    this.name = 'ApiError';
  }
}

const FUNCTION_BASE = '/functions/v1/app';

export async function requestJson(
  url: string,
  init: RequestInit = {},
  messages: Readonly<Record<string, string>> = {},
): Promise<unknown> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  let response: Response;
  try {
    response = await fetch(url, { ...init, headers, credentials: 'same-origin' });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new ApiError('The request could not be completed.', 'network_error');
  }
  if (response.status === 401 || response.status === 403) {
    throw new ApiError('Check your site access and sign in again.', 'access_denied', response.status);
  }
  if (response.redirected || !response.headers.get('content-type')?.includes('application/json')) {
    throw new ApiError('The site service returned an unexpected response.', 'invalid_response', response.status);
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ApiError('The site service returned invalid JSON.', 'invalid_response', response.status);
  }
  const body = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  const code = typeof body?.error === 'string' ? body.error
    : (!response.ok || body?.ok === false) && typeof body?.code === 'string' ? body.code
    : response.ok ? null : 'request_failed';
  if (!response.ok || body?.ok === false || code) {
    const resolved = code ?? 'request_failed';
    const mapped: unknown = Object.prototype.hasOwnProperty.call(messages, resolved)
      ? messages[resolved]
      : undefined;
    const message = typeof mapped === 'string'
      ? mapped
      : 'The request failed. Check the current state before retrying.';
    throw new ApiError(message, resolved, response.status);
  }
  return data;
}

export interface LiveStatus {
  ok: true;
  room: string;
  reading: { tempC: number; gasPpm: number; door: 'open' | 'closed'; status: 'normal' | 'abnormal' | 'danger'; at: string } | null;
}

export interface LiveLogs {
  ok: true;
  items: { id: string; level: string; message: string; at: string }[];
  hasMore: boolean;
  nextOffset: number | null;
}

export async function fetchLiveStatus(signal?: AbortSignal): Promise<LiveStatus> {
  const result = await requestJson(`${FUNCTION_BASE}?action=status`, { signal }) as Record<string, unknown>;
  if (result?.ok !== true || typeof result.room !== 'string') {
    throw new ApiError('The site service returned an invalid result.', 'invalid_response');
  }
  return result as unknown as LiveStatus;
}

export async function fetchLiveLogs(offset = 0, signal?: AbortSignal): Promise<LiveLogs> {
  const result = await requestJson(`${FUNCTION_BASE}?action=logs&offset=${offset}`, { signal }) as Record<string, unknown>;
  if (result?.ok !== true || !Array.isArray(result.items)) {
    throw new ApiError('The site service returned an invalid result.', 'invalid_response');
  }
  return result as unknown as LiveLogs;
}

export async function postCameraEvent(imageBytes: number, note: string): Promise<{ ok: true; telegram: string }> {
  const result = await requestJson(`${FUNCTION_BASE}?action=camera-event`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ imageBytes, note }),
  }) as Record<string, unknown>;
  if (result?.ok !== true) throw new ApiError('The site service returned an invalid result.', 'invalid_response');
  return result as unknown as { ok: true; telegram: string };
}
