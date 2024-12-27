const pool = require('../connect/connection');

class ShiftGenerator {
    constructor() {
        this.SHIFT_TYPES = {
            'CO094': 10, // Turno largo
            'CO005': 8,  // Turno medio
            'CO015': 6,  // Turno corto
            'DES': 0     // Descanso
        };
        this.STORE_OPEN_HOUR = 7;
        this.STORE_CLOSE_HOUR = 22;
        this.WEEKEND_HOURS = 16;
    }

    async generateInitialShiftDistribution(storeId, departmentId, positionId, startDate) {
        try {
            const employees = await this.getEmployeesByStoreDepPosition(storeId, departmentId, positionId);
            
            if (employees.length === 0) {
                throw new Error('No se encontraron empleados para los criterios especificados');
            }

            // Separar empleados de fin de semana y regulares
            const weekendEmployees = employees.filter(emp => parseInt(emp.working_day) === this.WEEKEND_HOURS);
            const regularEmployees = employees.filter(emp => parseInt(emp.working_day) !== this.WEEKEND_HOURS);

            const shifts = [];
            const startDateObj = new Date(startDate);
            const employeeWeeklyHours = {};

            // Inicializar contador de horas semanales
            employees.forEach(emp => {
                employeeWeeklyHours[emp.number_document] = 0;
            });

            // Generar turnos para la semana
            for (let day = 0; day < 7; day++) {
                const currentDate = new Date(startDateObj);
                currentDate.setDate(currentDate.getDate() + day);
                const isWeekend = day === 5 || day === 6; // Sábado o domingo
                
                if (isWeekend) {
                    // Generar turnos de fin de semana para empleados de 16 horas
                    const weekendShifts = this.generateWeekendShifts(
                        currentDate,
                        weekendEmployees,
                        employeeWeeklyHours
                    );
                    shifts.push(...weekendShifts);
                }

                // Generar turnos para empleados regulares
                if (!isWeekend || day === 5) { // Entre semana y sábados
                    const regularShifts = this.generateDayShifts(
                        currentDate,
                        regularEmployees,
                        employeeWeeklyHours
                    );
                    shifts.push(...regularShifts);
                }
            }

            this.validateWeeklyHours(shifts);
            return shifts;
        } catch (error) {
            throw new Error(`Error al generar distribución de turnos: ${error.message}`);
        }
    }

    generateWeekendShifts(date, weekendEmployees, employeeWeeklyHours) {
        const shifts = [];
        
        for (const employee of weekendEmployees) {
            const currentHours = employeeWeeklyHours[employee.number_document];
            const remainingHours = this.WEEKEND_HOURS - currentHours;

            if (remainingHours > 0) {
                // Asignar 8 horas por día de fin de semana
                const hours = Math.min(8, remainingHours);
                employeeWeeklyHours[employee.number_document] += hours;
                
                shifts.push(this.createShift(
                    employee,
                    date,
                    hours === 8 ? 'CO005' : 'CO015',
                    hours
                ));
            }
        }

        return shifts;
    }

    generateDayShifts(date, employees, employeeWeeklyHours) {
        const shifts = [];
        const availableEmployees = employees.filter(emp => 
            employeeWeeklyHours[emp.number_document] < parseInt(emp.working_day)
        );

        for (const employee of availableEmployees) {
            const currentHours = employeeWeeklyHours[employee.number_document];
            const maxHours = parseInt(employee.working_day);
            const remainingHours = maxHours - currentHours;
            const dayOfWeek = date.getDay();

            // Si es domingo y no es empleado de fin de semana, asignar descanso
            if (dayOfWeek === 0 && maxHours !== this.WEEKEND_HOURS) {
                shifts.push(this.createShift(employee, date, 'DES', 0));
                continue;
            }

            const shiftType = this.determineShiftType(remainingHours, date, currentHours, maxHours);
            
            if (shiftType === 'DES') {
                shifts.push(this.createShift(employee, date, 'DES', 0));
                continue;
            }

            const hours = this.SHIFT_TYPES[shiftType];
            
            if (currentHours + hours <= maxHours) {
                employeeWeeklyHours[employee.number_document] += hours;
                shifts.push(this.createShift(employee, date, shiftType, hours));
            }
        }

        return shifts;
    }

    determineShiftType(remainingHours, date, currentHours, maxHours) {
        const dayOfWeek = date.getDay();
        
        // Asignar descanso si:
        // - Ya tiene muchas horas
        // - Es domingo y no es empleado de fin de semana
        // - Es un día aleatorio para distribuir descansos
        if (currentHours >= maxHours - 6 || 
            (dayOfWeek === 0 && maxHours !== this.WEEKEND_HOURS) ||
            (Math.random() < 0.2 && currentHours >= maxHours * 0.7)) {
            return 'DES';
        }

        if (remainingHours <= 6) {
            return 'CO015';
        }

        // Alternar entre turnos largos y medios
        if (remainingHours >= 10 && Math.random() > 0.5) {
            return 'CO094';
        }

        return 'CO005';
    }

    createShift(employee, date, shiftType, hours) {
        return {
            number_document: employee.number_document,
            full_name: employee.full_name,
            workinDay: employee.working_day,
            store: employee.name_store,
            department: employee.name_department,
            position: employee.name_position,
            shift_type: shiftType,
            hours: hours,
            shift_date: new Date(date),
            break: this.giveBreak(hours),
            initial_hour: shiftType === 'DES' ?  '00:00:00': '08:00:00'
        };
    }

    validateWeeklyHours(shifts) {
        const employeeHours = {};
        
        shifts.forEach(shift => {
            if (!employeeHours[shift.number_document]) {
                employeeHours[shift.number_document] = {
                    totalHours: 0,
                    workingDay: parseInt(shift.workinDay)
                };
            }
            employeeHours[shift.number_document].totalHours += shift.hours;
        });

        for (const [employeeId, data] of Object.entries(employeeHours)) {
            if (data.totalHours > data.workingDay) {
                throw new Error(`El empleado ${employeeId} excede sus horas semanales permitidas. ` +
                    `Asignadas: ${data.totalHours}, Máximo: ${data.workingDay}`);
            }
        }
    }

    giveBreak(hours) {
        return (hours >= 8) ? '01:00:00' : '00:15:00';
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
}

module.exports = ShiftGenerator;