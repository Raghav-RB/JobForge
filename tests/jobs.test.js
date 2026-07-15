const redis = require("../src/redis/redis");
const request = require("supertest");
const app = require("../src/app");

beforeEach(async () => {
    await redis.del("jobs");
    await redis.del("failed_jobs");
    await redis.del("delayed_jobs");
});

afterAll(async () => {
    await redis.quit();
});

test("GET / should return 404", async () => {
    const response = await request(app).get("/");

    expect(response.statusCode).toBe(404);
});

test("POST /jobs should create a new job", async () => {
    const response = await request(app)
        .post("/jobs")
        .send({
            title: "Learn Jest"
        });

    expect(response.statusCode).toBe(201);
    expect(response.body.message).toBe("Job created successfully");

    expect(response.body.job).toBeDefined();
    expect(response.body.job.title).toBe("Learn Jest");
    expect(response.body.job.retries).toBe(0);
    expect(response.body.job.id).toBeDefined();
    expect(response.body.job.createdAt).toBeDefined();
});

test("GET /jobs should return all jobs", async () => {
    await request(app)
        .post("/jobs")
        .send({
            title: "First Job"
        });

    const response = await request(app).get("/jobs");

    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(1);

    expect(response.body[0].title).toBe("First Job");
    expect(response.body[0].retries).toBe(0);
    expect(response.body[0].id).toBeDefined();
    expect(response.body[0].createdAt).toBeDefined();
});

test("GET /failed_jobs should return failed jobs", async () => {
    await redis.rpush(
        "failed_jobs",
        JSON.stringify({
            id: 1,
            title: "Failed Job",
            retries: 3
        })
    );

    const response = await request(app).get("/failed_jobs");

    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(1);

    expect(response.body[0].title).toBe("Failed Job");
    expect(response.body[0].retries).toBe(3);
});

test("POST /failed_jobs/:id/replay should replay a failed job", async () => {

    const failedJob = {
        id: 1,
        title: "Replay Job",
        retries: 3,
        createdAt: new Date().toISOString(),
    };

    await redis.rpush(
        "failed_jobs",
        JSON.stringify(failedJob)
    );

    const response = await request(app)
        .post("/failed_jobs/1/replay");

    expect(response.statusCode).toBe(200);

    expect(response.body.message).toBe("Job replayed successfully");

    expect(response.body.job.retries).toBe(0);

    const jobs = await redis.lrange("jobs", 0, -1);

    expect(jobs.length).toBe(1);

    const replayedJob = JSON.parse(jobs[0]);

    expect(replayedJob.id).toBe(1);
    expect(replayedJob.title).toBe("Replay Job");
    expect(replayedJob.retries).toBe(0);

    const failedJobs = await redis.lrange("failed_jobs", 0, -1);

    expect(failedJobs.length).toBe(0);

});