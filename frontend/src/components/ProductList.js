import React from 'react';

const ProductList = ({ products, onProductClick }) => {
  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<span key={i} className="star active">★</span>);
      } else if (i === fullStars && hasHalfStar) {
        stars.push(<span key={i} className="star active">★</span>);
      } else {
        stars.push(<span key={i} className="star">☆</span>);
      }
    }
    return stars;
  };

  if (products.length === 0) {
    return (
      <div className="loading" style={{ 
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        margin: '48px 0',
        color: '#718096'
      }}>
        No products found
      </div>
    );
  }

  return (
    <div className="product-grid">
      {products.map((product) => (
        <div
          key={product._id}
          className="product-card"
          onClick={() => onProductClick(product)}
        >
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="product-card-image"
            />
          ) : (
            <div className="product-card-image" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: '#a0aec0',
              fontSize: '3rem'
            }}>
              📦
            </div>
          )}
          <div className="product-card-content">
            <h3>{product.name}</h3>
            <p>{product.description}</p>
          <div className="product-price">${product.price.toFixed(2)}</div>
          <div className="rating">
            {product.averageRating > 0 ? (
              <div className="rating-badge">
                <div className="stars">{renderStars(product.averageRating)}</div>
                <span>{product.averageRating.toFixed(1)}</span>
              </div>
            ) : null}
            <span className="rating-count">
              ({product.ratingsCount} {product.ratingsCount === 1 ? 'review' : 'reviews'})
            </span>
          </div>
          <div className="product-category">{product.category}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ProductList;

