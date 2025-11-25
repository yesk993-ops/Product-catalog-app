# API Endpoints Reference

## Base URLs

- **Product Service**: `http://localhost:5002` (or `http://product-service:5000` in Docker network)
- **Ratings Service**: `http://localhost:5003` (or `http://ratings-service:5001` in Docker network)

---

## 📦 Product Service Endpoints

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "OK",
  "service": "product-service",
  "timestamp": "2025-11-25T22:30:00.000Z"
}
```

**Example:**
```bash
curl http://localhost:5002/health
```

---

### Get All Products
```http
GET /api/products
```

**Query Parameters:**
- `category` (optional) - Filter by category
- `search` (optional) - Search in name and description
- `sort` (optional) - Sort field (default: `createdAt`)
- `order` (optional) - Sort order: `asc` or `desc` (default: `desc`)
- `page` (optional) - Page number (default: `1`)
- `limit` (optional) - Items per page (default: `10`)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "69262bb47283a82d4d61b403",
      "name": "Wireless Bluetooth Headphones",
      "description": "Premium noise-cancelling wireless headphones...",
      "price": 199.99,
      "category": "Electronics",
      "imageUrl": "https://images.unsplash.com/...",
      "averageRating": 4.5,
      "ratingsCount": 10,
      "createdAt": "2025-11-25T22:20:36.122Z",
      "updatedAt": "2025-11-25T22:20:36.128Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 6,
    "pages": 1
  }
}
```

**Examples:**
```bash
# Get all products
curl http://localhost:5002/api/products

# Filter by category
curl "http://localhost:5002/api/products?category=Electronics"

# Search products
curl "http://localhost:5002/api/products?search=laptop"

# Pagination
curl "http://localhost:5002/api/products?page=1&limit=5"

# Sort by price (ascending)
curl "http://localhost:5002/api/products?sort=price&order=asc"
```

---

### Get Product by ID
```http
GET /api/products/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "69262bb47283a82d4d61b403",
    "name": "Wireless Bluetooth Headphones",
    "description": "Premium noise-cancelling wireless headphones...",
    "price": 199.99,
    "category": "Electronics",
    "imageUrl": "https://images.unsplash.com/...",
    "averageRating": 4.5,
    "ratingsCount": 10,
    "createdAt": "2025-11-25T22:20:36.122Z",
    "updatedAt": "2025-11-25T22:20:36.128Z"
  }
}
```

**Example:**
```bash
curl http://localhost:5002/api/products/69262bb47283a82d4d61b403
```

---

### Create Product
```http
POST /api/products
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Product Name",
  "description": "Product description",
  "price": 99.99,
  "category": "Electronics",
  "imageUrl": "https://example.com/image.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "69262bb47283a82d4d61b403",
    "name": "Product Name",
    "description": "Product description",
    "price": 99.99,
    "category": "Electronics",
    "imageUrl": "https://example.com/image.jpg",
    "averageRating": 0,
    "ratingsCount": 0,
    "createdAt": "2025-11-25T22:20:36.122Z",
    "updatedAt": "2025-11-25T22:20:36.128Z"
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:5002/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Product",
    "description": "A new product description",
    "price": 49.99,
    "category": "Electronics",
    "imageUrl": "https://via.placeholder.com/300"
  }'
```

---

### Update Product
```http
PUT /api/products/:id
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Updated Product Name",
  "description": "Updated description",
  "price": 129.99,
  "category": "Electronics",
  "imageUrl": "https://example.com/new-image.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "69262bb47283a82d4d61b403",
    "name": "Updated Product Name",
    "description": "Updated description",
    "price": 129.99,
    "category": "Electronics",
    "imageUrl": "https://example.com/new-image.jpg",
    "averageRating": 4.5,
    "ratingsCount": 10,
    "createdAt": "2025-11-25T22:20:36.122Z",
    "updatedAt": "2025-11-25T22:30:00.000Z"
  }
}
```

**Example:**
```bash
curl -X PUT http://localhost:5002/api/products/69262bb47283a82d4d61b403 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Product",
    "description": "Updated description",
    "price": 129.99,
    "category": "Electronics"
  }'
```

---

### Delete Product
```http
DELETE /api/products/:id
```

**Response:**
```json
{
  "success": true,
  "message": "Product deleted successfully"
}
```

