const redis = require("../redis/redis");

const MAX_RETRIES = 3;
const BACKOFF = 10000;

async function startWorker() {
    while (true) {

        const result = await redis.brpop("jobs", 0);
        const job = JSON.parse(result[1]);

        try {

            console.log("Processing Job:", job);

            await new Promise((resolve) => setTimeout(resolve, 5000));

            if (job.title === "fail") {
                throw new Error("Simulated Job Failure");
            }

            console.log("Job Completed:", job.id);

        } catch (error) {

            console.log(`Job ${job.id} failed.`);
            console.log("Retry Count:", job.retries);

            if (job.retries < MAX_RETRIES) {

                job.retries++;

                const retryAt = Date.now() + BACKOFF;

                await redis.zadd("delayed_jobs", retryAt , JSON.stringify(job));

                console.log(`Job ${job.id} scheduled for retry at ${new Date(retryAt).toLocaleTimeString()}`);
                
            } else {

                await redis.rpush("failed_jobs", JSON.stringify(job));
                
                console.log(`Job ${job.id} exceeded max retries (${MAX_RETRIES}). Moved to Dead Letter Queue.`);
            }
        }
    }
}

startWorker();