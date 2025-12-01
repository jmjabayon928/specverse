// src/utils/fetchWithAuth.ts
export const fetchWithAuth = async <T>(
  url: string,
  options: RequestInit = {}
): Promise<T> => {
  const token = localStorage.getItem("token");

  // Normalize HeadersInit → plain object
  const toHeaderObject = (h: HeadersInit | undefined): Record<string, string> => {
    if (!h) return {};
    if (h instanceof Headers) return Object.fromEntries(h.entries());
    if (Array.isArray(h)) return Object.fromEntries(h);
    // Here h is a Record<string, string>
    return h;
  };

  const extraHeaders = toHeaderObject(options.headers);

  const res = await fetch(url, {
    // It’s fine to spread options first; our `headers` below will override
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extraHeaders,
    },
  });

  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON: ${text}`);
  }
};
