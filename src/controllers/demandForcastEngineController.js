import forcastService from '../services/demandForecastEngine.js'
    const  forcastController = async (req , res)=>{
        const {courseId , targetTerm} = req.body;
        const service = new forcastService()
        const result = await service.sectionsCount(courseId , Number(targetTerm))
        res.json({
            message:"course forcasting work",
            data:result,
            sucsses:true
    })
}

export default forcastController