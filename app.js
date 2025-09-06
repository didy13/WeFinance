const express = require("express");
const app = express();
const path = require("path");
const routes = require("./routes/routes");
const dotenv = require("dotenv");
dotenv.config();


app.set('views', path.join(__dirname, 'views'));
app.set("view engine", "ejs");
app.use(express.static('public'));
app.use(express.urlencoded({extended: true}));

app.listen(process.env.PORT, () =>
{
    console.log(`Server je pokrenut na portu ${process.env.PORT}`);
})

app.use(routes);

app.use((req,res) => {
    res.status(404).render("404", {title: "404"});
})