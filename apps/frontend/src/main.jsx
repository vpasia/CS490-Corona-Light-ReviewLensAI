import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './index.css';
import AuthProvider from './app/AuthProvider.jsx';
import AppRouter from './app/AppRouter.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  </StrictMode>,
);
