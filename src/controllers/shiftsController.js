const pool = require('../connect/connection');
const Shift = require('../models/shifts');

class ShiftController {
    // Obtener todos los turnos
    async getAllShifts() {
        const [shifts] = await pool.execute('SELECT * FROM Shifts');
        return shifts.map(shift => new Shift(shift.code_shift, shift.hours, shift.initial_hour));
    }

    // Obtener turno por código
    async getShiftByCode(code_shift) {
        const [shifts] = await pool.execute('SELECT * FROM Shifts WHERE code_shift = ?', [code_shift]);

        if (shifts.length === 0) return null;

        const shift = shifts[0];
        return new Shift(shift.code_shift, shift.hours, shift.initial_hour);
    }

    // Crear nuevo turno
    async createShift(shiftData) {
        const shift = new Shift(shiftData.code_shift, shiftData.hours, shiftData.initial_hour);

        const validationErrors = shift.validate();
        if (validationErrors) {
            throw new Error(validationErrors.join(', '));
        }

        await pool.execute(
            'INSERT INTO Shifts (code_shift, hours, initial_hour) VALUES (?, ?, ?)',
            [shift.code_shift, shift.hours, shift.initial_hour]
        );

        return shift;
    }

    // Crear múltiples turnos
    async createMultipleShifts(shiftsData) {
        const createdShifts = [];
        const errors = [];

        for (const shiftData of shiftsData) {
            const shift = new Shift(shiftData.code_shift, shiftData.hours, shiftData.initial_hour);

            const validationErrors = shift.validate();
            if (validationErrors) {
                errors.push({ shift: shiftData, errors: validationErrors });
                continue;
            }

            await pool.execute(
                'INSERT INTO Shifts (code_shift, hours, initial_hour) VALUES (?, ?, ?)',
                [shift.code_shift, shift.hours, shift.initial_hour]
            );
            createdShifts.push(shift);
        }

        return { createdShifts, errors };
    }

    // Actualizar turno
    async updateShift(code_shift, shiftData) {
        await pool.execute(
            'UPDATE Shifts SET hours = ?, initial_hour = ? WHERE code_shift = ?',
            [shiftData.hours, shiftData.initial_hour, code_shift]
        );

        return this.getShiftByCode(code_shift);
    }

    // Eliminar turno
    async deleteShift(code_shift) {
        await pool.execute('DELETE FROM Shifts WHERE code_shift = ?', [code_shift]);
        return true;
    }
}

module.exports = new ShiftController();
