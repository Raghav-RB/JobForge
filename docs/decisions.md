# Engineering Decisions

## Day 1 - Project Foundation & Naive Queue

### 1. Separate `app.js` and `server.js`

**Decision:**
Split Express application configuration from server startup.

**Reason:**
This keeps the application modular and allows the Express app to be imported directly for testing later using Jest and Supertest without starting another HTTP server.

---

### 2. Dedicated Queue Module

**Decision:**
Store the queue in a separate `queue.js` module instead of defining it inside a controller.

**Reason:**
The queue is a shared resource. Controllers, workers, and future retry mechanisms should all access the same queue instance. Node.js module caching ensures every file receives the same shared array.

---

### 3. Use a Job Object

**Decision:**
Wrap incoming request data inside a Job object before storing it.

**Reason:**
The server should manage job metadata such as IDs, status, timestamps, and retry counts rather than relying only on client-provided data.

---

### 4. RESTful API Design

**Decision:**
Use:

- `POST /jobs`
- `GET /jobs`

instead of endpoints like:

- `/createJob`
- `/getJobs`

**Reason:**
The URL represents the resource (`jobs`), while the HTTP method represents the action. This follows REST principles and scales better as the API grows.

---

### 5. In-Memory Queue for Initial Implementation

**Decision:**
Store jobs in a JavaScript array.

**Reason:**
An in-memory queue is simple to implement and helps demonstrate the limitations of RAM storage before introducing Redis in the next phase.

---

### 6. Implement Both Synchronous and Asynchronous Endpoints

**Decision:**
Build both:

- `POST /jobs`
- `POST /jobs-sync`

**Reason:**
Comparing both implementations makes it easier to understand the practical difference between synchronous request processing and asynchronous job processing.

# Day 2 – Redis Lists Integration

## Decision 1: Replace the in-memory queue with Redis

### Problem

The JavaScript array used on Day 1 lived inside the Node.js process.

This caused several limitations:

- Jobs were lost when the server restarted.
- Multiple application instances could not share the queue.
- Only the current Node.js process could access the data.

### Decision

Replace the in-memory array with a Redis List.

### Reason

Redis stores the queue outside the application process, allowing:

- Persistence across server restarts.
- A shared queue for multiple servers.
- Communication between different processes and programming languages.

---

## Decision 2: Store jobs as JSON strings

### Problem

Redis Lists cannot directly store JavaScript objects.

### Decision

Serialize every job using `JSON.stringify()` before storing it and reconstruct it using `JSON.parse()` after reading.

### Reason

JSON provides a portable and language-independent format that can be understood by any Redis client.

---

## Decision 3: Use RPUSH for inserting jobs

### Decision

New jobs are inserted using `RPUSH`.

### Reason

Jobs are added to the tail of the queue, preserving the order in which they are received.

---

## Decision 4: Read jobs using LRANGE

### Decision

Use `LRANGE jobs 0 -1` to retrieve all jobs.

### Reason

This allows inspection of the complete queue without removing any jobs, making it useful for debugging and status APIs.

---

## Decision 5: Prefer BRPOP over polling

### Problem

Using `LPOP` continuously requires workers to repeatedly query Redis even when the queue is empty.

### Decision

Workers will use `BRPOP` instead of repeatedly calling `LPOP`.

### Reason

`BRPOP` blocks until a job becomes available, eliminating unnecessary requests, reducing CPU usage, and providing a more efficient event-driven architecture.

---

## Decision 6: Preserve the naive implementation

### Decision

Keep both implementations in the project:

- `jobs.memory.controller.js`
- `jobs.redis.controller.js`

### Reason

Maintaining both versions documents the architectural evolution of the project, making it easier to compare approaches and explain design decisions during interviews.

# Day 3 – Worker Process and Concurrency

## Decision 1: Separate Producer and Consumer

### Decision

The Express application acts as the Producer, while a dedicated worker process acts as the Consumer.

### Reason

Separating responsibilities allows the API to respond immediately while background jobs are processed independently.

---

## Decision 2: Use a Dedicated Worker Process

### Decision

Implement job processing in `worker.js` instead of inside the Express server.

### Reason

Workers can be started, stopped, restarted, and scaled independently without affecting the API server.

---

## Decision 3: Use BRPOP Inside an Infinite Loop

### Decision

The worker continuously waits for new jobs using:

```javascript
while (true) {
    await redis.brpop("jobs", 0);
}
```

### Reason

`BRPOP` blocks until a job is available, eliminating unnecessary polling while allowing the worker to process jobs continuously.

---

## Decision 4: Run Multiple Worker Processes

### Decision

Allow multiple instances of `worker.js` to consume jobs from the same Redis queue.

### Reason

Redis atomically assigns each job to a single waiting worker, enabling concurrent job processing without duplicate execution.

---

## Decision 5: Accept the Lost Job Limitation

### Problem

A job is removed from Redis immediately after `BRPOP`.

If a worker crashes before completing the job, the job is permanently lost.

### Decision

Do not solve this limitation yet.

### Reason

