import express from 'express';
import forcastController from '../controllers/demandForcastEngineController.js';
const router = express.Router()



router.post('/forcasting',forcastController)



export default router