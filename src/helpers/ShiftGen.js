const pool = require('../connect/connection');

class ShiftGenerator {
    constructor() {
        this.MIN_HOURS_PER_DAY = 6;
        this.MAX_HOURS_PER_DAY = 10;
        this.STORE_OPEN_HOUR = 7;  // Hora de apertura de la tienda
        this.STORE_CLOSE_HOUR = 22; // Hora de cierre de la tienda
    }

    // Métodos principales de generación

    async generateSpecificShifts(params) {
        const {
            startDate,
            endDate,
            storeId,
            departmentId,
            positionId
        } = params;

        try {
            // Validar parámetros
            this.validateParams(params);

            // Obtener empleados específicos según los criterios
            const employees = await this.getSpecificEmployees(storeId, departmentId, positionId);
            
            if (employees.length === 0) {
                throw new Error('No se encontraron empleados con los criterios especificados');
            }

            // Generar turnos para los empleados encontrados
            const generatedShifts = await this.assignShiftsForGroup(employees, startDate, endDate);
            
            return {
                success: true,
                message: `Turnos generados para ${employees.length} empleados`,
                shifts: generatedShifts
            };
        } catch (error) {
            throw new Error(`Error generando turnos: ${error.message}`);
        }
    }

    async assignShiftsForGroup(employees, startDate, endDate) {
        const weekDays = this.getDatesBetween(startDate, endDate);
        const generatedShifts = [];
        
        for (const employee of employees) {
            const weeklyHours = employee.working_day;
            const schedule = await this.generateEmployeeSchedule(
                employee,
                weekDays,
                weeklyHours
            );
            
            // Validar y guardar los turnos generados
            for (const shift of schedule) {
                const validationErrors = this.validateShift(shift);
                if (validationErrors.length === 0) {
                    const weeklyHoursError = await this.validateWeeklyHours(
                        employee.number_document,
                        shift.shift_date,
                        shift.hours
                    );
                    
                    if (!weeklyHoursError) {
                        await this.saveShift(shift);
                        generatedShifts.push(shift);
                    }
                }
            }
        }
        
        return generatedShifts;
    }

    // Métodos de generación de horarios

    async generateEmployeeSchedule(employee, weekDays, weeklyHours) {
        const schedule = [];
        let remainingHours = weeklyHours;

        // Manejar empleados de tiempo parcial (16 horas)
        if (weeklyHours === 16) {
            return this.generatePartTimeSchedule(employee, weekDays);
        }

        // Para empleados de tiempo completo (36 o 46 horas)
        const sundaysInMonth = await this.getEmployeeSundaysWorked(employee.number_document);
        const canWorkSunday = sundaysInMonth < 2;

        for (const date of weekDays) {
            const dayOfWeek = new Date(date).getDay();
            
            // Sábado es obligatorio
            if (dayOfWeek === 6) {
                const hours = Math.min(8, remainingHours);
                if (hours > 0) {
                    schedule.push(this.createShift(employee, date, hours));
                    remainingHours -= hours;
                }
                continue;
            }

            // Domingo - máximo 2 por mes
            if (dayOfWeek === 0) {
                if (canWorkSunday && remainingHours > 0) {
                    const hours = Math.min(8, remainingHours);
                    schedule.push(this.createShift(employee, date, hours));
                    remainingHours -= hours;
                }
                continue;
            }

            // Días entre semana
            if (remainingHours > 0) {
                const hours = this.calculateDailyHours(remainingHours, weekDays.length);
                if (hours > 0) {
                    schedule.push(this.createShift(employee, date, hours));
                    remainingHours -= hours;
                }
            }
        }

        return schedule;
    }

    async generatePartTimeSchedule(employee, weekDays) {
        const schedule = [];
        let totalHours = employee.working_day;

        for (const date of weekDays) {
            const dayOfWeek = new Date(date).getDay();
            const isHoliday = await this.isHoliday(date);

            // Solo trabajan sábados, domingos y festivos
            if (dayOfWeek === 6 || dayOfWeek === 0 || isHoliday) {
                const hours = isHoliday ? 8 : Math.min(8, totalHours);
                if (hours > 0) {
                    schedule.push(this.createShift(employee, date, hours));
                    totalHours -= hours;
                }
            }
        }

        return schedule;
    }

    // Métodos de creación y guardado

    createShift(employee, date, hours) {
        return {
            number_document: employee.number_document,
            shift_date: date,
            hours: hours,
            initial_hour: this.calculateInitialHour(date),
            break: '01:00:00' // 1 hora de descanso por defecto
        };
    }

    async saveShift(shift) {
        const [result] = await pool.execute(
            'INSERT INTO Shifts (hours, number_document, shift_date, break, initial_hour) VALUES (?, ?, ?, ?, ?)',
            [shift.hours, shift.number_document, shift.shift_date, shift.break, shift.initial_hour]
        );
        return result.insertId;
    }

