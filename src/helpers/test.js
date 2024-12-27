const pool = require('../connect/connection');
const { randomInt } = require('crypto');

class ShiftGenerator {
    constructor() {
        this.MIN_HOURS_PER_DAY = 6;
        this.MAX_HOURS_PER_DAY = 10;
        this.STORE_OPEN_HOUR = 7;  // Hora de apertura de la tienda
        this.STORE_CLOSE_HOUR = 22; // Hora de cierre de la tienda
    }

    async generateInitialShiftDistribution(storeId, departmentId, positionId, startDate) {
        try {
            // 1. Se obtienen los empleados con base en los parametros de la tienda, departamento y posición
            const employees = await this.getEmployeesByStoreDepPosition(storeId, departmentId, positionId);
            
            if (employees.length === 0) {
                throw new Error('No se encontraron empleados para los criterios especificados');
            }

            //Tomar los empleados y distribuirlos en los turnos de la semana, 
            //La idea seria tener 2 for anidados, el primero recorre los 7 días de la semana
            // el segundo recorre los empleados y los va asignando a los turnos de ese día
            // teniendo en cuenta la jornada laboral de cada empleado, 
            //  Pero se debe tener presente que no todos trabajan un mismo día(Excepto los sabados), sino que estos 
            // se distribuyen a lo largo de la semana con el fin de que haya gente en la aprtura y el cierre. 
            // Habría que tener en cuenta que pensar en una forma de validar que se tenga cobeertura en todo el día es decir 
            // que no hayan huecos en donde no hayan empleados
        
            const shifts = [];
                
            for (const employee of employees) {
                const weeklyHours = parseInt(employee.working_day);
        
                // Generar turnos para la semana
                const currentDate = new Date(startDate);
                const end = new Date(currentDate);
                end.setDate(end.getDate() + 6); // Sumar 6 días a la fecha inicial para que la fecha final sea un domingo
                
                while (currentDate <= end) {
                    const dailyHours = this.calculateDailyHours();
                    shifts.push({
                        number_document: employee.number_document,
                        full_name: employee.full_name,
                        workinDay: employee.working_day,                      
                        store: employee.name_store,
                        department: employee.name_department,
                        position: employee.name_position,
                        hours: dailyHours,
                        shift_date: new Date(currentDate),
                        break: this.giveBreak(dailyHours),
                        initial_hour: '08:00:00'//Acá se debe calcular la hora de inicio del turno dado que no todos 
                        // los empleados asignados a ese día empiezan a la misma hora
                    });
                    currentDate.setDate(currentDate.getDate() + 1);
                }
            }
            return shifts;
        } catch (error) {
            throw new Error(`Error al generar distribución de turnos: ${error.message}`);
        }
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