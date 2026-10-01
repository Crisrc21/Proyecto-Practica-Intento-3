import { HttpError } from "../../../shared/errors/http-error.js";
const cache = new Map();
export async function historicalUf(year, fetcher = fetch) {
  if (!/^\d{4}$/.test(String(year)) || Number(year) < 1977 || Number(year) > new Date().getUTCFullYear() + 1) throw new HttpError(400, "Año de UF inválido.");
  const saved = cache.get(String(year));
  if (saved && saved.expires > Date.now()) return saved.rates;
  const response = await fetcher(`https://mindicador.cl/api/uf/${year}`, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new HttpError(502, "No se pudo consultar la UF histórica.");
  const body = await response.json();
  if (body.codigo !== "uf" || !Array.isArray(body.serie)) throw new HttpError(502, "Respuesta de UF histórica inválida.");
  const rates = {};
  for (const item of body.serie) {
    const date = typeof item.fecha === "string" ? item.fecha.slice(0, 10) : "";
    if (date.startsWith(`${year}-`) && Number.isFinite(item.valor) && item.valor > 0) rates[date] = item.valor;
  }
  if (!Object.keys(rates).length) throw new HttpError(502, "No hay valores UF disponibles para ese año.");
  cache.set(String(year), { rates, expires: Date.now() + 3600000 });
  return rates;
}
