const pool = require('../connect/connection');

class ShiftGenerator {
    constructor() {
        this.SHIFT_TYPES = {
            'CO094': { hours: 10, name: 'Turno largo' },
            'CO005': { hours: 8, name: 'Turno medio' },
            'CO015': { hours: 6, name: 'Turno corto' },
            'DES': { hours: 0, name: 'Descanso' }
        };

        // Definir los turnos disponibles considerando el horario de la tienda
        this.STORE_HOURS = {
            openingTime: 7,    // 7:00 AM
            closingTime: 22.5, // 10:30 PM
            shifts: [
                { start: '07:00:00', type: 'CO094', end: '17:00:00' },  // 7:00 AM - 5:00 PM
                { start: '08:00:00', type: 'CO005', end: '16:00:00' },  // 8:00 AM - 4:00 PM
                { start: '10:00:00', type: 'CO015', end: '16:00:00' },  // 10:00 AM - 4:00 PM
                { start: '12:00:00', type: 'CO005', end: '20:00:00' },  // 12:00 PM - 8:00 PM
                { start: '14:00:00', type: 'CO015', end: '20:00:00' },  // 2:00 PM - 8:00 PM
                { start: '12:30:00', type: 'CO094', end: '22:30:00' }   // 12:30 PM - 10:30 PM
            ]
        };
        this.WEEKEND_HOURS = 16;
        this.MAX_WEEKLY_SHIFTS = 7; // Incluye días de descanso
    }

    async generateInitialShiftDistribution(storeId, departmentId, positionId, startDate) {
        try {
            const employees = await this.getEmployeesByStoreDepPosition(storeId, departmentId, positionId);
            
            if (employees.length === 0) {
                throw new Error('No se encontraron empleados para los criterios especificados');
            }

            const weekendEmployees = employees.filter(emp => parseInt(emp.working_day) === this.WEEKEND_HOURS);
            const regularEmployees = employees.filter(emp => parseInt(emp.working_day) !== this.WEEKEND_HOURS);
            
            // Inicializar estructuras de seguimiento
            const shifts = [];
            const startDateObj = new Date(startDate);
            const employeeSchedule = this.initializeEmployeeSchedule(employees);

            // Generar turnos para toda la semana
            for (let day = 0; day < 7; day++) {
                const currentDate = new Date(startDateObj);
                currentDate.setDate(currentDate.getDate() + day);
                const isWeekend = day === 5 || day === 6;

                if (isWeekend) {
                    const weekendShifts = this.assignWeekendShifts(
                        currentDate,
                        weekendEmployees,
                        employeeSchedule
                    );
                    shifts.push(...weekendShifts);
                }

                const regularShifts = this.assignRegularShifts(
                    currentDate,
                    regularEmployees,
                    employeeSchedule,
                    isWeekend
                );
                shifts.push(...regularShifts);
            }

            // Asignar días de descanso faltantes
            this.assignRemainingRestDays(shifts, employees, startDateObj, employeeSchedule);
            
            this.validateSchedule(shifts, employees);
            return shifts;
        } catch (error) {
            throw new Error(`Error al generar distribución de turnos: ${error.message}`);
        }
    }

    initializeEmployeeSchedule(employees) {
        const schedule = {};
        employees.forEach(emp => {
            schedule[emp.number_document] = {
                weeklyHours: 0,
                shiftsCount: 0,
                lastShiftDate: null,
                workingDays: new Set(),
                restDays: new Set()
            };
        });
        return schedule;
    }

    assignRegularShifts(date, employees, employeeSchedule, isWeekend) {
        const shifts = [];
        const dayShifts = [...this.STORE_HOURS.shifts];
        const dateStr = date.toISOString().split('T')[0];

        // Ordenar empleados por horas trabajadas (menos a más)
        const availableEmployees = employees
            .filter(emp => this.canWorkOnDate(emp, date, employeeSchedule))
            .sort((a, b) => {
                const hoursA = employeeSchedule[a.number_document].weeklyHours;
                const hoursB = employeeSchedule[b.number_document].weeklyHours;
                return hoursA - hoursB;
            });

        // Asignar turnos prioritarios primero (apertura y cierre)
        const priorityShifts = dayShifts.filter(shift => 
            shift.start === '07:00:00' || 
            shift.end === '22:30:00'
        );

        // Luego asignar el resto de turnos
        const regularShifts = dayShifts.filter(shift => 
            !priorityShifts.includes(shift)
        );

        // Asignar turnos en orden de prioridad
        [...priorityShifts, ...regularShifts].forEach(shiftTime => {
            const eligibleEmployee = this.findEligibleEmployee(
                availableEmployees,
                employeeSchedule,
                shiftTime,
                dateStr
            );

            if (eligibleEmployee) {
                const shift = this.createShift(
                    eligibleEmployee,
                    date,
                    shiftTime.type,
                    this.SHIFT_TYPES[shiftTime.type].hours,
                    shiftTime.start,
                    shiftTime.end
                );

                this.updateEmployeeSchedule(
                    employeeSchedule,
                    eligibleEmployee.number_document,
                    shift
                );

                shifts.push(shift);
            }
        });

        return shifts;
    }

