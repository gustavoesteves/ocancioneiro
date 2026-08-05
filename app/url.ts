const baseUrl = import.meta.env.BASE_URL || "/";

export function publicUrl(path: string) {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}
