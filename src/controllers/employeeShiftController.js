const pool = require('../connect/connection');
const Shift = require('../models/employeeShift');
const ShiftGenerator = require('../helpers/shiftGenerator');
const moment = require('moment');
const EmployeeShift = require('../models/employeeShift');
const generator = new ShiftGenerator();

class EmployeeShiftController {
    listSpecialDays = ["X", "CUMPLEAÑOS", "VACACIONES", "INCAPACIDAD", "JURADO VOT", "DIA_FAMILIA", "LICENCIA", "DIA_DISFRUTE"];
    
    async validateOrFindShift(shiftData) {
        try {
            if (shiftData.turn) {
                const [shifts] = await pool.execute(
                    'SELECT * FROM Shifts WHERE code_shift = ?',
                    [shiftData.turn]
                );
                
                if (shifts.length === 0) {
                    return {
                        status: 404,
                        message: `No existe un turno con el código ${shiftData.code_shift}`
                    };
                }
                
                return {
                    status: 200,
                    data: shifts[0].code_shift
                };
            } else {
                const [shifts] = await pool.execute(
                    'SELECT * FROM Shifts WHERE hours = ? AND initial_hour = ?',
                    [shiftData.hours, shiftData.initial_hour]
                );
                
                if (shifts.length === 0) {
                    return {
                        status: 404,
                        message: `No existe un turno con ${shiftData.hours} horas iniciando a las ${shiftData.initial_hour}`
                    };
                }
                
                return {
                    status: 200,
                    data: shifts[0].code_shift
                };
            }
        } catch (error) {
            return {
                status: 500,
                message: `Error validando turno: ${error.message}`
            };
        }
    }
    
    async generateShifts(storeId, departmentId, numWeeks, employeeShifts) {
        try {
            if (!employeeShifts || !Array.isArray(employeeShifts)) {
                return {
                    status: 400,
                    errors: [{
                        id_employee: 'general',
                        message: 'employeeShifts debe ser un array válido',
                        type: 'error'
                    }]
                };
            }
            
            const validatedShifts = await generator.createShifts(
                numWeeks,
                employeeShifts
            );
            const results = {
                created: 0,
                updated: 0,
                skipped: 0
            };
            
            if (!validatedShifts.success) {
                return {
                    status: 409,
                    results: results,
                    errors: validatedShifts.errors
                };
            }

            for (const shiftData of validatedShifts.data) {
                for (const shift of shiftData.shifts) {
                    const shiftValidation = await this.validateOrFindShift(shift);
                    if (shiftValidation.status !== 200) {
                        processingErrors.push({
                            id_employee: shiftData.employeeId,
                            message: shiftValidation.message || 'Error validando turno',
                            type: 'error'
                        });
                        continue;
                    }
                    
                    // Verificar si el turno ya existe para este empleado en esta fecha
                    const [existingShifts] = await pool.execute(
                        `SELECT id_shift_his, turn, break FROM Employee_Shift 
                         WHERE number_document = ? AND shift_date = ?`,
                        [shiftData.employeeId, shift.shift_date]
                    );
                    
                    const breakValue = shift.break || '00:00:00';
                    
                    if (existingShifts.length > 0) {
                        const existingShift = existingShifts[0];
                        
                        // Verificar si hay cambios reales antes de actualizar
                        if (existingShift.turn === shiftValidation.data && 
                            existingShift.break === breakValue) {
                            results.skipped++;
                            continue;
                        }
                        
                        // Actualizar el turno existente solo si hay cambios
                        await pool.execute(
                            `UPDATE Employee_Shift 
                             SET turn = ?, break = ? 
                             WHERE number_document = ? AND shift_date = ?`,
                            [
                                shiftValidation.data,
                                breakValue,
                                shiftData.employeeId,
                                shift.shift_date
                            ]
                        );
                        results.updated++;
                    } else {
                        // Insertar nuevo turno
                        await pool.execute(
                            `INSERT INTO Employee_Shift (turn, number_document, shift_date, break)
                             VALUES (?, ?, ?, ?)`,
                            [
                                shiftValidation.data,
                                shiftData.employeeId,
                                shift.shift_date,
                                breakValue
                            ]
                        );
                        results.created++;
                    }
                }
            }
            
            return {
                status: 201,
                data: validatedShifts.data,
                results: results,
                message: `Turnos procesados correctamente: ${results.created} creados, ${results.updated} actualizados, ${results.skipped} sin cambios`
            };
        } catch (error) {
            return {
                status: 500,
                message: 'Error al validar o almacenar los turnos: ' + error.message
            };
        }
    }

