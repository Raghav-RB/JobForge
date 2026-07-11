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