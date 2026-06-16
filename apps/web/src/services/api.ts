const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type ApiErrorBody = {
  message?: string;
  issues?: {
    fieldErrors?: Record<string, string[] | undefined>;
    formErrors?: string[];
  };
};

function formatApiError(data: ApiErrorBody) {
  const fieldErrors = data.issues?.fieldErrors;
  if (fieldErrors) {
    const firstFieldError = Object.entries(fieldErrors).find(([, errors]) => errors?.length);
    if (firstFieldError) {
      const [field, errors] = firstFieldError;
      return `${field}: ${errors?.[0]}`;
    }
  }

  const formError = data.issues?.formErrors?.[0];
  return formError ?? data.message ?? 'Erro inesperado';
}

export function getToken() {
  return localStorage.getItem('token');
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem('token', token);
  else localStorage.removeItem('token');
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ message: 'Erro inesperado' })) as ApiErrorBody;
    throw new ApiError(response.status, formatApiError(data));
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
