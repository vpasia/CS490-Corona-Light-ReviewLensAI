import express from 'express';
import { createErrorPayload } from './utils/utils.js';
import { verifyUserToken } from './middleware/verifyUser.js';
import { errorHandler } from './middleware/errorHandler.js';
import productRoutes from './routes/productRoutes.js';
import cors from 'cors';

const app = express();

app.use(express.json());
app.use(cors());
app.use(verifyUserToken);
app.use('/api/products', productRoutes);

app.use((_req, res) => {
    res.status(404).json(createErrorPayload('NOT_FOUND', 'Endpoint not found.'));
});

app.use(errorHandler);

export default app;