Understanding this failure mode is essential before introducing retries, acknowledgements, and reliable queues in later stages of the project.

# Day 4 – Retry Mechanism and Failure Handling

## Decision 1: Handle job failures using try-catch

### Problem

A single exception during job processing caused the entire worker process to crash.

### Decision

Wrap the processing logic of each individual job inside a `try...catch` block.

### Reason

A failed job should not stop the worker from processing future jobs. Handling exceptions per job keeps the worker running continuously.

---

## Decision 2: Track retry count inside the job object

### Problem

The worker needs to know how many retry attempts have already been made.

### Decision

Add a `retries` field to every job.

### Reason

Storing retry information with the job allows any worker to continue processing it correctly, even if another worker originally handled previous attempts.

---

## Decision 3: Automatically retry failed jobs

### Decision

If processing fails, increment the retry count and push the job back into the Redis queue.

### Reason

Many failures are temporary (network issues, database timeouts, third-party service outages). Automatic retries improve the likelihood of successful processing without user intervention.

---

## Decision 4: Limit retry attempts

### Problem

Retrying forever creates infinite retry loops and wastes system resources.

### Decision

Introduce a configurable `MAX_RETRIES` limit.

### Reason

After a reasonable number of attempts, the job is considered permanently failed and should no longer consume worker resources.

---

## Decision 5: Accept immediate retries temporarily

### Problem

Immediately retrying failed jobs can create retry storms and repeatedly hit unavailable services.

### Decision

Keep immediate retries for now.

### Reason

The current objective is to understand retry mechanics. Delayed retries and exponential backoff will be implemented later using Redis Sorted Sets.

---

## Decision 6: Discard permanently failed jobs temporarily

### Problem

Jobs exceeding the retry limit are currently removed permanently.

### Decision

Accept this limitation for Day 4.

### Reason

The next architectural improvement is introducing a Dead Letter Queue (DLQ), where permanently failed jobs will be stored for inspection instead of being discarded.

# Day 5 – Dead Letter Queue (DLQ)

## Decision 1: Preserve permanently failed jobs

### Problem

Previously, jobs exceeding the retry limit were discarded permanently.

This made debugging impossible because all information about the failed job was lost.

### Decision

Move permanently failed jobs into a separate Dead Letter Queue.

### Reason

Keeping failed jobs allows engineers to inspect failures, identify root causes, and decide whether a job should be retried or discarded.

---

## Decision 2: Implement the Dead Letter Queue as a Redis List

### Decision

Create a second Redis List named:

failed_jobs

### Reason

A Dead Letter Queue is simply another queue with a different purpose.

Using another Redis List keeps the implementation simple while reusing the same Redis operations already used for the main queue.

---

## Decision 3: Move jobs using RPUSH

### Decision

When a job exceeds the retry limit, insert it into the Dead Letter Queue using:

RPUSH failed_jobs

### Reason

This preserves the order in which jobs permanently failed and maintains FIFO ordering inside the DLQ.

---

## Decision 4: Expose the Dead Letter Queue through an API

### Decision

Create:

GET /failed-jobs

### Reason

Operators should be able to inspect failed jobs without connecting directly to Redis.

Providing an API also keeps debugging consistent with the existing GET /jobs endpoint.

---

## Decision 5: Keep the DLQ read-only

### Problem

Once a job reaches the Dead Letter Queue, there is currently no way to retry or delete an individual job.

### Decision

Accept this limitation for now.

### Reason

TToday's objective is to understand why a Dead Letter Queue exists. Replay functionality is intentionally deferred to a later stage so the core DLQ concept can be understood before adding recovery operations.

# Day 6 – Delayed Jobs and Idempotency

## Decision 1: Delay retries instead of retrying immediately

### Problem

Immediately retrying failed jobs can create retry storms by repeatedly sending requests to already unhealthy services.

### Decision

Move failed jobs into a delayed queue instead of immediately requeueing them.

### Reason

Delaying retries gives external systems time to recover and increases the likelihood that subsequent attempts will succeed while reducing unnecessary load.

---

## Decision 2: Use a Redis Sorted Set for delayed jobs

### Problem

A Redis List preserves insertion order but has no notion of time.

### Decision

Store delayed jobs inside a Redis Sorted Set named:

delayed_jobs

using the retry timestamp as the score.

### Reason

Redis automatically maintains jobs sorted by retry time, allowing the scheduler to efficiently retrieve only the jobs whose retry time has arrived.

---

## Decision 3: Store the retry timestamp as the score

### Decision

Use:

retryAt = Date.now() + RETRY_DELAY

as the ZSET score.

### Reason

The scheduler only needs to retrieve jobs whose retry time is less than or equal to the current time. Using retryAt as the score naturally supports time-based scheduling.

---

## Decision 4: Introduce a dedicated scheduler process

### Problem

Having every worker check delayed jobs wastes resources and violates the Single Responsibility Principle.

### Decision

Create a separate scheduler process responsible for moving ready jobs from the delayed queue back to the main queue.

### Reason

Separating scheduling from job processing keeps workers focused on processing jobs while allowing the scheduler to manage retry timing independently.

