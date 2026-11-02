import forcastService from '../services/forcastRulesEngineService.js'
    const  forcastController = async (req , res)=>{
        const {courseId} = req.body;
        const service = new forcastService()
        const result = await service.sectionsCount(courseId)
        res.json({
            message:"course forcasting work",
            data:result,
            sucsses:true
    })
}

export default forcastController