const fs = require('fs');
let code = fs.readFileSync('cloudflare-worker/src/index.ts', 'utf8');

code = code.replace("import * as bip39 from 'bip39';", "// @ts-ignore\nimport * as bip39 from 'bip39';");
code = code.replace("import { derivePath } from 'ed25519-hd-key';", "// @ts-ignore\nimport { derivePath } from 'ed25519-hd-key';");

fs.writeFileSync('cloudflare-worker/src/index.ts', code);
