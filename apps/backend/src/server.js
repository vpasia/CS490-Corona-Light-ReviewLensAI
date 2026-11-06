import dotenv from 'dotenv';

dotenv.config();

import app from './app.js';

app.listen(process.env.API_PORT, () => {
    console.log(`Server is running on port: ${port}`);
});