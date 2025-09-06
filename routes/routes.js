const express = require("express");

const router = express.Router();
const connection = require("../control/config");

router.get("/", (req,res)=>{
    res.render("index", {title: "Home", active1: "active", active2: "", active3: ""});
})

module.exports = router;