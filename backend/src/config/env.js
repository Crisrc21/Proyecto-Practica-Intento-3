export function loadEnv() {
  return {
    port: Number(process.env.PORT ?? 4000),
    nodeEnv: process.env.NODE_ENV ?? "development",
    allowedOrigin: process.env.CORS_ORIGIN ?? "http://127.0.0.1:3000",
    dataPrivatePath: process.env.DATA_PRIVATE_PATH ?? "data/private",
    bemmboTokenPho: process.env.BEMMBO_TOKEN_PHO ?? "",
    bemmboTimeoutMs: Number(process.env.BEMMBO_TIMEOUT_MS ?? 15000)
  };
}
