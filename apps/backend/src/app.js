import express from 'express';
import { createErrorPayload } from './utils/utils.js';
import { verifyUserToken } from './middleware/verifyUser.js';

const app = express();

app.use(express.json());
app.use(verifyUserToken);

app.use((req, res) => {
    res.status(404).json(createErrorPayload("NOT_FOUND", "Endpoint Not Found."));
})

export default app;