    // Métodos de consulta

    async getSpecificEmployees(storeId, departmentId, positionId) {
        const [employees] = await pool.execute(`
            SELECT e.*, ed.id_position, ds.id_store_dep, p.name_position
            FROM Employees e
            JOIN Employees_Department ed ON e.number_document = ed.number_document
            JOIN Department_Store ds ON ed.id_store_dep = ds.id_store_dep
            JOIN Positions p ON ed.id_position = p.id_position
            WHERE ds.id_store = ?
            AND ds.id_department = ?
            AND ed.id_position = ?
        `, [storeId, departmentId, positionId]);

        return employees;
    }

    async getEmployeeSundaysWorked(employeeId) {
        const [result] = await pool.execute(`
            SELECT COUNT(*) as sundays
            FROM Shifts
            WHERE number_document = ?
            AND DAYOFWEEK(shift_date) = 1
            AND MONTH(shift_date) = MONTH(CURRENT_DATE())
        `, [employeeId]);

        return result[0].sundays;
    }

    // Métodos de validación

    validateParams(params) {
        const required = ['startDate', 'endDate', 'storeId', 'departmentId', 'positionId'];
        const missing = required.filter(param => !params[param]);
        
        if (missing.length > 0) {
            throw new Error(`Faltan parámetros requeridos: ${missing.join(', ')}`);
        }

        if (new Date(params.startDate) > new Date(params.endDate)) {
            throw new Error('La fecha de inicio debe ser anterior a la fecha de fin');
        }
    }

    validateShift(shiftData) {
        const errors = [];

        // Validar horas diarias
        if (shiftData.hours < this.MIN_HOURS_PER_DAY || shiftData.hours > this.MAX_HOURS_PER_DAY) {
            errors.push(`Las horas por turno deben estar entre ${this.MIN_HOURS_PER_DAY} y ${this.MAX_HOURS_PER_DAY}`);
        }

        // Validar formato de hora inicial
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
        if (!timeRegex.test(shiftData.initial_hour)) {
            errors.push('El formato de hora inicial debe ser HH:MM:SS');
        }

        // Validar break
        if (!timeRegex.test(shiftData.break)) {
            errors.push('El formato de break debe ser HH:MM:SS');
        }

        return errors;
    }

    async validateWeeklyHours(employeeId, shiftDate, newHours) {
        const startOfWeek = this.getStartOfWeek(shiftDate);
        const endOfWeek = this.getEndOfWeek(shiftDate);
    
        // Obtener horas trabajadas en la semana
        const [result] = await pool.execute(`
            SELECT SUM(s.hours) as weekly_hours
            FROM Shifts s
            WHERE s.number_document = ?
            AND s.shift_date BETWEEN ? AND ?
        `, [employeeId, startOfWeek, endOfWeek]);
    
        const [employeeData] = await pool.execute(`
            SELECT working_day
            FROM Employees
            WHERE number_document = ?
        `, [employeeId]);
    
        const currentWeeklyHours = result[0].weekly_hours || 0;
        const workingDay = employeeData[0].working_day;
    
        if (currentWeeklyHours + newHours > workingDay) {
            return `Excede las horas semanales permitidas (${workingDay} horas)`;
        }
    
        return null;
    }
    

    // Métodos auxiliares

    calculateInitialHour(date) {
        const baseHour = this.STORE_OPEN_HOUR;
        const maxStartHour = this.STORE_CLOSE_HOUR - 8; // Asegurar que el turno termine antes del cierre
        const random = Math.floor(Math.random() * (maxStartHour - baseHour));
        return `${String(baseHour + random).padStart(2, '0')}:00:00`;
    }

    calculateDailyHours(remainingHours, remainingDays) {
        if (remainingDays === 0) return 0;
        let hours = Math.ceil(remainingHours / remainingDays);
        return Math.min(Math.max(hours, this.MIN_HOURS_PER_DAY), this.MAX_HOURS_PER_DAY);
    }

    getDatesBetween(startDate, endDate) {
        const dates = [];
        let currentDate = new Date(startDate);
        const end = new Date(endDate);

        while (currentDate <= end) {
            dates.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return dates;
    }

    getStartOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    }

    getEndOfWeek(date) {
        const d = new Date(this.getStartOfWeek(date));
        return new Date(d.setDate(d.getDate() + 6));
    }

    async isHoliday(date) {
        // Aquí deberías implementar la lógica para verificar si una fecha es festivo
        // Podrías usar una tabla de festivos en la base de datos o un servicio externo
        return false;
    }
}

module.exports = ShiftGenerator;