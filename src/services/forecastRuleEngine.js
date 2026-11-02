import Repo from '../repositorys/Repo.js';
import repo from '../repositorys/Repo.js'

class ForecastRuleEngine{

    async checkPrerequise(studentId,courseId){
        
        const Repo = new repo()

        // get the target course
        const course = await Repo.getCourseById(courseId);
        // get the student
        const student = await Repo.getStudentById(studentId);
        // get the course prerequiste
        const prerequisiteId = await Repo.getPrerequisteId(courseId);
        if(prerequisiteId){

            const prerequisiteCourse = await Repo.getCourseById(prerequisiteId.required_course_id)
        }
        // check if student pass the prerequiste
        const status = await Repo.isStudentPass(studentId, courseId);

        return status
    }

    async checkCreditLimit(studentId , gpa , term ){
            let  maxCriditLimit = 0
            let hasAcceptance = null
            
            if((gpa > 3  && term === 'fall' ) || (gpa > 3 && term.toLowerCase() === 'spring') ){
                if(hasAcceptance == true){
                    maxCriditLimit = 21
                }
                else{
                    maxCriditLimit = 19
                }
            }
            else if((gpa < 2  && term === 'fall' ) || (gpa < 2 && term.toLowerCase() === 'spring')) {
                maxCriditLimit = 13
            }
            else if(term.toLowerCase() === "summer"){
                maxCriditLimit = 7;
            }
            return maxCriditLimit;
    }

    async checkTermAvailability(courseId , term){
        const Repo = new repo();
        let availableTerm = await Repo.courseTerm(courseId);
        availableTerm = availableTerm.term_type
        console.log(availableTerm)
        if(term.toLowerCase() === availableTerm.toLowerCase()){
            return true;
        }
        else{
            return false;
        }
    }
  


}




export default ForecastRuleEngine;