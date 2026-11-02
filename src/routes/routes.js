import express from 'express';
import forcastController from '../controllers/forcastController.js';
const router = express.Router()



router.post('/forcasting',forcastController)



export default router