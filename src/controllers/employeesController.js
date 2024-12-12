const pool = require('../connect/connection');
const Employee = require('../models/employees');

class EmployeeController {
    // Obtener todos los empleados
    async getAllEmployees() {
        const [employees] = await pool.execute(`
            SELECT 
                e1.number_document, 
                e1.first_names, 
                e1.last_names, 
                e1.working_day,
                e2.first_names as manager_first_names,
                e2.last_names as manager_last_names
            FROM 
                Employees e1
            LEFT JOIN 
                Employees e2 ON e1.num_doc_manager = e2.number_document
        `);
        return employees.map(emp => new Employee(
            emp.number_document, 
            emp.num_doc_manager, 
            emp.first_names, 
            emp.last_names, 
            emp.working_day
        ));
    }

    // Obtener empleado por número de documento
    async getEmployeeByDocument(number_document) {
        const [employees] = await pool.execute(
            `SELECT * FROM Employees WHERE number_document = ?`, 
            [number_document]
        );
        
        if (employees.length === 0) return null;
        
        const emp = employees[0];
        return new Employee(
            emp.number_document, 
            emp.num_doc_manager, 
            emp.first_names, 
            emp.last_names, 
            emp.working_day
        );
    }

    // Crear nuevo empleado
    async createEmployee(employeeData) {
        const employee = new Employee(
            employeeData.number_document,
            employeeData.num_doc_manager,
            employeeData.first_names,
            employeeData.last_names,
            employeeData.working_day
        );

        const validationErrors = employee.validate();
        if (validationErrors) {
            throw new Error(validationErrors.join(', '));
        }

        await pool.execute(
            `INSERT INTO Employees 
            (number_document, num_doc_manager, first_names, last_names, working_day) 
            VALUES (?, ?, ?, ?, ?)`, 
            [
                employee.number_document, 
                employee.num_doc_manager, 
                employee.first_names, 
                employee.last_names, 
                employee.working_day
            ]
        );

        return employee;
    }

    // Actualizar empleado
    async updateEmployee(number_document, employeeData) {
        await pool.execute(
            `UPDATE Employees 
            SET 
                num_doc_manager = ?, 
                first_names = ?, 
                last_names = ?, 
                working_day = ? 
            WHERE number_document = ?`, 
            [
                employeeData.num_doc_manager, 
                employeeData.first_names, 
                employeeData.last_names, 
                employeeData.working_day,
                number_document
            ]
        );

        return this.getEmployeeByDocument(number_document);
    }

    // Eliminar empleado
    async deleteEmployee(number_document) {
        await pool.execute(
            `DELETE FROM Employees WHERE number_document = ?`, 
            [number_document]
        );
        return true;
    }

    // Obtener empleados de un gerente específico
    async getEmployeesByManager(num_doc_manager) {
        const [employees] = await pool.execute(
            `SELECT * FROM Employees WHERE num_doc_manager = ?`, 
            [num_doc_manager]
        );
        
        return employees.map(emp => new Employee(
            emp.number_document, 
            emp.num_doc_manager, 
            emp.first_names, 
            emp.last_names, 
            emp.working_day
        ));
    }
}

module.exports = new EmployeeController();