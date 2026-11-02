import express from 'express';
import router from './routes/routes.js';
import "dotenv/config";
import pool from './config/db.js';
const port = process.env.PORT
const app = express();


app.use(express.json({limit:'17kb'}))
app.use('/',router);

app.get('/health', async(req,res)=>{
    const data = await pool.query(`
            SELECT * FROM student
        `)
    res.json({data:data.rows})
})




app.listen(port, 
    console.log(`server runing on port ${port}`)
)
