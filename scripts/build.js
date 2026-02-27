import { chmodSync, copyFileSync, mkdirSync, readdirSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcScripts = join(root, "src", "scripts");
const destScripts = join(root, "build", "scripts");

// Make the build/index.js file executable
chmodSync(join(root, "build", "index.js"), "755");

// Copy all .gd files from src/scripts/ to build/scripts/
try {
  mkdirSync(destScripts, { recursive: true });

  const gdFiles = readdirSync(srcScripts).filter((f) => f.endsWith(".gd"));

  for (const file of gdFiles) {
    copyFileSync(join(srcScripts, file), join(destScripts, file));
    console.log(`Successfully copied ${file} to build/scripts`);
  }
} catch (error) {
  console.error("Error copying scripts:", error);
  process.exit(1);
}

console.log("Build scripts completed successfully!");
