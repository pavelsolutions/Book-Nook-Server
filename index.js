import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from 'mongodb';
import 'dotenv/config';
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
    } catch (err) {
        console.dir(err);
    }
}

const connectClient = await connectToMongoDB();
const db = connectClient.db("book-nook");
const booksCollection = db.collection("books");
const borrowsCollection = db.collection("borrows");



const verifyToken = async(req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if(!authHeader){
        return res.status(401).send({ msg: 'Unauthorized' });
    }

    const token = authHeader.split(" ")[1]
    if(!token){
        return res.status(401).send({ msg: 'Unauthorized' });
    }

    const JWKS = createRemoteJWKSet(new URL('http://localhost:3000/api/auth/jwks'));

    try {
        const {payload} = await jwtVerify(token, JWKS);
        next();
    } catch (error) {
         return res.status(500).send({ msg: 'Server Error!' });
    }
}


app.post("/books", verifyToken,  async (req, res) => {
    // step-1: Retrieve the data from request body
    const bookData = req.body;

    // step-2: Insert the data into  the MongoDB collection
    const result = await booksCollection.insertOne(bookData);

    //  step-3: Send a response back to the client
    res.send(result);
})

app.get("/books", verifyToken,  async (req, res) => {
    // Step 1: Retrieve all books from MongoDB
    const result = await booksCollection.find().toArray();

    // Step 2: Send all books back to the client
    res.send(result);
});

app.get("/books/:id", verifyToken, async (req, res) => {
    const id = req.params.id;
    console.log(id, "id");

    const result = await booksCollection.findOne({ _id: new ObjectId(id) });

    // res.send({message: `you requested book with id: ${id}`})
    res.send(result);
})


app.get('/my-books/:email',  async (req, res) => {
    const { email } = req.params

    // if(email != req.user.email){
    //     return res.status(403).send({message: "Forbidden access"});
    // }
    const result = await booksCollection.find({ email: email }).toArray()
    res.send(result)
})

app.put("/books/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const updatedBook = req.body;

        const result = await booksCollection.updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    title: updatedBook.title,
                    author: updatedBook.author,
                    category: updatedBook.category,
                    description: updatedBook.description,
                    image: updatedBook.image,
                },
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).send({ message: "Book not found" });
        }

        res.send({
            message: "Book updated successfully",
            result,
        });
    } catch (error) {
        res.status(500).send({ message: "Failed to update book" });
    }
});

app.delete("/books/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const result = await booksCollection.deleteOne({
            _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
            return res.status(404).send({ message: "Book not found" });
        }

        res.send({
            message: "Book deleted successfully",
            result,
        });
    } catch (error) {
        res.status(500).send({ message: "Failed to delete book" });
    }
});


// Borrows
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

        // Check whether this book is already borrowed
        const existingBorrow = await borrowsCollection.findOne({
            bookId: bookId,
        });

        if (existingBorrow) {
            return res.status(409).send({
                message: "This book is already borrowed by another user",
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
            createdAt: new Date(),
        };

        const result = await borrowsCollection.insertOne(borrowData);

        res.status(201).send({
            message: "Book borrowed successfully",
            insertedId: result.insertedId,
        });
    } catch (error) {
        res.status(500).send({
            message: "Failed to borrow book",
        });
    }
});

app.get("/my-borrows/:email",  async (req, res) => {
    try {
        const { email } = req.params;

        const result = await borrowsCollection
            .find({ userEmail: email })
            .sort({ createdAt: -1 })
            .toArray();

        res.send(result);
    } catch (error) {
        res.status(500).send({ message: "Failed to fetch borrowed books" });
    }
});


// borrow delete
app.delete("/borrows/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { email } = req.body;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: "Invalid borrow ID" });
        }

        const result = await borrowsCollection.deleteOne({
            _id: new ObjectId(id),
            userEmail: email,
        });

        if (result.deletedCount === 0) {
            return res.status(404).send({
                message: "Borrow record not found",
            });
        }

        res.send({ message: "Book returned successfully" });
    } catch (error) {
        res.status(500).send({ message: "Failed to return book" });
    }
});


app.listen(PORT, () => {
    console.log(`Server is runing on port ${PORT}`);
});