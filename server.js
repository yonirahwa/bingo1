import express from "express";
import fetch from "node-fetch";

const app = express();

app.get("/", async (req, res) => {
  const urlParam = req.query.url;

  if (!urlParam) {
    return res.status(400).send("Missing ?url=");
  }

  try {
    const response = await fetch(urlParam, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });

    const buffer = await response.arrayBuffer();

    res.set({
      "Content-Type":
        response.headers.get("content-type") || "application/octet-stream",
      "Access-Control-Allow-Origin": "*",
    });

    res.status(response.status).send(Buffer.from(buffer));
  } catch (err) {
    res.status(500).send(`Proxy error: ${err.message}`);
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
