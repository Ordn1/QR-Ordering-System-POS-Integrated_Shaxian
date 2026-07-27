const BASE = '/api/v1';

let deviceToken = null;

export function setDeviceToken(token) {
  deviceToken = token;
}

export class ApiError extends Error {
  constructor(status, message, fieldErrors) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors ?? null;
  }
}

async function request(method, path, body) {
  let response;

  const headers = {};
  if (body) {
    headers['Content-Type'] = 'application/json';
  }
  if (deviceToken) {
    headers['X-Device-Token'] = deviceToken;
  }

  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'The server is not reachable. Check that it is running.');
  }

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.message ?? 'Something interrupted this action.',
      payload?.field_errors,
    );
  }

  return payload;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path) => request('DELETE', path),
};
