import { spawn } from "node:child_process";
// Evita MissingResourceException del emulador con locale es_PE en algunos JDK.
const env = { ...process.env, JAVA_TOOL_OPTIONS: `${process.env.JAVA_TOOL_OPTIONS ?? ""} -Duser.language=en -Duser.country=US`.trim() };
const args = ["emulators:exec", "--project", "demo-pizza-inventario", "--only", "firestore", "node --test tests/firestore.test.mjs"];
const windows = process.platform === "win32";
const child = windows
  ? spawn("cmd.exe", ["/d", "/s", "/c", 'firebase emulators:exec --project demo-pizza-inventario --only firestore "node --test tests/firestore.test.mjs"'], { env, stdio: "inherit" })
  : spawn("firebase", args, { env, stdio: "inherit" });
child.on("error", (e) => { console.error(e.message); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
