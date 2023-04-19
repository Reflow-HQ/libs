const fs = require("fs");
const express = require("express");
const jwt = require("jsonwebtoken");

const app = express();
const port = 8080;

const page = fs.readFileSync("index.html", "utf8");
const library = fs.readFileSync("../../index.js", "utf8");

let publicKey = null;

if (fs.existsSync("./public-key.txt")) {
  publicKey = fs.readFileSync("./public-key.txt", "utf8");
}

if (!publicKey || !publicKey.length) {
  console.error("Please provide a Reflow public key in " + __dirname + "/public-key.txt");
  process.exit(1);
}

// A simple "database" for storing secrets. Lost ot process exit
const db = {};

// Display the page

app.get("/", (req, res) => {
  res.send(page);
});

// Render the library

app.get("/script.js", (req, res) => {
  res.set("Content-Type", "text/javascript");
  res.send(library);
});

// Authenticated routes. Each validates the token and either sets
// or retrieves the secret message for the user from the database

app.post("/message", async (req, res) => {
  try {
    let payload = jwt.verify(req.query.token, publicKey);
    db[payload.user.id] = req.query.message;
    res.send({ success: true });
  } catch (e) {
    console.error(e);
    res.send({ success: false });
  }
});

app.get("/message", async (req, res) => {
  try {
    let payload = jwt.verify(req.query.token, publicKey);
    res.send({ success: true, message: db[payload.user.id] ?? "" });
  } catch (e) {
    console.error(e);
    res.send({ success: false });
  }
});

// Start the server

app.listen(port, () => console.log(`Open http://localhost:8080 to test this demo`));
