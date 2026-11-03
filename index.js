import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from 'mongodb';
import 'dotenv/config';

const PORT =5000;

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


// app.post("/books", async (req, res) => {
//   try {
//     const bookData = req.body;

//     const result = await booksCollection.insertOne(bookData);

//     res.status(201).send({
//       success: true,
//       message: "Book added successfully",
//       insertedId: result.insertedId,
//     });
//   } catch (error) {
//     res.status(500).send({
//       success: false,
//       message: "Failed to add book",
//     });
//   }
// });

app.post("/books", async (req, res) => {
    // step-1: Retrieve the data from request body
    const bookData = req.body;

    // step-2: Insert the data into  the MongoDB collection
     const result = await booksCollection.insertOne(bookData);
    
    //  step-3: Send a response back to the client
     res.send(result);
})

app.get("/books", async (req, res) => {
  // Step 1: Retrieve all books from MongoDB
  const result = await booksCollection.find().toArray();

  // Step 2: Send all books back to the client
  res.send(result);
});

app.get("/books/:id", async(req,res) => {
    const id = req.params.id;
    console.log(id, "id");

    const result = await booksCollection.findOne({_id: new ObjectId(id) });

    // res.send({message: `you requested book with id: ${id}`})
    res.send(result);
})


app.get('/my-books/:email', async(req, res) => {
    const {email} = req.params
    const result = await booksCollection.find({email:email}).toArray()
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



app.listen(PORT, () => {
    console.log(`Server is runing on port ${PORT}`);
});