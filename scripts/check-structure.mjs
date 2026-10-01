import { existsSync } from "node:fs";

const requiredPaths = [
  "frontend/src/app",
  "frontend/src/modules/accounts-receivable/components",
  "frontend/src/modules/accounts-receivable/data",
  "frontend/src/modules/accounts-receivable/types",
  "frontend/src/shared/components",
  "frontend/src/shared/charts",
  "backend/src/app",
  "backend/src/config",
  "backend/src/shared",
  "backend/src/modules/accounts-receivable/presentation",
  "backend/src/modules/accounts-receivable/application",
  "backend/src/modules/accounts-receivable/domain",
  "backend/src/modules/accounts-receivable/infrastructure",
  "data",
  "docs",
  "scripts",
  "README.md",
  ".env.example",
  ".gitignore"
];

const missing = requiredPaths.filter((path) => !existsSync(path));

if (missing.length > 0) {
  console.error("Missing required project paths:");
  for (const path of missing) {
    console.error(`- ${path}`);
  }
  process.exit(1);
}

console.log("Project structure looks aligned.");
