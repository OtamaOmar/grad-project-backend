import Repo from '../repositorys/Repo.js';
import ForecastRuleEngine from '../services/forecastRuleEngine.js';

class ForcastService {
    
    async studentNeedCourse(courseId, targetTerm ) {
        

        const forecastRuleEngine = new ForecastRuleEngine()
        

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
            
            // history of this course (number of all students whos pass the prerquiste course)
            const prerequisiteHistoryPassedStudentNumber = await repo.getNumberOfStudentTakenThisCourse(preRequisteId.required_course_id)
            const historyPassedStudentNumber = await repo.getNumberOfStudentTakenThisCourse(courseId);
            // console.log(historyPassedStudentNumber)
            
            // how many studens are eligable to registar this course
            const prevTermPassedStudent_2025 = await repo.getNumberOfStudentTakenThisCourseInCurentTerm(preRequisteId.required_course_id, Number(targetTerm-1))
            const prevTermPassedStudent_2024 = await repo.getNumberOfStudentTakenThisCourseInCurentTerm(preRequisteId.required_course_id, Number(targetTerm-2))
            const prevTermPassedStudent_2023 = await repo.getNumberOfStudentTakenThisCourseInCurentTerm(preRequisteId.required_course_id, Number(targetTerm-3))
            const prevTermPassedStudent_2022 = await repo.getNumberOfStudentTakenThisCourseInCurentTerm(preRequisteId.required_course_id, Number(targetTerm-4))
            const prevTermPassedStudent_2021 = await repo.getNumberOfStudentTakenThisCourseInCurentTerm(preRequisteId.required_course_id, Number(targetTerm-5))
            const prevTermPassedStudent_2020 = await repo.getNumberOfStudentTakenThisCourseInCurentTerm(preRequisteId.required_course_id, Number(targetTerm-6));
        
            // Number of students who enrolled in the target course
            // during the past three academic years.
            const studentEnrollment2026 =
                await repo.studentEnrollmentInThisYear(courseId, 44, 48, 38);

            const studentEnrollment2025 =
                await repo.studentEnrollmentInThisYear(courseId, 47, 59, 62);

            const studentEnrollment2024 =
                await repo.studentEnrollmentInThisYear(courseId, 33, 51, 56);

            // Number of students who passed the prerequisite course
            // during the corresponding academic years.
            const studentEligible2026 =
                await repo.studentEnrollmentInThisYear(
                    preRequisteId.required_course_id, 44, 48, 38
                );

            const studentEligible2025 =
                await repo.studentEnrollmentInThisYear(
                    preRequisteId.required_course_id, 47, 59, 62
                );

            const studentEligible2024 =
                await repo.studentEnrollmentInThisYear(
                    preRequisteId.required_course_id, 33, 51, 56
                );

            // Total enrollment and prerequisite passes across three years.
            const totalEnrollment =
                studentEnrollment2024 +
                studentEnrollment2025 +
                studentEnrollment2026;

            const totalEligible =
                studentEligible2024 +
                studentEligible2025 +
                studentEligible2026;

            // Calculate the historical enrollment rate.
            const enrollmentRate = totalEligible > 0
                ? totalEnrollment / totalEligible
                : 0;

            console.log("Total enrollment:", totalEnrollment);
            console.log("Total eligible:", totalEligible);
            console.log("Enrollment rate:", enrollmentRate);
            console.log("Enrollment rate (%):", (enrollmentRate * 100).toFixed(2) + "%");

            
               const finalResultPercentage =
        (prevTermPassedStudent_2020 ) +
        (prevTermPassedStudent_2021 ) +
        (prevTermPassedStudent_2022 ) +
        (prevTermPassedStudent_2023 ) +
        (prevTermPassedStudent_2024 ) +
        (prevTermPassedStudent_2025 );

        const pridectedRate = Math.round(finalResultPercentage*enrollmentRate)
            
        const finalPrdictResult = {

            courseName: course.title,
            preRequisteCourse: preRequisteCourse.code,
            credits:course.credits,
            eligableStudent:Math.round(finalResultPercentage),
            historicalNumberOfPassing:historyPassedStudentNumber[0].count,
            pridectedNumberOfStudent:pridectedRate,
            suggestion: Math.round(finalResultPercentage) >= lecCapacity * .25 ? "open section":"don`t open section"
        }


        return finalPrdictResult;

        }}catch(err){
            console.log(err)
        }
        }



   async sectionsCount(courseId , targetTerm) {

    const studentsNumber = await this.studentNeedCourse(courseId , targetTerm);
    const prdictStudentNumber = studentsNumber?.pridectedNumberOfStudent ?? null
    const lecCapacity = 60;
    const labCabacity = 30;
    let lecSections = 0;
    let labSections=0;
    if(prdictStudentNumber > lecCapacity * .25){

         lecSections = Math.ceil(studentsNumber.pridectedNumberOfStudent / lecCapacity);
         labSections = Math.ceil(studentsNumber.pridectedNumberOfStudent / labCabacity);
    }

    // console.log(studentsNumber)
    // console.log('Required Sections:', sections);
    let result = {};
    result = {
        courseDetails:studentsNumber,
        numberOfSections:lecSections,
        numberOfLabs:labSections
    }
    return result;
}
   



    
}


// console.log( await obj.studentNeedCourse(118))

export default ForcastService;




