import { Navigate, RouterProvider, createBrowserRouter } from 'react-router';

import ProductWorkspacePage from '../features/products/ProductWorkspacePage.jsx';
import ForgotPasswordPage from '../features/auth/ForgotPasswordPage.jsx';
import LoginPage from '../features/auth/LoginPage.jsx';
import RegisterPage from '../features/auth/RegisterPage.jsx';
import HomePage from '../features/products/HomePage.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/products/:productId/overview', element: <ProductWorkspacePage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
