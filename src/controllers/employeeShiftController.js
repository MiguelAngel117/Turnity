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
    
    async generateShifts(storeId, departmentId, positionId, startDate, numWeeks, employeeShifts) {
        try {
            if (!employeeShifts || !Array.isArray(employeeShifts)) {
                return {
                    status: 400,
                    message: 'employeeShifts debe ser un array válido'
                };
            }
    
            const validatedShifts = await generator.createShifts(
                numWeeks,
                employeeShifts
            );
    
            if (!validatedShifts.success) {
                return {
                    status: 400,
                    message: `Errores en la validación de turnos: ${JSON.stringify(validatedShifts.errors)}`
                };
            }
    
            for (const shiftData of validatedShifts.data) {
                for (const shift of shiftData.shifts) {
                    const shiftValidation = await this.validateOrFindShift(shift);
                    if (shiftValidation.status !== 200) {
                        return shiftValidation;
                    }
                    
                    await pool.execute(
                        `INSERT INTO Employee_Shift (turn, number_document, shift_date, break) 
                        VALUES (?, ?, ?, ?)`,
                        [
                            shiftValidation.data,
                            shiftData.employeeId,
                            shift.shift_date,
                            shift.break || '00:00:00'
                        ]
                    );
                }
            }
    
            return {
                status: 201,
                data: validatedShifts.data
            };
        } catch (error) {
            console.error('Error en el controlador de generación de turnos:', error);
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

    async updateShifts(date, employees) { 
        try {
            // 1. Generamos las semanas del mes a partir de la fecha proporcionada
            const { weeks, totalWeeks, startDate, endDate } = await this.generateWeeksPerMonth(date);
            let employeeShifts = [];
            const numWeeks = weeks.length;
            
            // 2. Iteramos sobre cada empleado y sus turnos a actualizar
            for (const employee of employees) {
                const { employeeId, working_day, updateShifts } = employee;
        
                // 3. Obtenemos los turnos actuales del empleado en el rango de fechas
                const [currentShifts] = await pool.execute(
                    `SELECT es.shift_date, es.turn, es.break, s.hours, s.initial_hour 
                    FROM Employee_Shift es
                    JOIN Shifts s ON es.turn = s.code_shift
                    WHERE es.number_document = ? 
                    AND es.shift_date BETWEEN ? AND ?`,
                    [employeeId, startDate, endDate]
                );
    
                // 4. Creamos una copia de los turnos actuales y actualizamos los turnos correspondientes
                const updatedShifts = [...currentShifts];  // Crea una copia de los turnos actuales
    
                updateShifts.forEach(update => {
                    //Se deben meter de a 7 dias por cada semana no todos los dias
                    const shiftIndex = updatedShifts.findIndex(shift => {
                        // Formateamos ambas fechas para comparar solo año, mes y día
                        const shiftDate = new Date(shift.shift_date).toISOString().split('T')[0]; // 2025-01-06
                        const updateDate = update.shift_date;
                        return shiftDate === updateDate;
                    });
                    if (shiftIndex !== -1) {
                        // Actualizamos el turno existente con los nuevos datos
                        updatedShifts[shiftIndex] = {
                            ...updatedShifts[shiftIndex],
                            turn: update.turn,
                            break: update.break,
                            hours: update.hours,
                            initial_hour: update.initial_hour
                        };
                    } else {
                        // Si no encontramos el turno, agregamos el nuevo turno
                        updatedShifts.push({
                            shift_date: update.shift_date,
                            turn: update.turn,
                            break: update.break,
                            hours: update.hours,
                            initial_hour: update.initial_hour
                        });
                    }
                });
    
                // 5. Formateamos los turnos en la estructura de employeeShifts
                employeeShifts.push({
                    employee: {
                        number_document: employeeId,
                        working_day: working_day
                    },
                    weeklyShifts: weeks.map((week, index) => {
                        // Extraemos los turnos correspondientes a esta semana
                        const startOfWeek = index * 7;
                        const endOfWeek = startOfWeek + 7;
                        const weekShifts = updatedShifts.slice(startOfWeek, endOfWeek);

                        return {
                            week: index + 1,
                            shifts: weekShifts.map(shift => ({
                                shift_date: new Date(shift.shift_date).toISOString().split('T')[0],
                                turn: shift.turn,
                                hours: shift.hours,
                                break: shift.break,
                                initial_hour: shift.initial_hour
                            }))
                        };
                    })
                });
    
                // 6. Validamos los turnos con generator.createShifts
                const validatedShifts = await generator.createShifts(totalWeeks, employeeShifts);
    
                if (!validatedShifts.success) {
                    return { status: 400, message: `Errores en la validación de turnos: ${JSON.stringify(validatedShifts.errors)}`} ;
                }
    
                // 7. Si la validación es correcta, actualizamos solamente los turnos que se han cambiado
                for (const shiftUpdate of updateShifts) {
                    await pool.execute(
                        `UPDATE Employee_Shift
                         SET turn = ?, break = ?
                         WHERE number_document = ? AND shift_date = ?`,
                        [
                            shiftUpdate.turn,
                            shiftUpdate.break,
                            employeeId,
                            shiftUpdate.shift_date
                        ]
                    );
                }
            }
    
            // 8. Retornamos una respuesta exitosa
            return { status: 200, message: "Turnos actualizados correctamente" };
    
        } catch (error) {
            console.error("Error actualizando turnos:", error);
            return { status: 500, message: "Error interno del servidor", error: error.message };
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
                SELECT es.id_shift_his, es.number_document, es.turn, es.shift_date, es.break,
                       s.hours, s.initial_hour,
                       e.full_name AS employee_name, e.num_doc_manager, e.working_day, 
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
     
}

module.exports = new EmployeeShiftController();