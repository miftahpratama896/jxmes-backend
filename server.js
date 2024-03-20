const express = require("express");
const bodyParser = require("body-parser");
const sql = require("mssql");
const cors = require("cors"); // Tambahkan modul cors
const os = require("os"); // Tambahkan modul os

const app = express();
const port = 3000;

// Database configuration
const config = {
  user: "sa",
  password: "Pai2015",
  server: "172.16.200.28",
  database: "JX2MES",
  options: {
    encrypt: false, // for Azure
    requestTimeout: 60000,
  },
};

// Middleware setup
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

// Function untuk mendapatkan alamat IP lokal sistem
function getClientIpAddress(req) {
  return (
    req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket.remoteAddress
  );
}
// Endpoint untuk menyimpan data statistik ke TB_MENU_STATISTICS
app.post("/api/log-menu-access", async (req, res) => {
  const { division, menuName, programName, userID } = req.body;

  // Mengambil alamat IP klien yang mengakses aplikasi
  const ipAddress = getClientIpAddress(req);

  try {
    // Buka koneksi ke database
    await sql.connect(config);

    // Mendapatkan waktu akses saat ini
    const currentTime = new Date();
    // Eksekusi perintah SQL untuk insert data
    await sql.query`
      INSERT INTO TB_MENU_STATISTICS (DIVISION, MENU_NM, PGM_NM, ID, IP, ACCESS_TIME)
      VALUES (${division}, ${menuName}, ${programName}, ${userID}, ${ipAddress}, ${currentTime})
    `;

    // Kirim respons sukses
    res.status(200).json({ message: "Menu access logged successfully" });
  } catch (error) {
    // Tangani kesalahan jika terjadi
    console.error("Error inserting to TB_MENU_STATISTICS:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Endpoint untuk pemeriksaan login
app.post("/login", async (req, res) => {
  const { user_id, password } = req.body;

  try {
    // Koneksi ke database
    await sql.connect(config);

    // Jalankan query
    const result = await sql.query`
      SELECT USER_ID, PASSWORD, USE_YN
      FROM TB_USER WITH (NOLOCK)
      WHERE USER_ID = ${user_id} AND PASSWORD = ${password}
    `;

    // Cek apakah ada hasil dari query
    if (result.recordset.length > 0) {
      // Jika ada pengguna dengan user_id dan password yang sesuai, kirim respons berhasil
      res.status(200).json({ message: "Login successful" });
    } else {
      // Jika tidak ada hasil, kirim respons gagal
      res.status(401).json({ message: "Invalid credentials" });
    }
  } catch (error) {
    // Tangani kesalahan
    console.error("Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// API endpoint for calling the stored procedure
app.post("/api/monitoring", async (req, res) => {
  try {
    // Connect to the database
    await sql.connect(config);

    // Get the PROD_DATE from the request body
    const { PROD_DATE } = req.body;

    // Call the stored procedure
    const result = await sql.query`
        EXEC [dbo].[SP_UI_TR_MONITORING] @PROD_DATE = ${PROD_DATE}
      `;

    // Send the result as JSON
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/product-detail", async (req, res) => {
  try {
    const {
      DATEFROM,
      DATETO,
      WC,
      TYPE,
      SCAN_LINE,
      RLS,
      STYLE_NAME,
      STYLE,
      GENDER,
      C_CEK,
      PLANT,
    } = req.query;

    await sql.connect(config);
    const request = new sql.Request();
    request.input("DATEFROM", sql.VarChar(10), DATEFROM);
    request.input("DATETO", sql.VarChar(10), DATETO);
    request.input("WC", sql.VarChar(20), WC);
    request.input("TYPE", sql.VarChar(10), TYPE);
    request.input("SCAN_LINE", sql.VarChar(3), SCAN_LINE);
    request.input("RLS", sql.VarChar(6), RLS);
    request.input("STYLE_NAME", sql.VarChar(30), STYLE_NAME);
    request.input("STYLE", sql.VarChar(20), STYLE);
    request.input("GENDER", sql.VarChar(10), GENDER);
    request.input("C_CEK", sql.Int, C_CEK);
    request.input("PLANT", sql.VarChar(10), PLANT);

    const result = await request.execute("SP_UI_TR_PRODUCT_DETAIL");
    console.log(result);
    res.send(result.recordsets);
  } catch (err) {
    console.error(err);
    res.status(500).send("Terjadi kesalahan dalam menjalankan prosedur.");
  }
});

app.post("/api/call-stored-procedure", async (req, res) => {
  try {
    // Buka koneksi ke SQL Server
    await sql.connect(config);

    // Eksekusi stored procedure
    const result = await sql.query`
        EXEC SP_UI_TR_PRODUCT_TIME
          @YESDAY_DATE = ${req.body.YESDAY_DATE},
          @TODAY_DATE = ${req.body.TODAY_DATE},
          @PLANT = ${req.body.PLANT},
          @WC = ${req.body.WC},
          @C_TIME = ${req.body.C_TIME}
      `;

    console.log("Sending response:", result.recordsets);

    res.json(result.recordsets);
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/product-pcard", async (req, res) => {
  try {
    // Mendapatkan nilai parameter dari query string
    const {
      prodDateFrom,
      prodDateTo,
      scanCell,
      cStyle,
      cStyleName,
      cRls,
      cGender,
      cCek,
      cCekDate,
      cCekNull,
      cReq,
      wc,
      plant,
      jxCell,
      iGubun,
    } = req.query;

    // Membuat koneksi ke database
    await sql.connect(config);

    // Menjalankan stored procedure dengan parameter yang diterima dari query string
    const result = await sql.query(`
        EXEC [dbo].[SP_UI_TR_PRODUCT_BARCODE] 
          @PROD_DATE_FROM = '${prodDateFrom}',
          @PROD_DATE_TO = '${prodDateTo}',
          @SCAN_CELL = '${scanCell}',
          @C_STYLE = '${cStyle}',
          @C_STYLENAME = '${cStyleName}',
          @C_RLS = '${cRls}',
          @C_GENDER = '${cGender}',
          @C_CEK = ${cCek},
          @C_CEK_DATE = ${cCekDate},
          @C_CEK_NULL = ${cCekNull},
          @C_REQ = '${cReq}',
          @WC = '${wc}',
          @PLANT = '${plant}',
          @JX_CELL = '${jxCell}',
          @I_GUBUN = ${iGubun}
      `);

    // Mengirimkan hasil dari stored procedure sebagai respons
    res.json(result.recordset);
  } catch (err) {
    // Menangani kesalahan jika terjadi
    console.error(err);
    res
      .status(500)
      .send("Terjadi kesalahan dalam menjalankan stored procedure.");
  }
});

app.post("/product-personel", async (req, res) => {
  try {
    // Membuka koneksi dengan database
    await sql.connect(config);

    // Menjalankan stored procedure dengan parameter yang diberikan
    const result = await sql.query(`
        EXEC [dbo].[SP_UI_TR_PRODUCT_PERSONNEL]
          @i_DATE = '${req.body.i_DATE}',
          @D_DEPTNAME_MAIN = '${req.body.D_DEPTNAME_MAIN}',
          @D_DEPTNAME_MID = '${req.body.D_DEPTNAME_MID}',
          @C_GUBUN = ${req.body.C_GUBUN}
      `);

    // Mengembalikan hasil dari eksekusi stored procedure
    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error("Error executing stored procedure:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

app.get("/product-nosew-mesin", async (req, res) => {
  try {
    // Buat koneksi pool
    await sql.connect(config);

    // Parameter untuk stored procedure yang diberikan melalui query string
    const { TODAY, D_SHIFT, D_PLANT } = req.query;

    // Eksekusi stored procedure dengan parameter dari query string
    const result = await sql.query`
        EXEC [dbo].[SP_UI_TR_PRODUCT_NOSEW_MESIN] 
          @TODAY = ${TODAY},
          @D_SHIFT = ${D_SHIFT},
          @D_PLANT = ${D_PLANT}
      `;

    // Kirim hasil eksekusi sebagai respons
    res.json(result.recordset);
  } catch (err) {
    // Tangani kesalahan jika terjadi
    console.error("Error executing stored procedure:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/product-kk-material", async (req, res) => {
  try {
    // Mengambil parameter dari body request
    const { DATEFROM, DATETO, RLSFROM, RLSTO, STYLE_NAME, STYLE, DEPT } =
      req.body;

    // Membuat koneksi ke database
    await sql.connect(config);

    // Membuat instance request
    const request = new sql.Request();

    // Menambahkan parameter ke request
    request.input("DATEFROM", sql.VarChar(10), DATEFROM);
    request.input("DATETO", sql.VarChar(10), DATETO);
    request.input("RLSFROM", sql.VarChar(6), RLSFROM);
    request.input("RLSTO", sql.VarChar(6), RLSTO);
    request.input("STYLE_NAME", sql.VarChar(30), STYLE_NAME);
    request.input("STYLE", sql.VarChar(20), STYLE);
    request.input("DEPT", sql.VarChar(50), DEPT);

    // Eksekusi stored procedure
    const result = await request.execute("SP_UI_TD_MAT_DAY_KK");

    // Mengembalikan hasil dari stored procedure sebagai response
    res.json(result.recordset);
  } catch (error) {
    // Mengembalikan error jika terjadi masalah
    res.status(500).json({ error: error.message });
  }
});

app.post("/product-material-balance", async (req, res) => {
  try {
    // Membuka koneksi ke database
    await sql.connect(config);

    // Mendapatkan data dari body request
    const { RLSFROM, RLSTO, STYLE_NAME, STYLE } = req.body;

    // Menjalankan prosedur dengan parameter yang diberikan
    const result = await sql.query`
        EXEC [dbo].[SP_UI_V_MAT_SET_BAL]
          @RLSFROM = ${RLSFROM},
          @RLSTO = ${RLSTO},
          @STYLE_NAME = ${STYLE_NAME},
          @STYLE = ${STYLE};
      `;

    // Mengirimkan hasil prosedur sebagai respons
    res.json(result.recordset);
  } catch (error) {
    console.error("Error executing procedure:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/product-sewing-mesin-counter", async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.body; // Menerima parameter dari body request

    // Validasi parameter
    if (!dateFrom || !dateTo) {
      return res.status(400).send("Parameter dateFrom dan dateTo diperlukan.");
    }

    // Koneksi ke database
    await sql.connect(config);

    // Eksekusi prosedur tersimpan dengan parameter dari frontend
    const result = await sql.query(`
        EXEC [dbo].[SP_UI_TR_SEWING_MESIN_PROD]
        @DATEFROM = '${dateFrom}',
        @DATETO = '${dateTo}'
      `);

    res.status(200).json(result.recordset); // Mengirimkan hasil eksekusi prosedur sebagai response
  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).send("Terjadi kesalahan saat mengeksekusi prosedur.");
  }
});

app.post("/product-daily-prod-trend", async (req, res) => {
  try {
    const { dateFrom, dateTo, wc, plant } = req.body;

    await sql.connect(config);
    const result =
      await sql.query`EXEC SP_UI_TR_PRODUCT_TREND ${dateFrom}, ${dateTo}, ${wc}, ${plant}`;
    res.json(result.recordset);
  } catch (err) {
    console.error("Error executing stored procedure:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/product-spk-balance", async (req, res) => {
  try {
    await sql.connect(config);

    const request = new sql.Request();

    // Mengatur parameter stored procedure berdasarkan request body
    request.input("SPK_DATE_FROM", sql.VarChar(10), req.body.SPK_DATE_FROM);
    request.input("SPK_DATE_TO", sql.VarChar(10), req.body.SPK_DATE_TO);
    request.input("WC", sql.VarChar(10), req.body.WC);
    request.input("STYLE", sql.VarChar(20), req.body.STYLE);
    request.input("STYLE_NAME", sql.VarChar(30), req.body.STYLE_NAME);
    request.input("GENDER", sql.VarChar(10), req.body.GENDER);
    request.input("TYPE", sql.Int, req.body.TYPE);
    request.input("JXLINE", sql.VarChar(2), req.body.JXLINE);

    // Eksekusi stored procedure
    const result = await request.execute("SP_UI_TR_PRODUCT_SPK_BAL");

    // Mengembalikan hasil eksekusi stored procedure sebagai respons
    res.json(result.recordsets);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/product-laminating", async (req, res) => {
  try {
    // Koneksi ke database
    await sql.connect(config);

    // Eksekusi prosedur dengan parameter yang diterima dari body request
    const result = await sql.query(`
        DECLARE @L_QRCODE VARCHAR(35) = '${req.body.L_QRCODE}',
                @L_PRODATE VARCHAR(10) = '${req.body.L_PRODATE}',
                @L_RLS VARCHAR(6) = '${req.body.L_RLS}',
                @L_STYLE VARCHAR(9) = '${req.body.L_STYLE}',
                @L_PROCESS VARCHAR(255) = '${req.body.L_PROCESS}',
                @L_PARTCODE VARCHAR(3) = '${req.body.L_PARTCODE}',
                @L_MESINNAME VARCHAR(40) = '${req.body.L_MESINNAME}',
                @L_MESINNO VARCHAR(2) = '${req.body.L_MESINNO}',
                @L_QTY VARCHAR(3) = '${req.body.L_QTY}',
                @L_STATUS VARCHAR(20) = '${req.body.L_STATUS}',
                @L_TYPE VARCHAR(20) = '${req.body.L_TYPE}',
                @L_CEK INT = ${req.body.L_CEK},
                @L_TO_RLS VARCHAR(6) = '${req.body.L_TO_RLS}',
                @L_MODEL VARCHAR(200) = '${req.body.L_MODEL}',
                @L_PARTNAME VARCHAR(200) = '${req.body.L_PARTNAME}',
                @L_TODATE VARCHAR(10) = '${req.body.L_TODATE}',
                @L_QTY_CEK INT = ${req.body.L_QTY_CEK};
  
        EXEC dbo.SP_UI_TR_PROD_LAMI @L_QRCODE, @L_PRODATE, @L_RLS, @L_STYLE, @L_PROCESS, @L_PARTCODE, @L_MESINNAME, @L_MESINNO, @L_QTY, @L_STATUS, @L_TYPE, @L_CEK, @L_TO_RLS, @L_MODEL, @L_PARTNAME, @L_TODATE, @L_QTY_CEK;
      `);

    res.send(result.recordsets[0]); // Mengirim hasil dari prosedur sebagai response
  } catch (err) {
    console.error("Error executing procedure:", err);
    res.status(500).send("Error executing procedure");
  }
});

// API endpoint to call the stored procedure
app.post("/getDailyProductionStatus", async (req, res) => {
  try {
    // Connect to MSSQL
    await sql.connect(config);

    // Call the stored procedure with the provided parameters
    const result = await sql.query`
        EXEC SP_UI_TR_DAILY_PRODUCTION_STATUS 
          @DATEFROM = ${req.body.DATEFROM},
          @DATETO = ${req.body.DATETO},
          @WC = ${req.body.WC},
          @PLANT = ${req.body.PLANT},
          @RDO_CEK = ${req.body.RDO_CEK}
      `;

    // Send the result as JSON
    res.json(result.recordset);
  } catch (err) {
    // Handle errors
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/api/product-result-target", async (req, res) => {
  try {
    // Mendapatkan parameter dari body request
    const { DATEFROM, DATETO, PLANT, D_CEK, D_ST } = req.body;

    // Membuat koneksi ke database
    await sql.connect(config);

    // Mengeksekusi stored procedure dengan parameter yang diberikan
    const result = await sql.query(`
        EXEC SP_UI_TR_PRODUCT_REUST_TARGET
          @DATEFROM = '${DATEFROM}',
          @DATETO = '${DATETO}',
          @PLANT = '${PLANT}',
          @D_CEK = ${D_CEK},
          @D_ST = ${D_ST};
      `);

    // Mengirimkan hasil ke client
    res.json({ success: true, result: result.recordset });
  } catch (error) {
    // Menangani error
    console.error(error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

// route to get all data from stored procedure
app.post('/po-balance', async (req, res) => {
  try {
    // Koneksi ke basis data
    await sql.connect(config);

    // Menjalankan prosedur tersimpan dengan parameter yang diterima dari body request
    const result = await sql.query`
      EXEC SP_UI_TR_PO_BALANCE 
        @FROM_RLS = ${req.body.FROM_RLS},
        @TO_RLS = ${req.body.TO_RLS},
        @PO = ${req.body.PO},
        @STYLE = ${req.body.STYLE},
        @MODEL = ${req.body.MODEL}
    `;

    // Menutup koneksi setelah selesai
    await sql.close();

    // Mengirimkan hasil eksekusi prosedur tersimpan sebagai respons
    res.json(result.recordset);
  } catch (error) {
    console.error('Error executing stored procedure:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/po-balance-modal', async (req, res) => {
  try {
    // Membuka koneksi ke database
    await sql.connect(config);

    // Mendapatkan data dari request
    const { JXLINE, WC, RLS, PO, STYLE, ASSY_INPUT, D_SIZE, CEK_GUBUN } = req.body;

    // Mengeksekusi stored procedure
    const result = await sql.query`EXEC SP_UI_TR_PO_BALANCE_POP ${JXLINE}, ${WC}, ${RLS}, ${PO}, ${STYLE}, ${ASSY_INPUT}, ${D_SIZE}, ${CEK_GUBUN}`;

    // Menutup koneksi database
    await sql.close();

    // Mengirimkan hasil eksekusi stored procedure sebagai respons
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('Error executing stored procedure:', err);
    res.status(500).json({ success: false, error: 'Error executing stored procedure' });
  }
});

app.post("/inventory", async (req, res) => {
  try {
    // Membuka koneksi ke database
    await sql.connect(config);

    // Mengeksekusi prosedur dengan parameter yang diterima dari body request
    const result = await sql.query(`
        EXEC [dbo].[SP_UI_TR_INVENTORY]
          @STOCK_DATE = '${req.body.STOCK_DATE}',
          @PLANT = '${req.body.PLANT}',
          @WC = '${req.body.WC}',
          @SCAN_LINE = '${req.body.SCAN_LINE}',
          @RLS = '${req.body.RLS}',
          @STYLE = '${req.body.STYLE}',
          @STYLE_NAME = '${req.body.STYLE_NAME}',
          @GENDER = '${req.body.GENDER}',
          @C_CEK = ${req.body.C_CEK}
      `);

    // Mengembalikan hasil eksekusi prosedur sebagai respons
    res.json(result.recordset);
  } catch (error) {
    // Menangani kesalahan
    console.error("Error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Define the route to execute the stored procedure
app.post("/inventory-long-term", async (req, res) => {
  try {
    const pool = await sql.connect(config);

    const {
      STOCK_DATE,
      S_DAY,
      WC,
      SCAN_LINE,
      RLS,
      STYLE_NAME,
      STYLE,
      GENDER,
      C_CEK,
      PLANT,
    } = req.body;

    const result = await pool
      .request()
      .input("STOCK_DATE", sql.VarChar(10), STOCK_DATE)
      .input("S_DAY", sql.Int, S_DAY)
      .input("WC", sql.VarChar(10), WC)
      .input("SCAN_LINE", sql.VarChar(3), SCAN_LINE)
      .input("RLS", sql.VarChar(6), RLS)
      .input("STYLE_NAME", sql.VarChar(30), STYLE_NAME)
      .input("STYLE", sql.VarChar(20), STYLE)
      .input("GENDER", sql.VarChar(10), GENDER)
      .input("C_CEK", sql.Int, C_CEK)
      .input("PLANT", sql.VarChar(3), PLANT)
      .execute("SP_UI_TR_INVENTORY_LONG_TERM");

    res.json(result.recordsets);
  } catch (err) {
    console.error("Error executing stored procedure:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/inventory-mesin", async (req, res) => {
  try {
    // Membuat koneksi dengan database
    await sql.connect(config);

    // Mengeksekusi stored procedure dengan parameter yang diberikan
    const result = await sql.query(`
        EXEC SP_UI_TR_INVENTORY_MESIN 
          @D_DATE = '${req.body.D_DATE}',
          @D_PLANT = '${req.body.D_PLANT}',
          @D_WC = '${req.body.D_WC}',
          @D_LINE = '${req.body.D_LINE}',
          @D_MESINCODE = '${req.body.D_MESINCODE}',
          @D_MESINNAME = '${req.body.D_MESINNAME}',
          @D_MESINBRAND = '${req.body.D_MESINBRAND}',
          @D_CEK_SEQ = ${req.body.D_CEK_SEQ}
      `);

    res.status(200).json(result.recordsets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error executing stored procedure" });
  }
});

app.get("/inventory-summary", async (req, res) => {
  try {
    // Membuat koneksi ke database
    await sql.connect(config);

    // Mengeksekusi prosedur tersimpan dengan parameter yang diterima dari request
    const result = await sql.query(`
      EXEC [dbo].[SP_UI_TR_INVENTORY_SUMMARY] 
        @STOCK_DATE = '${req.query.stockDate}',
        @WC = '${req.query.workCenter}',
        @CEK = ${req.query.checkValue}
    `);

    // Mengirimkan hasil query sebagai respons
    res.send(result.recordset);
  } catch (err) {
    console.error("Error executing procedure:", err);
    res.status(500).send("Error executing procedure");
  }
});

app.post("/daily-prod-report", async (req, res) => {
  try {
    // Membuat koneksi pool
    const pool = await sql.connect(config);

    // Ekstrak parameter dari body request
    const { PROD_DATE, TO_DATE, PLANT, TYPE } = req.body;

    // Membuat instance request
    const request = pool.request();

    // Menambahkan parameter ke request
    request.input("PROD_DATE", sql.VarChar(10), PROD_DATE);
    request.input("TO_DATE", sql.VarChar(10), TO_DATE);
    request.input("PLANT", sql.VarChar(20), PLANT);
    request.input("TYPE", sql.VarChar(10), TYPE);

    // Menjalankan stored procedure
    const result = await request.execute("SP_UI_TR_PROD_REPORT");

    // Mengirimkan hasil dari stored procedure sebagai respons
    res.json(result.recordset);
  } catch (err) {
    console.error("Error occurred:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/scan-jx2-jx", async (req, res) => {
  try {
    // Buat koneksi ke database
    await sql.connect(config);

    // Ekstrak parameter dari body request
    const {
      FROM_DATE,
      TO_DATE,
      LINE_JX2,
      CELL_JX,
      PLANT,
      D_STYLE,
      D_MODEL,
      D_GENDER,
      D_RLS,
      D_BARCODE,
      D_CHEK,
      CEK_IP,
    } = req.body;

    // Definisikan query SQL untuk menjalankan prosedur tersimpan
    const result = await sql.query`
        EXEC [dbo].[SP_UI_PRT_SCAN_STATUS_JX]
          @FROM_DATE = ${FROM_DATE},
          @TO_DATE = ${TO_DATE},
          @LINE_JX2 = ${LINE_JX2},
          @CELL_JX = ${CELL_JX},
          @PLANT = ${PLANT},
          @D_STYLE = ${D_STYLE},
          @D_MODEL = ${D_MODEL},
          @D_GENDER = ${D_GENDER},
          @D_RLS = ${D_RLS},
          @D_BARCODE = ${D_BARCODE},
          @D_CHEK = ${D_CHEK},
          @CEK_IP = ${CEK_IP}
      `;

    // Kirim response dengan hasil dari prosedur
    res.json(result.recordset);
  } catch (err) {
    // Tangani kesalahan jika koneksi atau eksekusi prosedur gagal
    console.error("Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post('/daily-prod-qty-trend', async (req, res) => {
  try {
    // Membuka koneksi dengan database
    await sql.connect(config);

    // Mengambil parameter dari body request
    const { fromDate, toDate } = req.body;

    // Mengeksekusi prosedur tersimpan dengan parameter yang diberikan
    const result = await sql.query(`
      EXEC SP_UI_TR_DAILY_PROD_QTY_TREND 
        @FROM_DATE = '${fromDate}', 
        @TO_DATE = '${toDate}'
    `);

    // Mengirimkan hasil eksekusi prosedur sebagai respons
    res.json(result.recordset);
  } catch (err) {
    // Mengirimkan pesan error jika terjadi kesalahan
    console.error(err.message);
    res.status(500).send('Internal Server Error');
  } 
});


app.post("/setting-sewingQTY", async (req, res) => {
  try {
    // Terhubung ke database
    await sql.connect(config);

    // Ekstrak parameter dari body request
    const {
      D_DATE,
      D_ASSY_LINE,
      D_ASSY_TARGET,
      D_SEWING_LINE,
      D_SETTING_MARKET,
      D_DI_CUTTING,
      D_DONE_DI_UPS,
      D_AVAIABLE_SETTING,
      D_ACTION,
      D_REMARKS,
      D_SAVE,
    } = req.body;

    // Membuat request baru
    const request = new sql.Request();

    // Menambahkan parameter ke dalam request
    request.input("D_DATE", sql.VarChar(10), D_DATE);
    request.input("D_ASSY_LINE", sql.VarChar(2), D_ASSY_LINE);
    request.input("D_ASSY_TARGET", sql.Int, D_ASSY_TARGET);
    request.input("D_SEWING_LINE", sql.VarChar(4), D_SEWING_LINE);
    request.input("D_SETTING_MARKET", sql.Int, D_SETTING_MARKET);
    request.input("D_DI_CUTTING", sql.Int, D_DI_CUTTING);
    request.input("D_DONE_DI_UPS", sql.Int, D_DONE_DI_UPS);
    request.input("D_AVAIABLE_SETTING", sql.Int, D_AVAIABLE_SETTING);
    request.input("D_ACTION", sql.VarChar(255), D_ACTION);
    request.input("D_REMARKS", sql.VarChar(255), D_REMARKS);
    request.input("D_SAVE", sql.Int, D_SAVE);

    // Menjalankan stored procedure sesuai dengan kondisi D_SAVE
    const result = await request.execute("SP_UI_PRT_TR_SETTING_SEWING_QTY");

    // Mengirimkan response
    res.send(result.recordsets);
  } catch (err) {
    console.error("Error:", err);
    res
      .status(500)
      .send("Terjadi kesalahan saat menjalankan stored procedure.");
  }
});

// Start the Express server
app.listen(port, "172.16.200.28", () => {
  console.log(`Server is running on http://172.16.200.28:${port}`);
});
