const express = require("express");
const fetch = require("node-fetch");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { User, Book } = require("./utils/db.js");
const { authenticateJwt } = require("../server/utils/authenticateJwt");
//for cors
const cors = require("cors");
const JWT_SECRET = "secret1212";
const port = process.env.PORT || 3001;
//for dotenv file
require("dotenv").config();

const app = express();

app.use(cors());

//body parser
app.use(express.json());

//for getting user details
app.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader) {
      const authorisation = authHeader.split(" ")[1] || authHeader;
      const decoded = jwt.verify(authorisation, JWT_SECRET);
      const user = await User.findOne({ username: decoded.username });
      return res.json({ user });
    } else {
      return res.json({ user: null });
    }
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "An error occurred while processing your request." });
  }
});

//signup route
app.post("/signup", async (req, res) => {
  const { username, password } = req.body;
  if (!username) {
    return res.status(400).json({ message: "Username is required" });
  }
  if (!password) {
    return res.status(400).json({ message: "Password is required" });
  }
  const user = await User.findOne({ username });
  if (user) {
    //if user already exists throw error
    return res.status(403).json({ message: "User already exists" });
  } else {
    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();
    const token = jwt.sign({ username }, JWT_SECRET, {
      //token will expire in 72 hours
      expiresIn: "72h",
    });
    res.json({ message: "User created successfully!", token });
  }
});

//login route

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username) {
    return res.status(400).json({ message: "Username is required" });
  }
  if (!password) {
    return res.status(400).json({ message: "Password is required" });
  }
  // Find the user by username
  const user = await User.findOne({ username });

  if (user) {
    // Compare the provided password with the hashed password in the database
    const isPasswordValid = bcrypt.compare(password, user.password);

    if (isPasswordValid) {
      // Password is valid, generate a JWT token
      const token = jwt.sign({ username, role: "user" }, JWT_SECRET, {
        expiresIn: "72h",
      });
      res.json({ message: "Logged in successfully", token });
      return;
    } else {
      // Password is invalid
      res.status(403).json({ message: "Invalid username or password" });
      return;
    }
  } else {
    // User not found
    res.status(403).json({ message: "Invalid username or password" });
    return;
  }
});
async function generateTextEmbeddings(inputText) {
  try {
    const requestBody = {
      input: `${inputText}`,
      model: "text-embedding-ada-002",
      encoding_format: "float",
    };
    const apiResponse = await fetch("https://api.openai.com/v1/embeddings", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      method: "POST",
      body: JSON.stringify(requestBody),
    });

    const parsedJson = await apiResponse.json();
    console.log("parsedJson", parsedJson);

    return parsedJson.data[0].embedding;
  } catch (error) {
    console.error("Error in generateTextEmbeddings:", error);
    throw error;
  }
}

//for generating and storing embeddings to the database for each book
async function generateAndSaveEmbeddings() {
  try {
    console.log("Generating and saving embeddings");
    const cursor = await Book.find({});

    let count = 233;
    const processNextBook = async () => {
      if (count >= cursor.length) {
        return;
      }

      const novel = cursor[count];
      const embeddings = await generateTextEmbeddings(
        `${novel.title} ${novel.description} ${novel.author}`
      );

      await Book.updateOne(
        { _id: novel._id },
        {
          $set: {
            embeddings: embeddings,
          },
        }
      );

      count++;
      setTimeout(processNextBook, 20000); // 20000 milliseconds = 20 seconds = 3 requests per minute
    };

    processNextBook();
  } catch (error) {
    console.error("Error in generateAndSaveEmbeddings:", error);
    throw error;
  }
}

//The cosine similarity is chosen due to its efficiency when dealing with high-dimensional data.
function computeCosineSimilarity(array1, array2) {
  let productSum = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  for (let index = 0; index < array1.length; index++) {
    productSum += array1[index] * array2[index];
    magnitude1 += Math.pow(array1[index], 2);
    magnitude2 += Math.pow(array2[index], 2);
  }

  return productSum / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));
}

async function suggestBooks(userPreferences) {
  // Transform user's preferences into embeddings
  const userEmbeddings = await generateTextEmbeddings(userPreferences);

  // Retrieve all books from the database
  const library = await Book.find({});

  // Compute the cosine similarity between user's embeddings and each book's embeddings
  const similarityScores = library.map((novel) => ({
    novel: novel,
    score: computeCosineSimilarity(userEmbeddings, novel.embeddings),
  }));

  // Order the novels based on their similarity scores
  similarityScores.sort((a, b) => b.score - a.score);

  // Return the top 3 novels
  const topThree = similarityScores.slice(0, 3);
  return topThree.map((item) => item.novel);
}

//recommend route
app.post("/recommend", async (req, res) => {
  try {
    const { favouriteBooks, favouriteAuthors, genre } = req.body;
    const userPreferences = `${favouriteBooks} ${favouriteAuthors} ${genre}`; // Assuming the user's preferences are sent in the request body
    const recommendedBooks = await suggestBooks(userPreferences);
    return res.status(200).json(recommendedBooks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// generateAndSaveEmbeddings()
//   .then(() => {
//     console.log("Done");
//   })
//   .catch(console.error);

//for creating connection to database if it is not already connected

if (mongoose.connection.readyState === 0) {
  mongoose.connect(process.env.MONGODB_URI, {
    dbName: "bookRecommender",
  });
}
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

app.listen(port, () => console.log("Server started on port 3001"));
