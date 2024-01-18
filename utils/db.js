const mongoose = require("mongoose");

const BookSchema = new mongoose.Schema({
  title: String,
  author: String,
  genre: String,
  rating: Number,
  description: String,
  published_year: Number,
  embeddings: [Number],
});

const UserSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  preferences: [String],
  userGenres: [String],
});

const User = mongoose.model("User", UserSchema);

const Book = mongoose.model("Book", BookSchema);

module.exports = { User, Book };
