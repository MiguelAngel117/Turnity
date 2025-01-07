const pool = require('../connect/connection');
const { randomInt } = require('crypto');

class ShiftValidator {
    constructor() {
        this.MIN_HOURS_PER_DAY = 4;
        this.MAX_HOURS_PER_DAY = 10;
    }

    async validateShifts(storeId, departmentId, positionId, startDate, shifts) {
        // 1. Se obtienen los datos del parametro Shifts, en el cual se encuentran los turnos a asignar, junto con la data de los empleados
        // 2. el día inicial de la fecha debe ser un lunes
        // 3. dentro de Shifts viene la generación de turnos de un mes completo, un mes laboral(lo que quieredecir que
        // las semanas se toman a partir de cada lunes y en el mes que esté es decir por ejemplo si la smena de el lunes arranca en diciembre y finaliza el domingo en el mes de enero, esa semana ya hace parte del mes de diciembre ya que es una semana laboral-. 
        //ya el siguiente lunes si seria parte del mes de enero y así seguiría la lógica para las demás semanas
        // en pocas palabras se debe tener en cuenta que si la semana empieza en un mes y termina en otro, se toma como parte del mes en el que inicia. por lo cual se pueden llegar a tener meses de 5 semanas laborales o de 4 semanas

    }

    async getEmployeesByStoreDepPosition(storeId, departmentId, positionId) {
        //Se obtienen los empleados de la base de datos que cumplan con los criterios de la tienda, departamento y posición
        try {
            const [employees] = await pool.execute(`
                SELECT 
                    e.number_document,
                    e.full_name,
                    e.working_day,
                    p.name_position,
                    p.id_position,
                    d.name_department,
                    s.name_store,
                    ed.id_store_dep
                FROM Employees_Department ed
                JOIN Employees e ON e.number_document = ed.number_document
                JOIN Positions p ON p.id_position = ed.id_position
                JOIN Department_Store ds ON ds.id_store_dep = ed.id_store_dep
                JOIN Departments d ON d.id_department = ds.id_department
                JOIN Stores s ON s.id_store = ds.id_store
                WHERE s.id_store = ? 
                AND d.id_department = ? 
                AND p.id_position = ?
                ORDER BY e.working_day DESC
            `, [storeId, departmentId, positionId]);

            return employees;
        } catch (error) {
            throw new Error(`Error al obtener empleados: ${error.message}`);
        }
    }

    validateRules(){
        //Los empleados de 46 horas y 36hras trabajan cualquier día de lunes a viernes, 
        // todos los empleados de cualquier jornada (46, 36 y 16) trabajan obligatoriamente los sábados
        //los 16horas solo trabajan los fines de semana y cuando hay un día festivo, lo trabajan, es decir pasan de trabajar 16hras a trabajar 24horas
    }

    validateOpeningClosing(){
        //la idea seria que se tome el numero de empleados en el cargo y estos se distribuyan a lo largo de la semana
        //es decir si hay 6 empleados, estos se distribuyen en la semana según su jornada laboral, con esto se sabe si se cuenta 
        //con empleados para la apertura y el cierre de la tienda
    }

    giveBreak(hours){
        return (hours >= 8)?'01:00:00':'00:15:00';
    }

    
    calculateDailyHours() {
        //ACÁ SE DEBE IMPLEMENTAR LA LÓGICA PARA DISTRIBUIR LAS HORAS SEMANALES EN TURNOS DIARIOS
        //SE DEBEN DISTRIBUIR LAS HORAS DE 4 A 10 HORAS DIARIAS POR EMPLEADO
        //Por ahora tengo un  random pero hay que cambiarlo
        const hour = randomInt(this.MIN_HOURS_PER_DAY, this.MAX_HOURS_PER_DAY); // Generates a random integer between 0 and 10
        return hour;
    }
}

module.exports = ShiftGenerator;