import React, { useState } from 'react';

const RatingForm = ({ productId, onRatingSubmitted, ratingsServiceUrl }) => {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [userId, setUserId] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!userId) {
      setMessage({ type: 'error', text: 'Please enter a user ID' });
      return;
    }

    if (rating === 0) {
      setMessage({ type: 'error', text: 'Please select a rating' });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(`${ratingsServiceUrl}/api/ratings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId,
          userId,
          rating,
          comment: comment.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Rating submitted successfully!' });
        setRating(0);
        setComment('');
        setTimeout(() => {
          setMessage(null);
          onRatingSubmitted();
        }, 2000);
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to submit rating' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error connecting to ratings service' });
      console.error('Error submitting rating:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rating-form">
      <h3>Rate this Product</h3>
      {message && (
        <div className={message.type === 'error' ? 'error' : 'success'}>
          {message.text}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="userId">User ID *</label>
          <input
            type="text"
            id="userId"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Enter your user ID"
            required
          />
        </div>

        <div className="form-group">
          <label>Rating *</label>
          <div className="star-rating">
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                className={`star ${star <= (hoveredRating || rating) ? 'active' : ''}`}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                style={{ cursor: 'pointer' }}
              >
                ★
              </span>
            ))}
          </div>
          {rating > 0 && (
            <p style={{ marginTop: '5px', color: '#666', textAlign: 'center' }}>
              Selected: {rating} out of 5 stars
            </p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="comment">Comment (optional)</label>
          <textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your thoughts about this product..."
            maxLength={500}
          />
          <small style={{ color: '#666' }}>{comment.length}/500 characters</small>
        </div>

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Submit Rating'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RatingForm;

