// Trusts the VIT-Care local CA on THIS computer, so https://<lan-ip>:3443
// shows a padlock instead of "Not secure". Run once: `npm run trust`.
// Other devices install the CA from https://<lan-ip>:3443/secure instead.

import { execFileSync } from "node:child_process";
import os from "node:os";
import { CA_FILE, loadCa } from "./certs.mjs";

loadCa();

try {
  if (process.platform === "win32") {
    // Current-user root store: no admin rights needed. Windows shows one
    // confirmation dialog - answer Yes. Chrome and Edge read this store.
    execFileSync("certutil", ["-user", "-addstore", "Root", CA_FILE], { stdio: "inherit" });
  } else if (process.platform === "darwin") {
    execFileSync(
      "security",
      ["add-trusted-cert", "-r", "trustRoot", "-k", `${os.homedir()}/Library/Keychains/login.keychain-db`, CA_FILE],
      { stdio: "inherit" },
    );
  } else {
    console.log(`Linux: copy ${CA_FILE} to /usr/local/share/ca-certificates/vitcare.crt`);
    console.log("and run `sudo update-ca-certificates`, then restart the browser.");
    process.exit(0);
  }
  console.log("\nTrusted. Restart the browser (close every window) and the padlock appears.");
} catch {
  console.error(`\nCould not add the CA automatically. Double-click ${CA_FILE},`);
  console.error('choose "Install Certificate" → Current User → "Trusted Root Certification Authorities".');
  process.exit(1);
}
