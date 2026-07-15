const redisClient = require("../redis/redis");

function delay(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function createJob(req, res) {
    const job = {
        id: Date.now(),
        ...req.body,
        createdAt: new Date().toISOString(),
        retries: 0,
    };

    await redisClient.rpush("jobs", JSON.stringify(job));

    res.status(201).json({
        message: "Job created successfully",
        job,
    });
}

async function getJobs(req, res) {
    const jobs = await redisClient.lrange("jobs", 0, -1);

    const parsedJobs = jobs.map((job) => JSON.parse(job));

    res.status(200).json(parsedJobs);
}

async function getFailedJobs(req, res) {
    const jobs = await redisClient.lrange("failed_jobs", 0, -1);

    const parsedJobs = jobs.map((job) => JSON.parse(job));

    res.status(200).json(parsedJobs);
}

async function replayFailedJob(req, res) {

    const jobId = Number(req.params.id);

    const failedJobs = await redisClient.lrange("failed_jobs", 0, -1);

    const jobString = failedJobs.find((job) => {
        return JSON.parse(job).id === jobId;
    });

    if (!jobString) {
        return res.status(404).json({
            message: "Job not found in Dead Letter Queue",
        });
    }

    const job = JSON.parse(jobString);

    job.retries = 0;

    await redisClient.lrem("failed_jobs", 1, jobString);

    await redisClient.rpush("jobs", JSON.stringify(job));

    res.status(200).json({
        message: "Job replayed successfully",
        job,
    });
}

async function createJobSync(req, res) {
    await delay(5000);

    res.status(200).json({
        message: "Synchronous job completed",
    });
}

module.exports = {
    createJob,
    getJobs,
    getFailedJobs,
    replayFailedJob,
    createJobSync,
};