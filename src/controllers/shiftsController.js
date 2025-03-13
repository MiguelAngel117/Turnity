const pool = require('../connect/connection');
const Shift = require('../models/shifts');

class ShiftController {
    // Obtener todos los turnos
    async getAllShifts() {
        const [shifts] = await pool.execute('SELECT * FROM Shifts');
        return shifts.map(shift => new Shift(shift.code_shift, shift.hours, shift.initial_hour, shift.end_hour));
    }

    // Obtener turno por código
    async getShiftByCode(code_shift) {
        const [shifts] = await pool.execute('SELECT * FROM Shifts WHERE code_shift = ?', [code_shift]);
        if (shifts.length === 0) return null;
        
        const shift = shifts[0];
        return new Shift(shift.code_shift, shift.hours, shift.initial_hour, shift.end_hour);
    }

    // Crear nuevo turno
    async createShift(shiftData) {
        const shift = new Shift(shiftData.code_shift, shiftData.hours, shiftData.initial_hour);

        const validationErrors = shift.validate();
        if (validationErrors) {
            throw new Error(validationErrors.join(', '));
        }

        await pool.execute(
            'INSERT INTO Shifts (code_shift, hours, initial_hour, end_hour) VALUES (?, ?, ?, ?)',
            [shift.code_shift, shift.hours, shift.initial_hour, shift.end_hour]
        );

        return shift;
    }

    // Crear múltiples turnos
    async createMultipleShifts(shiftsData) {
        const createdShifts = [];
        const errors = [];

        for (const shiftData of shiftsData) {
            const shift = new Shift(shiftData.code_shift, shiftData.hours, shiftData.initial_hour, shiftData.end_hour);

            const validationErrors = shift.validate();
            if (validationErrors) {
                errors.push({ shift: shiftData, errors: validationErrors });
                continue;
            }

            await pool.execute(
                'INSERT INTO Shifts (code_shift, hours, initial_hour, end_hour) VALUES (?, ?, ?, ?)',
                [shift.code_shift, shift.hours, shift.initial_hour, shift.end_hour]
            );
            createdShifts.push(shift);
        }

        return { createdShifts, errors };
    }

    // Actualizar turno
    async updateShift(code_shift, shiftData) {
        await pool.execute(
            'UPDATE Shifts SET hours = ?, initial_hour = ?, end_hour = ? WHERE code_shift = ?',
            [shiftData.hours, shiftData.initial_hour, shiftData.end_hour, code_shift]
        );

        return this.getShiftByCode(code_shift);
    }

    async getShiftsByHours(hours) {
        const [shifts] = await pool.execute(
            'SELECT * FROM Shifts WHERE hours = ? AND initial_hour != "00:00" ORDER BY initial_hour ASC',
            [hours]
        );
    
        return shifts.map(shift => new Shift(shift.code_shift, shift.hours, shift.initial_hour, shift.end_hour));
    }

    // Eliminar turno
    async deleteShift(code_shift) {
        await pool.execute('DELETE FROM Shifts WHERE code_shift = ?', [code_shift]);
        return true;
    }

    // Eliminar turno
    async deleteAllShifts(code_shift) {
        await pool.execute('DELETE FROM Shifts');
        return true;
    }

    async getFilteredShifts() {
        // Definir los códigos de turnos especiales que siempre se deben incluir
        const specialShifts = [
            "4","5","6","7","8","9","10", "CUMPLEAÑOS", "VACACIONES", "INCAPACIDAD", 
            "JURADO VOT", "DIA_FAMILIA", "LICENCIA", "DIA_DISFRUTE"
        ];
        return specialShifts;
    }

    /**
     * Genera los tiempos de descanso para un turno basado en su código.
     * @param {string} codeShift - Código del turno.
     * @returns {Object} - Objeto con el turno, los descansos y las posibles horas de salida.
     */
    async getShiftBreaks(code_shift) {
        const shift = await this.getShiftByCode(code_shift);
        if (!shift) {
            throw new Error("Turno no encontrado");
        }
        
        const { hours, initial_hour } = shift;
        const initialTime = this.parseTime(initial_hour);
        const hoursDef = hours >= 8 ? (hours +1): hours;
        const midPoint = initialTime + (hoursDef / 2) * 60; // Hora central del descanso en minutos
        const breakDuration = hours >= 8 ? 60 : 15;
        const breakTimes = this.generateBreakSlots(midPoint, breakDuration, hours);
        
        return breakTimes.map(slot => this.formatTime(slot[0]) + ' - ' + this.formatTime(slot[1]));
    }
    
    generateBreakSlots(midBreak, duration, hours) {
        if (hours >= 8) {
            return [
                [midBreak - duration, midBreak],
                [midBreak - duration / 2, midBreak + duration / 2],
                [midBreak, midBreak + duration],
                [midBreak + duration / 2, midBreak + duration * 1.5],
                [midBreak + duration, midBreak + duration * 2]
            ];
        } else {
            return [
                [midBreak - duration, midBreak],
                [midBreak, midBreak + duration],
                [midBreak + duration, midBreak + duration * 2],
                [midBreak + duration * 2, midBreak + duration * 3],
                [midBreak + duration * 3, midBreak + duration * 4]
            ];
        }
    }
    
    parseTime(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }
    
    formatTime(minutes) {
        const h = Math.floor(minutes / 60).toString().padStart(2, '0');
        const m = (minutes % 60).toString().padStart(2, '0');
        return `${h}:${m}`;
    }
}

module.exports = new ShiftController();
