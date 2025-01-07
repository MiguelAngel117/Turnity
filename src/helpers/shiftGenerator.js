class ShiftGenerator {
    constructor() {
        this.WORKING_DAYS = {
            FULL_TIME: 46,
            PART_TIME_36: 36,
            PART_TIME_24: 24,
            PART_TIME_16: 16
        };
    }

    isHoliday(date) {
        // Aquí puedes implementar una lógica para determinar si una fecha es festiva.
        // Por simplicidad, asumo que es una función placeholder que devuelve un booleano.
        return false;
    }

    validateWeeklyHours(weeklyShifts, employee) {
        const validation = {
            isValid: false,
            data: null,
            errors: []
        };

        if (!weeklyShifts || !Array.isArray(weeklyShifts)) {
            validation.errors.push({
                field: 'weeklyShifts',
                message: 'weeklyShifts debe ser un array válido',
                employeeId: employee?.number_document || 'Unknown'
            });
            return validation;
        }

        let totalHours = 0;
        const shiftErrors = [];
        let worksOnSaturday = false;

        weeklyShifts.forEach((shift, index) => {
            if (!shift || typeof shift.hours !== 'number' || !shift.shift_date) {
                shiftErrors.push({
                    field: `shifts[${index}]`,
                    message: 'El turno debe incluir un número de horas válido y una fecha',
                    employeeId: employee?.number_document || 'Unknown'
                });
                return;
            }

            const shiftDay = new Date(shift.shift_date).getDay() + 1;
            const day = shiftDay === 7 ? 0 : shiftDay;
            const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
            console.log("El día es: " + dias[day] + shift.shift_date);
            totalHours += shift.hours;

            if (shiftDay === 6) {
                worksOnSaturday = true;
            }

            if (employee.working_day === this.WORKING_DAYS.PART_TIME_16) {
                //falta validar festivo
                if (shiftDay !== 0 && shiftDay !== 6) {
                    shiftErrors.push({
                        field: `shifts[${index}]`,
                        message: 'Los empleados de jornada de 16 horas solo pueden trabajar sábados, domingos o días festivos',
                        employeeId: employee.number_document
                    });
                }
            }
        });

        if (shiftErrors.length > 0) {
            validation.errors.push(...shiftErrors);
            return validation;
        }

        const requiredHours = employee.working_day;
        if (totalHours !== requiredHours) {
            validation.errors.push({
                field: 'totalHours',
                message: `Las horas totales (${totalHours}) no coinciden con la jornada laboral requerida (${requiredHours} horas)`,
                employeeId: employee.number_document
            });
            return validation;
        }

        if (!worksOnSaturday) {
            validation.errors.push({
                field: 'weeklyShifts',
                message: 'El empleado debe tener al menos un turno asignado el sábado',
                employeeId: employee.number_document
            });
            return validation;
        }

        validation.isValid = true;
        validation.data = {
            totalHours,
            message: "Las horas semanales son correctas"
        };

        return validation;
    }

    async createShifts(storeId, departmentId, positionId, employeeShifts) {
        const response = {
            success: false,
            data: null,
            errors: []
        };

        try {
            if (!employeeShifts || !Array.isArray(employeeShifts)) {
                response.errors.push({
                    field: 'employeeShifts',
                    message: 'employeeShifts debe ser un array válido'
                });
                return response;
            }

            const validatedShifts = [];

            for (const employeeShift of employeeShifts) {
                if (!employeeShift.employee || !employeeShift.weeklyShifts) {
                    response.errors.push({
                        field: 'employeeShift',
                        message: 'Cada elemento debe tener employee y weeklyShifts',
                        employeeId: employeeShift?.employee?.number_document || 'Unknown'
                    });
                    continue;
                }

                const validation = this.validateWeeklyHours(
                    employeeShift.weeklyShifts,
                    employeeShift.employee
                );

                if (!validation.isValid) {
                    response.errors.push(...validation.errors);
                    continue;
                }

                validatedShifts.push({
                    employeeId: employeeShift.employee.number_document,
                    shifts: employeeShift.weeklyShifts,
                    totalHours: validation.data.totalHours
                });
            }

            if (response.errors.length > 0) {
                return response;
            }

            response.success = true;
            response.data = validatedShifts;

            return response;
        } catch (error) {
            response.errors.push({
                field: 'general',
                message: 'Error interno del servidor',
                details: error.message
            });
            return response;
        }
    }
}

module.exports = ShiftGenerator;
