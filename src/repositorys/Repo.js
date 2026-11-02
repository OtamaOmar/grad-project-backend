import pool from'../config/db.js';

class  Repo{


    async getCourseById(courseId){
        const  course = await pool.query(`
                SELECT * FROM course WHERE id = $1
            ` ,[courseId])
        return course.rows[0];
    }


    async getPrerequisteId(courseId){
        const preRequisteId = await pool.query(`
                SELECT required_course_id FROM requisite
                WHERE course_id = $1 
            `,[courseId])
        return preRequisteId.rows[0];
    }

    async getNumberOfStudentTakenThisCourse(courseId){
        const number = await pool.query(`
                SELECT count(*) FROM enrollment
                WHERE course_id = $1 AND attempt_state = $2
            `,[courseId,'passed'])
        return number.rows;
    }

    async getNumberOfStudentTakenThisCourseInCurentTerm(courseId, term) {
        const result = await pool.query(`
            SELECT COUNT(DISTINCT e.student_id) AS student_count
            FROM enrollment e
            JOIN academic_term t
                ON t.id = e.academic_term_id
            WHERE e.course_id = $1
            AND e.attempt_state = $2
            AND t.academic_year = $3
        `, [courseId, 'passed', term]);

        return Number(result.rows[0].student_count);
    }


    async getStudentLevel(studentId) {
        const result = await pool.query(`
            SELECT cohort_year
            FROM student
            WHERE course_id = $1
        `, [studentId]);

        if (result.rows.length === 0) {
            return null;
        }

        const currentYear = 2026;
        const cohortYear = Number(result.rows[0].cohort_year);

        const level = currentYear - cohortYear + 1;

        return level;
    }
    

    async getStudentsByLevel(year){
        let result = await pool.query(`
                SELECT COUNT(*) FROM student
                WHERE cohort_year = $1
            
            `,[year])
        return result.rows[0]
    }

async courseOfferYear(courseId) {
    const result = await pool.query(
        `SELECT study_year
         FROM plan_slot
         WHERE plan_template_id = $1`,
        [courseId]
    );

 

    return result.rows[0];
}


    async getNumberOfStudentShouldTakeThisCourse(){

    }






 

}


export default Repo;



