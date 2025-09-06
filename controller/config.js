const mysql = require("mysql2");
const dotenv = require("dotenv");
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
MIIEUDCCArigAwIBAgIUeJU6z7zR1hm33uV+frjypEOY7QIwDQYJKoZIhvcNAQEM
BQAwQDE+MDwGA1UEAww1ODJlOTg0NWEtZTIyNS00NDU3LTg4NGUtNGVlM2U0NzBm
NDYxIEdFTiAxIFByb2plY3QgQ0EwHhcNMjUwOTA2MDkzMzUwWhcNMzUwOTA0MDkz
MzUwWjBAMT4wPAYDVQQDDDU4MmU5ODQ1YS1lMjI1LTQ0NTctODg0ZS00ZWUzZTQ3
MGY0NjEgR0VOIDEgUHJvamVjdCBDQTCCAaIwDQYJKoZIhvcNAQEBBQADggGPADCC
AYoCggGBALKke8EZYTM7vIbLyr4uAqcbiPaJjHZCkgM1y0oXIlw3lod0pJKHSZk3
wjRNdcWWCWWSHSa007E+pJIi+iaNBenP7CsW3QCD0m1H+sXBUHNEPTb2HqRktB8x
zCt5hsyIh7WCfFRBEMrJoPeVtYT782jhAGp8O6Em2sqBIfqRJAVS7vJcnf/UhvRK
qFCXeLI6NhJdUy1duNALyilFMVX7gyMtrrPqu8CDLFX9JBIQ3DUr/EQTQQebIHmE
ztoA3b/u7QLYWuvj6Ue3ZbTjI33/ZGqeBGC6CwYzAo+I6CzBchayZoh4SqMGR+wd
/AXC0TGeKvpm3/TofCrumFG2FQlBF0/w0SBNJCSZRSzWayQQHdCqfaAVTIaorxA/
8MEF7f5ArYBzX5pRyKJ8uFw1HQsVOv1oFsYaeDNUKrZk/wZrwppT5aohYERGlVhn
ziurmGffF0Wcn4oGPQ6+tw6zVW977/b9nKDfeebJ/9uNzdWvMmght5IPuOoX6DY8
HIHaTJ6EEQIDAQABo0IwQDAdBgNVHQ4EFgQUMBrM685hU1jSHXNpsQcWHzoYis4w
EgYDVR0TAQH/BAgwBgEB/wIBADALBgNVHQ8EBAMCAQYwDQYJKoZIhvcNAQEMBQAD
ggGBAADkuKXCJd3bzKC1Bscgt4L7ek8q5JvMSMRz/e9MaWeoCLP/kiXAIHZq1p4r
hlifKEQQ/hmrkamNGno3Mf6SmNEPz1YawPd7vffQ/0tA9YUnF733BzjzOjiD3m7U
g4sTK6yBl/LolzIZquc551myYgBbk42otai1Om5RN14yY03TtedSDA0Gnbu4Do6P
rglOTDfFeMOGDMcDCjtWIYyosMmxMlJTzkoeLd1BmhuR4waz85e/naZ9861AW7yv
J2i+uzIs9Bwr57L/nuKoZmm/ZeBbtABi72gUxom+PL688rMk8AB8k1aq5fG9lRJ1
3iSLXEznot2PCHYiQ2NMtHvvOA6jd50Hz7JisXO+114/twKtkkE+DjYOK5gAuolH
HXTBJmF1KIphBCR9xVzEdLaYQgaF5GlxvuPrl+rk+6c3IAEBzCObIPPfdcGviUV8
kHabpjq88nOU+DkKtykV6xrF4I9d1BUK6dnFRqgDgsZXnom+sZ8MKeztg8qGZrnF
TyeD+w==
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