const redis = require("../src/redis/redis");
const request = require("supertest");
const app = require("../src/app");

beforeEach(async () => {
    await redis.del("jobs");
    await redis.del("failed_jobs");
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

    const jobs = await redis.lrange("jobs", 0, -1);

    expect(jobs.length).toBe(1);

    const job = JSON.parse(jobs[0]);

    expect(job.title).toBe("Learn Jest");
    expect(job.retries).toBe(0);
    expect(job.id).toBeDefined();
    expect(job.createdAt).toBeDefined();
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
});

test("GET /failed-jobs should return failed jobs", async () => {

    await redis.rpush(
        "failed_jobs",
        JSON.stringify({
            id: 1,
            title: "Failed Job",
            retries: 3
        })
    );

    const response = await request(app).get("/failed-jobs");

    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(1);
    expect(response.body[0].title).toBe("Failed Job");
    expect(response.body[0].retries).toBe(3);
});