**Example:**
```bash
curl -X DELETE http://localhost:5002/api/products/69262bb47283a82d4d61b403
```

---

### Update Product Rating (Internal - Used by Worker Service)
```http
PUT /api/products/:id/rating
Content-Type: application/json
```

**Request Body:**
```json
{
  "averageRating": 4.5,
  "ratingsCount": 10
}
```

**Note:** This endpoint is used internally by the worker service to update product ratings after processing rating events.

---

## ⭐ Ratings Service Endpoints

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "OK",
  "service": "ratings-service",
  "timestamp": "2025-11-25T22:30:00.000Z"
}
```

**Example:**
```bash
curl http://localhost:5003/health
```

---

### Submit Rating
```http
POST /api/ratings
Content-Type: application/json
```

**Request Body:**
```json
{
  "productId": "69262bb47283a82d4d61b403",
  "userId": "user-123",
  "rating": 5,
  "comment": "Great product! Highly recommended."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "69262cc47283a82d4d61b404",
    "productId": "69262bb47283a82d4d61b403",
    "userId": "user-123",
    "rating": 5,
    "comment": "Great product! Highly recommended.",
    "createdAt": "2025-11-25T22:30:00.000Z"
  },
  "message": "Rating submitted successfully"
}
```

**Note:** If the same user rates the same product again, it will update the existing rating.

**Example:**
```bash
curl -X POST http://localhost:5003/api/ratings \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "69262bb47283a82d4d61b403",
    "userId": "user-123",
    "rating": 5,
    "comment": "Excellent product!"
  }'
```

---

### Get Ratings for a Product
```http
GET /api/ratings/product/:productId
```

**Query Parameters:**
- `page` (optional) - Page number (default: `1`)
- `limit` (optional) - Items per page (default: `10`)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "69262cc47283a82d4d61b404",
      "productId": "69262bb47283a82d4d61b403",
      "userId": "user-123",
      "rating": 5,
      "comment": "Great product!",
      "createdAt": "2025-11-25T22:30:00.000Z"
    }
  ],
  "averageRating": 4.5,
  "ratingsCount": 10,
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 10,
    "pages": 1
  }
}
```

**Example:**
```bash
curl http://localhost:5003/api/ratings/product/69262bb47283a82d4d61b403

# With pagination
curl "http://localhost:5003/api/ratings/product/69262bb47283a82d4d61b403?page=1&limit=5"
```

---

### Get Ratings by User
```http
GET /api/ratings/user/:userId
```

**Query Parameters:**
- `page` (optional) - Page number (default: `1`)
- `limit` (optional) - Items per page (default: `10`)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "69262cc47283a82d4d61b404",
      "productId": "69262bb47283a82d4d61b403",
      "userId": "user-123",
      "rating": 5,
      "comment": "Great product!",
      "createdAt": "2025-11-25T22:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "pages": 1
  }
}
```

**Example:**
```bash
curl http://localhost:5003/api/ratings/user/user-123
```

---

### Delete Rating
```http
DELETE /api/ratings/:id
```

**Response:**
```json
{
  "success": true,
  "message": "Rating deleted successfully"
}
```

**Example:**
```bash
curl -X DELETE http://localhost:5003/api/ratings/69262cc47283a82d4d61b404
```

---

## 🔄 Complete Workflow Example

### 1. Get all products
```bash
curl http://localhost:5002/api/products
```

### 2. Submit a rating for a product
```bash
curl -X POST http://localhost:5003/api/ratings \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "69262bb47283a82d4d61b403",
    "userId": "user-123",
    "rating": 5,
    "comment": "Amazing product!"
  }'
```

### 3. Check ratings for the product
```bash
curl http://localhost:5003/api/ratings/product/69262bb47283a82d4d61b403
```

### 4. Verify product rating was updated (worker service processes it)
```bash
curl http://localhost:5002/api/products/69262bb47283a82d4d61b403
```

---

## 📝 Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "message": "Error message here",
  "errors": [
    {
      "msg": "Validation error message",
      "param": "fieldName"
    }
  ]
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `404` - Not Found
- `500` - Internal Server Error

---

## 🔐 Notes

- All endpoints are currently **public** (no authentication required)
- In production, you should add authentication (JWT tokens)
- The worker service automatically processes rating events and updates product averages
- Rating updates happen asynchronously via Redis message queue

