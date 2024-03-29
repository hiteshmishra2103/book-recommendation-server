const jwt = require("jsonwebtoken");
const dotenv = require("dotenv").config();
const JWT_SECRET = process.env.JWT_SECRET;

const authenticateJwt = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(" ")[1] || authHeader;
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        return res.sendStatus(403);
      }
      req.user = user;
      if (req.body) {
        const { favouriteBooks, favouriteAuthors, genre } = req.body;
        req.body.favouriteBooks = favouriteBooks;
        req.body.favouriteAuthors = favouriteAuthors;
        req.body.genre = genre;
      }
      next();
    });
  } else {
    res.sendStatus(401);
  }
};

module.exports = {
  authenticateJwt,
};
