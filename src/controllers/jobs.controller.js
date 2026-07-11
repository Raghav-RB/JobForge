const jobQueue = require("../queue/queue");

function delay(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function createJob(req, res) {
    const job = {
        id: Date.now(),
        ...req.body
    }

    jobQueue.push(job);

    res.status(201).json({
        message: "Job created successfully",
        job
    });
}

function getJobs(req, res) {

    res.status(200).json(jobQueue);

}

async function createJobSync(req, res) {

    await delay(5000);

    res.status(200).json({
        message: "Synchronous job completed"
    });

}

module.exports = {
    createJob,
    getJobs,
    createJobSync
};  