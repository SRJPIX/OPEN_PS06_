export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export class ApiClientError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const getBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
  if (envUrl) {
    const trimmed = envUrl.replace(/\/+$/, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
  }
  return '/api';
};

const BASE_URL = getBaseUrl();

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${BASE_URL}${cleanEndpoint}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Only set Content-Type to application/json if body is not FormData or raw string
  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Ensure HTTP-only session cookies are always included
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');

  if (!response.ok) {
    if (isJson) {
      const errorJson: ApiErrorResponse = await response.json();
      throw new ApiClientError(
        response.status,
        errorJson.error?.code || 'API_ERROR',
        errorJson.error?.message || `Request failed with status ${response.status}`,
        errorJson.error?.details
      );
    } else {
      const text = await response.text();
      throw new ApiClientError(
        response.status,
        'HTTP_ERROR',
        text || `HTTP Error ${response.status}`
      );
    }
  }

  if (isJson) {
    const json: ApiResponse<T> = await response.json();
    if (json.meta && typeof json.data === 'object' && json.data !== null) {
      if (Array.isArray(json.data)) {
        const arr = json.data as any;
        arr.meta = json.meta;
        arr.page = json.meta.page;
        arr.limit = json.meta.limit;
        arr.total = json.meta.total;
        arr.totalPages = json.meta.totalPages;
        arr.totalUnverified = json.meta.totalUnverified;
        arr.totalVerified = json.meta.totalVerified;
      }
    }
    return json.data;
  }

  return (await response.text()) as unknown as T;
}

export const api = {
  get: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  getWithMeta: async <T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<{ data: T; meta?: Record<string, unknown>; message?: string }> => {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${BASE_URL}${cleanEndpoint}`;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(options?.headers as Record<string, string>),
    };

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      const errorJson: ApiErrorResponse = await response.json().catch(() => ({}));
      throw new ApiClientError(
        response.status,
        errorJson.error?.code || 'API_ERROR',
        errorJson.error?.message || `Request failed with status ${response.status}`,
        errorJson.error?.details
      );
    }

    const json = await response.json();
    return {
      data: json.data as T,
      meta: json.meta,
      message: json.message,
    };
  },

  post: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),

  getBlob: async (endpoint: string, options?: RequestInit): Promise<Blob> => {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${BASE_URL}${cleanEndpoint}`;
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
    });
    if (!response.ok) {
      throw new ApiClientError(
        response.status,
        'DOWNLOAD_FAILED',
        `Failed to download resource (${response.status} ${response.statusText})`
      );
    }
    return response.blob();
  },

  upload: async <T>(endpoint: string, formData: FormData, options?: RequestInit): Promise<T> => {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${BASE_URL}${cleanEndpoint}`;
    const response = await fetch(url, {
      ...options,
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    const json = await response.json();
    if (!response.ok) {
      throw new ApiClientError(
        response.status,
        json.error?.code || 'UPLOAD_FAILED',
        json.error?.message || json.message || `Upload failed with status ${response.status}`,
        json.error?.details
      );
    }
    return (json.data !== undefined ? json.data : json) as T;
  },
};

export const getApiUrl = (endpoint: string): string => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${BASE_URL}${cleanEndpoint}`;
};

