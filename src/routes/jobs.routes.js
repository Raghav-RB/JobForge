const express = require("express");

const router = express.Router();

const { 
    createJob,
    getJobs,
    createJobSync
     } = require("../controllers/jobs.controller");

router.post("/jobs", createJob);

router.get("/jobs", getJobs);

router.post("/jobs-sync", createJobSync);

module.exports = router;