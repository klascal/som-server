require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const bodyParser = require("body-parser");
const db = require("./db");

const app = express();
app.use(cors());
app.use(bodyParser.json());

async function fetchNewTokens(refreshToken) {
  const params = new URLSearchParams();
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", refreshToken);
  params.append("client_id", "somtoday-leerling-web");
  params.append("scope", "openid");

  const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  const response = await axios.post("https://inloggen.somtoday.nl/oauth2/token", params.toString(), { headers });
  return response.data;
}

// Main endpoint
app.post("/", async (req, res) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    const users = db.getAllUsers();
    for (const user of users) {
      try {
        const tokenData = await fetchNewTokens(user.new_refresh_token);
        db.saveUser(
          user.old_refresh_token,
          tokenData.refresh_token,
          tokenData.access_token
        );
        return res.json({ data: tokenData });
      } catch {
        // silently ignore failure
      }
    }
  }

  const oldToken = authHeader.trim();
  const user = db.getUser(oldToken);

  if (!user) {
    try {
      const tokenData = await fetchNewTokens(oldToken);
      db.saveUser(oldToken, tokenData.refresh_token, tokenData.access_token);
      return res.json({ access_token: tokenData.access_token });
    } catch (e) {
      return res
        .status(400)
        .json({ error: "Invalid refresh_token. Error:" + e });
    }
  }

  return res.json({ access_token: user.access_token });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
