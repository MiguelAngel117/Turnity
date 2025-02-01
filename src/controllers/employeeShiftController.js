const pool = require('../connect/connection');
const Shift = require('../models/employeeShift');
const ShiftGenerator = require('../helpers/shiftGenerator');
const moment = require('moment');
const EmployeeShift = require('../models/employeeShift');
const generator = new ShiftGenerator();

class EmployeeShiftController {
    async validateOrFindShift(shiftData) {
        try {
            if (shiftData.turn) {
                const [shifts] = await pool.execute(
                    'SELECT * FROM Shifts WHERE code_shift = ? AND hours = ? AND initial_hour = ?',
                    [shiftData.turn, shiftData.hours, shiftData.initial_hour]
                );
                
                if (shifts.length === 0) {
                    return {
                        status: 404,
                        message: `No existe un turno con el código ${shiftData.code_shift} y las horas especificadas`
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
                storeId,
                departmentId,
                positionId,
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

    async updateShift(id_shift_his, shiftData) {
        try {
            const shiftExists = await this.getShiftById(id_shift_his);
            if (shiftExists.status === 404) {
                return shiftExists;
            }

            await pool.execute(
                'UPDATE Employee_Shift SET turn = ?, number_document = ?, shift_date = ?, break = ? WHERE id_shift_his = ?', 
                [
                    shiftData.turn, 
                    shiftData.number_document, 
                    shiftData.shift_date, 
                    shiftData.break_time, 
                    id_shift_his
                ]
            );

            const updatedShift = await this.getShiftById(id_shift_his);
            return {
                status: 200,
                data: updatedShift.data
            };
        } catch (error) {
            return {
                status: 500,
                message: `Error al actualizar el turno: ${error.message}`
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
        const endOfMonth = inputDate.clone().endOf('month');
    
        // Encontrar el primer lunes del mes
        let firstMonday = startOfMonth.clone().startOf('isoWeek');
        // Si el primer lunes está en el mes anterior, avanzamos una semana
        if (firstMonday.isBefore(startOfMonth)) {
            firstMonday.add(7, 'days');
        }
    
        const weeks = [];
        let currentMonday = firstMonday.clone();

        // Iteramos mientras estemos dentro del mes o el lunes pertenezca al mes
        while (currentMonday.month() === startOfMonth.month()) {
            const weekEnd = currentMonday.clone().endOf('isoWeek');
    
            weeks.push({
                start: currentMonday.format('YYYY-MM-DD'),
                end: weekEnd.format('YYYY-MM-DD'),
            });
    
            currentMonday = currentMonday.clone().add(7, 'days');
        }
    
        return weeks;
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

    async getAllEmployeeShifts(store = null, department = null) {
        try {
            let whereClause = "";

            if (store) {
                whereClause += ` WHERE st.id_store = ?`;
                if (department) {
                    whereClause += store ? ` AND ds.id_department = ?` : ` WHERE ds.id_department = ?`;
                }
            }
        
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
    
            const params = [];
            if (store) params.push(store);
            if (department) params.push(department);
    
            const [shifts] = await pool.execute(query, params);
    
            if (shifts.length === 0) {
                return {
                    status: 404,
                    data: []
                };
            }
    
            const formattedShifts = shifts.map(shift => {
                let codigoTurno = shift.turn;    
                return {
                    codigo_persona: shift.number_document,
                    nombre: shift.employee_name,
                    jornada: shift.working_day,
                    codigo_turno: (shift.hours === 0)? 'DES': codigoTurno,
                    inicio_turno: shift.shift_date.toISOString().split('T')[0],
                    termino_turno: shift.shift_date.toISOString().split('T')[0],
                    horas: shift.hours,
                    turno: (shift.hours === 0)? codigoTurno: `${shift.hours}H ${shift.initial_hour.slice(0, 5)}`,
                    cedula_jefe: shift.num_doc_manager,
                    nombre_jefe: shift.manager_name,
                    tienda: shift.name_store,
                    departamento: shift.name_department
                };
            });
    
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
}

module.exports = new EmployeeShiftController();