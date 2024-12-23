const pool = require('../connect/connection');
const Shift = require('../models/shifts');
const ShiftGenerator = require('../helpers/shiftGenerator');
const generator = new ShiftGenerator();

class ShiftController {
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

    async generateShiftsForDepartment(params) {
        try {
            return await generator.generateSpecificShifts(params);
        } catch (error) {
            throw new Error(`Error en la generación de turnos: ${error.message}`);
        }
    }

    // Método mejorado para crear turno manual con validaciones
    async createShift(shiftData) {        
        // Validar el turno
        const validationErrors = generator.validateShift(shiftData);
        if (validationErrors.length > 0) {
            throw new Error(validationErrors.join(', '));
        }

        // Validar horas semanales
        const weeklyHoursError = await generator.validateWeeklyHours(
            shiftData.number_document,
            shiftData.shift_date,
            shiftData.hours
        );
        if (weeklyHoursError) {
            throw new Error(weeklyHoursError);
        }

        // Crear el turno si pasa todas las validaciones
        const shift = new Shift(
            null,
            shiftData.hours,
            shiftData.number_document,
            shiftData.shift_date,
            shiftData.break_time,
            shiftData.initial_hour
        );

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

    async generateShiftsForWeek(startDate, endDate) {
        const shiftGenerator = require('../helpers/shiftGenerator');
        await shiftGenerator.generateWeeklyShifts(startDate, endDate);
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