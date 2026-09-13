import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { domainSuggestions, lookup } from "./api.js";
import { findDapps, getDapp, listDapps } from "./api/dapps.js";

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.static("public"));
app.use(express.json());

app.get(["/privacy", "/terms", "/copyright", "/legal"], (_req, res) => {
  res.sendFile(path.resolve("public/legal.html"));
});

app.get("/api/domain-suggestions", async (req, res) => {
  await domainSuggestions(req, res);
});

app.get("/api/lookup", async (req, res) => {
  await lookup(req, res);
});

app.get("/api/dapps", async (req, res) => {
  await listDapps(req, res);
});

app.get("/api/dapps/search", async (req, res) => {
  await listDapps(req, res);
});

app.get("/api/dapps/:id", async (req, res) => {
  await getDapp({ query: { id: req.params.id } }, res);
});

app.post("/api/ai/dapp-finder", async (req, res) => {
  await findDapps(req, res);
});

app.listen(PORT, () => {
  console.log(`Seeker Pulse running at http://localhost:${PORT}`);
});

