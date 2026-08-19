const crypto = require("crypto");

const secretBytes = crypto.randomBytes(20);
const base32Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
let bits = "";
for (const byte of secretBytes) {
  bits += byte.toString(2).padStart(8, "0");
}
let totpSecret = "";
for (let i = 0; i < bits.length; i += 5) {
  const chunk = bits.slice(i, i + 5).padEnd(5, "0");
  totpSecret += base32Chars[parseInt(chunk, 2)];
}

const sessionSecret = crypto.randomBytes(32).toString("hex");

const issuer = "IsraelHayomMonitor";
const account = "editor";
const uri = `otpauth://totp/${issuer}:${account}?secret=${totpSecret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;

console.log("");
console.log("=== setup editor authentication ===");
console.log("");
console.log("Add these lines to your .env file:");
console.log("");
console.log(`EDITOR_PASSWORD=CHANGE_ME`);
console.log(`EDITOR_TOTP_SECRET=${totpSecret}`);
console.log(`EDITOR_SESSION_SECRET=${sessionSecret}`);
console.log("");
console.log("Scan this URI in your authenticator app (Google Authenticator / Authy):");
console.log("");
console.log(`  ${uri}`);
console.log("");
console.log(`Or enter the secret manually: ${totpSecret}`);
console.log("");
console.log("Set a strong password in place of CHANGE_ME, then restart the dev server.");
console.log("");
