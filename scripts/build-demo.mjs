// Gera o app de demonstração e deixa a saída também em ./dist (raiz).
// Assim a Vercel encontra a pasta de saída com qualquer configuração de projeto
// (raiz do repositório ou apps/demo, preset Vite ou "Other").
import { execSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";

execSync("pnpm --filter @galato/demo build", { stdio: "inherit" });
if (!existsSync("apps/demo/dist/index.html")) throw new Error("Build não gerou apps/demo/dist/index.html");
rmSync("dist", { recursive: true, force: true });
cpSync("apps/demo/dist", "dist", { recursive: true });
console.log("Saída pronta em ./dist e ./apps/demo/dist");
