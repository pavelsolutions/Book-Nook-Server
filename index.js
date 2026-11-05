import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import "dotenv/config";
import { createRemoteJWKSet, jwtVerify } from "jose";

const PORT = 5000;

const app = express();

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGO_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    throw error;
  }
}

const connectClient = await connectToMongoDB();

const db = connectClient.db("book-nook");
const booksCollection = db.collection("books");
const borrowsCollection = db.collection("borrows");

// JWT verification
const JWKS = createRemoteJWKSet(
  new URL(`${process.env.FRONTEND_URI}/api/auth/jwks`)
);

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({
      message: "Unauthorized",
    });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).send({
      message: "Unauthorized",
    });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);

    req.user = payload;

    next();
  } catch (error) {
    return res.status(401).send({
      message: "Invalid or expired token",
    });
  }
};

// Create index for preventing duplicate active borrows.
// Run this once during server startup.
await borrowsCollection.createIndex(
  {
    bookId: 1,
    userEmail: 1,
    status: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      status: "borrowed",
    },
  }
);

// --------------------------------------------------
// BOOK ROUTES
// --------------------------------------------------

// Add a book
app.post("/books", verifyToken, async (req, res) => {
  try {
    const bookData = req.body;

    const totalCopies = Number(bookData.totalCopies);

    if (!Number.isInteger(totalCopies) || totalCopies < 0) {
      return res.status(400).send({
        message: "totalCopies must be a non-negative integer",
      });
    }

    const newBook = {
      ...bookData,
      totalCopies,
      availableCopies: totalCopies,
      createdAt: new Date(),
    };

    const result = await booksCollection.insertOne(newBook);

    res.status(201).send({
      message: "Book added successfully",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error("Add book error:", error);

    res.status(500).send({
      message: "Failed to add book",
    });
  }
});

// Get all books
app.get("/books", async (req, res) => {
  try {
    const result = await booksCollection.find().toArray();

    res.send(result);
  } catch (error) {
    console.error("Fetch books error:", error);

    res.status(500).send({
      message: "Failed to fetch books",
    });
  }
});

// Get a single book
app.get("/books/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        message: "Invalid book ID",
      });
    }

    const result = await booksCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!result) {
      return res.status(404).send({
        message: "Book not found",
      });
    }

    res.send(result);
  } catch (error) {
    console.error("Fetch book error:", error);

    res.status(500).send({
      message: "Failed to fetch book",
    });
  }
});

// Get books created by a user
app.get("/my-books/:email", async (req, res) => {
  try {
    const { email } = req.params;

    const result = await booksCollection
      .find({ email })
      .toArray();

    res.send(result);
  } catch (error) {
    console.error("My books error:", error);

    res.status(500).send({
      message: "Failed to fetch user's books",
    });
  }
});

// Update a book
app.patch("/books/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updatedBook = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        message: "Invalid book ID",
      });
    }

    const updateFields = {
      title: updatedBook.title,
      author: updatedBook.author,
      category: updatedBook.category,
      description: updatedBook.description,
      image: updatedBook.image,
      totalCopies: updatedBook.totalCopies,
      availableCopies: updatedBook.availableCopies,
    };

    // Do not allow this route to overwrite availableCopies.
    // Borrow/return routes control availableCopies.
    const result = await booksCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: updateFields,
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({
        message: "Book not found",
      });
    }

    res.send({
      message: "Book updated successfully",
      result,
    });
  } catch (error) {
    console.error("Update book error:", error);

    res.status(500).send({
      message: "Failed to update book",
    });
  }
});

// Delete a book
app.delete("/books/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        message: "Invalid book ID",
      });
    }

    const result = await booksCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({
        message: "Book not found",
      });
    }

    res.send({
      message: "Book deleted successfully",
      result,
    });
  } catch (error) {
    console.error("Delete book error:", error);

    res.status(500).send({
      message: "Failed to delete book",
    });
  }
});

// --------------------------------------------------
// BORROW ROUTES
// --------------------------------------------------

