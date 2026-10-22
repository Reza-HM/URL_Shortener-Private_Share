import type {
  ApiErrorBody,
  CreatedShare,
  DropInput,
} from "../shared/contracts";
export async function responseData<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      (data as ApiErrorBody).error?.message ||
        "The request failed. Please try again.",
    );
  return data as T;
}
export async function postJson<T>(path: string, data: unknown) {
  return responseData<T>(
    await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  );
}
export function uploadDrop(
  options: DropInput,
  payload: Uint8Array<ArrayBuffer>,
  onProgress: (progress: number) => void,
): Promise<CreatedShare> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.set("options", JSON.stringify(options));
    form.set(
      "payload",
      new Blob([payload], { type: "application/octet-stream" }),
      "encrypted.bin",
    );
    const request = new XMLHttpRequest();
    request.open("POST", "/api/v1/drops");
    request.responseType = "json";
    request.timeout = 120_000;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () =>
      reject(
        new Error(
          "The upload was interrupted. Check your connection and try again.",
        ),
      );
    request.ontimeout = () =>
      reject(new Error("The upload timed out. Please try again."));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300)
        resolve(request.response as CreatedShare);
      else
        reject(
          new Error(
            request.response?.error?.message ||
              "The upload failed. Please try again.",
          ),
        );
    };
    request.send(form);
  });
}
export function safeFilename(value?: string) {
  return (
    (value || "download")
      .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, "_")
      .replace(/^\.+/, "_")
      .slice(0, 180) || "download"
  );
}
export function download(
  bytes: Uint8Array<ArrayBuffer>,
  filename: string,
  mime = "application/octet-stream",
) {
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeFilename(filename);
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
