class Shift {
    constructor(id_shift, hours, number_document, shift_date, break_time, initial_hour) {
        this.id_shift = id_shift;
        this.hours = hours;
        this.number_document = number_document;
        this.shift_date = shift_date;
        this.break_time = break_time;
        this.initial_hour = initial_hour;
    }

    validate() {
        const errors = [];

        if (!this.hours) {
            errors.push('Las horas del turno son obligatorias');
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

        if (!this.initial_hour) {
            errors.push('La hora inicial del turno es obligatoria');
        }

        return errors.length === 0 ? null : errors;
    }
}

module.exports = Shift;