const express = require("express");

const router = express.Router();
const connection = require("../controller/config");

router.get("/", (req,res)=>{
    res.render("index", {title: "Home"});
})

module.exports = router;