import connectDB from "./db/index.js";
import app from "./app.js";

const PORT = process.env.PORT || 8080;

connectDB()
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port: ${PORT}`);
    });

    server.on("error", (err) => {
      console.error("Server listen error:", err);
      process.exit(1);
    });
  })
  .catch((err) => {
    console.error("MONGO DB connection failed", err);
    process.exit(1);
  });