    async getShiftById(id_shift_his) {
        try {
            const [shifts] = await pool.execute(`
                SELECT es.*, e.full_name, s.hours, s.initial_hour
                FROM Employee_Shift es
                JOIN Employees e ON es.number_document = e.number_document
                JOIN Shifts s ON es.turn = s.code_shift
                WHERE es.id_shift_his = ?
            `, [id_shift_his]);
            
            if (shifts.length === 0) {
                return {
                    status: 404,
                    message: `No se encontró el turno con ID ${id_shift_his}`
                };
            }
            
            const shift = shifts[0];
            const shiftData = new EmployeeShift({
                id_shift_his: shift.id_shift_his,
                turn: {
                    code_shift: shift.turn,
                    hours: shift.hours,
                    initial_hour: shift.initial_hour
                },
                number_document: shift.number_document,
                employee_name: shift.full_name,
                shift_date: shift.shift_date,
                break: shift.break
            });

            return {
                status: 200,
                data: shiftData
            };
        } catch (error) {
            return {
                status: 500,
                message: `Error al obtener el turno: ${error.message}`
            };
        }
    }

    async getAllShifts() {
        try {
            const [shifts] = await pool.execute(`
                SELECT es.*, e.full_name, s.hours, s.initial_hour
                FROM Employee_Shift es
                JOIN Employees e ON es.number_document = e.number_document
                JOIN Shifts s ON es.turn = s.code_shift
            `);
            
            if (shifts.length === 0) {
                return {
                    status: 404,
                    data: []
                };
            }

            const formattedShifts = shifts.map(shift => new EmployeeShift({
                id_shift_his: shift.id_shift_his,
                turn: {
                    code_shift: shift.turn,
                    hours: shift.hours,
                    initial_hour: shift.initial_hour
                },
                number_document: shift.number_document,
                employee_name: shift.full_name,
                shift_date: shift.shift_date,
                break: shift.break
            }));

            return {
                status: 200,
                data: formattedShifts
            };
        } catch (error) {
            return {
                status: 500,
                message: `Error al obtener los turnos: ${error.message}`
            };
        }
    }
    
    async deleteShift(id_shift_his) {
        try {
            const shiftExists = await this.getShiftById(id_shift_his);
            if (shiftExists.status === 404) {
                return shiftExists;
            }

            await pool.execute('DELETE FROM Employee_Shift WHERE id_shift_his = ?', [id_shift_his]);
            return {
                status: 200
            };
        } catch (error) {
            return {
                status: 500,
                message: `Error al eliminar el turno: ${error.message}`
            };
        }
    }

    async deleteAllShifts() {
        try {
            await pool.execute('DELETE FROM Employee_Shift');
            return {
                status: 200
            };
        } catch (error) {
            return {
                status: 500,
                message: `Error al eliminar todos los turnos: ${error.message}`
            };
        }
    }

    async getShiftsByEmployee(number_document) {
        try {
            const [shifts] = await pool.execute(`
                SELECT * FROM Employee_Shift 
                WHERE number_document = ? 
                ORDER BY shift_date DESC
            `, [number_document]);
            
            if (shifts.length === 0) {
                return {
                    status: 404,
                    data: []
                };
            }

            const formattedShifts = shifts.map(shift => new Shift(
                shift.id_shift_his, 
                shift.turn, 
                shift.number_document, 
                shift.shift_date, 
                shift.break
            ));

            return {
                status: 200,
                data: formattedShifts
            };
        } catch (error) {
            return {
                status: 500,
                message: `Error al obtener los turnos del empleado: ${error.message}`
            };
        }
    }

