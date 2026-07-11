const app = require("./app");

const redisClient = require("./redis/redis");

const PORT = 3000;

redisClient
  .ping()
  .then((result) => {
    console.log("Redis Connected:", result);
  })
  .catch((err) => {
    console.error("Redis Connection Failed:", err);
  });

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});