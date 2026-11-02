import Repo from '../repositorys/Repo.js';

class ForcastService {
    
    async studentNeedCourse(courseId ) {
        
        let finalResult = 0;
        const lecCapacity = 60;
        // get the course
        const repo = new Repo();

        const course = await repo.getCourseById(courseId);

        // console.log(course)

        
        // console.log(preRequisteCourse)
        
        
        // get the target course prerequsite
        const preRequisteId = await repo.getPrerequisteId(courseId);

        // console.log('Prerequisite result:', preRequisteId);

        const prerequisiteCourseId =
        preRequisteId?.required_course_id ?? null;
        

        // Not work yet
        try{if(prerequisiteCourseId  == null){
            
            //  check students in specific year year
            const studentsCount = await repo.getStudentsByLevel(2024)
            // console.log( "stttttttttt",studentsCount)

            const courseOfferLevel = await repo.courseOfferYear(courseId)
            // console.log("year", courseOfferLevel)
            return
            
        }
        else{
            const preRequisteCourse = await repo.getCourseById(
                prerequisiteCourseId
                );
            
            // history of this course (number of all students whos pass the course)
            const historyPassedStudentNumber = await repo.getNumberOfStudentTakenThisCourse(preRequisteId.required_course_id)
            // console.log(historyPassedStudentNumber)
            
            // how many studens are eligable to registar this course
            const prevTermPassedStudent_2025 = await repo.getNumberOfStudentTakenThisCourseInCurentTerm(preRequisteId.required_course_id, 2025)
            const prevTermPassedStudent_2024 = await repo.getNumberOfStudentTakenThisCourseInCurentTerm(preRequisteId.required_course_id, 2024)
            const prevTermPassedStudent_2023 = await repo.getNumberOfStudentTakenThisCourseInCurentTerm(preRequisteId.required_course_id, 2023)
            const prevTermPassedStudent_2022 = await repo.getNumberOfStudentTakenThisCourseInCurentTerm(preRequisteId.required_course_id, 2022)
            const prevTermPassedStudent_2021 = await repo.getNumberOfStudentTakenThisCourseInCurentTerm(preRequisteId.required_course_id, 2021)
            const prevTermPassedStudent_2020 = await repo.getNumberOfStudentTakenThisCourseInCurentTerm(preRequisteId.required_course_id, 2020)
            
                const finalResultPercentage =
        (prevTermPassedStudent_2020 * 0.05) +
        (prevTermPassedStudent_2021 * 0.05) +
        (prevTermPassedStudent_2022 * 0.10) +
        (prevTermPassedStudent_2023 * 0.10) +
        (prevTermPassedStudent_2024 * 0.20) +
        (prevTermPassedStudent_2025 * 0.50);

            
        const finalPrdictResult = {

            courseName: course.title,
            preRequisteCourse: preRequisteCourse.code,
            credits:course.credits,
            prdictedNumberOfStudent:Math.round(finalResultPercentage),
            suggestion: Math.round(finalResultPercentage) >= lecCapacity * .25 ? "open section":"don`t open section"
        }


        return finalPrdictResult;

        }}catch(err){
            console.log(err)
        }
        }



   async sectionsCount(courseId) {

    const studentsNumber = await this.studentNeedCourse(courseId);
    const prdictStudentNumber = studentsNumber?.prdictedNumberOfStudent ?? null
    const lecCapacity = 60;
    let sections = 0;
    if(prdictStudentNumber > 0){

         sections = Math.ceil(studentsNumber.prdictedNumberOfStudent / lecCapacity);
    }

    // console.log(studentsNumber)
    // console.log('Required Sections:', sections);
    let result = {};
    result = {
        courseDetails:studentsNumber,
        numberOfSections:sections
    }
    return result;
}
   



    
}


// console.log( await obj.studentNeedCourse(118))

export default ForcastService;