// Borrow a book
app.post("/borrows", async (req, res) => {
  try {
    const {
      bookId,
      bookTitle,
      bookImage,
      userName,
      userEmail,
      borrowDate,
      returnDate,
    } = req.body;

    // Validate required fields
    if (
      !bookId ||
      !bookTitle ||
      !userName ||
      !userEmail ||
      !borrowDate ||
      !returnDate
    ) {
      return res.status(400).send({
        message: "Missing required fields",
      });
    }

    if (!ObjectId.isValid(bookId)) {
      return res.status(400).send({
        message: "Invalid book ID",
      });
    }

    const bookObjectId = new ObjectId(bookId);

    // Check whether this user already has this book borrowed.
    const existingBorrow = await borrowsCollection.findOne({
      bookId,
      userEmail,
      status: "borrowed",
    });

    if (existingBorrow) {
      return res.status(409).send({
        message: "You have already borrowed this book",
      });
    }

    // Atomically decrease availableCopies only if it is greater than 0.
    const stockUpdate = await booksCollection.updateOne(
      {
        _id: bookObjectId,
        availableCopies: { $gt: 0 },
      },
      {
        $inc: {
          availableCopies: -1,
        },
      }
    );

    if (stockUpdate.modifiedCount === 0) {
      return res.status(409).send({
        message: "This book is not available",
      });
    }

    const borrowData = {
      bookId,
      bookTitle,
      bookImage: bookImage || "",
      userName,
      userEmail,
      borrowDate,
      returnDate,
      status: "borrowed",
      createdAt: new Date(),
    };

    try {
      const result = await borrowsCollection.insertOne(borrowData);

      res.status(201).send({
        message: "Book borrowed successfully",
        insertedId: result.insertedId,
      });
    } catch (insertError) {
      // If creating the borrow record fails, restore the book copy.
      await booksCollection.updateOne(
        { _id: bookObjectId },
        {
          $inc: {
            availableCopies: 1,
          },
        }
      );

      if (insertError.code === 11000) {
        return res.status(409).send({
          message: "You have already borrowed this book",
        });
      }

      throw insertError;
    }
  } catch (error) {
    console.error("Borrow book error:", error);

    res.status(500).send({
      message: "Failed to borrow book",
    });
  }
});

// Get a user's borrow records
app.get("/my-borrows/:email", async (req, res) => {
  try {
    const { email } = req.params;

    const result = await borrowsCollection
      .find({ userEmail: email })
      .sort({ createdAt: -1 })
      .toArray();

    res.send(result);
  } catch (error) {
    console.error("Fetch borrows error:", error);

    res.status(500).send({
      message: "Failed to fetch borrowed books",
    });
  }
});

// Return a borrowed book
app.delete("/borrows/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        message: "Invalid borrow ID",
      });
    }

    if (!email) {
      return res.status(400).send({
        message: "User email is required",
      });
    }

    // Only return a record that is currently borrowed by this user.
    const borrowRecord = await borrowsCollection.findOne({
      _id: new ObjectId(id),
      userEmail: email,
      status: "borrowed",
    });

    if (!borrowRecord) {
      return res.status(404).send({
        message: "Active borrow record not found",
      });
    }

    // Mark as returned first. This prevents returning the same record twice.
    const returnUpdate = await borrowsCollection.updateOne(
      {
        _id: new ObjectId(id),
        userEmail: email,
        status: "borrowed",
      },
      {
        $set: {
          status: "returned",
          returnedAt: new Date(),
        },
      }
    );

    if (returnUpdate.modifiedCount === 0) {
      return res.status(409).send({
        message: "This book has already been returned",
      });
    }

    // Increase availableCopies after successful status update.
    await booksCollection.updateOne(
      {
        _id: new ObjectId(borrowRecord.bookId),
      },
      {
        $inc: {
          availableCopies: 1,
        },
      }
    );

    res.send({
      message: "Book returned successfully",
    });
  } catch (error) {
    console.error("Return book error:", error);

    res.status(500).send({
      message: "Failed to return book",
    });
  }
});

app.get("/new-arrivals", async (req, res) => {
  try {
    const books = await booksCollection
      .find()
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();

    res.status(200).json({
      success: true,
      data: books,
    });
  } catch (error) {
    console.error("Failed to fetch new arrivals:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch new arrivals",
    });
  }
});
// --------------------------------------------------
// SERVER
// --------------------------------------------------

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app