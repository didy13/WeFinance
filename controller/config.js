const mysql = require("mysql2");
const dotenv = require("dotenv");
const fs = require("fs");
const pg = require("pg");
dotenv.config()

  let connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DBNAME,
    port: process.env.DB_PORT,
    ssl: {
      rejectUnauthorized: true,
      ca: `-----BEGIN CERTIFICATE-----
MIIEQTCCAqmgAwIBAgIUfA4uCud0De6Ju8spJTJnZJOdvTkwDQYJKoZIhvcNAQEM
BQAwOjE4MDYGA1UEAwwvMjU3M2JjOTAtZDg5MC00M2EwLWJmZGQtMmQ4YjAwNmJh
YzBiIFByb2plY3QgQ0EwHhcNMjQxMjA1MTE0ODQ2WhcNMzQxMjAzMTE0ODQ2WjA6
MTgwNgYDVQQDDC8yNTczYmM5MC1kODkwLTQzYTAtYmZkZC0yZDhiMDA2YmFjMGIg
UHJvamVjdCBDQTCCAaIwDQYJKoZIhvcNAQEBBQADggGPADCCAYoCggGBAMKutpvi
uKqJxBcW/lrYPMr2bXnYDYF8L3oRbjt8EWSIi0AzyhPcxU1HHCNVaY1chVxUtvBq
iJKTwV+zNsdheJ1mLMIbd+aENPdTtvsynl1XladbAUM/GQxcTPGjWOAcaEih1OcG
/+mYbEOZMPUrZRQiISaQ+ghfJiwor5BLxS80wA0OBt1vZiEeyk5HqiopGnKJx60X
xFjMkCoWxrKaRYj29R6ehL94FpyUO/uZ0CkyQvU/huvbuv6NJeE1Gc0GEdjpYbLL
G3GB30flAZei06x/sP83pHmiQWblwBoix2KZM517ZBok0S0f++WvyO3q1TX5JrI+
o8iJ1T/3lLYIi+Ftxqo7AdAn9sAlncCWPaGKckj3cCNbsaW5m5sMGJ/CMQcRsPxr
TviEWJYhAaH3Qcfw3EnEYhGjPFiLII4ccUnNlbvyx3HkJRwgEQEeYvxfP2DHq17n
NfP2OldZnJMBTnS0za5QUbiJ1KvupW7pG2ry99zYt+Qoj9CmQ0COWBhCuwIDAQAB
oz8wPTAdBgNVHQ4EFgQUPp41l+1+BjgRP4fHdU1y3Q48ohUwDwYDVR0TBAgwBgEB
/wIBADALBgNVHQ8EBAMCAQYwDQYJKoZIhvcNAQEMBQADggGBAH0I/FAr6vdqAe3m
5elYuPFmfBvzY0JG22lSg0JqvG1CjX6U11ZQLyMyFvm7DfvsE/XmNG2W8fGZVJRU
t6dNPtZaA2ECZ/V88hKwYw405Vq0WHmBDeU0bK2rxJ2aavdUXTbixaFh/b9fOrqr
jF+SAQeLo7rWCdFc0mKfyYHDDTjq0pDiT6qmpYXbKMr7JEo0ZZW9Q3l+Go3k1PVa
wHGvJAp6TNaetuDSPa1AsGks0Wj4ZdO86sm9gXyQazXb4NvZPNZJqVboIGC/ZYD2
aQR2hLfvF7yEV+VbfW2BXXUG6VCTsemecyche39mNwHsuFsMKkAOAlnFYQgoka9G
1lm44Fgt2B0pBaija8UDiuNltyCN5Mq0SRjR75/IwpRhc+ZHXobdwUPmsibk1u7u
bUOOkxv95OYw5dDSI3MWm+W6/ZBM6D0g8BMujobeewJLQpt0CD6NccXF0L/+NIx8
uB884rcAeXXRblrP1MPjZXUFI9aWvWl4+F6zgLu/6SDDbfsLig==
-----END CERTIFICATE-----`,
    },
})

connection.connect((err) => {
  if (err) {
      console.error('Greška pri povezivanju sa bazom: ', err.message);
  } else {
      console.log('Povezano sa MySQL bazom!');
  }
});

  module.exports = connection;