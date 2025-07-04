import express from "express";
import dotenv from "dotenv";
import { initDB } from "./config/db.js";
import bikeRidesRoute from "./routes/bikeRidesRoute.js";
import incomeRoute from "./routes/incomeRoute.js";

dotenv.config();

const app = express();

app.use(express.json());

app.use((req, res, next) => {
    console.log("Hey we hit a request, the method is", req.method);
    next();
});

const PORT = process.env.PORT || 5001;



app.get("/", (req, res) => {
    res.send("its working");
});


console.log("my port:", process.env.PORT);

app.use("/api/bikeRides", bikeRidesRoute);
app.use("/api/income", incomeRoute);

initDB().then(() => {
    app.listen(PORT, () => {
        console.log("server is up and running on PORT:", PORT);
    });
});