    async generateWeeksPerMonth(date) {
        const inputDate = moment(date, 'YYYY-MM-DD');
        if (!inputDate.isValid()) {
            throw new Error('Invalid date format. Please use YYYY-MM-DD.');
        }
    
        const startOfMonth = inputDate.clone().startOf('month');
        let firstMonday = startOfMonth.clone().startOf('isoWeek');
    
        // Si el primer lunes es del mes anterior, avanzar 7 días
        if (firstMonday.isBefore(startOfMonth)) {
            firstMonday.add(7, 'days');
        }
    
        const weeks = [];
        let currentMonday = firstMonday.clone();
    
        while (currentMonday.month() === startOfMonth.month()) {
            const weekEnd = currentMonday.clone().endOf('isoWeek');
    
            weeks.push({
                start: currentMonday.format('YYYY-MM-DD'),
                end: weekEnd.format('YYYY-MM-DD'),
            });
    
            currentMonday = currentMonday.clone().add(7, 'days');
        }
    
        return {
            weeks,
            totalWeeks: weeks.length,
            startDate: weeks[0].start,
            endDate: weeks[weeks.length - 1].end
        };
    }
    

    async getShiftsByDateRange(startDate, endDate) {
        try {
            const [shifts] = await pool.execute(`
                SELECT s.*, e.full_name 
                FROM Employee_Shift s
                JOIN Employees e ON s.number_document = e.number_document
                WHERE shift_date BETWEEN ? AND ?
                ORDER BY shift_date
            `, [startDate, endDate]);
            
            if (shifts.length === 0) {
                return {
                    status: 404,
                    data: []
                };
            }

            const formattedShifts = shifts.map(shift => new Shift(
                shift.id_shift_his, 
                shift.turn, 
                shift.number_document, 
                shift.shift_date, 
                shift.break
            ));

            return {
                status: 200,
                data: formattedShifts
            };
        } catch (error) {
            return {
                status: 500,
                message: `Error al obtener los turnos por rango de fecha: ${error.message}`
            };
        }
    }

    async getAllEmployeeShifts(store = null, department = null, report = false) {
        try {
            let conditions = [];
            let params = [];
    
            if (store) {
                conditions.push("st.id_store = ?");
                params.push(store);
            }
            if (department) {
                conditions.push("ds.id_department = ?");
                params.push(department);
            }
    
            const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
    
            const query = `
                SELECT es.id_shift_his, ed.working_day, es.number_document, es.turn, es.shift_date, es.break,
                       s.hours, s.initial_hour,
                       e.full_name AS employee_name, e.num_doc_manager, 
                       m.full_name AS manager_name,
                       st.name_store,
                       d.name_department
                FROM Employee_Shift es
                JOIN Employees e ON es.number_document = e.number_document
                JOIN Shifts s ON es.turn = s.code_shift
                LEFT JOIN Employees m ON e.num_doc_manager = m.number_document
                LEFT JOIN Employees_Department ed ON e.number_document = ed.number_document
                LEFT JOIN Department_Store ds ON ed.id_store_dep = ds.id_store_dep
                LEFT JOIN Stores st ON ds.id_store = st.id_store
                LEFT JOIN Departments d ON ds.id_department = d.id_department
                ${whereClause}
            `;
    
            const [shifts] = await pool.execute(query, params);
    
            if (shifts.length === 0) {
                return { status: 404, data: [] };
            }
    
            const isSpecialDay = (codigoTurno) => this.listSpecialDays.includes(codigoTurno);
            const getFinalHours = (shift, specialDay, hours) => (shift.working_day === 36 && specialDay && hours != 0) ? 6 : shift.hours;
    
            const formattedShifts = shifts.map(shift => {
                const codigoTurno = shift.turn;
                const specialDay = isSpecialDay(codigoTurno);
                const finalHours = getFinalHours(shift, specialDay, shift.hours);
                const turno = (specialDay && report) ? codigoTurno : `${finalHours}H ${shift.initial_hour.slice(0, 5)}`;
                
                return {
                    codigo_persona: shift.number_document,
                    nombre: shift.employee_name,
                    jornada: shift.working_day,
                    codigo_turno: report? (specialDay ? 'DES' : codigoTurno) : codigoTurno,
                    inicio_turno: shift.shift_date.toISOString().split('T')[0],
                    termino_turno: shift.shift_date.toISOString().split('T')[0],
                    horas: finalHours,
                    turno,
                    cedula_jefe: shift.num_doc_manager,
                    nombre_jefe: shift.manager_name,
                    tienda: shift.name_store,
                    departamento: shift.name_department
                };
            });
    
            return { status: 200, data: formattedShifts };
    
        } catch (error) {
            console.error("Error al obtener los turnos:", error);
            return { status: 500, message: `Error al obtener los turnos: ${error.message}` };
        }
    }

