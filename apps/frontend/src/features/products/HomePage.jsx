import { Button } from '@/components/ui/button';

import { useAuth } from '../auth/useAuth.js';
import AddProductForm from './AddProductForm.jsx';
import ProductList from './ProductList.jsx';
import { useProducts } from './useProducts.js';

export default function HomePage() {
  const { user, logout } = useAuth();
  const { status, products, error, refresh, retry } = useProducts();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-12">
      <h1 className="text-2xl font-semibold text-[#1F1F1F]">
        What product do you want to analyze?
      </h1>

      <AddProductForm onProductAdded={refresh} />

      <section aria-labelledby="products-heading" className="flex flex-col gap-4">
        <h2 id="products-heading" className="text-lg font-semibold text-[#1F1F1F]">
          Your products
        </h2>
        <ProductList status={status} products={products} error={error} onRetry={retry} />
      </section>

      <div className="flex items-center gap-4 text-sm text-[#6B6B6B]">
        <span>Signed in as {user.email}</span>
        <Button variant="outline" className="h-10 px-4" onClick={() => logout()}>
          Sign out
        </Button>
      </div>
    </main>
  );
}
