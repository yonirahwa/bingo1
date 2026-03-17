import express from "express";
import fetch from "node-fetch";

const app = express();

app.get("/proxy", async (req, res) => {
  const url = req.query.url;

  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });

  const text = await response.text();
  res.send(text);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