    async getShiftsByEmployeeList(employees, startDate, endDate, numWeeks) {
        try {
            // Validación básica de entrada
            if (!employees || !Array.isArray(employees) || employees.length === 0) {
                return {
                    status: 400,
                    message: 'La lista de cédulas de empleados es requerida'
                };
            }
    
            if (!startDate || !endDate) {
                return {
                    status: 400,
                    message: 'Las fechas de inicio y fin son requeridas'
                };
            }
    
            // Formatear fechas y preparar lista de empleados
            const formattedStartDate = moment(startDate).format('YYYY-MM-DD');
            const formattedEndDate = moment(endDate).format('YYYY-MM-DD');
            const employeeIds = employees.join(',');
            
            // Obtener información básica de los empleados - Corregida la consulta SQL
            const [employeeInfo] = await pool.execute(`
                SELECT e.number_document, e.full_name, p.name_position,
                      (SELECT ed.working_day FROM Employees_Department ed 
                       WHERE ed.number_document = e.number_document 
                       ORDER BY ed.contract_date DESC, ed.id_employee_dep DESC LIMIT 1) AS latest_working_day
                FROM Employees e
                JOIN Employees_Department ed ON e.number_document = ed.number_document
                JOIN positions p ON ed.id_position = p.id_position
                WHERE e.number_document IN (${employeeIds})
                GROUP BY e.number_document, e.full_name, p.name_position
            `);
            
            if (employeeInfo.length === 0) {
                return {
                    status: 404,
                    message: 'No se encontraron los empleados especificados',
                    data: []
                };
            }
            
            // Crear estructura para almacenar datos de empleados
            const employeeData = {};
            
            // Inicializar estructura para todos los empleados
            employeeInfo.forEach(emp => {
                employeeData[emp.number_document] = {
                    employee: {
                        name: emp.full_name,
                        number_document: emp.number_document,
                        working_day: emp.latest_working_day, // Usamos la jornada más reciente
                        position: emp.name_position
                    },
                    weeklyShifts: []
                };
            });
            
            // Obtener turnos para los empleados en el rango de fechas
            const [shifts] = await pool.execute(`
                SELECT es.number_document, es.turn, es.shift_date, es.break,
                       s.hours, s.initial_hour, s.end_hour
                FROM Employee_Shift es
                JOIN Shifts s ON es.turn = s.code_shift
                WHERE es.number_document IN (${employeeIds})
                AND es.shift_date BETWEEN ? AND ?
                ORDER BY es.number_document, es.shift_date
            `, [formattedStartDate, formattedEndDate]);
            
            // Obtener las jornadas semanales para cada empleado
            // Necesitamos las fechas de inicio de cada semana (lunes)
            const weekStartDates = [];
            let currentWeekStart = moment(startDate).startOf('isoWeek');
            
            for (let i = 0; i < numWeeks; i++) {
                weekStartDates.push(currentWeekStart.format('YYYY-MM-DD'));
                currentWeekStart.add(7, 'days');
            }
            
            // Obtener TODAS las jornadas laborales para cada empleado
            const [weeklyWorkingDays] = await pool.execute(`
                SELECT ed.number_document, ed.working_day, ed.contract_date
                FROM Employees_Department ed
                WHERE ed.number_document IN (${employeeIds})
                ORDER BY ed.number_document, ed.contract_date
            `);
            
            // Organizar los turnos por empleado y semana
            const shiftsByEmployee = {};
            
            shifts.forEach(shift => {
                const employeeId = shift.number_document;
                const shiftDate = moment(shift.shift_date).format('YYYY-MM-DD');
                
                if (!shiftsByEmployee[employeeId]) {
                    shiftsByEmployee[employeeId] = {};
                }
                
                // Determinar a qué semana pertenece este turno
                const weekIndex = weekStartDates.findIndex((weekStart, index) => {
                    const nextWeekStart = index < weekStartDates.length - 1 
                        ? weekStartDates[index + 1] 
                        : moment(weekStartDates[index]).add(7, 'days').format('YYYY-MM-DD');
                    
                    return shiftDate >= weekStart && shiftDate < nextWeekStart;
                });
                
                if (weekIndex === -1) return; // Ignorar turnos fuera del rango de semanas
                
                const weekNumber = weekIndex + 1;
                
                // Inicializar la estructura de la semana si no existe
                if (!shiftsByEmployee[employeeId][weekNumber]) {
                    shiftsByEmployee[employeeId][weekNumber] = {
                        shifts: []
                    };
                }
                
                // Determinar las horas correctas según las reglas de jornada especial
                const isSpecialDay = this.listSpecialDays && this.listSpecialDays.includes(shift.turn);
                const currentEmployeeWorkingDay = employeeData[employeeId]?.employee?.working_day;
                const finalHours = (currentEmployeeWorkingDay === 36 && 
                                    isSpecialDay && 
                                    shift.hours != 0) ? 6 : shift.hours;
                
                // Añadir el turno a la semana correspondiente
                shiftsByEmployee[employeeId][weekNumber].shifts.push({
                    shift_date: shiftDate,
                    turn: shift.turn,
                    hours: finalHours,
                    break: shift.break,
                    initial_hour: shift.initial_hour,
                    end_hour: shift.end_hour
                });
            });
            
            // Agrupar las jornadas por empleado para un acceso más fácil
            const workingDaysByEmployee = {};
            weeklyWorkingDays.forEach(wd => {
                const employeeId = wd.number_document.toString();
                if (!workingDaysByEmployee[employeeId]) {
                    workingDaysByEmployee[employeeId] = [];
                }
                workingDaysByEmployee[employeeId].push({
                    working_day: wd.working_day,
                    contract_date: moment(wd.contract_date).format('YYYY-MM-DD')
                });
            });
            
            // Construir la estructura de respuesta final
            Object.keys(employeeData).forEach(employeeId => {
                // Obtener las jornadas para este empleado
                const workingDaysForEmployee = workingDaysByEmployee[employeeId] || [];
                
                // Para cada semana, añadir los turnos correspondientes
                for (let weekNum = 1; weekNum <= numWeeks; weekNum++) {
                    const weekStartDate = weekStartDates[weekNum - 1];
                    
                    // Encontrar la jornada válida para esta semana
                    // Buscamos la jornada cuya fecha de contrato sea la más reciente
                    // pero que no sea posterior al inicio de la semana
                    let applicableWorkingDay = null;
                    let maxDate = null;
                    
                    for (const wd of workingDaysForEmployee) {
                        const contractDate = wd.contract_date;
                        // Solo consideramos fechas que no sean posteriores al inicio de la semana
                        if (contractDate <= weekStartDate) {
                            // Si no tenemos una fecha aún, o si esta es más reciente que la actual
                            if (maxDate === null || contractDate > maxDate) {
                                maxDate = contractDate;
                                applicableWorkingDay = wd;
                            }
                        }
                    }
                    
                    // Si no encontramos una jornada aplicable, usamos la jornada por defecto
                    const workingDayForWeek = applicableWorkingDay ? 
                        applicableWorkingDay.working_day : 
                        employeeData[employeeId]?.employee?.working_day;
                    
                    const weeklyShift = {
                        week: weekNum,
                        working_day: workingDayForWeek,
                        week_start_date: weekStartDate,
                        shifts: shiftsByEmployee[employeeId] && 
                                shiftsByEmployee[employeeId][weekNum] ? 
                                shiftsByEmployee[employeeId][weekNum].shifts : []
                    };
                    
                    employeeData[employeeId].weeklyShifts.push(weeklyShift);
                }
            });
            
            return {
                employeeShifts: Object.values(employeeData)
            };
            
        } catch (error) {
            console.error("Error al obtener los turnos por lista de empleados:", error);
            return {
                status: 500,
                message: `Error al obtener los turnos: ${error.message}`
            };
        }
    }
     
}

module.exports = new EmployeeShiftController();