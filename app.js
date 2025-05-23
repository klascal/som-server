require("dotenv").config();
const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const db = require("./db");

const app = express();
app.use(bodyParser.json());

const { CLIENT_ID, SCOPE, TOKEN_URL } = process.env;

async function fetchNewTokens(refreshToken) {
  const params = new URLSearchParams();
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", refreshToken);
  params.append("client_id", CLIENT_ID);
  params.append("scope", SCOPE);

  const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  const response = await axios.post(TOKEN_URL, params.toString(), { headers });
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
      } catch {
        // silently ignore failure
      }
    }
    return res.status(204).send(); // No Content
  }

  const oldToken = authHeader.trim();
  const user = db.getUser(oldToken);

  if (!user) {
    try {
      const tokenData = await fetchNewTokens(oldToken);
      db.saveUser(oldToken, tokenData.refresh_token, tokenData.access_token);
      return res.json({ access_token: tokenData.access_token });
    } catch {
      return res.status(400).json({ error: "Invalid refresh_token" });
    }
  }

  return res.json({ access_token: user.access_token });
});

const puppeteer = require("puppeteer");

app.post("/sso", async (req, res) => {
  const { org, username, password } = req.body;

  if (!org || !username || !password) {
    return res
      .status(400)
      .json({ error: "School, gebruikersnaam en wachtwoord zijn vereist." });
  }

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    await page.goto("https://inloggen.somtoday.nl/?0");
    await page.type("#organisatieSearchField", org);
    await page.click("#id3");

    await page.waitForSelector("#usernameField");
    await page.type("#usernameField", username);
    await page.click("#id9");

    const element = await Promise.race([
      page
        .waitForSelector("input[name='Passwd']")
        .then((el) => ({ id: "input[name='Passwd']", el })),
      page.waitForSelector("#i0118").then((el) => ({ id: "#i0118", el })),
    ]);

    await page.type(element.id, password);

    if (element.id === "#i0118") {
      await page.click("#idSIButton9");
      await page.waitForSelector("#idBtn_Back");
      await page.click("#idBtn_Back");
    } else {
      await browser.close();
      return res.status(400).json({ error: "Google SSO not supported" });
    }

    await page.waitForRequest((request) =>
      request.url().includes("https://api.somtoday.nl/rest/v1/account/me")
    );

    const refreshToken = await page.evaluate(() => {
      return JSON.parse(
        localStorage[
          "CapacitorStorage." +
            JSON.parse(localStorage["CapacitorStorage.SL_AUTH_CONFIG_RECORDS"])
              .currentSessionIdentifier.UUID
        ]
      ).refresh_token;
    });

    await browser.close();
    return res.json({ refresh_token: refreshToken });
  } catch (err) {
    console.error("SSO error:", err);
    return res
      .status(500)
      .json({ error: `Authenticatie mislukt. Error: ${err}` });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
