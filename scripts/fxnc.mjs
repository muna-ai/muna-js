/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import chalk from "chalk"
import { promises as fsPromises } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
const { writeFile, mkdir } = fsPromises;

const FXNC_VERSION = "0.0.41";
const FXNODE_VERSION = "0.0.5";

function getLibName() {
  switch (process.platform) {
    case "linux": return "libFunction";
    default:      return "Function";
  }
}

function getLibSuffix() {
  switch (process.platform) {
    case "darwin":  return ".dylib";
    case "linux":   return ".so";
    case "win32":   return ".dll";
    default:        return "";
  }
}

function getPlatformId() {
  switch (process.platform) {
    case "darwin":  return "macos";
    case "linux":   return "linux";
    case "win32":   return "win";
    default:        return "unknown";
  }
}

function getArchId() {
  switch (process.arch) {
    case "arm64":   return "arm64";
    case "x64":     return "x86_64";
    default:        return "unknown";
  }
}

const fxnodeUrl = `https://cdn.fxn.ai/fxnode/${FXNODE_VERSION}/Function-${getPlatformId()}-${getArchId()}.node`;
const fxncUrl = `https://cdn.fxn.ai/fxnc/${FXNC_VERSION}/${getLibName()}-${getPlatformId()}-${getArchId()}${getLibSuffix()}`;
const __dirname = dirname(fileURLToPath(import.meta.url));
const libDir = join(__dirname, "..", "lib");
const fxncPath = join(libDir, `${getLibName()}${getLibSuffix()}`);
const fxnodePath = join(libDir, "Function.node");

try {
  const fxncResponse = await fetch(fxncUrl);
  const fxnodeResponse = await fetch(fxnodeUrl);
  await mkdir(libDir, { recursive: true });
  await writeFile(fxncPath, Buffer.from(await fxncResponse.arrayBuffer()));
  await writeFile(fxnodePath, Buffer.from(await fxnodeResponse.arrayBuffer()));
} catch (e) {
  console.error(chalk.redBright(`Muna Error: Failed to download library with error: ${e.message}. Predictions will fail.`));
}