class EmployeeShift {
    constructor(turn, number_document, shift_date, break_time) {
        this.turn = turn;
        this.number_document = number_document;
        this.shift_date = shift_date;
        this.break_time = break_time;
    }

    validate() {
        const errors = [];

        if (!this.turn) {
            errors.push('El codigo del Turno es obligatorio');
        }

        if (!this.number_document) {
            errors.push('El número de documento del empleado es obligatorio');
        }

        if (!this.shift_date) {
            errors.push('La fecha del turno es obligatoria');
        }

        if (!this.break_time) {
            errors.push('El tiempo de descanso es obligatorio');
        }

        return errors.length === 0 ? null : errors;
    }
}

module.exports = EmployeeShift;