import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const localEnvPath = fileURLToPath(new URL('../../.env', import.meta.url));

if (existsSync(localEnvPath)) {
    process.loadEnvFile(localEnvPath);
}

import app from './app.js';


app.listen(process.env.API_PORT, () => {
    console.log(`Server is running on port: ${port}`);
});