import { copyFile, mkdir, readFile, rename, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const seedPath = path.join(projectDirectory, "data", "seed.json");
const localDirectory = path.join(projectDirectory, ".local");
const targetPath = path.join(localDirectory, "rpg-vitin.json");
const uploadsPath = path.resolve(localDirectory, "uploads");

if (
  !targetPath.startsWith(`${projectDirectory}${path.sep}`) ||
  !uploadsPath.startsWith(`${localDirectory}${path.sep}`)
) {
  throw new Error(`Destino local inesperado: ${targetPath}`);
}

await mkdir(localDirectory, { recursive: true });
const seedContents = await readFile(seedPath, "utf8");
JSON.parse(seedContents);
const temporaryPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
await writeFile(temporaryPath, seedContents, "utf8");

try {
  await rename(temporaryPath, targetPath);
} catch (error) {
  if (error.code !== "EPERM" && error.code !== "EEXIST") {
    throw error;
  }
  await copyFile(temporaryPath, targetPath);
  await unlink(temporaryPath);
}

await rm(uploadsPath, { recursive: true, force: true });

console.log(`Dados e uploads locais restaurados a partir do seed: ${targetPath}`);
