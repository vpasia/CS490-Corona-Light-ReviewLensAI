import app from './app.js';

const port = process.env.API_PORT || 8000;
app.listen(port, () => {
    console.info(`Server is running on port: ${port}`);
});
