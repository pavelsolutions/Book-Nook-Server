# 📚 BookNook Backend

The backend API for **BookNook**, an online book library application. It provides RESTful APIs for managing books, borrowing records, and user-related library operations.

## 🚀 Features

- Create and manage book records
- Retrieve books and book details
- Track total and available book copies
- Manage book borrowing records
- Fetch a user's borrowed books using their email
- Sort borrowing records by creation date
- Protected API requests using Bearer token authentication
- MongoDB database integration
- Error handling for API requests

## 🛠️ Technologies Used

- Node.js
- Express.js
- MongoDB
- JavaScript
- REST API
- Authentication with Bearer tokens

## 📁 Project Structure

```text
booknook-backend/
├── index.js
├── package.json
├── .env
└── README.md
```

> Update this structure if your backend uses separate routes, controllers, or configuration folders.

## ⚙️ Installation

### 1. Clone the repository

```bash
git clone https://github.com/pavelsolutions/Book-Nook-Server
```

### 2. Navigate to the project directory

```bash
cd booknook-backend
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create a `.env` file in the root directory:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
DB_NAME=your_database_name
```

Add any authentication-related environment variables required by your project.

**Never commit your `.env` file or expose your database credentials.**

### 5. Start the server

For development:

```bash
npm run dev
```

For production:

```bash
npm start
```

The server will run at:

```text
http://localhost:5000
```

## 🔗 API Endpoints

### Books

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/books` | Retrieve books |
| `GET` | `/books/:id` | Retrieve a specific book |
| `POST` | `/books` | Add a new book |

> Confirm the exact routes in your backend source code before publishing this endpoint list.

### Borrowed Books

#### Get a user's borrowed books

```http
GET /my-borrows/:email
```

Example:

```http
GET /my-borrows/user@example.com
```

This endpoint retrieves borrowing records for the specified user and sorts them by creation date in descending order.

Example response:

```json
[
  {
    "_id": "borrow-record-id",
    "userEmail": "user@example.com",
    "bookId": "book-id",
    "createdAt": "2026-01-01T10:00:00.000Z"
  }
]
```

The actual response fields depend on the stored borrowing record.

## 📖 Book Data Structure

A book record may contain the following fields:

```json
{
  "title": "Example Book",
  "author": "Example Author",
  "category": "Fiction",
  "description": "A short book description",
  "image": "https://example.com/book.jpg",
  "totalCopies": 5,
  "availableCopies": 5,
  "userName": "Book Owner",
  "email": "owner@example.com",
  "addedDate": "2026-01-01T10:00:00.000Z"
}
```

## 🔐 Authentication

Protected requests use a Bearer token in the `Authorization` header.

```http
Authorization: Bearer YOUR_ACCESS_TOKEN
```

Example:

```javascript
const response = await fetch(`${API_URL}/books`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    authorization: `Bearer ${token}`,
  },
  body: JSON.stringify(bookData),
});
```

## 🌐 Frontend Integration

The BookNook frontend communicates with this backend through REST API requests.

Configure the frontend API URL using an environment variable:

```env
NEXT_PUBLIC_SERVER_BASE_URL=http://localhost:5000
```

For a deployed backend, replace the local URL with your live API URL.

## 🚀 Deployment

The backend can be deployed to a Node.js-compatible hosting platform.

Before deployment:

- Configure production environment variables.
- Add the production frontend URL to CORS settings.
- Configure MongoDB network access.
- Keep credentials and tokens private.
- Test API endpoints after deployment.

## 👨‍💻 Author

**BookNook Project**

A book library application designed to help users discover books and manage their personal library.

---

⭐ If you find this project useful, consider giving it a star!
