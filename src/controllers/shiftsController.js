const pool = require('../connect/connection');
const Shift = require('../models/shifts');
const ShiftGenerator = require('../helpers/shiftGenerator');
const moment = require('moment');
const generator = new ShiftGenerator();

class ShiftController {    

    async generateShifts(storeId, departmentId, positionId, startDate, numWeeks, employeeShifts) {
        try {
            // Validar que vengan los employeeShifts
            if (!employeeShifts || !Array.isArray(employeeShifts)) {
                throw new Error('employeeShifts debe ser un array válido');
            }
    
            // Validar y generar turnos
            const validatedShifts = await generator.createShifts(
                storeId,
                departmentId,
                positionId,
                numWeeks,
                employeeShifts
            );
    
            // Si hay errores de validación, detener el proceso
            if (!validatedShifts.success) {
                throw new Error(
                    `Errores en la validación de turnos: ${JSON.stringify(validatedShifts.errors)}`
                );
            }
    
            // Guardar los turnos en la base de datos
            for (const shiftData of validatedShifts.data) {
                for (const shift of shiftData.shifts) {
                    await pool.execute(
                        `INSERT INTO Shifts (hours, number_document, shift_date, break, initial_hour) 
                        VALUES (?, ?, ?, ?, ?)`,
                        [
                            shift.hours, // Número de horas trabajadas
                            shiftData.employeeId, // ID del empleado
                            shift.shift_date, // Fecha del turno
                            shift.break || '00:00:00', // Descanso, valor predeterminado si es nulo
                            shift.initial_hour || '00:00:00', // Hora inicial, valor predeterminado si es nulo
                        ]
                    );
                }
            }
    
            // Respuesta de éxito
            return {
                success: true,
                message: 'Turnos validados y almacenados correctamente.',
            };
        } catch (error) {
            console.error('Error en el controlador de generación de turnos:', error);
            return {
                success: false,
                message: 'Error al validar o almacenar los turnos.',
                errors: error.message,
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

    async deleteAllShifts() {
        try {
            const [result] = await pool.execute('DELETE FROM Shifts');
            return result.affectedRows;
        } catch (error) {
            throw new Error(`Error al eliminar los turnos: ${error.message}`);
        }
    }
    
    // Obtener todos los turnos
    async getAllShifts() {
        const [shifts] = await pool.execute(`
            SELECT s.*, e.full_name 
            FROM Shifts s
            JOIN Employees e ON s.number_document = e.number_document
        `);
        
        return shifts.map(shift => new Shift(
            shift.id_shift, 
            shift.hours, 
            shift.number_document, 
            shift.shift_date, 
            shift.break, 
            shift.initial_hour
        ));
    }

    // Obtener turno por ID
    async getShiftById(id_shift) {
        const [shifts] = await pool.execute(`
            SELECT s.*, e.full_name 
            FROM Shifts s
            JOIN Employees e ON s.number_document = e.number_document
            WHERE s.id_shift = ?
        `, [id_shift]);
        
        if (shifts.length === 0) return null;
        
        const shift = shifts[0];
        return new Shift(
            shift.id_shift, 
            shift.hours, 
            shift.number_document, 
            shift.shift_date, 
            shift.break, 
            shift.initial_hour
        );
    }

    // Crear nuevo turno
    async createShift(shiftData) {
        const shift = new Shift(
            shiftData.id_shift,
            shiftData.hours,
            shiftData.number_document,
            shiftData.shift_date,
            shiftData.break_time,
            shiftData.initial_hour
        );

        const validationErrors = shift.validate();
        if (validationErrors) {
            throw new Error(validationErrors.join(', '));
        }

        const [result] = await pool.execute(
            'INSERT INTO Shifts (hours, number_document, shift_date, break, initial_hour) VALUES (?, ?, ?, ?, ?)', 
            [
                shift.hours, 
                shift.number_document, 
                shift.shift_date, 
                shift.break_time, 
                shift.initial_hour
            ]
        );

        shift.id_shift = result.insertId;
        return shift;
    }

    // Actualizar turno
    async updateShift(id_shift, shiftData) {
        await pool.execute(
            'UPDATE Shifts SET hours = ?, number_document = ?, shift_date = ?, break = ?, initial_hour = ? WHERE id_shift = ?', 
            [
                shiftData.hours, 
                shiftData.number_document, 
                shiftData.shift_date, 
                shiftData.break_time, 
                shiftData.initial_hour,
                id_shift
            ]
        );

        return this.getShiftById(id_shift);
    }

    // Eliminar turno
    async deleteShift(id_shift) {
        await pool.execute('DELETE FROM Shifts WHERE id_shift = ?', [id_shift]);
        return true;
    }

    // Obtener turnos por empleado
    async getShiftsByEmployee(number_document) {
        const [shifts] = await pool.execute(`
            SELECT * FROM Shifts 
            WHERE number_document = ? 
            ORDER BY shift_date DESC
        `, [number_document]);
        
        return shifts.map(shift => new Shift(
            shift.id_shift, 
            shift.hours, 
            shift.number_document, 
            shift.shift_date, 
            shift.break, 
            shift.initial_hour
        ));
    }

    // Obtener turnos por rango de fechas
    async getShiftsByDateRange(startDate, endDate) {
        const [shifts] = await pool.execute(`
            SELECT s.*, e.full_name 
            FROM Shifts s
            JOIN Employees e ON s.number_document = e.number_document
            WHERE shift_date BETWEEN ? AND ?
            ORDER BY shift_date
        `, [startDate, endDate]);
        
        return shifts.map(shift => new Shift(
            shift.id_shift, 
            shift.hours, 
            shift.number_document, 
            shift.shift_date, 
            shift.break, 
            shift.initial_hour
        ));
    }
}

module.exports = new ShiftController();