import { apiRequest } from '../../lib/api.js';

export async function createProduct({ productName, amazonUrl }) {
  const response = await apiRequest('/api/products', {
    method: 'POST',
    body: { productName, amazonUrl },
  });
  return response?.data ?? null;
}
