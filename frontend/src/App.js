import React, { useState, useEffect } from 'react';
import './index.css';
import ProductList from './components/ProductList';
import ProductDetail from './components/ProductDetail';

const PRODUCT_SERVICE_URL = process.env.REACT_APP_PRODUCT_SERVICE_URL || 'http://localhost:5000';
const RATINGS_SERVICE_URL = process.env.REACT_APP_RATINGS_SERVICE_URL || 'http://localhost:5001';

function App() {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProducts();
    
    // Refresh products every 5 seconds to get updated ratings
    const interval = setInterval(fetchProducts, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${PRODUCT_SERVICE_URL}/api/products`);
      const data = await response.json();
      
      if (data.success) {
        setProducts(data.data);
        setError(null);
      } else {
        setError(data.message || 'Failed to fetch products');
      }
    } catch (err) {
      setError('Error connecting to product service');
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleProductClick = (product) => {
    setSelectedProduct(product);
  };

  const handleBackToList = () => {
    setSelectedProduct(null);
    fetchProducts(); // Refresh to get updated ratings
  };

  if (loading && products.length === 0) {
    return (
      <div className="container">
        <div className="header">
          <h1>Product Catalog</h1>
        </div>
        <div className="loading">Loading products...</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <h1>Product Catalog</h1>
      </div>

      {error && <div className="error">{error}</div>}

      {selectedProduct ? (
        <ProductDetail
          product={selectedProduct}
          onBack={handleBackToList}
          productServiceUrl={PRODUCT_SERVICE_URL}
          ratingsServiceUrl={RATINGS_SERVICE_URL}
        />
      ) : (
        <>
          <div className="section-header">
            <h2>Featured Products</h2>
            <p>Discover our curated collection of premium products</p>
          </div>
          <ProductList
            products={products}
            onProductClick={handleProductClick}
          />
        </>
      )}
    </div>
  );
}

export default App;

