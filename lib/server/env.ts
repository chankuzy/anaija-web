export function functionsUrl(): string {
  const url = process.env.ANAIJA_FUNCTIONS_URL;
  if (!url) throw new Error("ANAIJA_FUNCTIONS_URL is not set");
  return url.replace(/\/+$/, "");
}
