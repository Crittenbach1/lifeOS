import express from "express";
import dotenv from "dotenv";
import { initDB } from "./config/db.js";
import { job } from "./config/cron.js";


dotenv.config();

const app = express();

if (process.env.NODE_ENV==="production")job.start();

app.use(express.json());

app.use((req, res, next) => {
    console.log("Hey we hit a request, the method is", req.method);
    next();
});

const PORT = process.env.PORT || 5001;

app.get("/api/health", (req, res) => {
    res.status(200).json({status:"ok"});
});

app.get("/", (req, res) => {
    res.send("its working");
});


console.log("my port:", process.env.PORT);




initDB().then(() => {
    app.listen(PORT, () => {
        console.log("server is up and running on PORT:", PORT);
    });
});
