import app from "./app";

app.listen(3000, ()=> {
    console.info(`server is listining to port 3000`);

}).on("error", (err) => {
    console.error(`something went wrong while running backend ${err}`);
})