---

## Decision 5: Poll the delayed queue every second

### Decision

The scheduler checks the delayed queue once every second using:

ZRANGEBYSCORE delayed_jobs -inf currentTime

### Reason

A one-second polling interval is simple to implement and sufficient for this learning project while demonstrating delayed job scheduling.

---

## Decision 6: Accept the non-atomic scheduler limitation

### Problem

Moving a job back to the main queue currently requires two separate Redis operations:

RPUSH jobs

followed by

ZREM delayed_jobs

If the scheduler crashes between these operations, the same job may exist in both queues and later be processed twice.

### Decision

Accept this limitation for the learning project.

### Reason

The goal is to understand delayed scheduling rather than implement a fully fault-tolerant scheduler. Production systems typically solve this using acknowledgements, atomic operations, or transactional mechanisms.

---

## Decision 7: Discuss idempotency conceptually instead of implementing a naive solution

### Problem

A simple SET ... NX approach introduces another failure window. Marking a job as processed before the business operation completes can permanently lose work if the worker crashes.

### Decision

Do not implement simplified idempotency.

### Reason

Understanding the trade-offs is more valuable than adding an implementation that is known to be unsafe. Production systems typically reduce or eliminate this failure window using techniques such as transactional outbox patterns, downstream idempotency keys, delivery acknowledgements, or broker-managed message visibility. These approaches require infrastructure beyond the scope of this learning project.

# Day 7 – Automated Testing with Jest & Supertest

## Goal

Add automated integration testing to JobForge to verify API behavior without relying on manual Postman testing.

---

## Decisions Taken

### 1. Chose Integration Testing over Unit Testing

Instead of testing individual functions, the project focuses on integration testing because the primary objective is verifying the interaction between Express, Controllers, and Redis.

Flow:

Client
↓
Express
↓
Controller
↓
Redis
↓
Response

This provides greater confidence that the application works correctly as a whole.

---

### 2. Used Supertest

Instead of sending requests through Postman, Supertest was used to simulate HTTP requests directly against the Express application.

Benefits:

- Faster execution
- Repeatable tests
- No browser or Postman required
- Easily integrated with Jest

---

### 3. Test Isolation using beforeEach()

Redis queues are cleared before every test.

Reason:

Each test should be independent.

Without cleanup, data from previous tests could affect later test results, making tests unreliable.

---

### 4. Verified Side Effects

The POST /jobs test verifies both:

- HTTP response
- Data actually stored in Redis

Reason:

A successful response alone does not guarantee the queue was updated correctly.

---

### 5. Seeded Dead Letter Queue Directly

The GET /failed-jobs endpoint is tested by inserting sample data directly into the failed_jobs queue.

Reason:

Creating failed jobs naturally requires worker execution and retry exhaustion, which is beyond the scope of API integration tests.

---

# Day 8 – Replaying Failed Jobs

## Problem

Jobs that exceed the maximum retry limit are moved to the Dead Letter Queue (DLQ). While this prevents endless retry loops, those jobs remain permanently unprocessed even after the original failure has been resolved.

Without a replay mechanism, the only recovery option is manually creating a new job again.

---

## Decision

Implemented a replay endpoint:

POST /failed_jobs/:id/replay

The endpoint performs the following operations:

1. Reads all jobs from the Dead Letter Queue.
2. Finds the requested job using its ID.
3. Removes the job from the Dead Letter Queue.
4. Resets its retry counter to 0.
5. Pushes the job back into the main jobs queue.

The worker treats the replayed job exactly like a newly created job.

---

## Why this approach?

The Dead Letter Queue is expected to contain relatively few jobs compared to the main queue.

Because Redis Lists do not support direct lookup by ID, scanning the DLQ using `LRANGE` before replaying a job is an acceptable trade-off while keeping the implementation simple.

This endpoint models a common operational workflow where failed jobs are replayed only after the underlying issue has been resolved.

---

## Alternatives Considered

### Replay all failed jobs

Rejected.

Replaying every failed job at once could unnecessarily retry jobs whose failures have not yet been resolved.

### Leave failed jobs permanently in the DLQ

Rejected.

Operators should have a simple recovery mechanism instead of manually recreating jobs.

---

## Consequences

### Advantages

- Failed jobs can be recovered.
- Original job metadata is preserved.
- Retry count starts fresh.
- Worker logic remains unchanged.
- Simple operational workflow.

### Trade-offs

- Requires manual replay.
- Linear search through the Dead Letter Queue.
- No bulk replay support.

## Outcome

Added automated integration tests covering:

- GET /
- POST /jobs
- GET /jobs
- GET /failed-jobs
- POST/failed_jobs/:id/replay

The project now includes automated verification of its primary REST APIs.

## Why Worker Logic Was Left Unchanged

The replay endpoint simply places the selected job back into the main Redis queue after resetting its retry count.

Because replayed jobs follow exactly the same execution path as newly created jobs, the worker requires no additional replay-specific logic.

Keeping the worker unaware of replay operations preserves the separation of responsibilities and keeps job processing independent of how jobs entered the queue.