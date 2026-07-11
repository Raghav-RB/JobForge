const express = require("express");

const app = express();

app.use(express.json());

const jobRoutes = require("./routes/jobs.routes");

app.use(jobRoutes);

module.exports = app;