const redis = require("../redis/redis");

async function startWorker() {
   while (true) {
    const result = await redis.brpop("jobs", 0);

    const job = JSON.parse(result[1]);

    console.log("Processing Job:", job);

    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log("Job Completed:", job.id);
}
}

startWorker();