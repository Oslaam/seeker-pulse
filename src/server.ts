import "dotenv/config";
import express from "express";
import cors from "cors";
import { domainSuggestions, lookup } from "./api.js";

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.static("public"));
app.use(express.json());

app.get("/api/domain-suggestions", async (req, res) => {
  await domainSuggestions(req, res);
});

app.get("/api/lookup", async (req, res) => {
  await lookup(req, res);
});

app.listen(PORT, () => {
  console.log(`Seeker Pulse running at http://localhost:${PORT}`);
});

