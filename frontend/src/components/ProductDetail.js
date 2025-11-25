import React, { useState, useEffect } from 'react';
import RatingForm from './RatingForm';

const ProductDetail = ({ product, onBack, productServiceUrl, ratingsServiceUrl }) => {
  const [productDetails, setProductDetails] = useState(product);
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProductDetails();
    fetchRatings();
    
    // Refresh every 3 seconds to get updated ratings
    const interval = setInterval(() => {
      fetchProductDetails();
      fetchRatings();
    }, 3000);
    
    return () => clearInterval(interval);
  }, [product._id]);

  const fetchProductDetails = async () => {
    try {
      const response = await fetch(`${productServiceUrl}/api/products/${product._id}`);
      const data = await response.json();
      if (data.success) {
        setProductDetails(data.data);
      }
    } catch (err) {
      console.error('Error fetching product details:', err);
    }
  };

  const fetchRatings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${ratingsServiceUrl}/api/ratings/product/${product._id}`);
      const data = await response.json();
      if (data.success) {
        setRatings(data.data);
      }
    } catch (err) {
      console.error('Error fetching ratings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRatingSubmitted = () => {
    fetchProductDetails();
    fetchRatings();
  };

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

  return (
    <div>
      <button className="btn" onClick={onBack} style={{ marginBottom: '32px', background: '#6c757d', color: 'white' }}>
        ← Back to Products
      </button>

      <div className="product-card" style={{ maxWidth: '900px', margin: '0 auto', background: '#ffffff' }}>
        {productDetails.imageUrl ? (
          <img
            src={productDetails.imageUrl}
            alt={productDetails.name}
            className="product-card-image"
            style={{ height: '400px' }}
          />
        ) : (
          <div className="product-card-image" style={{ 
            height: '400px',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#a0aec0',
            fontSize: '5rem'
          }}>
            📦
          </div>
        )}
        <div className="product-card-content">
          <h2 style={{ fontSize: '2rem', marginBottom: '16px' }}>{productDetails.name}</h2>
          <div className="product-price" style={{ fontSize: '2rem', marginBottom: '20px' }}>
            ${productDetails.price.toFixed(2)}
          </div>
          <div className="rating" style={{ margin: '20px 0' }}>
            {productDetails.averageRating > 0 ? (
              <div className="rating-badge" style={{ fontSize: '1rem', padding: '6px 12px' }}>
                <div className="stars">{renderStars(productDetails.averageRating)}</div>
                <span>{productDetails.averageRating.toFixed(1)}</span>
              </div>
            ) : null}
            <span className="rating-count" style={{ fontSize: '0.9375rem' }}>
              ({productDetails.ratingsCount} {productDetails.ratingsCount === 1 ? 'review' : 'reviews'})
            </span>
          </div>
          <p style={{ marginBottom: '24px', lineHeight: '1.8', fontSize: '1.1rem', color: '#4a5568' }}>
            {productDetails.description}
          </p>
          <div className="product-category" style={{ fontSize: '0.875rem', marginTop: '16px' }}>
            {productDetails.category}
          </div>
        </div>
      </div>

      <RatingForm
        productId={product._id}
        onRatingSubmitted={handleRatingSubmitted}
        ratingsServiceUrl={ratingsServiceUrl}
      />

      <div className="rating-form" style={{ marginTop: '48px', maxWidth: '900px' }}>
        <h3 style={{ textAlign: 'center' }}>Customer Reviews ({ratings.length})</h3>
        {loading ? (
          <div className="loading" style={{ padding: '40px', color: '#718096' }}>Loading reviews...</div>
        ) : ratings.length === 0 ? (
          <p style={{ color: '#718096', fontSize: '1.1rem', textAlign: 'center', padding: '40px' }}>
            No reviews yet. Be the first to review!
          </p>
        ) : (
          <div>
            {ratings.map((rating) => (
              <div
                key={rating._id}
                style={{
                  padding: '20px',
                  marginBottom: '16px',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  borderLeft: '3px solid #0d6efd'
                }}
              >
                <div className="rating" style={{ marginBottom: '12px' }}>
                  <div className="stars">{renderStars(rating.rating)}</div>
                  <span style={{ marginLeft: '12px', fontWeight: '600', color: '#1a202c' }}>
                    {rating.rating} out of 5
                  </span>
                </div>
                {rating.comment && (
                  <p style={{ marginBottom: '12px', color: '#4a5568', lineHeight: '1.6' }}>{rating.comment}</p>
                )}
                <div style={{ fontSize: '0.875rem', color: '#718096', fontWeight: '500' }}>
                  User: {rating.userId} • {new Date(rating.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductDetail;

