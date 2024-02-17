const express = require('express');
const bodyParser = require('body-parser');
const sql = require('mssql');
const cors = require('cors'); // Tambahkan modul cors

const app = express();
const port = 3000;

// Database configuration
const config = {
  user: 'sa',
  password: 'Pai2015',
  server: '172.16.200.28',
  database: 'JX2MES',
  options: {
    encrypt: false, // for Azure
    requestTimeout: 60000,
  },
};

// Middleware setup
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());


// API endpoint for calling the stored procedure
app.post('/api/monitoring', async (req, res) => {
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
      res.status(500).send('Internal Server Error');
    } finally {
      // Close the database connection
      sql.close();
    }
  });

  app.post('/api/call-stored-procedure', async (req, res) => {
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
  
      // Tutup koneksi SQL Server
      await sql.close();
  
      console.log('Sending response:', result.recordsets);
  
      res.json(result.recordsets);
    } catch (error) {
      console.error('Error:', error.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // API endpoint to call the stored procedure
  app.post('/getDailyProductionStatus', async (req, res) => {
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
      res.status(500).send('Internal Server Error');
    } finally {
      // Close the MSSQL connection
      await sql.close();
    }
  });

  app.post('/api/product-result-target', async (req, res) => {
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
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    } finally {
      // Menutup koneksi setelah selesai
      await sql.close();
    }
  });

  // route to get all data from stored procedure
app.get('/po-balance', (req, res) => {
  sql.connect(config, (err) => {
    if (err) {
      console.error(err);
      res.status(500).send('Error connecting to database');
      return;
    }

    // query to execute stored procedure
    const query = 'EXEC [dbo].[SP_UI_TR_PO_BALANCE] @FROM_RLS, @TO_RLS, @PO, @STYLE, @MODEL';

    // define parameters for stored procedure
    const request = new sql.Request();
    request.input('FROM_RLS', sql.VarChar(6), req.query.FROM_RLS);
    request.input('TO_RLS', sql.VarChar(6), req.query.TO_RLS);
    request.input('PO', sql.VarChar(14), req.query.PO);
    request.input('STYLE', sql.VarChar(9), req.query.STYLE);
    request.input('MODEL', sql.VarChar(100), req.query.MODEL);

    // execute query
    request.query(query, (err, result) => {
      if (err) {
        console.error(err);
        res.status(500).send('Error executing query');
        return;
      }

      // send response with data
      res.json(result.recordset);
    });
  });
});

  // Define the route to execute the stored procedure
  app.post('/inventory-long-term', async (req, res) => {
    try {
      const pool = await sql.connect(config);

      const { STOCK_DATE, S_DAY, WC, SCAN_LINE, RLS, STYLE_NAME, STYLE, GENDER, C_CEK, PLANT } = req.body;

      const result = await pool.request()
        .input('STOCK_DATE', sql.VarChar(10), STOCK_DATE)
        .input('S_DAY', sql.Int, S_DAY)
        .input('WC', sql.VarChar(10), WC)
        .input('SCAN_LINE', sql.VarChar(3), SCAN_LINE)
        .input('RLS', sql.VarChar(6), RLS)
        .input('STYLE_NAME', sql.VarChar(30), STYLE_NAME)
        .input('STYLE', sql.VarChar(20), STYLE)
        .input('GENDER', sql.VarChar(10), GENDER)
        .input('C_CEK', sql.Int, C_CEK)
        .input('PLANT', sql.VarChar(3), PLANT)
        .execute('SP_UI_TR_INVENTORY_LONG_TERM');

      res.json(result.recordsets);
    } catch (err) {
      console.error('Error executing stored procedure:', err);
      res.status(500).send('Internal Server Error');
    }
  });

  app.post('/daily-prod-report', async (req, res) => {
    try {
      // Membuat koneksi pool
      const pool = await sql.connect(config);
  
      // Ekstrak parameter dari body request
      const { PROD_DATE, TO_DATE, PLANT, TYPE } = req.body;
  
      // Membuat instance request
      const request = pool.request();
  
      // Menambahkan parameter ke request
      request.input('PROD_DATE', sql.VarChar(10), PROD_DATE);
      request.input('TO_DATE', sql.VarChar(10), TO_DATE);
      request.input('PLANT', sql.VarChar(20), PLANT);
      request.input('TYPE', sql.VarChar(10), TYPE);
  
      // Menjalankan stored procedure
      const result = await request.execute('SP_UI_TR_PROD_REPORT');
  
      // Mengirimkan hasil dari stored procedure sebagai respons
      res.json(result.recordset);
    } catch (err) {
      console.error('Error occurred:', err);
      res.status(500).send('Internal Server Error');
    }
  });
  

  app.post('/scan-jx2-jx', async (req, res) => {
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
        CEK_IP
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
      console.error('Error:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    } finally {
      // Tutup koneksi setelah selesai
      await sql.close();
    }
  });

  app.post('/setting-sewingQTY', async (req, res) => {
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
      request.input('D_DATE', sql.VarChar(10), D_DATE);
      request.input('D_ASSY_LINE', sql.VarChar(2), D_ASSY_LINE);
      request.input('D_ASSY_TARGET', sql.Int, D_ASSY_TARGET);
      request.input('D_SEWING_LINE', sql.VarChar(4), D_SEWING_LINE);
      request.input('D_SETTING_MARKET', sql.Int, D_SETTING_MARKET);
      request.input('D_DI_CUTTING', sql.Int, D_DI_CUTTING);
      request.input('D_DONE_DI_UPS', sql.Int, D_DONE_DI_UPS);
      request.input('D_AVAIABLE_SETTING', sql.Int, D_AVAIABLE_SETTING);
      request.input('D_ACTION', sql.VarChar(255), D_ACTION);
      request.input('D_REMARKS', sql.VarChar(255), D_REMARKS);
      request.input('D_SAVE', sql.Int, D_SAVE);
  
      // Menjalankan stored procedure sesuai dengan kondisi D_SAVE
      const result = await request.execute('SP_UI_PRT_TR_SETTING_SEWING_QTY');
  
      // Mengirimkan response
      res.send(result.recordsets);
    } catch (err) {
      console.error('Error:', err);
      res.status(500).send('Terjadi kesalahan saat menjalankan stored procedure.');
    } finally {
      // Menutup koneksi setelah selesai
      await sql.close();
    }
  });
// Start the Express server
app.listen(port, '172.16.206.4', () => {
  console.log(`Server is running on http://172.16.206.4:${port}`);
});