    assignWeekendShifts(date, employees, employeeSchedule) {
        const shifts = [];
        const dateStr = date.toISOString().split('T')[0];

        // Asignar turnos específicos para fin de semana
        const weekendShifts = [
            { start: '07:00:00', type: 'CO005', end: '15:00:00' },
            { start: '09:00:00', type: 'CO005', end: '17:00:00' },
            { start: '11:00:00', type: 'CO005', end: '19:00:00' },
            { start: '14:30:00', type: 'CO005', end: '22:30:00' }
        ];

        weekendShifts.forEach(shiftTime => {
            const eligibleEmployee = this.findEligibleEmployee(
                employees,
                employeeSchedule,
                shiftTime,
                dateStr
            );

            if (eligibleEmployee) {
                const shift = this.createShift(
                    eligibleEmployee,
                    date,
                    shiftTime.type,
                    8, // Turno fijo de 8 horas para fin de semana
                    shiftTime.start,
                    shiftTime.end
                );

                this.updateEmployeeSchedule(
                    employeeSchedule,
                    eligibleEmployee.number_document,
                    shift
                );

                shifts.push(shift);
            }
        });

        return shifts;
    }

    findEligibleEmployee(employees, schedule, shiftTime, dateStr) {
        return employees.find(emp => {
            const empSchedule = schedule[emp.number_document];
            const shiftHours = this.SHIFT_TYPES[shiftTime.type].hours;
            
            // Verificar si el empleado puede tomar este turno
            return empSchedule.weeklyHours + shiftHours <= parseInt(emp.working_day) &&
                   !empSchedule.workingDays.has(dateStr) &&
                   empSchedule.shiftsCount < this.MAX_WEEKLY_SHIFTS - 1; // Dejar espacio para un día de descanso
        });
    }

    assignRemainingRestDays(shifts, employees, startDate, employeeSchedule) {
        employees.forEach(employee => {
            const empSchedule = employeeSchedule[employee.number_document];
            const daysNeeded = this.MAX_WEEKLY_SHIFTS - empSchedule.shiftsCount;

            if (daysNeeded > 0) {
                for (let day = 0; day < 7; day++) {
                    const currentDate = new Date(startDate);
                    currentDate.setDate(currentDate.getDate() + day);
                    const dateStr = currentDate.toISOString().split('T')[0];

                    if (!empSchedule.workingDays.has(dateStr) && !empSchedule.restDays.has(dateStr)) {
                        shifts.push(this.createShift(
                            employee,
                            currentDate,
                            'DES',
                            0,
                            '00:00:00',
                            '00:00:00'
                        ));
                        empSchedule.restDays.add(dateStr);
                        empSchedule.shiftsCount++;
                    }
                }
            }
        });
    }

    updateEmployeeSchedule(schedule, employeeId, shift) {
        const empSchedule = schedule[employeeId];
        const dateStr = shift.shift_date.toISOString().split('T')[0];

        empSchedule.weeklyHours += shift.hours;
        empSchedule.shiftsCount++;
        empSchedule.lastShiftDate = shift.shift_date;
        empSchedule.workingDays.add(dateStr);
    }

    canWorkOnDate(employee, date, schedule) {
        const empSchedule = schedule[employee.number_document];
        const dateStr = date.toISOString().split('T')[0];

        // Verificar si el empleado ya tiene un turno o descanso asignado ese día
        return !empSchedule.workingDays.has(dateStr) && 
               !empSchedule.restDays.has(dateStr);
    }

    createShift(employee, date, shiftType, hours, initialHour, endHour) {
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
            break: this.calculateBreak(hours),
            initial_hour: initialHour,
            end_hour: endHour
        };
    }

    calculateBreak(hours) {
        return hours >= 8 ? '01:00:00' : '00:15:00';
    }

    validateSchedule(shifts, employees) {
        const schedule = {};
        
        // Inicializar el registro de horarios
        employees.forEach(emp => {
            schedule[emp.number_document] = {
                totalHours: 0,
                workingDay: parseInt(emp.working_day),
                shiftsCount: 0,
                assignedDays: new Set()
            };
        });

        // Validar horarios y turnos
        shifts.forEach(shift => {
            const empSchedule = schedule[shift.number_document];
            const dateStr = shift.shift_date.toISOString().split('T')[0];

            empSchedule.totalHours += shift.hours;
            empSchedule.shiftsCount++;
            empSchedule.assignedDays.add(dateStr);

            // Validar horas semanales
            if (empSchedule.totalHours > empSchedule.workingDay) {
                throw new Error(
                    `El empleado ${shift.number_document} excede sus horas semanales permitidas. ` +
                    `Asignadas: ${empSchedule.totalHours}, Máximo: ${empSchedule.workingDay}`
                );
            }

            // Validar cantidad de turnos
            if (empSchedule.shiftsCount > this.MAX_WEEKLY_SHIFTS) {
                throw new Error(
                    `El empleado ${shift.number_document} excede el número máximo de turnos semanales.`
                );
            }

            // Validar que no haya turnos duplicados en el mismo día
            if (empSchedule.assignedDays.size !== empSchedule.shiftsCount) {
                throw new Error(
                    `El empleado ${shift.number_document} tiene turnos duplicados en un mismo día.`
                );
            }
        });
    }

    async getEmployeesByStoreDepPosition(storeId, departmentId, positionId) {
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