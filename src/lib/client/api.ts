const pagesMode = process.env.NEXT_PUBLIC_GITHUB_PAGES === "true";
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
const tokenKey = "baraka-session-token";

export function saveApiSessionToken(token: string | null) {
  try {
    if (token) localStorage.setItem(tokenKey, token);
    else localStorage.removeItem(tokenKey);
  } catch {
    // Browser storage can be disabled; protected API calls then fail closed.
  }
}

function currentApiToken() {
  try {
    return localStorage.getItem(tokenKey) || "";
  } catch {
    return "";
  }
}

export function apiUrl(path: string) {
  if (!pagesMode || !path.startsWith("/api/")) return path;
  if (!apiBaseUrl) return path;
  return `${apiBaseUrl}${path}`;
}

async function prepareUpload(init?: RequestInit) {
  if (!pagesMode || !(init?.body instanceof FormData)) return init;
  const source = init.body.get("image");
  if (!(source instanceof File) || source.size === 0) return init;
  if (source.size > 100 * 1024 * 1024) {
    return { ...init, body: null, headers: { "x-baraka-upload-error": "IMAGE_TOO_LARGE" } };
  }
  try {
    const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
    if (bitmap.width * bitmap.height > 100_000_000) {
      bitmap.close();
      return { ...init, body: null, headers: { "x-baraka-upload-error": "IMAGE_TOO_LARGE" } };
    }
    const convert = async (maxEdge: number, quality: number) => {
      const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("IMAGE_PROCESSING_FAILED");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("IMAGE_PROCESSING_FAILED")), "image/webp", quality),
      );
    };
    let blob = await convert(2200, 0.82);
    if (blob.size > 3 * 1024 * 1024) blob = await convert(1600, 0.7);
    bitmap.close();
    if (blob.size > 3 * 1024 * 1024) throw new Error("IMAGE_TOO_LARGE");
    const form = new FormData();
    init.body.forEach((value, key) => {
      if (key === "image") form.set("image", new File([blob], `${source.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" }));
      else form.append(key, value);
    });
    return { ...init, body: form };
  } catch (error) {
    const code = error instanceof Error && error.message === "IMAGE_TOO_LARGE" ? "IMAGE_TOO_LARGE" : "INVALID_IMAGE";
    return { ...init, body: null, headers: { "x-baraka-upload-error": code } };
  }
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const path = typeof input === "string" ? input : input.toString();
  if (!pagesMode || !path.startsWith("/api/")) return fetch(input, init);
  if (!apiBaseUrl)
    return Promise.resolve(
      new Response(JSON.stringify({ error: "UNAVAILABLE" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    );
  const headers = new Headers(init?.headers);
  if (headers.has("x-baraka-upload-error")) {
    return new Response(JSON.stringify({ error: headers.get("x-baraka-upload-error") }), {
      status: headers.get("x-baraka-upload-error") === "IMAGE_TOO_LARGE" ? 413 : 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const prepared = await prepareUpload(init);
  const preparedHeaders = new Headers(prepared?.headers);
  if (preparedHeaders.has("x-baraka-upload-error")) {
    const code = preparedHeaders.get("x-baraka-upload-error") || "INVALID_IMAGE";
    return new Response(JSON.stringify({ error: code }), {
      status: code === "IMAGE_TOO_LARGE" ? 413 : 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const token = currentApiToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(apiUrl(path), { ...prepared, headers, credentials: "omit" });
}

export async function downloadApiFile(path: string, filename: string) {
  const response = await apiFetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error("Download unavailable");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
