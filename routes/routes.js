const express = require("express");

const router = express.Router();
const connection = require("../control/config");

router.get("/", (req,res)=>{
    res.render("index", {title: "Home"});
})

module.exports = router;