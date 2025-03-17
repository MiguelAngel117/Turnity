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
        console.log(employeeShifts[0].weeklyShifts[0].shifts);
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
            console.log(validatedShifts);
            const results = {
                created: 0,
                updated: 0,
                skipped: 0
            };
            
            // Variable para almacenar errores de procesamiento
            const processingErrors = [];
            
            if (!validatedShifts.success) {
                return {
                    status: 409,
                    results: results,
                    errors: validatedShifts.errors
                };
            }
    
            // Usar un conjunto para rastrear combinaciones únicas de empleado+fecha ya procesadas
            const processedShifts = new Set();
    
            for (const shiftData of validatedShifts.data) {
                for (const shift of shiftData.shifts) {
                    // Crear una clave única para esta combinación de empleado y fecha
                    const uniqueKey = `${shiftData.employeeId}_${shift.shift_date}`;
                    
                    // Si ya procesamos este empleado+fecha, saltar al siguiente turno
                    if (processedShifts.has(uniqueKey)) {
                        console.log(`Turno duplicado detectado y omitido: ${uniqueKey}`);
                        continue;
                    }
                    
                    // Marcar esta combinación como procesada
                    processedShifts.add(uniqueKey);
                    
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
                        `SELECT turn, break FROM Employee_Shift 
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
                        try {
                            // Insertar nuevo turno con manejo de errores para duplicados
                            await pool.execute(
                                `INSERT INTO Employee_Shift (number_document, shift_date, turn, break)
                                 VALUES (?, ?, ?, ?)`,
                                [
                                    shiftData.employeeId,
                                    shift.shift_date,
                                    shiftValidation.data,
                                    breakValue
                                ]
                            );
                            results.created++;
                        } catch (insertError) {
                            // Si hay un error de clave duplicada, intentar actualizar en su lugar
                            if (insertError.code === 'ER_DUP_ENTRY') {
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
                                // Otro tipo de error, agregar a errores de procesamiento
                                processingErrors.push({
                                    id_employee: shiftData.employeeId,
                                    message: `Error al insertar turno: ${insertError.message}`,
                                    type: 'error'
                                });
                            }
                        }
                    }
                }
            }
            
            return {
                status: processingErrors.length > 0 ? 207 : 201, // 207 Multi-Status si hay errores parciales
                data: validatedShifts.data,
                results: results,
                errors: processingErrors.length > 0 ? processingErrors : undefined,
                message: `Turnos procesados correctamente: ${results.created} creados, ${results.updated} actualizados, ${results.skipped} sin cambios${processingErrors.length > 0 ? `, ${processingErrors.length} errores` : ''}`
            };
        } catch (error) {
            console.error('Error al procesar turnos:', error);
            return {
                status: 500,
                message: 'Error al validar o almacenar los turnos: ' + error.message
            };
        }
    }

    async getShiftById(number_document, shift_date) {
        try {
            const [shifts] = await pool.execute(`
                SELECT es.*, e.full_name, s.hours, s.initial_hour
                FROM Employee_Shift es
                JOIN Employees e ON es.number_document = e.number_document
                JOIN Shifts s ON es.turn = s.code_shift
                WHERE es.number_document = ? AND es.shift_date = ?
            `, [number_document, shift_date]);
            
            if (shifts.length === 0) {
                return {
                    status: 404,
                    message: `No se encontró el turno con ID ${number_document} y fecha ${shift_date}`
                };
            }
            
            const shift = shifts[0];
            const shiftData = new EmployeeShift({
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
    
    async deleteShift(number_document, shift_date) {
        try {
            const shiftExists = await this.getShiftById(number_document, shift_date);
            if (shiftExists.status === 404) {
                return shiftExists;
            }

            await pool.execute('DELETE FROM Employee_Shift WHERE number_document = ? AND shift_date = ?', [number_document, shift_date]);
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

    async getAllEmployeeShifts(month) {
        const currentDate = moment().format('YYYY-') + month + '-15';
        const {startDate, endDate, totalWeeks} = await this.generateWeeksPerMonth(currentDate);
        try {
            // Validación básica de entrada
            if (!startDate || !endDate) {
                return {
                    status: 400,
                    message: 'Las fechas de inicio y fin son requeridas'
                };
            }
    
            // Formatear fechas
            const formattedStartDate = moment(startDate).format('YYYY-MM-DD');
            const formattedEndDate = moment(endDate).format('YYYY-MM-DD');
            
            // Obtener todas las cédulas de empleados que tienen turnos en el rango de fechas
            const [employeesWithShifts] = await pool.execute(`
                SELECT DISTINCT es.number_document
                FROM Employee_Shift es
                WHERE es.shift_date BETWEEN ? AND ?
            `, [formattedStartDate, formattedEndDate]);
            
            if (employeesWithShifts.length === 0) {
                return {
                    status: 404,
                    message: 'No se encontraron turnos para el rango de fechas especificado',
                    data: []
                };
            }
            
            // Extraer la lista de cédulas
            const employeeIds = employeesWithShifts.map(emp => emp.number_document).join(',');
            
            // Obtener información detallada de los empleados
            const [employeeInfo] = await pool.execute(`
                SELECT e.number_document, e.full_name, p.name_position,
                        ds.id_department, d.name_department,
                        st.name_store,
                        (SELECT e2.number_document FROM Employees e2 
                        WHERE e2.number_document = e.num_doc_manager) AS manager_document,
                        (SELECT e2.full_name FROM Employees e2 
                        WHERE e2.number_document = e.num_doc_manager) AS manager_name
                FROM Employees e
                JOIN Employees_Department ed ON e.number_document = ed.number_document
                JOIN Department_Store ds ON ed.id_store_dep = ds.id_store_dep
                JOIN Departments d ON ds.id_department = d.id_department
                JOIN Stores st ON ds.id_store = st.id_store
                JOIN Positions p ON ed.id_position = p.id_position
                WHERE e.number_document IN (${employeeIds})
                GROUP BY e.number_document, e.full_name, p.name_position, ds.id_department, d.name_department, st.name_store
            `);
            
            // Obtener las jornadas laborales para cada empleado, incluyendo las jornadas semanales
            const [weeklyWorkingDays] = await pool.execute(`
                SELECT ed.number_document, ed.working_day, ed.contract_date, 
                       YEARWEEK(ed.contract_date, 1) as year_week
                FROM Employees_Department ed
                WHERE ed.number_document IN (${employeeIds})
                ORDER BY ed.number_document, ed.contract_date
            `);
            
            // Agrupar las jornadas por empleado y por semana para un acceso más fácil
            const workingDaysByEmployee = {};
            const workingDaysByWeek = {};
            
            weeklyWorkingDays.forEach(wd => {
                const employeeId = wd.number_document.toString();
                const yearWeek = wd.year_week.toString();
                
                // Agrupar por empleado (jornada general)
                if (!workingDaysByEmployee[employeeId]) {
                    workingDaysByEmployee[employeeId] = [];
                }
                workingDaysByEmployee[employeeId].push({
                    working_day: wd.working_day,
                    contract_date: moment(wd.contract_date).format('YYYY-MM-DD'),
                    year_week: yearWeek
                });
                
                // Agrupar por empleado y semana (jornada semanal)
                if (!workingDaysByWeek[employeeId]) {
                    workingDaysByWeek[employeeId] = {};
                }
                if (!workingDaysByWeek[employeeId][yearWeek]) {
                    workingDaysByWeek[employeeId][yearWeek] = [];
                }
                workingDaysByWeek[employeeId][yearWeek].push({
                    working_day: wd.working_day,
                    contract_date: moment(wd.contract_date).format('YYYY-MM-DD')
                });
            });
            
            // Obtener todos los turnos para los empleados en el rango de fechas
            const [shifts] = await pool.execute(`
                SELECT es.number_document, es.turn, es.shift_date, es.break,
                        s.hours, s.initial_hour, s.end_hour,
                        YEARWEEK(es.shift_date, 1) as shift_week
                FROM Employee_Shift es
                JOIN Shifts s ON es.turn = s.code_shift
                WHERE es.shift_date BETWEEN ? AND ?
                ORDER BY es.number_document, es.shift_date
            `, [formattedStartDate, formattedEndDate]);
            
            // Crear diccionario para acceso rápido a la información de los empleados
            const employeeInfoMap = {};
            employeeInfo.forEach(emp => {
                employeeInfoMap[emp.number_document] = emp;
            });
            
            // Crear la lista de turnos con la estructura solicitada
            const formattedShifts = [];
            
            shifts.forEach(shift => {
                const employeeId = shift.number_document;
                const shiftDate = moment(shift.shift_date).format('YYYY-MM-DD');
                const shiftWeek = shift.shift_week.toString();
                const employeeData = employeeInfoMap[employeeId];
                
                if (!employeeData) return; // Si no encontramos datos del empleado, ignoramos este turno
                
                // Primero intentamos encontrar una jornada semanal específica
                let currentEmployeeWorkingDay = null;
                
                // Buscar en las jornadas semanales
                if (workingDaysByWeek[employeeId] && workingDaysByWeek[employeeId][shiftWeek]) {
                    // Ordenar por fecha para obtener la más reciente de esa semana
                    const weeklyJornadas = workingDaysByWeek[employeeId][shiftWeek].sort((a, b) => 
                        moment(b.contract_date).valueOf() - moment(a.contract_date).valueOf()
                    );
                    
                    // Usar la más reciente de esa semana específica
                    if (weeklyJornadas.length > 0) {
                        currentEmployeeWorkingDay = weeklyJornadas[0].working_day;
                    }
                }
                
                // Si no encontramos una jornada semanal, buscar la jornada general más reciente y aplicable
                if (currentEmployeeWorkingDay === null) {
                    const workingDaysForEmployee = workingDaysByEmployee[employeeId] || [];
                    let applicableWorkingDay = null;
                    let maxDate = null;
                    
                    for (const wd of workingDaysForEmployee) {
                        const contractDate = wd.contract_date;
                        // Solo consideramos fechas que no sean posteriores a la fecha del turno
                        if (contractDate <= shiftDate) {
                            // Si no tenemos una fecha aún, o si esta es más reciente que la actual
                            if (maxDate === null || contractDate > maxDate) {
                                maxDate = contractDate;
                                applicableWorkingDay = wd;
                            }
                        }
                    }
                    
                    // Si encontramos una jornada aplicable, usarla
                    if (applicableWorkingDay) {
                        currentEmployeeWorkingDay = applicableWorkingDay.working_day;
                    } else if (workingDaysForEmployee.length > 0) {
                        // Si no, usar la más reciente de todas
                        workingDaysForEmployee.sort((a, b) => 
                            moment(b.contract_date).valueOf() - moment(a.contract_date).valueOf()
                        );
                        currentEmployeeWorkingDay = workingDaysForEmployee[0].working_day;
                    }
                }
                
                // Si aún no tenemos jornada, usar un valor por defecto (puedes ajustar según necesites)
                if (currentEmployeeWorkingDay === null) {
                    currentEmployeeWorkingDay = 36; // Jornada por defecto
                }
                
                // Determinar las horas correctas según las reglas de jornada especial
                const isSpecialDay = this.listSpecialDays && this.listSpecialDays.includes(shift.turn);
                const codeTurn = (isSpecialDay)? "DES": shift.turn;
                const finalHours = (currentEmployeeWorkingDay === 36 && 
                                    isSpecialDay && 
                                    shift.hours != 0) ? 6 : shift.hours;
                
                // Formato del turno (ejemplo: "8H 14:30")
                const formattedTurn = (isSpecialDay)? shift.turn:`${finalHours}H ${shift.initial_hour.slice(0, -3)}`;
                
                // Añadir el turno a la lista de turnos formateados
                formattedShifts.push({
                    codigo_persona: employeeId,
                    nombre: employeeData.full_name,
                    jornada: currentEmployeeWorkingDay,
                    codigo_turno: codeTurn,
                    inicio_turno: moment(shift.shift_date).format('DD/MM/YYYY'),
                    termino_turno: moment(shift.shift_date).format('DD/MM/YYYY'),
                    horas: finalHours,
                    turno: formattedTurn,
                    cedula_jefe: employeeData.manager_document,
                    nombre_jefe: employeeData.manager_name,
                    tienda: employeeData.name_store,
                    departamento: employeeData.name_department,
                    posicion: employeeData.name_position,
                    semana: shiftWeek
                });
            });
            
            // Ordenar los turnos por empleado y fecha
            formattedShifts.sort((a, b) => {
                if (a.codigo_persona !== b.codigo_persona) {
                    return a.codigo_persona - b.codigo_persona;
                }
                return moment(a.inicio_turno, 'DD/MM/YYYY') - moment(b.inicio_turno, 'DD/MM/YYYY');
            });
            
            return {
                status: 200,
                data: formattedShifts
            }
            
        } catch (error) {
            console.error("Error al obtener los turnos de empleados:", error);
            return {
                status: 500,
                message: `Error al obtener los turnos: ${error.message}`,
                data: []
            };
        }
    }
    
    async getShiftsByEmployeeList(employees, month) {
        const currentDate = moment().format('YYYY-') + month + '-15';
        const {startDate, endDate, totalWeeks} = await this.generateWeeksPerMonth(currentDate);
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
            
            for (let i = 0; i < totalWeeks; i++) {
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
                
                // Encontrar la jornada aplicable para esta semana y empleado
                const workingDaysForEmployee = workingDaysByEmployee[employeeId] || [];
                const weekStartDate = weekStartDates[weekIndex];
                
                // Encontrar la jornada válida para este turno específico
                let applicableWorkingDay = null;
                let maxDate = null;
                
                for (const wd of workingDaysForEmployee) {
                    const contractDate = wd.contract_date;
                    // Solo consideramos fechas que no sean posteriores a la fecha del turno
                    if (contractDate <= shiftDate) {
                        // Si no tenemos una fecha aún, o si esta es más reciente que la actual
                        if (maxDate === null || contractDate > maxDate) {
                            maxDate = contractDate;
                            applicableWorkingDay = wd;
                        }
                    }
                }
                
                // Si no encontramos una jornada aplicable, usamos la jornada por defecto
                const currentEmployeeWorkingDay = applicableWorkingDay ? 
                    applicableWorkingDay.working_day : 
                    employeeData[employeeId]?.employee?.working_day;
                
                // Determinar las horas correctas según las reglas de jornada especial
                const isSpecialDay = this.listSpecialDays && this.listSpecialDays.includes(shift.turn);
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
            
            // Agrupar las jornadas por empleado para un acceso más fácil (movido fuera del loop de shifts)
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
                for (let weekNum = 1; weekNum <= totalWeeks; weekNum++) {
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