import { useNavigate } from 'react-router';

import { useProducts } from './useProducts.js';

// Lets the user move between their own products from inside the workspace. The workspace page is
// keyed by product ID, so choosing another product reloads that product's reviews, import status
// and questions from scratch and nothing from the previous product stays on screen.
export default function TargetSwitcher({ currentProductId }) {
  const navigate = useNavigate();
  const { status, products } = useProducts();

  const options = Array.isArray(products) ? products : [];
  const hasCurrent = options.some((product) => product.productId === currentProductId);

  // Nothing to switch to, or we cannot say which product is active: show nothing instead of
  // risking a selector that points at the wrong product.
  if (status !== 'ready' || options.length < 2 || !hasCurrent) {
    return null;
  }

  function handleChange(event) {
    navigate(`/products/${encodeURIComponent(event.target.value)}/overview`);
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="target-switcher" className="text-sm font-medium text-[#1F1F1F]">
        Active product
      </label>
      <select
        id="target-switcher"
        value={currentProductId}
        onChange={handleChange}
        className="h-10 w-full rounded-lg border border-[#E5E5E5] bg-white px-3 text-sm text-[#1F1F1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]"
      >
        {options.map((product) => (
          <option key={product.productId} value={product.productId}>
            {product.productName}
          </option>
        ))}
      </select>
      <p className="text-xs text-[#6B6B6B]">
        Switching loads that product’s reviews, import status, and questions.
      </p>
    </div>
  );
}
