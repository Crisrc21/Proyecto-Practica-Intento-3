import { createApp } from "./app/create-app.js";
import { loadEnv } from "./config/env.js";

const env = loadEnv();
const app = createApp(env);

app.listen(env.port, () => {
  console.log(`CxC PHO backend listening on http://127.0.0.1:${env.port}`);
});
