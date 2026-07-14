const redis = require("../redis/redis");

async function startScheduler() {

    while (true) {

        const readyJobs = await redis.zrangebyscore(
            "delayed_jobs",
            "-inf",
            Date.now()
        );

        for (const jobString of readyJobs) {

            const job = JSON.parse(jobString);

            await redis.rpush("jobs", jobString);

            await redis.zrem("delayed_jobs", jobString);

            console.log(`Moved Job ${job.id} back to main queue`);
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

}

startScheduler();