const redis = require("../redis/redis");

const MAX_RETRIES = 3;

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

            job.retries++;

            console.log(`Job ${job.id} failed.`);
            console.log("Retry Count:", job.retries);

            if (job.retries <= MAX_RETRIES) {

                await redis.rpush("jobs", JSON.stringify(job));

                console.log(`Retrying Job ${job.id} (${job.retries}/${MAX_RETRIES})`);
                
            } else {

                console.log(`Job ${job.id} permanently failed after ${job.retries} retries.`);
            }
        }
    }
}

startWorker();