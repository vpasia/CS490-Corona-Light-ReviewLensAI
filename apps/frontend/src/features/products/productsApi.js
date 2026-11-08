import { apiRequest } from '../../lib/api.js';

export async function createProduct({ productName, amazonUrl }) {
  const response = await apiRequest('/api/products', {
    method: 'POST',
    body: { productName, amazonUrl },
  });
  return response?.data ?? null;
}

export async function listProducts() {
  const response = await apiRequest('/api/products');
  return response?.data ?? [];
}

export async function getProduct(productId) {
  const response = await apiRequest(`/api/products/${encodeURIComponent(productId)}`);
  return response?.data ?? null;
}

export async function importReviews(productId) {
  const response = await apiRequest(
    `/api/products/${encodeURIComponent(productId)}/import-reviews`,
    { method: 'POST' },
  );
  return response?.data ?? null;
}
